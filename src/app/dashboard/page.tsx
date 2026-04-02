'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ViewAsBar from '@/components/ViewAsBar'
import StatCard from '@/components/StatCard'
import ProgressBar from '@/components/ProgressBar'
import { formatMoney, getMonthName, getDealStatusLabel, getDealStatusColor } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { useViewAs } from '@/lib/view-as-context'
import { getCurrentUser, getActivePeriod, getDashboardData, getBondaDashboardData, getPreviousPeriodComparison } from '@/lib/supabase/queries'
import {
  Wallet, TrendingUp, Handshake, CalendarDays,
  Target, BarChart3, ChevronRight, Loader2, Eye
} from 'lucide-react'

export default function DashboardPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const { viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs } = useViewAs()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [data, setData] = useState<any>(null)
  const [bondaData, setBondaData] = useState<any>(null)
  const [prevComparison, setPrevComparison] = useState<any>(null)

  // Load current user once
  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  // Load dashboard data — re-runs when viewAsUser changes
  useEffect(() => {
    if (!user) return
    const targetUserId = effectiveUserId(user.id)
    const targetCompanyId = effectiveCompanyId(user.company_id)

    // Admin without viewAs — show empty (director/rop see own data)
    if (user.role === 'admin' && !isViewingAs) {
      setData(null)
      setBondaData(null)
      setPeriod(null)
      setPrevComparison(null)
      return
    }

    // Detect БОНДА company
    const companyName = isViewingAs ? viewAsUser?.company?.name : user.company?.name
    const isBondaUser = companyName?.toUpperCase()?.includes('БОНД') || false

    async function loadDash() {
      try {
        const activePeriod = await getActivePeriod(supabase, targetCompanyId)
        if (!activePeriod) { setPeriod(null); setData(null); setBondaData(null); setPrevComparison(null); return }
        setPeriod(activePeriod)

        if (isBondaUser) {
          const bData = await getBondaDashboardData(supabase, targetUserId, activePeriod.id)
          setBondaData(bData)
          setData(null)
        } else {
          const [dashData, prevData] = await Promise.all([
            getDashboardData(supabase, targetUserId, activePeriod.id),
            getPreviousPeriodComparison(supabase, targetUserId, { year: activePeriod.year, month: activePeriod.month }),
          ])
          setData(dashData)
          setBondaData(null)
          setPrevComparison(prevData)
        }
      } catch (err) {
        console.error(err)
      }
    }
    loadDash()
  }, [supabase, user, viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
  }

  if (!user) return null

  const isAdminOnly = user.role === 'admin'
  const showEmptyPrompt = isAdminOnly && !isViewingAs && !data && !bondaData

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} userName={user.full_name} companyName={user.company?.name || 'ИННО'} />

      <main className="flex-1 p-4 pt-16 lg:p-8 lg:pt-8">
        <div className="max-w-6xl mx-auto">

          <ViewAsBar userRole={user.role} />

          {/* Empty prompt for admin */}
          {showEmptyPrompt && (
            <div className="glass rounded-2xl p-12 text-center">
              <Eye className="w-12 h-12 text-white/15 mx-auto mb-4" />
              <h2 className="text-lg font-heading font-bold text-white mb-2">Выберите менеджера</h2>
              <p className="text-sm text-white/40">Нажмите «Выбрать менеджера» чтобы просмотреть его дашборд</p>
            </div>
          )}

          {/* No period */}
          {isViewingAs && !data && !bondaData && period === null && (
            <div className="glass rounded-2xl p-12 text-center">
              <p className="text-white/40">Нет активного периода для этого сотрудника.</p>
            </div>
          )}

          {/* Dashboard content */}
          {data && (() => {
            const d = data
            const salary = d.salary || { base_salary: 0, kpi_quality: 0, kpi_quantity: 0, margin_bonus: 0, total: 0, forecast_total: 0 }

            return (
              <>
                <div className="flex items-center justify-between mb-6 lg:mb-8">
                  <div>
                    <h1 className="text-xl lg:text-2xl font-heading font-bold text-white">
                      {period ? `${getMonthName(period.month)} ${period.year}` : 'Дашборд'}
                    </h1>
                    <p className="text-white/40 mt-1 text-sm">
                      {isViewingAs ? `Дашборд — ${viewAsUser?.full_name}` : 'Мой прогресс'}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 glass rounded-xl px-4 py-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-white/50">Период активен</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
                  <StatCard title="Текущая ЗП" value={formatMoney(salary.total)} icon={Wallet} />
                  <StatCard title="Прогноз ЗП" value={formatMoney(salary.forecast_total)} icon={TrendingUp} variant="accent"
                    trend={{ value: `+${formatMoney(salary.forecast_total - salary.total)}`, positive: true }} />
                  <StatCard title="Сделки" value={String(d.deals_count)} subtitle={`${d.breakdown.units_fact} точек`} icon={Handshake} />
                  <StatCard title="Встречи" value={`${d.breakdown.meetings_fact} / ${d.breakdown.meetings_plan}`} subtitle={`${d.breakdown.meetings_percent}% плана`} icon={CalendarDays} variant="success" />
                </div>

                {/* Сравнение с прошлым месяцем */}
                {prevComparison && (
                  <div className="glass rounded-2xl p-4 mb-6 lg:mb-8">
                    <p className="text-xs text-white/30 mb-3 font-semibold uppercase tracking-wider">
                      vs {getMonthName(prevComparison.period.month)} — к {new Date().getDate()} числу
                    </p>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        {
                          label: 'Выручка',
                          current: d.breakdown.revenue_fact,
                          prev: prevComparison.revenue_at_same_day,
                          format: formatMoney,
                        },
                        {
                          label: 'Сделки',
                          current: d.deals_count,
                          prev: prevComparison.deals_at_same_day,
                          format: String,
                        },
                        {
                          label: 'Точки',
                          current: d.breakdown.units_fact,
                          prev: prevComparison.units_at_same_day,
                          format: String,
                        },
                        {
                          label: 'Встречи',
                          current: d.breakdown.meetings_fact,
                          prev: prevComparison.meetings_at_same_day,
                          format: String,
                        },
                      ].map(item => {
                        const diff = item.current - item.prev
                        const isUp = diff > 0
                        const isDown = diff < 0
                        return (
                          <div key={item.label} className="flex flex-col gap-1">
                            <p className="text-xs text-white/40">{item.label}</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-semibold text-white">{item.format(item.current)}</span>
                              <span className={cn('text-xs font-medium',
                                isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-white/30'
                              )}>
                                {isUp ? '↑' : isDown ? '↓' : '='} {item.format(Math.abs(diff))}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/25">в прошлом: {item.format(item.prev)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
                  <div className="glass rounded-2xl p-6">
                    <h2 className="text-lg font-heading font-semibold text-white mb-5 flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-400" /> Выполнение плана
                    </h2>
                    <div className="space-y-5">
                      <ProgressBar label="Выручка (факт)" value={d.breakdown.revenue_fact} max={d.breakdown.revenue_plan} percent={d.breakdown.revenue_percent} formatValue={formatMoney} />
                      <ProgressBar label="Выручка (прогноз)" value={d.breakdown.revenue_forecast} max={d.breakdown.revenue_plan} percent={d.breakdown.revenue_forecast_percent} formatValue={formatMoney} />
                      <ProgressBar label="Точки" value={d.breakdown.units_fact} max={d.breakdown.units_plan} percent={d.breakdown.units_percent} />
                      <ProgressBar label="Встречи" value={d.breakdown.meetings_fact} max={d.breakdown.meetings_plan} percent={d.breakdown.meetings_percent} />
                    </div>
                  </div>

                  <div className="glass rounded-2xl p-6">
                    <h2 className="text-lg font-heading font-semibold text-white mb-5 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-400" /> Расчёт ЗП
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

                <div className="glass rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-heading font-semibold text-white flex items-center gap-2">
                      <Handshake className="w-5 h-5 text-blue-400" /> Последние сделки
                    </h2>
                    {!isViewingAs && (
                      <button onClick={() => router.push('/deals')} className="text-sm text-blue-400 hover:text-blue-500 font-medium flex items-center gap-1 transition">
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

          {/* БОНДА Dashboard */}
          {bondaData && (() => {
            const bd = bondaData
            const salary = bd.salary
            const paidDeals = bd.deals.filter((d: any) => d.status === 'paid')
            const fdCount = paidDeals.filter((d: any) => d.product_type === 'findir').length
            const biCount = paidDeals.filter((d: any) => d.product_type === 'bonda_bi').length
            const otCount = paidDeals.filter((d: any) => d.product_type === 'one_time_service').length
            const totalRevenue = paidDeals.reduce((s: number, d: any) => s + Number(d.revenue), 0)

            return (
              <>
                <div className="flex items-center justify-between mb-6 lg:mb-8">
                  <div>
                    <h1 className="text-xl lg:text-2xl font-heading font-bold text-white">
                      {period ? `${getMonthName(period.month)} ${period.year}` : 'Дашборд'}
                    </h1>
                    <p className="text-white/40 mt-1 text-sm">
                      {isViewingAs ? `Дашборд — ${viewAsUser?.full_name}` : 'Мой прогресс'}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 glass rounded-xl px-4 py-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-white/50">Период активен</span>
                  </div>
                </div>

                {/* БОНДА stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
                  <StatCard title="Итого ЗП" value={formatMoney(salary.total)} icon={Wallet} />
                  <StatCard title="Пуш-бонус" value={formatMoney(salary.push_bonus_total)} icon={TrendingUp} variant="accent" />
                  <StatCard title="KPI" value={formatMoney(salary.kpi_total)} subtitle={`записей: ${bd.kpiEntries.length}`} icon={Target} variant="success" />
                  <StatCard title="Сделок (оплач.)" value={String(paidDeals.length)} subtitle={`ФД: ${fdCount} · BI: ${biCount}`} icon={Handshake} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
                  {/* Продукты */}
                  <div className="glass rounded-2xl p-6">
                    <h2 className="text-lg font-heading font-semibold text-white mb-5 flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-400" /> Продукты
                    </h2>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                        <span className="text-sm text-purple-400">ФинДиров продано</span>
                        <span className="text-sm font-semibold text-white">{fdCount} шт.</span>
                      </div>
                      <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                        <span className="text-sm text-purple-400">Ставка ФД</span>
                        <span className={cn('text-sm font-semibold', salary.breakdown.fd_rate_applied >= 15 ? 'text-emerald-400' : 'text-white')}>
                          {salary.breakdown.fd_rate_applied}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                        <span className="text-sm text-cyan-400">Bonda BI</span>
                        <span className="text-sm font-semibold text-white">{biCount} шт.</span>
                      </div>
                      <div className="flex justify-between items-center py-2.5 border-b border-white/5">
                        <span className="text-sm text-orange-400">Разовые услуги</span>
                        <span className="text-sm font-semibold text-white">{otCount} шт.</span>
                      </div>
                      <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-white/10">
                        <span className="text-sm text-white/50">Выручка (оплачено)</span>
                        <span className="text-sm font-bold text-white">{formatMoney(totalRevenue)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Расчёт ЗП */}
                  <div className="glass rounded-2xl p-6">
                    <h2 className="text-lg font-heading font-semibold text-white mb-5 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-400" /> Расчёт ЗП
                    </h2>
                    <div className="space-y-3">
                      {[
                        { label: 'Оклад', value: salary.base_salary },
                        { label: 'KPI (записи)', value: salary.kpi_entries_bonus },
                        { label: bd.isJunior ? 'KPI (аттестация)' : 'KPI (конверсия)', value: salary.kpi_approval_bonus },
                        { label: 'Пуш-бонус ФД', value: salary.push_bonus_fd },
                        { label: 'Пуш-бонус BI', value: salary.push_bonus_bi },
                        { label: 'Пуш-бонус разовые', value: salary.push_bonus_one_time },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between items-center py-2.5 border-b border-white/5">
                          <span className="text-sm text-white/50">{item.label}</span>
                          <span className={cn('text-sm font-semibold', item.value > 0 ? 'text-white' : 'text-white/20')}>
                            {formatMoney(Number(item.value))}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-white/10">
                        <span className="font-heading font-semibold text-white">Итого</span>
                        <span className="text-xl font-bold text-blue-400">{formatMoney(Number(salary.total))}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Последние сделки */}
                <div className="glass rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-heading font-semibold text-white flex items-center gap-2">
                      <Handshake className="w-5 h-5 text-blue-400" /> Последние сделки
                    </h2>
                    {!isViewingAs && (
                      <button onClick={() => router.push('/deals')} className="text-sm text-blue-400 hover:text-blue-500 font-medium flex items-center gap-1 transition">
                        Все сделки <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {bd.deals.length === 0 ? (
                      <p className="text-white/40 text-sm text-center py-8">Нет сделок за этот период</p>
                    ) : (
                      bd.deals.slice(0, 5).map((deal: any, i: number) => (
                        <div key={deal.id || i} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/5 transition">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm",
                              deal.product_type === 'findir' ? 'bg-purple-500/20 text-purple-400' :
                              deal.product_type === 'bonda_bi' ? 'bg-cyan-500/20 text-cyan-400' :
                              'bg-orange-500/20 text-orange-400'
                            )}>
                              {deal.client_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-white">{deal.client_name}</p>
                              <p className="text-xs text-white/40">
                                {deal.product_type === 'findir' ? 'ФинДир' :
                                 deal.product_type === 'bonda_bi' ? 'Bonda BI' : 'Разовая'}
                                {deal.subscription_period && ` · ${
                                  deal.subscription_period === 'month' ? 'мес' :
                                  deal.subscription_period === 'quarter' ? 'кв' :
                                  deal.subscription_period === 'half_year' ? '6 мес' : 'год'
                                }`}
                              </p>
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
        </div>
      </main>
    </div>
  )
}
