'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import StatCard from '@/components/StatCard'
import ProgressBar from '@/components/ProgressBar'
import { formatMoney, getMonthName, getDealStatusLabel, getDealStatusColor } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getDashboardData } from '@/lib/supabase/queries'
import { getUsers } from '@/lib/supabase/admin-queries'
import {
  Wallet, TrendingUp, Handshake, CalendarDays,
  Target, BarChart3, ChevronRight, Loader2, Eye, ChevronDown
} from 'lucide-react'

export default function DashboardPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [data, setData] = useState<any>(null)

  // Admin view-as
  const [isAdmin, setIsAdmin] = useState(false)
  const [managers, setManagers] = useState<any[]>([])
  const [viewAsId, setViewAsId] = useState<string | null>(null)
  const [viewAsName, setViewAsName] = useState<string>('')
  const [showPicker, setShowPicker] = useState(false)
  const [loadingData, setLoadingData] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) {
          router.push('/login')
          return
        }
        setUser(currentUser)

        const canViewAs = ['admin', 'director', 'rop'].includes(currentUser.role)
        setIsAdmin(canViewAs)

        if (canViewAs) {
          const allUsers = await getUsers(supabase)
          setManagers(allUsers.filter((u: any) => u.is_active && !u.fired_at && u.role === 'manager'))
        }

        // For managers — load their own data
        if (currentUser.role === 'manager') {
          const activePeriod = await getActivePeriod(supabase, currentUser.company_id)
          if (!activePeriod) { setLoading(false); return }
          setPeriod(activePeriod)
          const dashData = await getDashboardData(supabase, currentUser.id, activePeriod.id)
          setData(dashData)
        }
        // For admin/rop/director — no data until they pick a manager
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  async function selectManager(managerId: string) {
    const mgr = managers.find((m: any) => m.id === managerId)
    if (!mgr) return

    setViewAsId(managerId)
    setViewAsName(mgr.full_name)
    setShowPicker(false)
    setLoadingData(true)

    try {
      const activePeriod = await getActivePeriod(supabase, mgr.company_id)
      if (!activePeriod) {
        setPeriod(null)
        setData(null)
        setLoadingData(false)
        return
      }
      setPeriod(activePeriod)
      const dashData = await getDashboardData(supabase, managerId, activePeriod.id)
      setData(dashData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingData(false)
    }
  }

  function resetView() {
    setViewAsId(null)
    setViewAsName('')
    setData(null)
    setPeriod(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  // Admin/ROP/Director with no manager selected
  const needsManagerSelection = isAdmin && !viewAsId && user?.role !== 'manager'

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={user?.role || 'manager'}
        userName={user?.full_name || ''}
        companyName={user?.company?.name || 'ИННО'}
      />

      <main className="flex-1 p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="max-w-6xl mx-auto">

          {/* Admin: Manager selector */}
          {isAdmin && (
            <div className="mb-6">
              <div className="glass rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-white/50">Просмотр от имени:</span>
                  {viewAsId ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{viewAsName}</span>
                      <button onClick={resetView} className="text-xs text-white/30 hover:text-white/60 transition">✕</button>
                    </div>
                  ) : (
                    <span className="text-sm text-white/30">не выбран</span>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowPicker(!showPicker)}
                    className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-xl text-sm font-medium transition"
                  >
                    Выбрать менеджера
                    <ChevronDown className={cn('w-4 h-4 transition-transform', showPicker && 'rotate-180')} />
                  </button>

                  {showPicker && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowPicker(false)} />
                      <div className="absolute right-0 top-full mt-2 z-40 glass-strong rounded-xl shadow-2xl w-72 max-h-80 overflow-y-auto">
                        {managers.length === 0 ? (
                          <div className="p-4 text-sm text-white/30 text-center">Нет активных менеджеров</div>
                        ) : (
                          managers.map((m: any) => (
                            <button
                              key={m.id}
                              onClick={() => selectManager(m.id)}
                              className={cn(
                                'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition',
                                viewAsId === m.id && 'bg-blue-500/10'
                              )}
                            >
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                                {m.full_name?.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white truncate">{m.full_name}</p>
                                <p className="text-[10px] text-white/30">{m.company?.name} · {m.position?.name || '—'}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Loading data for selected manager */}
          {loadingData && (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          )}

          {/* No manager selected prompt */}
          {needsManagerSelection && !loadingData && (
            <div className="glass rounded-2xl p-12 text-center">
              <Eye className="w-12 h-12 text-white/15 mx-auto mb-4" />
              <h2 className="text-lg font-heading font-bold text-white mb-2">Выберите менеджера</h2>
              <p className="text-sm text-white/40">Нажмите «Выбрать менеджера» чтобы просмотреть его дашборд</p>
            </div>
          )}

          {/* No active period */}
          {!needsManagerSelection && !loadingData && !data && viewAsId && (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-white/40">Нет активного периода для этого сотрудника.</p>
            </div>
          )}

          {/* Dashboard content */}
          {!loadingData && data && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-6 lg:mb-8">
                <div>
                  <h1 className="text-xl lg:text-2xl font-heading font-bold text-white">
                    {period ? `${getMonthName(period.month)} ${period.year}` : 'Дашборд'}
                  </h1>
                  <p className="text-white/40 mt-1 text-sm">
                    {viewAsId ? `Дашборд ${viewAsName}` : 'Мой прогресс'}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 glass rounded-xl px-4 py-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm text-white/50">Период активен</span>
                </div>
              </div>

              {/* Stat cards */}
              {(() => {
                const d = data
                const salary = d.salary || { base_salary: 0, kpi_quality: 0, kpi_quantity: 0, margin_bonus: 0, total: 0, forecast_total: 0 }

                return (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
                      <StatCard title="Текущая ЗП" value={formatMoney(salary.total)} icon={Wallet} />
                      <StatCard
                        title="Прогноз ЗП" value={formatMoney(salary.forecast_total)} icon={TrendingUp} variant="accent"
                        trend={{ value: `+${formatMoney(salary.forecast_total - salary.total)}`, positive: true }}
                      />
                      <StatCard title="Сделки" value={String(d.deals_count)} subtitle={`${d.breakdown.units_fact} точек подключено`} icon={Handshake} />
                      <StatCard title="Встречи" value={`${d.breakdown.meetings_fact} / ${d.breakdown.meetings_plan}`} subtitle={`${d.breakdown.meetings_percent}% плана`} icon={CalendarDays} variant="success" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
                      {/* Plan progress */}
                      <div className="glass rounded-2xl p-6">
                        <h2 className="text-lg font-heading font-semibold text-white mb-5 flex items-center gap-2">
                          <Target className="w-5 h-5 text-blue-400" />
                          Выполнение плана
                        </h2>
                        <div className="space-y-5">
                          <ProgressBar label="Выручка (факт)" value={d.breakdown.revenue_fact} max={d.breakdown.revenue_plan} percent={d.breakdown.revenue_percent} formatValue={formatMoney} />
                          <ProgressBar label="Выручка (прогноз)" value={d.breakdown.revenue_forecast} max={d.breakdown.revenue_plan} percent={d.breakdown.revenue_forecast_percent} formatValue={formatMoney} />
                          <ProgressBar label="Точки" value={d.breakdown.units_fact} max={d.breakdown.units_plan} percent={d.breakdown.units_percent} />
                          <ProgressBar label="Встречи" value={d.breakdown.meetings_fact} max={d.breakdown.meetings_plan} percent={d.breakdown.meetings_percent} />
                        </div>
                      </div>

                      {/* Salary breakdown */}
                      <div className="glass rounded-2xl p-6">
                        <h2 className="text-lg font-heading font-semibold text-white mb-5 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-blue-400" />
                          Расчёт ЗП
                        </h2>
                        <div className="space-y-3">
                          {[
                            { label: 'Оклад', value: salary.base_salary },
                            { label: 'Качественный KPI', value: salary.kpi_quality },
                            { label: 'Количественный KPI', value: salary.kpi_quantity },
                            { label: 'Маржа с оборудования', value: salary.margin_bonus },
                          ].map(item => (
                            <div key={item.label} className="flex justify-between items-center py-2.5 border-b border-white/5">
                              <span className="text-sm text-white/50">{item.label}</span>
                              <span className="text-sm font-semibold text-white">{formatMoney(Number(item.value))}</span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-white/10">
                            <span className="font-heading font-semibold text-white">Итого</span>
                            <span className="text-xl font-bold text-blue-400">{formatMoney(Number(salary.total))}</span>
                          </div>
                          <div className="flex justify-between items-center bg-orange-500/15 rounded-xl px-4 py-3 -mx-1">
                            <span className="text-sm font-medium text-orange-400">Прогноз</span>
                            <span className="text-lg font-bold text-orange-400">{formatMoney(Number(salary.forecast_total))}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent deals */}
                    <div className="glass rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-heading font-semibold text-white flex items-center gap-2">
                          <Handshake className="w-5 h-5 text-blue-400" />
                          Последние сделки
                        </h2>
                        {!viewAsId && (
                          <button onClick={() => router.push('/deals')}
                            className="text-sm text-blue-400 hover:text-blue-500 font-medium flex items-center gap-1 transition">
                            Все сделки <ChevronRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {d.recent_deals.length === 0 ? (
                          <p className="text-white/40 text-sm text-center py-8">Нет сделок за этот период</p>
                        ) : (
                          d.recent_deals.map((deal: any, i: number) => (
                            <div key={deal.id || i} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/5 transition">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-blue-400 font-bold text-sm">
                                  {deal.client_name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-white">{deal.client_name}</p>
                                  <p className="text-xs text-white/40">{deal.units} точек</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', getDealStatusColor(deal.status))}>
                                  {getDealStatusLabel(deal.status)}
                                </span>
                                <span className="text-sm font-semibold text-white w-28 text-right">{formatMoney(Number(deal.revenue))}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )
              })()}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
