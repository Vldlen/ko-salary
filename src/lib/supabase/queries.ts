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

export async function getActivePeriod(supabase: SupabaseClient, _companyId?: string) {
  const { data } = await supabase
    .from('periods')
    .select('*')
    .eq('status', 'active')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .single()

  return data
}

// ======== Dashboard ========

export async function getDashboardData(supabase: SupabaseClient, userId: string, periodId: string) {
  const [dealsRes, meetingsRes, salaryRes, schemaRes] = await Promise.all([
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
      .select('position:positions(motivation_schemas(*))')
      .eq('id', userId)
      .single(),
  ])

  const deals = dealsRes.data || []
  const meetings = meetingsRes.data || []
  const salaryResult = salaryRes.data
  const posData = schemaRes.data?.position as any
  const schemas = Array.isArray(posData) ? posData[0]?.motivation_schemas : posData?.motivation_schemas
  const schema = schemas?.[0]

  // Base salary from motivation schema
  const baseSalary = schema?.base_salary || 0
  const config = schema?.config || {}

  // Calculate stats from deals
  const paidDeals = deals.filter((d: any) => d.status === 'paid')
  const revenueFact = paidDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0)
  const revenueForecast = deals.reduce((s: number, d: any) => s + Number(d.forecast_revenue || d.revenue), 0)
  const unitsFact = paidDeals.reduce((s: number, d: any) => s + d.units, 0)
  const marginTotal = paidDeals.reduce((s: number, d: any) => s + Number(d.equipment_margin), 0)

  // Meetings stats
  const meetingsFact = meetings.reduce((s: number, m: any) => s + m.new_completed + m.repeat_completed, 0)

  // Plan from motivation schema
  const revenuePlan = config.revenue_plan || 660000
  const unitsPlan = config.units_plan || 15
  const meetingsPlan = config.meetings_plan || 25

  // Build salary object — use salary_results if exists, otherwise compute from schema
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

  // If salary_results exists but has no base_salary, fill it from schema
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

export async function getTeamProgress(supabase: SupabaseClient, _companyId: string, periodId: string) {
  // Batch: 1 query for users, 1 for all deals, 1 for all meetings = 3 total (was N*2+1)
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, role, company:companies(id, name), position:positions(name, motivation_schemas(config))')
    .eq('is_active', true)
    .in('role', ['manager', 'rop'])

  if (!users || users.length === 0) return []

  const userIds = users.map((u: any) => u.id)

  const [dealsRes, meetingsRes] = await Promise.all([
    supabase
      .from('deals')
      .select('user_id, revenue, units, status, equipment_margin')
      .eq('period_id', periodId)
      .in('user_id', userIds),
    supabase
      .from('meetings')
      .select('user_id, new_completed, repeat_completed, invoiced_sum, paid_sum')
      .eq('period_id', periodId)
      .in('user_id', userIds),
  ])

  const allDeals = dealsRes.data || []
  const allMeetings = meetingsRes.data || []

  // Group by user_id in memory
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

  const teamData = users.map((user: any) => {
    const deals = dealsByUser.get(user.id) || []
    const meetings = meetingsByUser.get(user.id) || []
    const config = user.position?.motivation_schemas?.[0]?.config || {}

    const paidDeals = deals.filter((d: any) => d.status === 'paid')
    const unpaidDeals = deals.filter((d: any) => d.status !== 'paid' && d.status !== 'cancelled')
    const revenueFact = paidDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0)
    const revenueForecast = unpaidDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0)
    const unitsFact = paidDeals.reduce((s: number, d: any) => s + d.units, 0)
    const meetingsFact = meetings.reduce((s: number, m: any) => s + (m.new_completed || 0) + (m.repeat_completed || 0), 0)
    const invoicedSum = meetings.reduce((s: number, m: any) => s + (m.invoiced_sum || 0), 0)
    const paidSum = meetings.reduce((s: number, m: any) => s + (m.paid_sum || 0), 0)

    return {
      id: user.id,
      name: user.full_name,
      position: user.position?.name || '',
      company_id: user.company?.id || '',
      company_name: user.company?.name || '',
      revenue_fact: revenueFact,
      revenue_forecast: revenueForecast,
      revenue_plan: config.revenue_plan || 0,
      units_fact: unitsFact,
      units_plan: config.units_plan || 0,
      meetings_fact: meetingsFact,
      meetings_plan: config.meetings_plan || 0,
      invoiced_sum: invoicedSum,
      paid_sum: paidSum,
    }
  })

  // Sort by revenue plan completion % descending
  teamData.sort((a, b) => {
    const aPct = a.revenue_plan > 0 ? a.revenue_fact / a.revenue_plan : 0
    const bPct = b.revenue_plan > 0 ? b.revenue_fact / b.revenue_plan : 0
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
