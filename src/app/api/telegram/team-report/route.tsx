import { ImageResponse } from '@vercel/og'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

function verifyToken(request: NextRequest): boolean {
  const token = request.nextUrl.searchParams.get('token')
  return token === process.env.TELEGRAM_SECRET_TOKEN
}

// Get current time in Moscow timezone (UTC+3)
function moscowNow(): Date {
  const utc = new Date()
  return new Date(utc.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }))
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(Math.round(n))
}

function pctColor(pct: number): string {
  if (pct >= 90) return '#4ade80'
  if (pct >= 70) return '#60a5fa'
  if (pct >= 50) return '#fbbf24'
  return '#f87171'
}

interface MemberData {
  name: string
  position: string
  company: string
  isBonda: boolean
  revenue_fact: number
  revenue_forecast: number
  revenue_plan: number
  units_fact: number
  units_forecast: number
  units_plan: number
  meetings_fact: number
  mrr: number
  mrr_forecast: number
  fd_count: number
  bi_count: number
}

async function getTeamData(): Promise<{ inno: MemberData[]; bonda: MemberData[]; periodLabel: string }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: periods } = await supabase
    .from('periods')
    .select('id, company_id, year, month')
    .eq('status', 'active')

  if (!periods || periods.length === 0) return { inno: [], bonda: [], periodLabel: '' }

  const allPeriodIds = periods.map(p => p.id)
  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
  const firstPeriod = periods[0]
  const now = moscowNow()
  const dayStr = now.getDate()
  const monShort = monthNames[now.getMonth()].toLowerCase().slice(0, 3)
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const periodLabel = `${monthNames[firstPeriod.month - 1]} ${firstPeriod.year} · ${dayStr} ${monShort}., ${timeStr}`

  const [usersRes, dealsRes, kpiEntriesRes, plansRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, role, company_id, position_id, company:companies(id, name), position:positions(name)')
      .eq('is_active', true)
      .in('role', ['manager', 'rop']),
    supabase
      .from('deals')
      .select('user_id, revenue, impl_revenue, content_revenue, forecast_revenue, units, status, product_type, mrr')
      .in('period_id', allPeriodIds),
    supabase
      .from('kpi_entries')
      .select('user_id')
      .in('period_id', allPeriodIds),
    supabase
      .from('individual_plans')
      .select('user_id, revenue_plan, units_plan')
      .in('period_id', allPeriodIds),
  ])

  const users = usersRes.data || []
  const deals = dealsRes.data || []
  const kpiEntries = kpiEntriesRes.data || []
  const plans = plansRes.data || []

  const dealsByUser = new Map<string, any[]>()
  for (const d of deals) { const l = dealsByUser.get(d.user_id) || []; l.push(d); dealsByUser.set(d.user_id, l) }
  const kpiCountByUser = new Map<string, number>()
  for (const k of kpiEntries) { kpiCountByUser.set(k.user_id, (kpiCountByUser.get(k.user_id) || 0) + 1) }
  const plansByUser = new Map<string, any>()
  for (const p of plans) plansByUser.set(p.user_id, p)

  const members: MemberData[] = users.map((u: any) => {
    const ud = dealsByUser.get(u.id) || []
    const plan = plansByUser.get(u.id)
    const companyName = u.company?.name || ''
    const positionName = u.position?.name || ''
    const isBonda = companyName.toUpperCase().includes('БОНД')
    const paid = ud.filter((d: any) => d.status === 'paid')
    const unpaid = ud.filter((d: any) => d.status !== 'paid' && d.status !== 'cancelled')

    return {
      name: u.full_name, position: positionName, company: companyName, isBonda,
      revenue_fact: paid.reduce((s: number, d: any) => s + Number(d.revenue || 0) + Number(d.impl_revenue || 0) + Number(d.content_revenue || 0), 0),
      revenue_forecast: unpaid.reduce((s: number, d: any) => s + Number(d.revenue || 0) + Number(d.impl_revenue || 0) + Number(d.content_revenue || 0), 0),
      revenue_plan: plan?.revenue_plan || 0,
      units_fact: paid.reduce((s: number, d: any) => s + (d.units || 0), 0),
      units_forecast: unpaid.reduce((s: number, d: any) => s + (d.units || 0), 0),
      units_plan: plan?.units_plan || 0,
      meetings_fact: kpiCountByUser.get(u.id) || 0,
      mrr: paid.reduce((s: number, d: any) => s + Number(d.mrr || 0), 0),
      mrr_forecast: unpaid.reduce((s: number, d: any) => s + Number(d.mrr || 0), 0),
      fd_count: ud.filter((d: any) => d.product_type === 'findir').length,
      bi_count: ud.filter((d: any) => d.product_type === 'bonda_bi').length,
    }
  })

  const inno = members.filter(m => !m.isBonda).sort((a, b) => {
    const ap = a.revenue_plan > 0 ? a.revenue_fact / a.revenue_plan : 0
    const bp = b.revenue_plan > 0 ? b.revenue_fact / b.revenue_plan : 0
    return bp - ap
  })
  const bonda = members.filter(m => m.isBonda).sort((a, b) => b.revenue_fact - a.revenue_fact)

  return { inno, bonda, periodLabel }
}

// Rank badge colors
function rankBg(i: number): string {
  if (i === 0) return 'linear-gradient(135deg, #fbbf24, #f59e0b)'
  if (i === 1) return 'rgba(148,163,184,0.25)'
  if (i === 2) return 'rgba(180,120,80,0.25)'
  return 'rgba(255,255,255,0.06)'
}
function rankColor(i: number): string {
  if (i === 0) return '#1a1a2e'
  if (i === 1) return '#94a3b8'
  if (i === 2) return '#c8956c'
  return 'rgba(255,255,255,0.3)'
}

// Forecast color: lighter/desaturated version with dashed pattern effect
function forecastColor(baseColor: string): string {
  const map: Record<string, string> = {
    '#4ade80': '#2d7a4d',  // green → muted green
    '#60a5fa': '#3b6b9e',  // blue → muted blue
    '#fbbf24': '#8a6d1a',  // yellow → muted gold
    '#f87171': '#8a3d3d',  // red → muted red
    '#a78bfa': '#6b5b9e',  // purple → muted purple
  }
  return map[baseColor] || 'rgba(255,255,255,0.15)'
}

function MetricBar({ factPct, forecastPct, color }: { factPct: number; forecastPct: number; color: string }) {
  const clampedFact = Math.min(100, factPct)
  const clampedForecast = Math.min(100 - clampedFact, forecastPct)
  return (
    <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
      {clampedFact > 0 && (
        <div style={{ height: 12, width: `${clampedFact}%`, background: color, borderRadius: clampedForecast > 0 ? '6px 0 0 6px' : '6px' }} />
      )}
      {clampedForecast > 0 && (
        <div style={{ height: 12, width: `${clampedForecast}%`, background: forecastColor(color), borderRadius: clampedFact > 0 ? '0 6px 6px 0' : '6px', borderLeft: clampedFact > 0 ? '2px solid rgba(0,0,0,0.3)' : 'none' }} />
      )}
    </div>
  )
}

function InnoImage({ members, periodLabel }: { members: MemberData[]; periodLabel: string }) {
  const totalPlan = members.reduce((s, m) => s + m.revenue_plan, 0)
  const totalFact = members.reduce((s, m) => s + m.revenue_fact, 0)
  const totalPct = totalPlan > 0 ? Math.round(totalFact / totalPlan * 100) : 0
  const maxMrr = Math.max(...members.map(m => m.mrr + m.mrr_forecast), 1)

  const now = moscowNow()
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} МСК`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a35 100%)', padding: 56, fontFamily: 'sans-serif', color: 'white' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, paddingBottom: 32, borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36, fontWeight: 700 }}>
            <span style={{ color: '#60a5fa' }}>ИННО</span>
            <span> · Пульс КО</span>
          </div>
          <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>{periodLabel}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 56, fontWeight: 800, color: pctColor(totalPct) }}>{totalPct}%</span>
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 2 }}>план выручки</span>
        </div>
      </div>

      {/* Section title */}
      <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 24, fontWeight: 600 }}>Рейтинг менеджеров</span>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 16, height: 8, borderRadius: 4, background: '#60a5fa' }} />
          <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>факт</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 16, height: 8, borderRadius: 4, background: '#3b6b9e' }} />
          <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>прогноз</span>
        </div>
      </div>

      {/* Managers */}
      {members.map((m, i) => {
        const revPct = m.revenue_plan > 0 ? Math.round(m.revenue_fact / m.revenue_plan * 100) : 0
        const revForecastPct = m.revenue_plan > 0 ? Math.round(m.revenue_forecast / m.revenue_plan * 100) : 0
        const unitsPct = m.units_plan > 0 ? Math.round(m.units_fact / m.units_plan * 100) : 0
        const unitsForecastPct = m.units_plan > 0 ? Math.round(m.units_forecast / m.units_plan * 100) : 0
        const mrrTotal = m.mrr + m.mrr_forecast
        const mrrPctBar = maxMrr > 0 ? Math.round(m.mrr / maxMrr * 100) : 0
        const mrrForecastPctBar = maxMrr > 0 ? Math.round(m.mrr_forecast / maxMrr * 100) : 0

        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', padding: '24px 0', borderBottom: i < members.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            {/* Name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, background: rankBg(i), color: rankColor(i) }}>{i + 1}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 26, fontWeight: 600 }}>{m.name}</span>
                <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>{m.position}</span>
              </div>
              <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)' }}>встреч: <span style={{ color: 'white', fontWeight: 600 }}>{m.meetings_fact}</span></span>
            </div>
            {/* Выручка */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 72, marginBottom: 8 }}>
              <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.35)', width: 124 }}>Выручка</span>
              <MetricBar factPct={revPct} forecastPct={revForecastPct} color={pctColor(revPct)} />
              <span style={{ fontSize: 22, fontWeight: 700, width: 96, textAlign: 'right', color: pctColor(revPct) }}>{revPct}%</span>
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', width: 180, textAlign: 'right' }}>{fmtK(m.revenue_fact)} / {fmtK(m.revenue_plan || 0)}</span>
            </div>
            {/* Лицензии */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 72, marginBottom: 8 }}>
              <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.35)', width: 124 }}>Лицензии</span>
              <MetricBar factPct={unitsPct} forecastPct={unitsForecastPct} color={pctColor(unitsPct)} />
              <span style={{ fontSize: 22, fontWeight: 700, width: 96, textAlign: 'right', color: pctColor(unitsPct) }}>{unitsPct}%</span>
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', width: 180, textAlign: 'right' }}>{m.units_fact} / {m.units_plan || 0}</span>
            </div>
            {/* MRR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 72 }}>
              <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.35)', width: 124 }}>MRR</span>
              <MetricBar factPct={mrrPctBar} forecastPct={mrrForecastPctBar} color="#4ade80" />
              <span style={{ fontSize: 22, fontWeight: 700, width: 96, textAlign: 'right', color: mrrTotal > 0 ? '#4ade80' : 'rgba(255,255,255,0.2)' }}>{fmtK(m.mrr)}</span>
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', width: 180, textAlign: 'right' }}>/ мес</span>
            </div>
          </div>
        )
      })}

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.2)' }}>Пульс КО · бот</span>
        <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.2)' }}>{dateStr} {timeStr}</span>
      </div>
    </div>
  )
}

function BondaImage({ members, periodLabel }: { members: MemberData[]; periodLabel: string }) {
  const totalRevenue = members.reduce((s, m) => s + m.revenue_fact, 0)
  const maxRevenue = Math.max(...members.map(m => m.revenue_fact + m.revenue_forecast), 1)
  const maxMrr = Math.max(...members.map(m => m.mrr + m.mrr_forecast), 1)

  const now = moscowNow()
  const dateStr = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} МСК`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a35 100%)', padding: 56, fontFamily: 'sans-serif', color: 'white' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, paddingBottom: 32, borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36, fontWeight: 700 }}>
            <span style={{ color: '#a78bfa' }}>БОНДА</span>
            <span> · Пульс КО</span>
          </div>
          <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>{periodLabel}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 56, fontWeight: 800, color: '#a78bfa' }}>{fmtK(totalRevenue)}</span>
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 2 }}>выручка</span>
        </div>
      </div>

      <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 24, fontWeight: 600 }}>Рейтинг менеджеров</span>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 32, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 16, height: 8, borderRadius: 4, background: '#a78bfa' }} />
          <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>факт</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 16, height: 8, borderRadius: 4, background: '#6b5b9e' }} />
          <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>прогноз</span>
        </div>
      </div>

      {/* Managers */}
      {members.map((m, i) => {
        const revFactPct = maxRevenue > 0 ? Math.round(m.revenue_fact / maxRevenue * 100) : 0
        const revForecastPct = maxRevenue > 0 ? Math.round(m.revenue_forecast / maxRevenue * 100) : 0
        const mrrFactPct = maxMrr > 0 ? Math.round(m.mrr / maxMrr * 100) : 0
        const mrrForecastPct = maxMrr > 0 ? Math.round(m.mrr_forecast / maxMrr * 100) : 0

        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', padding: '24px 0', borderBottom: i < members.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, background: rankBg(i), color: rankColor(i) }}>{i + 1}</div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 26, fontWeight: 600 }}>{m.name}</span>
                <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>{m.position}</span>
              </div>
              <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.5)' }}>встреч: <span style={{ color: 'white', fontWeight: 600 }}>{m.meetings_fact}</span></span>
            </div>
            {/* Выручка */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 72, marginBottom: 8 }}>
              <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.35)', width: 124 }}>Выручка</span>
              <MetricBar factPct={revFactPct} forecastPct={revForecastPct} color="#a78bfa" />
              <span style={{ fontSize: 22, fontWeight: 700, width: 96, textAlign: 'right', color: m.revenue_fact > 0 ? '#a78bfa' : 'rgba(255,255,255,0.2)' }}>{fmtK(m.revenue_fact)}</span>
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', width: 180, textAlign: 'right' }}>ФД: {m.fd_count} · BI: {m.bi_count}</span>
            </div>
            {/* MRR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 72 }}>
              <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.35)', width: 124 }}>MRR</span>
              <MetricBar factPct={mrrFactPct} forecastPct={mrrForecastPct} color="#4ade80" />
              <span style={{ fontSize: 22, fontWeight: 700, width: 96, textAlign: 'right', color: m.mrr > 0 ? '#4ade80' : 'rgba(255,255,255,0.2)' }}>{fmtK(m.mrr)}</span>
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', width: 180, textAlign: 'right' }}>/ мес</span>
            </div>
          </div>
        )
      })}

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.2)' }}>Пульс КО · бот</span>
        <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.2)' }}>{dateStr} {timeStr}</span>
      </div>
    </div>
  )
}

export async function GET(request: NextRequest) {
  if (!verifyToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const company = request.nextUrl.searchParams.get('company') || 'inno'
    const format = request.nextUrl.searchParams.get('format')
    const { inno, bonda, periodLabel } = await getTeamData()

    if (format === 'json') {
      return NextResponse.json({ periodLabel, inno, bonda })
    }

    const isInno = company !== 'bonda'
    const members = isInno ? inno : bonda

    if (members.length === 0) {
      return NextResponse.json({ error: `No ${company} members found` }, { status: 404 })
    }

    // 2x dimensions for high-res Telegram images
    // Header(~200) + section title(60) + legend(60) + footer(100) + padding(112)
    const chrome = 532
    // ИННО: name row(80) + 3 metrics(48*3) + padding(48) = 272
    // БОНДА: name row(80) + 2 metrics(48*2) + padding(48) = 224
    const rowHeight = isInno ? 272 : 224
    const imgHeight = chrome + members.length * rowHeight

    return new ImageResponse(
      isInno
        ? <InnoImage members={members} periodLabel={periodLabel} />
        : <BondaImage members={members} periodLabel={periodLabel} />,
      { width: 1040, height: imgHeight }
    )
  } catch (err: any) {
    console.error('Team report error:', err)
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
