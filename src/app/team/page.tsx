'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Users } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import ProgressBar from '@/components/ProgressBar'
import { formatMoney, cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getTeamProgress } from '@/lib/supabase/queries'

type CompanyFilter = 'all' | string

export default function TeamPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<any[]>([])
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all')

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)

        if (!['rop', 'director', 'admin'].includes(currentUser.role)) {
          router.push('/dashboard')
          return
        }

        const activePeriod = await getActivePeriod(supabase)
        if (!activePeriod) { setLoading(false); return }

        const teamData = await getTeamProgress(supabase, currentUser.company_id, activePeriod.id)
        setTeam(teamData)
      } catch (err) {
        console.error('Team load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  // Extract unique companies for filter tabs
  const companies = useMemo(() => {
    const map = new Map<string, string>()
    team.forEach(m => { if (m.company_id && m.company_name) map.set(m.company_id, m.company_name) })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [team])

  // Filtered team
  const filtered = useMemo(() => {
    if (companyFilter === 'all') return team
    return team.filter(m => m.company_id === companyFilter)
  }, [team, companyFilter])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  // Aggregates
  const totalRev = filtered.reduce((s, m) => s + m.revenue_fact, 0)
  const totalForecast = filtered.reduce((s, m) => s + m.revenue_forecast, 0)
  const totalPlan = filtered.reduce((s, m) => s + m.revenue_plan, 0)
  const avgRevPct = totalPlan > 0 ? Math.round((totalRev / totalPlan) * 100) : 0
  const totalUnits = filtered.reduce((s, m) => s + m.units_fact, 0)
  const totalUp = filtered.reduce((s, m) => s + m.units_plan, 0)
  const totalMeet = filtered.reduce((s, m) => s + m.meetings_fact, 0)
  const totalMp = filtered.reduce((s, m) => s + m.meetings_plan, 0)

  return (
    <MobileRestricted>
    <div className="flex min-h-screen">
      <Sidebar role={user?.role || 'rop'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-blue-400" />
              <h1 className="text-2xl font-heading font-bold text-white">Команда</h1>
            </div>
          </div>

          {/* Company filter tabs */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setCompanyFilter('all')}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                companyFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-white/10 text-blue-400 border border-white/10 hover:bg-white/15'
              )}
            >
              Все ({team.length})
            </button>
            {companies.map(c => {
              const count = team.filter(m => m.company_id === c.id).length
              return (
                <button
                  key={c.id}
                  onClick={() => setCompanyFilter(c.id)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                    companyFilter === c.id ? 'bg-blue-500 text-white' : 'bg-white/10 text-blue-400 border border-white/10 hover:bg-white/15'
                  )}
                >
                  {c.name} ({count})
                </button>
              )
            })}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-blue-400 mb-1">Факт выручки</p>
              <p className="text-2xl font-bold text-white">{formatMoney(totalRev)}</p>
              <p className="text-[10px] text-blue-400 mt-0.5">план: {formatMoney(totalPlan)}</p>
            </div>
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-blue-400 mb-1">Прогноз</p>
              <p className="text-2xl font-bold text-blue-600">{formatMoney(totalRev + totalForecast)}</p>
              <p className="text-[10px] text-blue-400 mt-0.5">факт + неоплаченные</p>
            </div>
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-blue-400 mb-1">Точки</p>
              <p className="text-2xl font-bold text-white">{totalUnits} / {totalUp}</p>
              <p className="text-[10px] text-blue-400 mt-0.5">{totalUp > 0 ? Math.round(totalUnits / totalUp * 100) : 0}%</p>
            </div>
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-blue-400 mb-1">Встречи</p>
              <p className="text-2xl font-bold text-white">{totalMeet} / {totalMp}</p>
              <p className="text-[10px] text-blue-400 mt-0.5">{totalMp > 0 ? Math.round(totalMeet / totalMp * 100) : 0}%</p>
            </div>
          </div>

          {/* Overall progress */}
          <div className="glass rounded-xl p-5 mb-6">
            <h2 className="text-sm font-semibold text-white mb-3">Общий прогресс</h2>
            <div className="space-y-3">
              <ProgressBar label="Выручка" value={totalRev} max={totalPlan} percent={avgRevPct} formatValue={formatMoney} />
              <ProgressBar label="Точки" value={totalUnits} max={totalUp} percent={totalUp > 0 ? Math.round(totalUnits / totalUp * 100) : 0} />
              <ProgressBar label="Встречи" value={totalMeet} max={totalMp} percent={totalMp > 0 ? Math.round(totalMeet / totalMp * 100) : 0} />
            </div>
          </div>

          {/* Individual member cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(m => {
              const revPct = m.revenue_plan > 0 ? Math.round((m.revenue_fact / m.revenue_plan) * 100) : 0
              const unitsPct = m.units_plan > 0 ? Math.round((m.units_fact / m.units_plan) * 100) : 0
              const meetPct = m.meetings_plan > 0 ? Math.round((m.meetings_fact / m.meetings_plan) * 100) : 0
              const status = revPct >= 100
                ? { label: 'По плану', cls: 'bg-green-100 text-green-700' }
                : revPct >= 60
                  ? { label: 'Отстаёт', cls: 'bg-yellow-100 text-yellow-700' }
                  : { label: 'Риск', cls: 'bg-red-100 text-red-700' }

              return (
                <div key={m.id} className="glass rounded-xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        {m.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{m.name}</p>
                        <p className="text-xs text-blue-400">{m.position} • {m.company_name}</p>
                      </div>
                    </div>
                    <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', status.cls)}>
                      {status.label}
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <ProgressBar label="Выручка" value={m.revenue_fact} max={m.revenue_plan} percent={revPct} formatValue={formatMoney} />
                    <ProgressBar label="Точки" value={m.units_fact} max={m.units_plan} percent={unitsPct} />
                    <ProgressBar label="Встречи" value={m.meetings_fact} max={m.meetings_plan} percent={meetPct} />
                  </div>

                  {/* Extra info row */}
                  <div className="flex items-center gap-4 pt-3 border-t border-white/10 text-xs text-blue-400">
                    {m.revenue_forecast > 0 && (
                      <span>Прогноз: <span className="text-blue-600 font-medium">+{formatMoney(m.revenue_forecast)}</span></span>
                    )}
                    {m.invoiced_sum > 0 && (
                      <span>Выставлено: <span className="text-white/80 font-medium">{formatMoney(m.invoiced_sum)}</span></span>
                    )}
                    {m.paid_sum > 0 && (
                      <span>Оплачено: <span className="text-emerald-600 font-medium">{formatMoney(m.paid_sum)}</span></span>
                    )}
                    {m.revenue_forecast === 0 && m.invoiced_sum === 0 && m.paid_sum === 0 && (
                      <span className="text-white/30">Нет дополнительных данных</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-white/40 py-12">Нет сотрудников</div>
          )}
        </div>
      </main>
    </div>
    </MobileRestricted>
  )
}
