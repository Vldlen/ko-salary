import { ImageResponse } from '@vercel/og'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

// Secret token to protect the endpoint
function verifyToken(request: NextRequest): boolean {
  const token = request.nextUrl.searchParams.get('token')
  return token === process.env.TELEGRAM_SECRET_TOKEN
}

// Format money
function fmt(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₽'
}

interface TeamMember {
  name: string
  company: string
  revenue_fact: number
  revenue_plan: number
  revenue_forecast: number
  deals_paid: number
  deals_total: number
  meetings_fact: number
  meetings_plan: number
  units_fact: number
  units_plan: number
  fd_count: number
  bi_count: number
  ot_count: number
  isBonda: boolean
}

async function getTeamData(): Promise<{ members: TeamMember[]; period: string }> {
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

  if (!periods || periods.length === 0) return { members: [], period: '' }

  const allPeriodIds = periods.map(p => p.id)
  const periodByCompany = new Map<string, any>()
  for (const p of periods) periodByCompany.set(p.company_id, p)

  // First period for display
  const firstPeriod = periods[0]
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
  const periodLabel = `${monthNames[firstPeriod.month - 1]} ${firstPeriod.year}`

  // Load users, deals, meetings, plans
  const [usersRes, dealsRes, meetingsRes, plansRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, role, company_id, company:companies(id, name)')
      .eq('is_active', true)
      .in('role', ['manager', 'rop']),
    supabase
      .from('deals')
      .select('user_id, revenue, units, status, product_type')
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

  const members: TeamMember[] = users.map((u: any) => {
    const userDeals = dealsByUser.get(u.id) || []
    const userMeetings = meetingsByUser.get(u.id) || []
    const plan = plansByUser.get(u.id)
    const companyName = u.company?.name || ''
    const isBonda = companyName.toUpperCase().includes('БОНД')

    const paid = userDeals.filter((d: any) => d.status === 'paid')
    const unpaid = userDeals.filter((d: any) => d.status !== 'paid' && d.status !== 'cancelled')

    return {
      name: u.full_name,
      company: companyName,
      revenue_fact: paid.reduce((s: number, d: any) => s + Number(d.revenue), 0),
      revenue_plan: plan?.revenue_plan || 0,
      revenue_forecast: unpaid.reduce((s: number, d: any) => s + Number(d.revenue), 0),
      deals_paid: paid.length,
      deals_total: userDeals.length,
      meetings_fact: userMeetings.reduce((s: number, m: any) => s + (m.new_completed || 0) + (m.repeat_completed || 0), 0),
      meetings_plan: 0,
      units_fact: paid.reduce((s: number, d: any) => s + d.units, 0),
      units_plan: plan?.units_plan || 0,
      fd_count: userDeals.filter((d: any) => d.product_type === 'findir').length,
      bi_count: userDeals.filter((d: any) => d.product_type === 'bonda_bi').length,
      ot_count: userDeals.filter((d: any) => d.product_type === 'one_time_service').length,
      isBonda,
    }
  })

  // Sort by revenue %
  members.sort((a, b) => {
    const aPct = a.revenue_plan > 0 ? a.revenue_fact / a.revenue_plan : a.deals_paid / 10
    const bPct = b.revenue_plan > 0 ? b.revenue_fact / b.revenue_plan : b.deals_paid / 10
    return bPct - aPct
  })

  return { members, period: periodLabel }
}

// Return JSON data
export async function GET(request: NextRequest) {
  if (!verifyToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const format = request.nextUrl.searchParams.get('format')

  const { members, period } = await getTeamData()

  // JSON format
  if (format === 'json') {
    const totalFact = members.reduce((s, m) => s + m.revenue_fact, 0)
    const totalPlan = members.reduce((s, m) => s + m.revenue_plan, 0)
    const totalForecast = members.reduce((s, m) => s + m.revenue_forecast, 0)

    return NextResponse.json({
      period,
      total: { fact: totalFact, plan: totalPlan, forecast: totalForecast, pct: totalPlan > 0 ? Math.round(totalFact / totalPlan * 100) : 0 },
      members,
    })
  }

  // Image format (default)
  const totalFact = members.reduce((s, m) => s + m.revenue_fact, 0)
  const totalPlan = members.reduce((s, m) => s + m.revenue_plan, 0)
  const totalForecast = members.reduce((s, m) => s + m.revenue_forecast, 0)
  const totalPct = totalPlan > 0 ? Math.round(totalFact / totalPlan * 100) : 0
  const totalDeals = members.reduce((s, m) => s + m.deals_paid, 0)
  const totalMeetings = members.reduce((s, m) => s + m.meetings_fact, 0)

  const now = new Date()
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`

  return new ImageResponse(
    (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#0f1225',
        padding: '40px',
        fontFamily: 'sans-serif',
        color: 'white',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' }}>П</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '22px', fontWeight: 'bold' }}>Пульс КО</span>
              <span style={{ fontSize: '12px', color: '#60a5fa' }}>{period}</span>
            </div>
          </div>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>{dateStr} {timeStr}</span>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Выручка (факт)</span>
            <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#34d399' }}>{fmt(totalFact)}</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>план: {fmt(totalPlan)} ({totalPct}%)</span>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', color: '#60a5fa' }}>Прогноз</span>
            <span style={{ fontSize: '22px', fontWeight: 'bold' }}>{fmt(totalFact + totalForecast)}</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>неоплач: {fmt(totalForecast)}</span>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Сделки / Встречи</span>
            <span style={{ fontSize: '22px', fontWeight: 'bold' }}>{totalDeals} / {totalMeetings}</span>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{members.length} менеджеров</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px', marginBottom: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Общий прогресс</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: totalPct >= 100 ? '#34d399' : totalPct >= 50 ? '#60a5fa' : '#f97316' }}>{totalPct}%</span>
          </div>
          <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
            <div style={{
              width: `${Math.min(totalPct, 100)}%`,
              height: '100%',
              background: totalPct >= 100 ? 'linear-gradient(90deg, #34d399, #10b981)' : totalPct >= 50 ? 'linear-gradient(90deg, #60a5fa, #3b82f6)' : 'linear-gradient(90deg, #f97316, #ea580c)',
              borderRadius: '5px',
            }} />
          </div>
        </div>

        {/* Team table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          {/* Header row */}
          <div style={{ display: 'flex', padding: '8px 12px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <span style={{ flex: 2 }}>Менеджер</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Выручка</span>
            <span style={{ width: '60px', textAlign: 'center' }}>%</span>
            <span style={{ width: '60px', textAlign: 'center' }}>Сделки</span>
            <span style={{ width: '70px', textAlign: 'center' }}>Встречи</span>
            <span style={{ width: '80px', textAlign: 'right' }}>Прогноз</span>
          </div>

          {members.map((m, i) => {
            const pct = m.revenue_plan > 0 ? Math.round(m.revenue_fact / m.revenue_plan * 100) : 0
            const pctColor = pct >= 100 ? '#34d399' : pct >= 50 ? '#60a5fa' : '#ef4444'
            const bgColor = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'

            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', background: bgColor, borderRadius: '8px', fontSize: '13px' }}>
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: '600', color: 'white' }}>{m.name}</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{m.company}</span>
                </div>
                <span style={{ flex: 1, textAlign: 'right', color: '#34d399', fontWeight: '600' }}>{fmt(m.revenue_fact)}</span>
                <span style={{ width: '60px', textAlign: 'center', color: pctColor, fontWeight: '700', fontSize: '12px' }}>{pct}%</span>
                <span style={{ width: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>{m.deals_paid}</span>
                <span style={{ width: '70px', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>{m.meetings_fact}</span>
                <span style={{ width: '80px', textAlign: 'right', color: '#60a5fa', fontSize: '12px' }}>{fmt(m.revenue_fact + m.revenue_forecast)}</span>
              </div>
            )
          })}
        </div>
      </div>
    ),
    {
      width: 800,
      height: Math.max(600, 280 + members.length * 48),
    }
  )
}
