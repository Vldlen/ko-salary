'use client'

import { useState, useEffect } from 'react'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getTeamProgress } from '@/lib/supabase/queries'
import { Loader2 } from 'lucide-react'

function formatK(n: number): string {
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

function barWidth(pct: number): string {
  return `${Math.min(100, Math.max(0, pct))}%`
}

// Sum MRR from paid deals for a manager
function calcMrr(deals: any[]): number {
  return deals
    .filter((d: any) => d.status === 'paid')
    .reduce((sum: number, d: any) => sum + Number(d.mrr || 0), 0)
}

function now(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}.${mm}.${yyyy} ${hh}:${mi} МСК`
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function RankBadge({ rank }: { rank: number }) {
  const cls = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other'
  return <div className={`rank ${cls}`}>{rank}</div>
}

function MetricLine({ label, pct, barColor, value, sub }: {
  label: string
  pct?: number
  barColor: string
  value: string
  sub: string
}) {
  const width = pct !== undefined ? barWidth(pct) : '0%'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 36, marginBottom: 4 }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', width: 62, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: 6, borderRadius: 3, background: barColor, width }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, width: 48, textAlign: 'right', flexShrink: 0, color: pct !== undefined ? pctColor(pct) : barColor }}>{value}</div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', width: 90, textAlign: 'right', flexShrink: 0 }}>{sub}</div>
    </div>
  )
}

function InnoReport({ managers, periodLabel }: { managers: any[]; periodLabel: string }) {
  const totalRevenuePlan = managers.reduce((s, m) => s + (m.revenue_plan || 0), 0)
  const totalRevenueFact = managers.reduce((s, m) => s + m.revenue_fact, 0)
  const totalPct = totalRevenuePlan > 0 ? Math.round(totalRevenueFact / totalRevenuePlan * 100) : 0

  // Sort by revenue %
  const sorted = [...managers].sort((a, b) => {
    const aPct = a.revenue_plan > 0 ? a.revenue_fact / a.revenue_plan : 0
    const bPct = b.revenue_plan > 0 ? b.revenue_fact / b.revenue_plan : 0
    return bPct - aPct
  })

  return (
    <div className="report">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}><span style={{ color: '#60a5fa' }}>ИННО</span> · Пульс КО</h1>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{periodLabel}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: pctColor(totalPct) }}>{totalPct}%</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>план выручки</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, fontWeight: 600 }}>
        Рейтинг менеджеров
      </div>

      {sorted.map((m, i) => {
        const revPct = m.revenue_plan > 0 ? Math.round(m.revenue_fact / m.revenue_plan * 100) : 0
        const unitsPct = m.units_plan > 0 ? Math.round(m.units_fact / m.units_plan * 100) : 0
        const mrr = calcMrr(m._deals || [])
        const maxMrr = Math.max(...sorted.map(s => calcMrr(s._deals || [])), 1)
        const mrrPctBar = Math.round(mrr / maxMrr * 100)

        return (
          <div key={m.id} style={{ padding: '12px 0', borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <RankBadge rank={i + 1} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{m.position}</div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                встреч: <span style={{ color: 'white', fontWeight: 600 }}>{m.meetings_fact}</span>
              </div>
            </div>
            <MetricLine label="Выручка" pct={revPct} barColor={pctColor(revPct)} value={`${revPct}%`} sub={`${formatK(m.revenue_fact)} / ${formatK(m.revenue_plan || 0)}`} />
            <MetricLine label="Точки" pct={unitsPct} barColor={pctColor(unitsPct)} value={`${unitsPct}%`} sub={`${m.units_fact} / ${m.units_plan || 0}`} />
            <MetricLine label="MRR" pct={mrrPctBar} barColor="#4ade80" value={formatK(mrr)} sub="/ мес" />
          </div>
        )
      })}

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Пульс КО · бот</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{now()}</span>
      </div>
    </div>
  )
}

function BondaReport({ managers, periodLabel }: { managers: any[]; periodLabel: string }) {
  const totalRevenue = managers.reduce((s, m) => s + m.revenue_fact, 0)

  // Sort by revenue
  const sorted = [...managers].sort((a, b) => b.revenue_fact - a.revenue_fact)
  const maxRevenue = Math.max(...sorted.map(m => m.revenue_fact), 1)
  const maxMrr = Math.max(...sorted.map(m => calcMrr(m._deals || [])), 1)

  return (
    <div className="report">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700 }}><span style={{ color: '#a78bfa' }}>БОНДА</span> · Пульс КО</h1>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>{periodLabel}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#a78bfa' }}>{formatK(totalRevenue)}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 }}>выручка</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12, fontWeight: 600 }}>
        Рейтинг менеджеров
      </div>

      {sorted.map((m, i) => {
        const revPctBar = Math.round(m.revenue_fact / maxRevenue * 100)
        const mrr = calcMrr(m._deals || [])
        const mrrPctBar = Math.round(mrr / maxMrr * 100)

        return (
          <div key={m.id} style={{ padding: '12px 0', borderBottom: i < sorted.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <RankBadge rank={i + 1} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{m.position}</div>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                встреч: <span style={{ color: 'white', fontWeight: 600 }}>{m.meetings_fact}</span>
              </div>
            </div>
            <MetricLine label="Выручка" pct={revPctBar} barColor="#a78bfa" value={formatK(m.revenue_fact)} sub={`ФД: ${m.fd_count} · BI: ${m.bi_count}`} />
            <MetricLine label="MRR" pct={mrrPctBar} barColor="#4ade80" value={formatK(mrr)} sub="/ мес" />
          </div>
        )
      })}

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>Пульс КО · бот</span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{now()}</span>
      </div>
    </div>
  )
}

export default function ReportPreviewPage() {
  const supabase = useSupabase()
  const [loading, setLoading] = useState(true)
  const [innoManagers, setInnoManagers] = useState<any[]>([])
  const [bondaManagers, setBondaManagers] = useState<any[]>([])
  const [periodLabel, setPeriodLabel] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) return

        // Get active period for label
        const { data: activePeriod } = await supabase
          .from('periods')
          .select('*')
          .eq('status', 'active')
          .limit(1)
          .single()

        if (activePeriod) {
          const d = new Date()
          setPeriodLabel(`${MONTHS[activePeriod.month - 1]} ${activePeriod.year} · ${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase().slice(0, 3)}., ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
        }

        // Get team data
        const teamData = await getTeamProgress(supabase, currentUser.company_id, activePeriod?.id || '')

        // We also need raw deals for MRR — fetch them
        const allPeriodIds = Array.from(new Set(teamData.map((m: any) => m.company_id))).map(() => activePeriod?.id).filter(Boolean)

        // Fetch deals for all managers to get MRR
        const userIds = teamData.map((m: any) => m.id)
        const { data: allDeals } = await supabase
          .from('deals')
          .select('user_id, mrr, status')
          .in('user_id', userIds)
          .eq('status', 'paid')

        // Attach deals to managers
        const dealsByUser = new Map<string, any[]>()
        for (const d of (allDeals || [])) {
          const list = dealsByUser.get(d.user_id) || []
          list.push(d)
          dealsByUser.set(d.user_id, list)
        }

        const enriched = teamData.map((m: any) => ({
          ...m,
          _deals: dealsByUser.get(m.id) || [],
        }))

        // Split by company
        const inno = enriched.filter((m: any) => !m.company_name?.toUpperCase()?.includes('БОНД'))
        const bonda = enriched.filter((m: any) => m.company_name?.toUpperCase()?.includes('БОНД'))

        setInnoManagers(inno)
        setBondaManagers(bonda)
      } catch (err) {
        console.error('Report preview error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
      <style>{`
        .report {
          width: 520px;
          background: linear-gradient(135deg, #0f0f23 0%, #1a1a35 100%);
          border-radius: 20px;
          padding: 28px;
          color: white;
          border: 1px solid rgba(255,255,255,0.08);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .rank {
          width: 24px; height: 24px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; flex-shrink: 0;
        }
        .rank-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #1a1a2e; }
        .rank-2 { background: rgba(148,163,184,0.25); color: #94a3b8; }
        .rank-3 { background: rgba(180,120,80,0.25); color: #c8956c; }
        .rank-other { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.3); }
      `}</style>

      {innoManagers.length > 0 && (
        <>
          <h2 style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2 }}>Сообщение 1 — ИННО</h2>
          <InnoReport managers={innoManagers} periodLabel={periodLabel} />
        </>
      )}

      {bondaManagers.length > 0 && (
        <>
          <h2 style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2 }}>Сообщение 2 — БОНДА</h2>
          <BondaReport managers={bondaManagers} periodLabel={periodLabel} />
        </>
      )}

      {innoManagers.length === 0 && bondaManagers.length === 0 && (
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16 }}>Нет активных менеджеров с данными</div>
      )}
    </div>
  )
}
