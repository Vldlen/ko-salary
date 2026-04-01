'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Wallet, TrendingUp } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { formatMoney, getMonthName, cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getSalaryResult, getSalaryHistory } from '@/lib/supabase/queries'

export default function SalaryPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [salary, setSalary] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)

        const activePeriod = await getActivePeriod(supabase, currentUser.company_id)
        if (!activePeriod) { setLoading(false); return }
        setPeriod(activePeriod)

        const [salaryData, historyData] = await Promise.all([
          getSalaryResult(supabase, currentUser.id, activePeriod.id),
          getSalaryHistory(supabase, currentUser.id),
        ])
        setSalary(salaryData)
        setHistory(historyData)
      } catch (err) {
        console.error('Salary load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    )
  }

  const s = salary || { base_salary: 0, kpi_quality: 0, kpi_quantity: 0, margin_bonus: 0, extra_bonus: 0, deduction: 0, total: 0, forecast_total: 0 }
  const diff = Number(s.forecast_total) - Number(s.total)
  const diffPct = Number(s.total) > 0 ? Math.round(diff / Number(s.total) * 100) : 0

  const items = [
    { label: 'Оклад', value: Number(s.base_salary), max: Number(s.base_salary) || 80000 },
    { label: 'KPI качественный (встречи)', value: Number(s.kpi_quality), max: 15000 },
    { label: 'KPI количественный (точки)', value: Number(s.kpi_quantity), max: 10000 },
    { label: 'Маржа с оборудования', value: Number(s.margin_bonus), max: 15000 },
    { label: 'Разовый бонус', value: Number(s.extra_bonus), max: Number(s.extra_bonus) || 5000 },
    { label: 'Депремирование', value: Number(s.deduction), max: 0, negative: true },
  ]

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-heading font-bold text-brand-900 mb-6">Расчёт зарплаты</h1>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center">
              <Wallet className="w-6 h-6 text-brand-300 mb-2" />
              <p className="text-sm text-gray-400 mb-1">Текущая зарплата</p>
              <p className="text-3xl font-bold text-brand-500">{formatMoney(Number(s.total))}</p>
            </div>
            <div className="bg-orange-50 rounded-2xl border border-orange-200 p-6 flex flex-col items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-300 mb-2" />
              <p className="text-sm text-orange-600 mb-1">Прогноз</p>
              <p className="text-3xl font-bold text-accent">{formatMoney(Number(s.forecast_total))}</p>
              {diff > 0 && <p className="text-sm text-green-600 mt-1">+{formatMoney(diff)} ({diffPct}%)</p>}
            </div>
          </div>

          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-heading font-semibold text-brand-900 mb-4">Детализация</h2>
            {items.map(item => (
              <div key={item.label} className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-gray-500">{item.label}</span>
                  <span className={cn('text-sm font-semibold', item.negative ? 'text-red-600' : 'text-brand-900')}>
                    {item.negative ? '−' : ''}{formatMoney(item.value)}
                  </span>
                </div>
                {item.max > 0 && !item.negative && (
                  <div className="h-1.5 rounded-full bg-brand-100">
                    <div className="h-1.5 rounded-full bg-brand-400" style={{ width: `${Math.min(100, (item.value / item.max) * 100)}%` }} />
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-between pt-4 mt-2 border-t-2 border-brand-100">
              <span className="font-bold text-brand-900">Итого к выплате</span>
              <span className="text-2xl font-bold text-brand-500">{formatMoney(Number(s.total))}</span>
            </div>
          </div>

          {history.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-heading font-semibold text-brand-900 mb-4">История</h2>
              <div className="flex gap-3">
                {history.map((h: any) => (
                  <div key={h.id} className={cn('flex-1 rounded-xl p-4 text-center', h.period_id === period?.id ? 'bg-orange-50' : 'bg-brand-50')}>
                    <p className={cn('text-xs', h.period_id === period?.id ? 'text-orange-600' : 'text-gray-400')}>
                      {h.period ? getMonthName(h.period.month) : '—'}
                      {h.period_id === period?.id && ' (текущий)'}
                    </p>
                    <p className={cn('text-lg font-bold mt-1', h.period_id === period?.id ? 'text-accent' : 'text-brand-900')}>
                      {formatMoney(Number(h.total))}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
