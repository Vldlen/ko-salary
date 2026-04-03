import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'edge'

// Temporary endpoint to fetch team report data as JSON
// TODO: Remove after verifying report mockup
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get active periods
  const { data: periods } = await supabase
    .from('periods')
    .select('id, company_id, year, month')
    .eq('status', 'active')

  if (!periods || periods.length === 0) {
    return NextResponse.json({ error: 'No active periods' }, { status: 404 })
  }

  const allPeriodIds = periods.map(p => p.id)
  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const firstPeriod = periods[0]
  const periodLabel = `${monthNames[firstPeriod.month - 1]} ${firstPeriod.year}`

  // Load data
  const [usersRes, dealsRes, meetingsRes, plansRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, role, company_id, position_id, company:companies(id, name), position:positions(name)')
      .eq('is_active', true)
      .in('role', ['manager', 'rop']),
    supabase
      .from('deals')
      .select('user_id, revenue, units, status, product_type, mrr')
      .in('period_id', allPeriodIds),
    supabase
      .from('meetings')
      .select('user_id, new_completed, repeat_completed')
      .in('period_id', allPeriodIds),
    supabase
      .from('individual_plans')
      .select('user_id, revenue_plan, units_plan')
      .in('period_id', allPeriodIds),
  ])

  const users = usersRes.data || []
  const deals = dealsRes.data || []
  const meetings = meetingsRes.data || []
  const plans = plansRes.data || []

  // Group by user
  const dealsByUser = new Map<string, any[]>()
  for (const d of deals) {
    const list = dealsByUser.get(d.user_id) || []
    list.push(d)
    dealsByUser.set(d.user_id, list)
  }

  const meetingsByUser = new Map<string, any[]>()
  for (const m of meetings) {
    const list = meetingsByUser.get(m.user_id) || []
    list.push(m)
    meetingsByUser.set(m.user_id, list)
  }

  const plansByUser = new Map<string, any>()
  for (const p of plans) plansByUser.set(p.user_id, p)

  const members = users.map((u: any) => {
    const userDeals = dealsByUser.get(u.id) || []
    const userMeetings = meetingsByUser.get(u.id) || []
    const plan = plansByUser.get(u.id)
    const companyName = u.company?.name || ''
    const positionName = u.position?.name || ''
    const isBonda = companyName.toUpperCase().includes('БОНД')

    const paid = userDeals.filter((d: any) => d.status === 'paid')

    return {
      name: u.full_name,
      position: positionName,
      company: companyName,
      isBonda,
      revenue_fact: paid.reduce((s: number, d: any) => s + Number(d.revenue || 0), 0),
      revenue_plan: plan?.revenue_plan || 0,
      units_fact: paid.reduce((s: number, d: any) => s + (d.units || 0), 0),
      units_plan: plan?.units_plan || 0,
      meetings_fact: userMeetings.reduce((s: number, m: any) => s + (m.new_completed || 0) + (m.repeat_completed || 0), 0),
      mrr: paid.reduce((s: number, d: any) => s + Number(d.mrr || 0), 0),
      fd_count: userDeals.filter((d: any) => d.product_type === 'findir').length,
      bi_count: userDeals.filter((d: any) => d.product_type === 'bonda_bi').length,
    }
  })

  return NextResponse.json({ period: periodLabel, members })
}
