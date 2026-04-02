'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Users, ChevronDown, ChevronUp, TrendingUp, AlertTriangle, Clock, CheckCircle2, Circle } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import ProgressBar from '@/components/ProgressBar'
import { formatMoney, cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getTeamProgress, getKpiEntries, getKpiApprovals, toggleKpiApproval } from '@/lib/supabase/queries'

type CompanyFilter = 'all' | string

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  paid: { label: 'Оплачено', cls: 'text-emerald-400' },
  waiting_payment: { label: 'Ждёт оплаты', cls: 'text-amber-400' },
  no_invoice: { label: 'Без счёта', cls: 'text-white/40' },
  cancelled: { label: 'Отменена', cls: 'text-red-400' },
}

export default function TeamPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [team, setTeam] = useState<any[]>([])
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [periodId, setPeriodId] = useState<string | null>(null)

  // KPI data for БОНДА managers (loaded on expand)
  const [kpiData, setKpiData] = useState<Record<string, { entries: any[]; approvals: any[] }>>({})
  const [kpiLoading, setKpiLoading] = useState<string | null>(null)

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

        setPeriodId(activePeriod.id)
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

  // Load KPI data for a БОНДА user when expanding
  async function loadKpiForUser(userId: string) {
    if (!periodId || kpiData[userId]) return
    setKpiLoading(userId)
    try {
      const [entries, approvals] = await Promise.all([
        getKpiEntries(supabase, userId, periodId),
        getKpiApprovals(supabase, userId, periodId),
      ])
      setKpiData(prev => ({ ...prev, [userId]: { entries, approvals } }))
    } catch (err) {
      console.error('KPI load error:', err)
    } finally {
      setKpiLoading(null)
    }
  }

  async function handleToggleApproval(managerId: string, kpiType: string) {
    if (!periodId || !user) return
    try {
      await toggleKpiApproval(supabase, managerId, periodId, kpiType, user.id)
      // Reload approvals
      const approvals = await getKpiApprovals(supabase, managerId, periodId)
      setKpiData(prev => ({
        ...prev,
        [managerId]: { ...prev[managerId], approvals },
      }))
    } catch (err: any) {
      alert(err.message || 'Ошибка')
    }
  }

  function handleExpand(userId: string, isBondaCompany: boolean) {
    const isExpanding = expandedId !== userId
    setExpandedId(isExpanding ? userId : null)
    if (isExpanding && isBondaCompany) {
      loadKpiForUser(userId)
    }
  }

  const companies = useMemo(() => {
    const map = new Map<string, string>()
    team.forEach(m => { if (m.company_id && m.company_name) map.set(m.company_id, m.company_name) })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [team])

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
  const totalWaiting = filtered.reduce((s, m) => s + m.revenue_waiting, 0)
  const totalPlan = filtered.reduce((s, m) => s + m.revenue_plan, 0)
  const avgRevPct = totalPlan > 0 ? Math.round((totalRev / totalPlan) * 100) : 0
  const totalUnits = filtered.reduce((s, m) => s + m.units_fact, 0)
  const totalUp = filtered.reduce((s, m) => s + m.units_plan, 0)
  const totalMeet = filtered.reduce((s, m) => s + m.meetings_fact, 0)
  const totalMp = filtered.reduce((s, m) => s + m.meetings_plan, 0)
  const totalDeals = filtered.reduce((s, m) => s + m.deals_total, 0)
  const totalMargin = filtered.reduce((s, m) => s + m.margin_fact, 0)

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
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-white/40 mb-1">Выручка (факт)</p>
              <p className="text-xl font-bold text-white">{formatMoney(totalRev)}</p>
              {totalPlan > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {formatMoney(totalPlan)} ({avgRevPct}%)</p>}
            </div>
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-white/40 mb-1">Ждёт оплаты</p>
              <p className="text-xl font-bold text-amber-400">{formatMoney(totalWaiting)}</p>
              <p className="text-[10px] text-white/30 mt-0.5">прогноз: {formatMoney(totalRev + totalForecast)}</p>
            </div>
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-white/40 mb-1">Сделки / Точки</p>
              <p className="text-xl font-bold text-white">{totalDeals} / {totalUnits}</p>
              {totalUp > 0 && <p className="text-[10px] text-white/30 mt-0.5">план точек: {totalUp}</p>}
            </div>
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-white/40 mb-1">Встречи</p>
              <p className="text-xl font-bold text-white">{totalMeet}</p>
              {totalMp > 0 && <p className="text-[10px] text-white/30 mt-0.5">план: {totalMp} ({Math.round(totalMeet / totalMp * 100)}%)</p>}
            </div>
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-white/40 mb-1">Маржа (оборуд.)</p>
              <p className="text-xl font-bold text-white">{formatMoney(totalMargin)}</p>
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
          <div className="space-y-4">
            {filtered.map(m => {
              const revPct = m.revenue_plan > 0 ? Math.round((m.revenue_fact / m.revenue_plan) * 100) : 0
              const unitsPct = m.units_plan > 0 ? Math.round((m.units_fact / m.units_plan) * 100) : 0
              const meetPct = m.meetings_plan > 0 ? Math.round((m.meetings_fact / m.meetings_plan) * 100) : 0
              const isExpanded = expandedId === m.id
              const isBondaCompany = m.company_name?.toUpperCase()?.includes('БОНД') || false
              const isJunior = m.position?.toLowerCase()?.includes('младш') || false

              const statusIcon = revPct >= 100
                ? { label: 'План выполнен', cls: 'bg-emerald-500/20 text-emerald-400', icon: TrendingUp }
                : revPct >= 50
                  ? { label: 'В работе', cls: 'bg-blue-500/20 text-blue-400', icon: Clock }
                  : { label: 'Отстаёт', cls: 'bg-red-500/20 text-red-400', icon: AlertTriangle }

              return (
                <div key={m.id} className="glass rounded-xl overflow-hidden">
                  {/* Header — always visible */}
                  <button
                    onClick={() => handleExpand(m.id, isBondaCompany)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        {m.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{m.name}</p>
                        <p className="text-xs text-white/40">{m.position} · {m.company_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Quick stats */}
                      <div className="hidden md:flex items-center gap-4 text-xs">
                        <span className="text-white/60">
                          Выручка: <span className="text-white font-medium">{formatMoney(m.revenue_fact)}</span>
                          {m.revenue_plan > 0 && <span className={cn('ml-1 font-semibold', revPct >= 100 ? 'text-emerald-400' : revPct >= 50 ? 'text-blue-400' : 'text-red-400')}>({revPct}%)</span>}
                        </span>
                        <span className="text-white/60">
                          Сделки: <span className="text-white font-medium">{m.deals_total}</span>
                        </span>
                        <span className="text-white/60">
                          Точки: <span className="text-white font-medium">{m.units_fact}</span>
                        </span>
                      </div>

                      <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap', statusIcon.cls)}>
                        {statusIcon.label}
                      </span>

                      {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-white/5 pt-4">
                      {/* Progress bars */}
                      <div className="space-y-3 mb-5">
                        <ProgressBar label="Выручка" value={m.revenue_fact} max={m.revenue_plan} percent={revPct} formatValue={formatMoney} />
                        <ProgressBar label="Точки" value={m.units_fact} max={m.units_plan} percent={unitsPct} />
                        <ProgressBar label="Встречи" value={m.meetings_fact} max={m.meetings_plan} percent={meetPct} />
                      </div>

                      {/* Detailed stats grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                        {/* Сделки */}
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Сделки</p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-white/50">Всего</span>
                              <span className="text-white font-medium">{m.deals_total}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-emerald-400/70">Оплачено</span>
                              <span className="text-emerald-400 font-medium">{m.deals_paid}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-amber-400/70">Ждёт оплаты</span>
                              <span className="text-amber-400 font-medium">{m.deals_waiting}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/30">Без счёта</span>
                              <span className="text-white/50 font-medium">{m.deals_no_invoice}</span>
                            </div>
                            {m.deals_cancelled > 0 && (
                              <div className="flex justify-between">
                                <span className="text-red-400/70">Отменено</span>
                                <span className="text-red-400 font-medium">{m.deals_cancelled}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Выручка */}
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Выручка</p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-emerald-400/70">Оплачено</span>
                              <span className="text-emerald-400 font-medium">{formatMoney(m.revenue_fact)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-amber-400/70">Ждёт оплаты</span>
                              <span className="text-amber-400 font-medium">{formatMoney(m.revenue_waiting)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/50">Прогноз всего</span>
                              <span className="text-blue-400 font-medium">{formatMoney(m.revenue_fact + m.revenue_forecast)}</span>
                            </div>
                            {m.revenue_plan > 0 && (
                              <div className="flex justify-between pt-1 border-t border-white/5">
                                <span className="text-white/30">План</span>
                                <span className="text-white/50 font-medium">{formatMoney(m.revenue_plan)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Встречи */}
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Встречи</p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-white/50">Новые</span>
                              <span className="text-white font-medium">{m.meetings_new}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/50">Повторные</span>
                              <span className="text-white font-medium">{m.meetings_repeat}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/50">Запланировано</span>
                              <span className="text-white/70 font-medium">{m.meetings_scheduled}</span>
                            </div>
                            {m.meetings_plan > 0 && (
                              <div className="flex justify-between pt-1 border-t border-white/5">
                                <span className="text-white/30">План</span>
                                <span className="text-white/50 font-medium">{m.meetings_plan}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Точки + Маржа */}
                        <div className="bg-white/5 rounded-lg p-3">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Точки / Маржа</p>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-emerald-400/70">Оплачено</span>
                              <span className="text-emerald-400 font-medium">{m.units_fact} шт.</span>
                            </div>
                            {m.units_waiting > 0 && (
                              <div className="flex justify-between">
                                <span className="text-amber-400/70">Ждёт оплаты</span>
                                <span className="text-amber-400 font-medium">{m.units_waiting} шт.</span>
                              </div>
                            )}
                            {m.units_plan > 0 && (
                              <div className="flex justify-between">
                                <span className="text-white/30">План</span>
                                <span className="text-white/50 font-medium">{m.units_plan} шт.</span>
                              </div>
                            )}
                            <div className="flex justify-between pt-1 border-t border-white/5">
                              <span className="text-orange-400/70">Маржа оборуд.</span>
                              <span className="text-orange-400 font-medium">{formatMoney(m.margin_fact)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* БОНДА: KPI Approvals */}
                      {isBondaCompany && (
                        <div className="mb-5">
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">KPI — БОНДА</p>
                          <div className="bg-white/5 rounded-lg p-4">
                            {kpiLoading === m.id ? (
                              <div className="flex items-center gap-2 text-sm text-white/40">
                                <Loader2 className="w-4 h-4 animate-spin" /> Загрузка...
                              </div>
                            ) : kpiData[m.id] ? (
                              <div className="space-y-3">
                                {/* KPI entries count */}
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-white/60">
                                    {isJunior ? 'Встречи (KPI записи)' : 'Чек-апы (KPI записи)'}
                                  </span>
                                  <span className={cn(
                                    'font-semibold',
                                    kpiData[m.id].entries.length >= (isJunior ? 5 : 12)
                                      ? 'text-emerald-400' : 'text-white'
                                  )}>
                                    {kpiData[m.id].entries.length} / {isJunior ? 5 : 12}
                                  </span>
                                </div>
                                {/* Approval checkboxes */}
                                {isJunior ? (
                                  <button
                                    onClick={() => handleToggleApproval(m.id, 'attestation')}
                                    className="flex items-center gap-2 text-sm hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition w-full text-left"
                                  >
                                    {kpiData[m.id].approvals.some((a: any) => a.kpi_type === 'attestation')
                                      ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                      : <Circle className="w-5 h-5 text-white/20" />
                                    }
                                    <span className="text-white/70">Аттестация пройдена</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleToggleApproval(m.id, 'conversion_approved')}
                                    className="flex items-center gap-2 text-sm hover:bg-white/5 rounded-lg px-2 py-1.5 -mx-2 transition w-full text-left"
                                  >
                                    {kpiData[m.id].approvals.some((a: any) => a.kpi_type === 'conversion_approved')
                                      ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                      : <Circle className="w-5 h-5 text-white/20" />
                                    }
                                    <span className="text-white/70">Конверсия одобрена</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-white/30">Нет данных</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Recent deals */}
                      {m.recent_deals && m.recent_deals.length > 0 && (
                        <div>
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Последние сделки</p>
                          <div className="bg-white/5 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-white/5">
                                  <th className="px-3 py-2 text-left text-white/30 font-medium">Клиент</th>
                                  <th className="px-3 py-2 text-right text-white/30 font-medium">Сумма</th>
                                  <th className="px-3 py-2 text-right text-white/30 font-medium">Точки</th>
                                  <th className="px-3 py-2 text-right text-white/30 font-medium">Статус</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.recent_deals.map((d: any, idx: number) => {
                                  const st = STATUS_LABELS[d.status] || { label: d.status, cls: 'text-white/40' }
                                  return (
                                    <tr key={idx} className="border-b border-white/5 last:border-0">
                                      <td className="px-3 py-2 text-white/70">{d.client_name}</td>
                                      <td className="px-3 py-2 text-right text-white font-medium">{formatMoney(d.revenue)}</td>
                                      <td className="px-3 py-2 text-right text-white/60">{d.units}</td>
                                      <td className={cn('px-3 py-2 text-right font-medium', st.cls)}>{st.label}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
