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

  return data
}

export async function getActivePeriod(supabase: SupabaseClient, companyId: string) {
  const { data } = await supabase
    .from('periods')
    .select('*')
    .eq('company_id', companyId)
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
  const salary = salaryRes.data
  const posData = schemaRes.data?.position as any
  const schemas = Array.isArray(posData) ? posData[0]?.motivation_schemas : posData?.motivation_schemas
  const schema = schemas?.[0]

  // Calculate stats from deals
  const paidDeals = deals.filter((d: any) => d.status === 'paid' || d.status === 'waiting_payment')
  const revenueFact = paidDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0)
  const revenueForecast = deals.reduce((s: number, d: any) => s + Number(d.forecast_revenue || d.revenue), 0)
  const unitsFact = paidDeals.reduce((s: number, d: any) => s + d.units, 0)
  const marginTotal = paidDeals.reduce((s: number, d: any) => s + Number(d.equipment_margin), 0)

  // Meetings stats
  const meetingsFact = meetings.reduce((s: number, m: any) => s + m.new_completed + m.repeat_completed, 0)

  // Plan from motivation schema
  const config = schema?.config || {}
  const revenuePlan = config.revenue_plan || 660000
  const unitsPlan = config.units_plan || 15
  const meetingsPlan = config.meetings_plan || 25

  return {
    deals,
    salary,
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

export async function getTeamProgress(supabase: SupabaseClient, companyId: string, periodId: string) {
  // Get all users in the company
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, role, position:positions(name, motivation_schemas(config))')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .in('role', ['manager', 'rop'])

  if (!users) return []

  // Get deals and meetings for all team members
  const teamData = await Promise.all(users.map(async (user: any) => {
    const [dealsRes, meetingsRes] = await Promise.all([
      supabase
        .from('deals')
        .select('revenue, units, status, equipment_margin, forecast_revenue')
        .eq('user_id', user.id)
        .eq('period_id', periodId),
      supabase
        .from('meetings')
        .select('new_completed, repeat_completed')
        .eq('user_id', user.id)
        .eq('period_id', periodId),
    ])

    const deals = dealsRes.data || []
    const meetings = meetingsRes.data || []
    const config = user.position?.motivation_schemas?.[0]?.config || {}

    const paidDeals = deals.filter((d: any) => d.status === 'paid' || d.status === 'waiting_payment')
    const revenueFact = paidDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0)
    const unitsFact = paidDeals.reduce((s: number, d: any) => s + d.units, 0)
    const meetingsFact = meetings.reduce((s: number, m: any) => s + m.new_completed + m.repeat_completed, 0)

    return {
      id: user.id,
      name: user.full_name,
      position: user.position?.name || '',
      revenue_fact: revenueFact,
      revenue_plan: config.revenue_plan || 0,
      units_fact: unitsFact,
      units_plan: config.units_plan || 0,
      meetings_fact: meetingsFact,
      meetings_plan: config.meetings_plan || 0,
    }
  }))

  return teamData
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
