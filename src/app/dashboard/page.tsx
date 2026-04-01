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
import {
  Wallet, TrendingUp, Handshake, CalendarDays,
  Target, BarChart3, ChevronRight, Loader2
} from 'lucide-react'

export default function DashboardPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) {
          router.push('/login')
          return
        }
        setUser(currentUser)

        const activePeriod = await getActivePeriod(supabase, currentUser.company_id)
        if (!activePeriod) {
          setLoading(false)
          return
        }
        setPeriod(activePeriod)

        const dashData = await getDashboardData(supabase, currentUser.id, activePeriod.id)
        setData(dashData)
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  if (!user || !data) {
    return (
      <div className="flex min-h-screen">
        <Sidebar role="manager" userName="..." companyName="..." />
        <main className="flex-1 p-8">
          <div className="text-center text-white/40 mt-20">
            Нет данных. Убедитесь, что создан активный период.
          </div>
        </main>
      </div>
    )
  }

  const d = data
  const salary = d.salary || { base_salary: 0, kpi_quality: 0, kpi_quantity: 0, margin_bonus: 0, total: 0, forecast_total: 0 }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={user.role}
        userName={user.full_name}
        companyName={user.company?.name || 'ИННО'}
      />

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-heading font-bold text-white">
                {period ? `${getMonthName(period.month)} ${period.year}` : 'Дашборд'}
              </h1>
              <p className="text-white/40 mt-1">Мой прогресс</p>
            </div>
            <div className="flex items-center gap-2 glass rounded-xl px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-white/50">Период активен</span>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Текущая ЗП"
              value={formatMoney(salary.total)}
              icon={Wallet}
            />
            <StatCard
              title="Прогноз ЗП"
              value={formatMoney(salary.forecast_total)}
              icon={TrendingUp}
              variant="accent"
              trend={{
                value: `+${formatMoney(salary.forecast_total - salary.total)}`,
                positive: true,
              }}
            />
            <StatCard
              title="Сделки"
              value={String(d.deals_count)}
              subtitle={`${d.breakdown.units_fact} точек подключено`}
              icon={Handshake}
            />
            <StatCard
              title="Встречи"
              value={`${d.breakdown.meetings_fact} / ${d.breakdown.meetings_plan}`}
              subtitle={`${d.breakdown.meetings_percent}% плана`}
              icon={CalendarDays}
              variant="success"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Plan progress */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-heading font-semibold text-white mb-5 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" />
                Выполнение плана
              </h2>
              <div className="space-y-5">
                <ProgressBar
                  label="Выручка (факт)"
                  value={d.breakdown.revenue_fact}
                  max={d.breakdown.revenue_plan}
                  percent={d.breakdown.revenue_percent}
                  formatValue={formatMoney}
                />
                <ProgressBar
                  label="Выручка (прогноз)"
                  value={d.breakdown.revenue_forecast}
                  max={d.breakdown.revenue_plan}
                  percent={d.breakdown.revenue_forecast_percent}
                  formatValue={formatMoney}
                />
                <ProgressBar
                  label="Точки"
                  value={d.breakdown.units_fact}
                  max={d.breakdown.units_plan}
                  percent={d.breakdown.units_percent}
                />
                <ProgressBar
                  label="Встречи"
                  value={d.breakdown.meetings_fact}
                  max={d.breakdown.meetings_plan}
                  percent={d.breakdown.meetings_percent}
                />
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
                    <span className="text-sm font-semibold text-white">
                      {formatMoney(Number(item.value))}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-white/10">
                  <span className="font-heading font-semibold text-white">Итого</span>
                  <span className="text-xl font-bold text-blue-400">
                    {formatMoney(Number(salary.total))}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-orange-500/15 rounded-xl px-4 py-3 -mx-1">
                  <span className="text-sm font-medium text-orange-400">Прогноз</span>
                  <span className="text-lg font-bold text-orange-400">
                    {formatMoney(Number(salary.forecast_total))}
                  </span>
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
              <button
                onClick={() => router.push('/deals')}
                className="text-sm text-blue-400 hover:text-blue-500 font-medium flex items-center gap-1 transition"
              >
                Все сделки <ChevronRight className="w-4 h-4" />
              </button>
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
                      <span className={cn(
                        'text-xs font-medium px-2.5 py-1 rounded-full',
                        getDealStatusColor(deal.status)
                      )}>
                        {getDealStatusLabel(deal.status)}
                      </span>
                      <span className="text-sm font-semibold text-white w-28 text-right">
                        {formatMoney(Number(deal.revenue))}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
