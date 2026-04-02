import { SupabaseClient } from '@supabase/supabase-js'

// ======== Current User & Period ========

export async function getCurrentUser(supabase: SupabaseClient) {
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data } = await supabase
    .from('users')
    .select('*, company:companies(*), position:positions(*)')
    .eq('id', authUser.id)
    .single()

  // Блокируем вход для неактивных и уволенных
  if (data && (!data.is_active || data.fired_at)) {
    await supabase.auth.signOut()
    return null
  }

  return data
}

export async function getActivePeriod(supabase: SupabaseClient, companyId?: string) {
  let query = supabase
    .from('periods')
    .select('*')
    .eq('status', 'active')

  if (companyId) {
    query = query.eq('company_id', companyId)
  }

  const { data } = await query
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .single()

  return data
}

// ======== Dashboard ========

// Найти актуальную схему мотивации для даты периода
function findSchemaForPeriod(schemas: any[], year: number, month: number): any {
  if (!schemas || schemas.length === 0) return null
  // Дата начала периода (первый день месяца)
  const periodDate = `${year}-${String(month).padStart(2, '0')}-01`
  // Ищем схему, где valid_from <= periodDate и (valid_to IS NULL или valid_to >= periodDate)
  const matching = schemas.find((s: any) =>
    s.valid_from <= periodDate && (!s.valid_to || s.valid_to >= periodDate)
  )
  // Если не нашли — берём последнюю по valid_from (на случай если даты ещё не настроены)
  return matching || schemas.sort((a: any, b: any) => b.valid_from.localeCompare(a.valid_from))[0]
}

export async function getDashboardData(supabase: SupabaseClient, userId: string, periodId: string) {
  const [dealsRes, meetingsRes, salaryRes, userRes, planRes, periodRes] = await Promise.all([
    supabase
      .from('deals')
      .select('*')
      .eq('user_id', userId)
      .eq('period_id', periodId)
      .order('created_at', { ascending: false }),
    supabase
      .from('meetings')
      .select('*')
      .eq('user_id', userId)
      .eq('period_id', periodId)
      .order('date', { ascending: false }),
    supabase
      .from('salary_results')
      .select('*')
      .eq('user_id', userId)
      .eq('period_id', periodId)
      .single(),
    supabase
      .from('users')
      .select('position_id, position:positions(motivation_schemas(*))')
      .eq('id', userId)
      .single(),
    supabase
      .from('individual_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('period_id', periodId)
      .single(),
    supabase
      .from('periods')
      .select('year, month')
      .eq('id', periodId)
      .single(),
  ])

  const deals = dealsRes.data || []
  const meetings = meetingsRes.data || []
  const salaryResult = salaryRes.data
  const posData = userRes.data?.position as any
  const allSchemas = Array.isArray(posData) ? posData[0]?.motivation_schemas : posData?.motivation_schemas
  const period = periodRes.data
  const individualPlan = planRes.data

  // Выбираем схему по valid_from/valid_to для текущего периода
  const schema = period
    ? findSchemaForPeriod(allSchemas, period.year, period.month)
    : allSchemas?.[0]

  const config = schema?.config || {}
  const baseSalary = schema?.base_salary || 0

  // Calculate stats from deals
  const paidDeals = deals.filter((d: any) => d.status === 'paid')
  const revenueFact = paidDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0)
  const revenueForecast = deals.reduce((s: number, d: any) => s + Number(d.forecast_revenue || d.revenue), 0)
  const unitsFact = paidDeals.reduce((s: number, d: any) => s + d.units, 0)
  const marginTotal = paidDeals.reduce((s: number, d: any) => s + Number(d.equipment_margin), 0)

  // Meetings stats
  const meetingsFact = meetings.reduce((s: number, m: any) => s + m.new_completed + m.repeat_completed, 0)

  // Plans: individual_plans (персональные), meetings_plan из schema (общий для должности)
  const revenuePlan = individualPlan?.revenue_plan || 0
  const unitsPlan = individualPlan?.units_plan || 0
  const meetingsPlan = config.meetings_plan || 0

  // Build salary object
  const salary = salaryResult || {
    base_salary: baseSalary,
    kpi_quality: 0,
    kpi_quantity: 0,
    margin_bonus: 0,
    extra_bonus: 0,
    deduction: 0,
    total: baseSalary,
    forecast_total: baseSalary,
  }

  if (salaryResult && (!salaryResult.base_salary || Number(salaryResult.base_salary) === 0)) {
    salary.base_salary = baseSalary
    salary.total = Number(salary.total || 0) + baseSalary
    salary.forecast_total = Number(salary.forecast_total || 0) + baseSalary
  }

  return {
    deals,
    salary,
    schema,
    breakdown: {
      revenue_fact: revenueFact,
      revenue_forecast: revenueForecast,
      revenue_plan: revenuePlan,
      revenue_percent: revenuePlan > 0 ? Math.round((revenueFact / revenuePlan) * 100) : 0,
      revenue_forecast_percent: revenuePlan > 0 ? Math.round((revenueForecast / revenuePlan) * 100) : 0,
      units_fact: unitsFact,
      units_plan: unitsPlan,
      units_percent: unitsPlan > 0 ? Math.round((unitsFact / unitsPlan) * 100) : 0,
      meetings_fact: meetingsFact,
      meetings_plan: meetingsPlan,
      meetings_percent: meetingsPlan > 0 ? Math.round((meetingsFact / meetingsPlan) * 100) : 0,
      margin_total: marginTotal,
    },
    deals_count: deals.length,
    recent_deals: deals.slice(0, 5),
  }
}

// ======== Previous Period Comparison ========

export async function getPreviousPeriodComparison(
  supabase: SupabaseClient,
  userId: string,
  currentPeriod: { year: number; month: number }
) {
  // Find previous month
  const prevMonth = currentPeriod.month === 1 ? 12 : currentPeriod.month - 1
  const prevYear = currentPeriod.month === 1 ? currentPeriod.year - 1 : currentPeriod.year

  // Get previous period
  const { data: prevPeriod } = await supabase
    .from('periods')
    .select('*')
    .eq('year', prevYear)
    .eq('month', prevMonth)
    .limit(1)
    .single()

  if (!prevPeriod) return null

  // Get deals and meetings from previous period
  const [dealsRes, meetingsRes] = await Promise.all([
    supabase.from('deals').select('*').eq('user_id', userId).eq('period_id', prevPeriod.id),
    supabase.from('meetings').select('*').eq('user_id', userId).eq('period_id', prevPeriod.id),
  ])

  const deals = dealsRes.data || []
  const meetings = meetingsRes.data || []
  const paidDeals = deals.filter((d: any) => d.status === 'paid')

  // Считаем показатели на тот же день месяца
  const today = new Date()
  const currentDay = today.getDate()

  // Фильтруем сделки прошлого месяца, созданные до того же дня
  const dealsBeforeDay = deals.filter((d: any) => {
    const created = new Date(d.created_at)
    return created.getDate() <= currentDay
  })
  const paidBeforeDay = dealsBeforeDay.filter((d: any) => d.status === 'paid')

  // Фильтруем встречи прошлого месяца до того же дня
  const meetingsBeforeDay = meetings.filter((m: any) => {
    const day = parseInt(m.date.split('-')[2])
    return day <= currentDay
  })

  return {
    period: prevPeriod,
    revenue_at_same_day: paidBeforeDay.reduce((s: number, d: any) => s + Number(d.revenue), 0),
    revenue_total: paidDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0),
    deals_at_same_day: dealsBeforeDay.length,
    deals_total: deals.length,
    units_at_same_day: paidBeforeDay.reduce((s: number, d: any) => s + d.units, 0),
    meetings_at_same_day: meetingsBeforeDay.reduce((s: number, m: any) => s + m.new_completed + m.repeat_completed, 0),
  }
}

// ======== Deals ========

export async function getDeals(supabase: SupabaseClient, userId: string, periodId: string, status?: string) {
  let query = supabase
    .from('deals')
    .select('*')
    .eq('user_id', userId)
    .eq('period_id', periodId)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data } = await query
  return data || []
}

export async function createDeal(supabase: SupabaseClient, deal: {
  user_id: string
  period_id: string
  client_name: string
  revenue?: number
  mrr?: number
  units?: number
  status?: string
  equipment_margin?: number
  forecast_revenue?: number
  notes?: string
  product_type?: string | null
  subscription_period?: string | null
  amo_link?: string | null
}) {
  const { data, error } = await supabase
    .from('deals')
    .insert(deal)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateDeal(supabase: SupabaseClient, dealId: string, updates: Record<string, any>) {
  const { data, error } = await supabase
    .from('deals')
    .update(updates)
    .eq('id', dealId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ======== Meetings ========

export async function getMeetings(supabase: SupabaseClient, userId: string, periodId: string) {
  const { data } = await supabase
    .from('meetings')
    .select('*')
    .eq('user_id', userId)
    .eq('period_id', periodId)
    .order('date', { ascending: false })

  return data || []
}

export async function upsertMeeting(supabase: SupabaseClient, meeting: {
  user_id: string
  period_id: string
  date: string
  scheduled?: number
  new_completed?: number
  repeat_completed?: number
  mentor?: number
  next_day?: number
  rescheduled?: number
}) {
  const { data, error } = await supabase
    .from('meetings')
    .upsert(meeting, { onConflict: 'user_id,date' })
    .select()
    .single()

  if (error) throw error
  return data
}

// ======== Salary ========

export async function getSalaryResult(supabase: SupabaseClient, userId: string, periodId: string) {
  const { data } = await supabase
    .from('salary_results')
    .select('*')
    .eq('user_id', userId)
    .eq('period_id', periodId)
    .single()

  return data
}

export async function getSalaryHistory(supabase: SupabaseClient, userId: string, limit = 6) {
  const { data } = await supabase
    .from('salary_results')
    .select('*, period:periods(*)')
    .eq('user_id', userId)
    .order('calculated_at', { ascending: false })
    .limit(limit)

  return data || []
}

// ======== Team (for ROP/Director) ========

export async function getTeamProgress(supabase: SupabaseClient, _companyId: string, _periodId: string) {
  // Load all active periods (each company has its own)
  const [usersRes, periodsRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, role, position_id, company_id, company:companies(id, name), position:positions(name, motivation_schemas(*))')
      .eq('is_active', true)
      .in('role', ['manager', 'rop']),
    supabase
      .from('periods')
      .select('*')
      .eq('status', 'active'),
  ])

  const users = usersRes.data
  const allActivePeriods = periodsRes.data || []
  if (!users || users.length === 0) return []

  // Map company_id → active period
  const periodByCompany = new Map<string, any>()
  for (const p of allActivePeriods) {
    periodByCompany.set(p.company_id, p)
  }

  const allPeriodIds = allActivePeriods.map((p: any) => p.id)
  if (allPeriodIds.length === 0) return []

  const userIds = users.map((u: any) => u.id)

  const [dealsRes, meetingsRes, plansRes] = await Promise.all([
    supabase
      .from('deals')
      .select('user_id, client_name, revenue, forecast_revenue, units, status, equipment_margin, product_type, subscription_period, planned_payment_date, notes, mrr, created_at')
      .in('period_id', allPeriodIds)
      .in('user_id', userIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('meetings')
      .select('user_id, date, new_completed, repeat_completed, scheduled, invoiced_sum, paid_sum')
      .in('period_id', allPeriodIds)
      .in('user_id', userIds),
    supabase
      .from('individual_plans')
      .select('*')
      .in('period_id', allPeriodIds)
      .in('user_id', userIds),
  ])

  const allDeals = dealsRes.data || []
  const allMeetings = meetingsRes.data || []
  const allPlans = plansRes.data || []

  // Group by user_id
  const dealsByUser = new Map<string, any[]>()
  for (const d of allDeals) {
    const list = dealsByUser.get(d.user_id) || []
    list.push(d)
    dealsByUser.set(d.user_id, list)
  }

  const meetingsByUser = new Map<string, any[]>()
  for (const m of allMeetings) {
    const list = meetingsByUser.get(m.user_id) || []
    list.push(m)
    meetingsByUser.set(m.user_id, list)
  }

  const plansByUser = new Map<string, any>()
  for (const p of allPlans) {
    plansByUser.set(p.user_id, p)
  }

  const teamData = users.map((user: any) => {
    const deals = dealsByUser.get(user.id) || []
    const meetings = meetingsByUser.get(user.id) || []
    const plan = plansByUser.get(user.id)
    const allSchemas = user.position?.motivation_schemas || []
    const userPeriod = periodByCompany.get(user.company_id)
    const schema = userPeriod
      ? findSchemaForPeriod(allSchemas, userPeriod.year, userPeriod.month)
      : allSchemas[0]
    const config = schema?.config || {}
    const baseSalary = schema?.base_salary || 0

    const paidDeals = deals.filter((d: any) => d.status === 'paid')
    const unpaidDeals = deals.filter((d: any) => d.status !== 'paid' && d.status !== 'cancelled')
    const waitingDeals = deals.filter((d: any) => d.status === 'waiting_payment')
    const noInvoiceDeals = deals.filter((d: any) => d.status === 'no_invoice')
    const cancelledDeals = deals.filter((d: any) => d.status === 'cancelled')

    const revenueFact = paidDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0)
    const revenueForecast = unpaidDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0)
    const revenueWaiting = waitingDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0)
    const unitsFact = paidDeals.reduce((s: number, d: any) => s + d.units, 0)
    const unitsWaiting = waitingDeals.reduce((s: number, d: any) => s + d.units, 0)
    const marginFact = paidDeals.reduce((s: number, d: any) => s + Number(d.equipment_margin || 0), 0)

    const meetingsNew = meetings.reduce((s: number, m: any) => s + (m.new_completed || 0), 0)
    const meetingsRepeat = meetings.reduce((s: number, m: any) => s + (m.repeat_completed || 0), 0)
    const meetingsFact = meetingsNew + meetingsRepeat
    const meetingsScheduled = meetings.reduce((s: number, m: any) => s + (m.scheduled || 0), 0)
    const invoicedSum = meetings.reduce((s: number, m: any) => s + (m.invoiced_sum || 0), 0)
    const paidSum = meetings.reduce((s: number, m: any) => s + (m.paid_sum || 0), 0)

    // БОНДА product counts
    const fdCount = deals.filter((d: any) => d.product_type === 'findir').length
    const biCount = deals.filter((d: any) => d.product_type === 'bonda_bi').length
    const otCount = deals.filter((d: any) => d.product_type === 'one_time_service').length

    // Последние 5 сделок для превью
    const recentDeals = deals.slice(0, 5).map((d: any) => ({
      client_name: d.client_name,
      revenue: Number(d.revenue),
      status: d.status,
      units: d.units,
      product_type: d.product_type,
    }))

    // Unpaid deals for forecast tab
    const forecastDeals = deals
      .filter((d: any) => d.status !== 'paid' && d.status !== 'cancelled')
      .map((d: any) => ({
        client_name: d.client_name,
        revenue: Number(d.revenue),
        mrr: Number(d.mrr || 0),
        units: d.units,
        status: d.status,
        product_type: d.product_type,
        equipment_margin: Number(d.equipment_margin || 0),
        planned_payment_date: d.planned_payment_date,
        notes: d.notes,
      }))

    return {
      id: user.id,
      name: user.full_name,
      position: user.position?.name || '',
      company_id: user.company?.id || '',
      company_name: user.company?.name || '',
      // Выручка
      revenue_fact: revenueFact,
      revenue_forecast: revenueForecast,
      revenue_waiting: revenueWaiting,
      revenue_plan: plan?.revenue_plan || 0,
      // Сделки
      deals_total: deals.length,
      deals_paid: paidDeals.length,
      deals_waiting: waitingDeals.length,
      deals_no_invoice: noInvoiceDeals.length,
      deals_cancelled: cancelledDeals.length,
      recent_deals: recentDeals,
      // Точки
      units_fact: unitsFact,
      units_waiting: unitsWaiting,
      units_plan: plan?.units_plan || 0,
      // Маржа
      margin_fact: marginFact,
      // Встречи
      meetings_fact: meetingsFact,
      meetings_new: meetingsNew,
      meetings_repeat: meetingsRepeat,
      meetings_scheduled: meetingsScheduled,
      meetings_plan: config.meetings_plan || 0,
      // Финансы из встреч
      invoiced_sum: invoicedSum,
      paid_sum: paidSum,
      // Оклад
      base_salary: baseSalary,
      // БОНДА products
      fd_count: fdCount,
      bi_count: biCount,
      ot_count: otCount,
      // Forecast (unpaid deals)
      forecast_deals: forecastDeals,
      revenue_no_invoice: noInvoiceDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0),
    }
  })

  teamData.sort((a, b) => {
    // Sort by revenue % for ИННО, by deals count for БОНДА
    const aPct = a.revenue_plan > 0 ? a.revenue_fact / a.revenue_plan : (a.deals_total / 10)
    const bPct = b.revenue_plan > 0 ? b.revenue_fact / b.revenue_plan : (b.deals_total / 10)
    return bPct - aPct
  })

  return teamData
}

// ======== Forecast ========

export async function getForecastDeals(supabase: SupabaseClient, periodId: string, userId?: string) {
  let query = supabase
    .from('deals')
    .select('*')
    .eq('period_id', periodId)
    .order('created_at', { ascending: false })

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query
  if (error) console.error('getForecastDeals error:', error)
  return data || []
}

// ======== One-time payments ========

export async function getOneTimePayments(supabase: SupabaseClient, userId: string, periodId: string) {
  const { data } = await supabase
    .from('one_time_payments')
    .select('*')
    .eq('user_id', userId)
    .eq('period_id', periodId)
    .order('created_at', { ascending: false })

  return data || []
}

// ======== KPI Entries (БОНДА) ========

export async function getKpiEntries(supabase: SupabaseClient, userId: string, periodId: string) {
  const { data } = await supabase
    .from('kpi_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('period_id', periodId)
    .order('entry_date', { ascending: false })

  return data || []
}

export async function createKpiEntry(supabase: SupabaseClient, entry: {
  user_id: string
  period_id: string
  entry_date: string
  client_name: string
  amo_link?: string
  product?: string
  comment?: string
}) {
  const { data, error } = await supabase
    .from('kpi_entries')
    .insert(entry)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateKpiEntry(supabase: SupabaseClient, entryId: string, updates: Record<string, any>) {
  const { data, error } = await supabase
    .from('kpi_entries')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteKpiEntry(supabase: SupabaseClient, entryId: string) {
  const { error } = await supabase
    .from('kpi_entries')
    .delete()
    .eq('id', entryId)

  if (error) throw error
}

// ======== KPI Approvals (БОНДА) ========

export async function getKpiApprovals(supabase: SupabaseClient, userId: string, periodId: string) {
  const { data } = await supabase
    .from('kpi_approvals')
    .select('*')
    .eq('user_id', userId)
    .eq('period_id', periodId)

  return data || []
}

export async function toggleKpiApproval(supabase: SupabaseClient, userId: string, periodId: string, kpiType: string, approvedBy: string) {
  // Check if exists
  const { data: existing } = await supabase
    .from('kpi_approvals')
    .select('id')
    .eq('user_id', userId)
    .eq('period_id', periodId)
    .eq('kpi_type', kpiType)
    .single()

  if (existing) {
    // Remove approval
    const { error } = await supabase
      .from('kpi_approvals')
      .delete()
      .eq('id', existing.id)
    if (error) throw error
    return null
  } else {
    // Create approval
    const { data, error } = await supabase
      .from('kpi_approvals')
      .insert({
        user_id: userId,
        period_id: periodId,
        kpi_type: kpiType,
        approved_by: approvedBy,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// ======== БОНДА Dashboard ========

export async function getBondaDashboardData(supabase: SupabaseClient, userId: string, periodId: string) {
  const [dealsRes, kpiEntriesRes, kpiApprovalsRes, userRes, planRes, periodRes] = await Promise.all([
    supabase
      .from('deals')
      .select('*')
      .eq('user_id', userId)
      .eq('period_id', periodId)
      .order('created_at', { ascending: false }),
    supabase
      .from('kpi_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('period_id', periodId),
    supabase
      .from('kpi_approvals')
      .select('*')
      .eq('user_id', userId)
      .eq('period_id', periodId),
    supabase
      .from('users')
      .select('position_id, position:positions(name, motivation_schemas(*))')
      .eq('id', userId)
      .single(),
    supabase
      .from('individual_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('period_id', periodId)
      .single(),
    supabase
      .from('periods')
      .select('year, month')
      .eq('id', periodId)
      .single(),
  ])

  const deals = dealsRes.data || []
  const kpiEntries = kpiEntriesRes.data || []
  const kpiApprovals = (kpiApprovalsRes.data || []).map((a: any) => a.kpi_type)
  const posData = userRes.data?.position as any
  const allSchemas = Array.isArray(posData) ? posData[0]?.motivation_schemas : posData?.motivation_schemas
  const period = periodRes.data
  const individualPlan = planRes.data

  const schema = period
    ? findSchemaForPeriod(allSchemas, period.year, period.month)
    : allSchemas?.[0]

  const config = schema?.config || {}
  const baseSalary = schema?.base_salary || 0
  const positionName = (Array.isArray(posData) ? posData[0]?.name : posData?.name) || ''
  const isJunior = positionName.toLowerCase().includes('младш')

  // Import and use bonda calculator
  const { calculateBondaSalary } = await import('@/lib/bonda-calculator')

  const calcResult = calculateBondaSalary({
    deals,
    kpiEntriesCount: kpiEntries.length,
    kpiApprovals,
    baseSalary,
    isJunior,
    kpiMaxAmount: config.kpi_max_amount || 10000,
    kpiEntriesTarget: isJunior ? (config.kpi_entries_target_junior || 5) : (config.kpi_entries_target || 12),
    fdThreshold: config.fd_threshold || 4,
    fdPercentLow: config.fd_percent_low || 0.075,
    fdPercentHigh: config.fd_percent_high || 0.15,
    oneTimeServicePercent: config.one_time_service_percent || 0.10,
    biPercents: config.bi_percents || undefined,
  })

  return {
    deals,
    kpiEntries,
    kpiApprovals,
    salary: calcResult,
    schema,
    isJunior,
    individualPlan,
    findir_plan: individualPlan?.findir_plan || 0,
    units_plan: individualPlan?.units_plan || 0,
  }
}
