'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Wallet, TrendingUp, Eye } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import ViewAsBar from '@/components/ViewAsBar'
import { formatMoney, getMonthName, cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { useViewAs } from '@/lib/view-as-context'
import { getCurrentUser, getActivePeriod, getSalaryResult, getSalaryHistory, getBondaDashboardData } from '@/lib/supabase/queries'

export default function SalaryPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const { viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs } = useViewAs()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [salary, setSalary] = useState<any>(null)
  const [bondaData, setBondaData] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [isBonda, setIsBonda] = useState(false)

  // Load current user once
  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)
      } catch (err) {
        console.error('Salary load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  // Load salary data — re-runs when viewAsUser changes
  useEffect(() => {
    if (!user) return
    const targetUserId = effectiveUserId(user.id)
    const targetCompanyId = effectiveCompanyId(user.company_id)

    // Detect БОНДА
    const companyName = isViewingAs ? (viewAsUser?.company?.name || '') : (user.company?.name || '')
    const bonda = companyName.toUpperCase().includes('БОНД')
    setIsBonda(bonda)

    // Admin/director/rop without viewAs — show empty
    if (['admin', 'director', 'rop'].includes(user.role) && !isViewingAs) {
      setSalary(null)
      setBondaData(null)
      setPeriod(null)
      setHistory([])
      return
    }

    async function loadSalary() {
      try {
        const activePeriod = await getActivePeriod(supabase, targetCompanyId)
        if (!activePeriod) { setPeriod(null); setSalary(null); setBondaData(null); setHistory([]); return }
        setPeriod(activePeriod)

        if (bonda) {
          // БОНДА: real-time calculation
          const data = await getBondaDashboardData(supabase, targetUserId, activePeriod.id)
          setBondaData(data)
          setSalary(null)
        } else {
          // ИННО: from salary_results table
          const [salaryData, historyData] = await Promise.all([
            getSalaryResult(supabase, targetUserId, activePeriod.id),
            getSalaryHistory(supabase, targetUserId),
          ])
          setSalary(salaryData)
          setBondaData(null)
          setHistory(historyData)
        }
      } catch (err) {
        console.error('Salary load error:', err)
      }
    }
    loadSalary()
  }, [supabase, user, viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  // БОНДА salary breakdown
  const bs = bondaData?.salary
  const bondaItems = bs ? [
    { label: 'Оклад', value: bs.base_salary, max: bs.base_salary || 30000 },
    { label: 'KPI за записи (встречи/чекапы)', value: bs.kpi_entries_bonus, max: bs.kpi_entries_bonus + bs.kpi_approval_bonus || 20000 },
    { label: 'KPI аттестация / конверсия', value: bs.kpi_approval_bonus, max: bs.kpi_entries_bonus + bs.kpi_approval_bonus || 20000 },
    { label: 'Пуш-бонус ФинДир', value: bs.push_bonus_fd, max: Math.max(bs.push_bonus_fd, 10000) },
    { label: 'Пуш-бонус Bonda BI', value: bs.push_bonus_bi, max: Math.max(bs.push_bonus_bi, 5000) },
    { label: 'Пуш-бонус разовые услуги', value: bs.push_bonus_one_time, max: Math.max(bs.push_bonus_one_time, 5000) },
  ] : []

  // ИННО salary breakdown
  const s = salary || { base_salary: 0, kpi_quality: 0, kpi_quantity: 0, margin_bonus: 0, extra_bonus: 0, deduction: 0, total: 0, forecast_total: 0 }
  const innoItems = [
    { label: 'Оклад', value: Number(s.base_salary), max: Number(s.base_salary) || 80000 },
    { label: 'KPI качественный (встречи)', value: Number(s.kpi_quality), max: 15000 },
    { label: 'KPI количественный (точки)', value: Number(s.kpi_quantity), max: 10000 },
    { label: 'Маржа с оборудования', value: Number(s.margin_bonus), max: 15000 },
    { label: 'Разовый бонус', value: Number(s.extra_bonus), max: Number(s.extra_bonus) || 5000 },
    { label: 'Депремирование', value: Number(s.deduction), max: 0, negative: true },
  ]

  const items = isBonda ? bondaItems : innoItems
  const totalSalary = isBonda ? (bs?.total || 0) : Number(s.total)
  const forecastTotal = isBonda ? (bs?.total || 0) : Number(s.forecast_total)

  // БОНДА extra stats
  const breakdown = bs?.breakdown

  return (
    <MobileRestricted>
    <div className="flex min-h-screen">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <ViewAsBar userRole={user?.role || 'manager'} />

          {/* Empty prompt for admin without viewAs */}
          {['admin', 'director', 'rop'].includes(user?.role) && !isViewingAs && (
            <div className="glass rounded-2xl p-12 text-center">
              <Eye className="w-12 h-12 text-white/15 mx-auto mb-4" />
              <h2 className="text-lg font-heading font-bold text-white mb-2">Выберите менеджера</h2>
              <p className="text-sm text-white/40">Нажмите «Выбрать менеджера» чтобы просмотреть расчёт ЗП</p>
            </div>
          )}

          {(isViewingAs || !['admin', 'director', 'rop'].includes(user?.role)) && (<>
          <h1 className="text-2xl font-heading font-bold text-white mb-1">Расчёт зарплаты</h1>
          {isViewingAs && <p className="text-white/40 text-sm mb-6">ЗП — {viewAsUser?.full_name}</p>}
          {!isViewingAs && <div className="mb-6" />}

          <div className={cn('grid gap-4 mb-6', isBonda ? 'grid-cols-3' : 'grid-cols-2')}>
            <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-400 mb-2" />
              <p className="text-sm text-white/40 mb-1">{isBonda ? 'Итого ЗП' : 'Текущая зарплата'}</p>
              <p className="text-3xl font-bold text-blue-400">{formatMoney(totalSalary)}</p>
            </div>
            {isBonda ? (
              <>
                <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center">
                  <p className="text-sm text-white/40 mb-1">Пуш-бонус</p>
                  <p className="text-3xl font-bold text-emerald-400">{formatMoney(bs?.push_bonus_total || 0)}</p>
                </div>
                <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center">
                  <p className="text-sm text-white/40 mb-1">KPI</p>
                  <p className="text-3xl font-bold text-orange-400">{formatMoney(bs?.kpi_total || 0)}</p>
                </div>
              </>
            ) : (
              <div className="bg-orange-500/15 rounded-2xl border border-orange-500/30 p-6 flex flex-col items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-400 mb-2" />
                <p className="text-sm text-orange-400 mb-1">Прогноз</p>
                <p className="text-3xl font-bold text-orange-400">{formatMoney(forecastTotal)}</p>
                {forecastTotal - totalSalary > 0 && totalSalary > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    +{formatMoney(forecastTotal - totalSalary)} ({Math.round((forecastTotal - totalSalary) / totalSalary * 100)}%)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Детализация */}
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-heading font-semibold text-white mb-4">Детализация</h2>
            {items.map(item => (
              <div key={item.label} className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-white/50">{item.label}</span>
                  <span className={cn('text-sm font-semibold', ('negative' in item && item.negative) ? 'text-red-600' : 'text-white')}>
                    {('negative' in item && item.negative) ? '−' : ''}{formatMoney(item.value)}
                  </span>
                </div>
                {item.max > 0 && !('negative' in item && item.negative) && (
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${Math.min(100, item.max > 0 ? (item.value / item.max) * 100 : 0)}%` }} />
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-between pt-4 mt-2 border-t-2 border-white/10">
              <span className="font-bold text-white">Итого к выплате</span>
              <span className="text-2xl font-bold text-blue-400">{formatMoney(totalSalary)}</span>
            </div>
          </div>

          {/* БОНДА: breakdown by product */}
          {isBonda && breakdown && (breakdown.fd_deals?.length > 0 || breakdown.bi_deals?.length > 0 || breakdown.one_time_deals?.length > 0) && (
            <div className="glass rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-heading font-semibold text-white mb-4">Детализация по сделкам</h2>

              {breakdown.fd_deals?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-2">
                    ФинДир · ставка {breakdown.fd_rate_applied}% · {breakdown.fd_count} шт
                  </p>
                  {breakdown.fd_deals.map((d: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-white/5">
                      <span className="text-white/70">{d.client}</span>
                      <div className="flex gap-4">
                        <span className="text-white/30">{formatMoney(d.revenue)}</span>
                        <span className="text-emerald-400 font-medium w-24 text-right">+{formatMoney(d.bonus)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {breakdown.bi_deals?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Bonda BI</p>
                  {breakdown.bi_deals.map((d: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-white/5">
                      <span className="text-white/70">{d.client}</span>
                      <div className="flex gap-4">
                        <span className="text-white/30">{formatMoney(d.revenue)}</span>
                        <span className="text-blue-400 font-medium w-24 text-right">+{formatMoney(d.bonus)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {breakdown.one_time_deals?.length > 0 && (
                <div>
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Разовые услуги</p>
                  {breakdown.one_time_deals.map((d: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-white/5">
                      <span className="text-white/70">{d.client}</span>
                      <div className="flex gap-4">
                        <span className="text-white/30">{formatMoney(d.revenue)}</span>
                        <span className="text-orange-400 font-medium w-24 text-right">+{formatMoney(d.bonus)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* БОНДА: KPI status */}
          {isBonda && breakdown && (
            <div className="glass rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-heading font-semibold text-white mb-4">Статус KPI</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-xs text-white/40 mb-1">KPI записей</p>
                  <p className="text-lg font-bold text-white">
                    {breakdown.kpi_entries_count} <span className="text-white/30">/ {breakdown.kpi_entries_target}</span>
                  </p>
                  <div className="h-1.5 rounded-full bg-white/10 mt-2">
                    <div className={cn('h-1.5 rounded-full', breakdown.kpi_entries_count >= breakdown.kpi_entries_target ? 'bg-emerald-400' : 'bg-orange-400')}
                      style={{ width: `${Math.min(100, (breakdown.kpi_entries_count / breakdown.kpi_entries_target) * 100)}%` }} />
                  </div>
                  <p className={cn('text-xs mt-1', breakdown.kpi_entries_count >= breakdown.kpi_entries_target ? 'text-emerald-400' : 'text-orange-400')}>
                    {breakdown.kpi_entries_count >= breakdown.kpi_entries_target ? '✓ Выполнено' : `Осталось ${breakdown.kpi_entries_target - breakdown.kpi_entries_count}`}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-xs text-white/40 mb-1">Аттестация / Конверсия</p>
                  <p className={cn('text-lg font-bold', bs?.kpi_approval_bonus > 0 ? 'text-emerald-400' : 'text-white/30')}>
                    {bs?.kpi_approval_bonus > 0 ? '✓ Одобрено' : 'Ожидание'}
                  </p>
                  <p className="text-xs text-white/30 mt-2">
                    Бонус: {formatMoney(bs?.kpi_approval_bonus || 0)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ИННО: history */}
          {!isBonda && history.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-heading font-semibold text-white mb-4">История</h2>
              <div className="flex gap-3">
                {history.map((h: any) => (
                  <div key={h.id} className={cn('flex-1 rounded-xl p-4 text-center', h.period_id === period?.id ? 'bg-orange-500/15' : 'bg-white/5')}>
                    <p className={cn('text-xs', h.period_id === period?.id ? 'text-orange-400' : 'text-white/40')}>
                      {h.period ? getMonthName(h.period.month) : '—'}
                      {h.period_id === period?.id && ' (текущий)'}
                    </p>
                    <p className={cn('text-lg font-bold mt-1', h.period_id === period?.id ? 'text-orange-400' : 'text-white')}>
                      {formatMoney(Number(h.total))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          </>)}
        </div>
      </main>
    </div>
    </MobileRestricted>
  )
}
