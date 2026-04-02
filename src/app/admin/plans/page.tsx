'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Target, Save, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser } from '@/lib/supabase/queries'
import { getUsers, getCompanies, getPeriods, getIndividualPlans, upsertIndividualPlan } from '@/lib/supabase/admin-queries'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

interface PlanRow {
  user_id: string
  full_name: string
  revenue_plan: number
  units_plan: number
  mrr_plan: number
  findir_plan: number
  dirty: boolean
}

export default function AdminPlansPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [periods, setPeriods] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [plans, setPlans] = useState<Record<string, PlanRow>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const user = await getCurrentUser(supabase)
      if (!user) { router.push('/login'); return }
      if (!['admin', 'director', 'rop', 'founder'].includes(user.role)) { router.push('/dashboard'); return }
      setCurrentUser(user)

      const [usersData, companiesData, periodsData] = await Promise.all([
        getUsers(supabase),
        getCompanies(supabase),
        getPeriods(supabase),
      ])
      setUsers(usersData.filter((u: any) => u.is_active && !u.fired_at && u.role === 'manager'))
      setCompanies(companiesData)
      setPeriods(periodsData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => { loadData() }, [loadData])

  // Load plans when period changes
  useEffect(() => {
    async function loadPlans() {
      // Find period IDs for this month/year
      const matchedPeriods = periods.filter((p: any) => p.year === selectedYear && p.month === selectedMonth)
      if (matchedPeriods.length === 0) return

      const allPlans: any[] = []
      for (const p of matchedPeriods) {
        const data = await getIndividualPlans(supabase, p.id)
        allPlans.push(...data)
      }

      const planMap: Record<string, PlanRow> = {}
      for (const u of users) {
        const existing = allPlans.find((p: any) => p.user_id === u.id)
        planMap[u.id] = {
          user_id: u.id,
          full_name: u.full_name,
          revenue_plan: existing?.revenue_plan ?? 0,
          units_plan: existing?.units_plan ?? 0,
          mrr_plan: existing?.mrr_plan ?? 0,
          findir_plan: existing?.findir_plan ?? 0,
          dirty: false,
        }
      }
      setPlans(planMap)
    }
    if (periods.length > 0 && users.length > 0) {
      loadPlans()
    }
  }, [supabase, periods, users, selectedYear, selectedMonth])

  function updatePlan(userId: string, field: keyof PlanRow, value: number) {
    setPlans(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [field]: value, dirty: true }
    }))
  }

  async function savePlan(userId: string, companyId: string) {
    const plan = plans[userId]
    if (!plan) return

    const period = periods.find((p: any) => p.year === selectedYear && p.month === selectedMonth && p.company_id === companyId)
    if (!period) {
      alert('Период не найден. Создайте период для этого месяца.')
      return
    }

    setSaving(userId)
    try {
      await upsertIndividualPlan(supabase, {
        user_id: userId,
        period_id: period.id,
        company_id: companyId,
        revenue_plan: plan.revenue_plan || null,
        units_plan: plan.units_plan || null,
        mrr_plan: plan.mrr_plan || null,
        findir_plan: plan.findir_plan || null,
      })
      setPlans(prev => ({ ...prev, [userId]: { ...prev[userId], dirty: false } }))
      setSavedId(userId)
      setTimeout(() => setSavedId(null), 1500)
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  function changeMonth(delta: number) {
    let m = selectedMonth + delta
    let y = selectedYear
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setSelectedMonth(m)
    setSelectedYear(y)
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>

  const innoCompany = companies.find((c: any) => c.name?.toUpperCase().includes('ИНН'))
  const bondaCompany = companies.find((c: any) => c.name?.toUpperCase().includes('БОНД'))

  const innoUsers = users.filter((u: any) => u.company_id === innoCompany?.id)
  const bondaUsers = users.filter((u: any) => u.company_id === bondaCompany?.id)

  return (
    <MobileRestricted>
    <div className="flex min-h-screen">
      <Sidebar role={currentUser?.role || 'rop'} userName={currentUser?.full_name || ''} companyName={currentUser?.company?.name || ''} />

      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Target className="w-7 h-7 text-blue-400" />
              <h1 className="text-2xl font-heading font-bold text-white">Планы</h1>
            </div>

            {/* Month selector */}
            <div className="flex items-center gap-3">
              <button onClick={() => changeMonth(-1)} className="p-2 text-white/40 hover:text-white transition rounded-lg hover:bg-white/5">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center min-w-[160px]">
                <p className="text-lg font-heading font-bold text-white">{MONTHS[selectedMonth - 1]}</p>
                <p className="text-xs text-white/40">{selectedYear}</p>
              </div>
              <button onClick={() => changeMonth(1)} className="p-2 text-white/40 hover:text-white transition rounded-lg hover:bg-white/5">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Split screen */}
          <div className="grid grid-cols-2 gap-6">
            {/* ИННО */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 bg-blue-500/10">
                <h2 className="text-lg font-heading font-bold text-blue-400">ИННО</h2>
                <p className="text-xs text-white/40">Выручка, Штуки</p>
              </div>

              {innoUsers.length === 0 ? (
                <div className="p-8 text-center text-white/30 text-sm">Нет активных менеджеров</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {innoUsers.map((u: any) => {
                    const plan = plans[u.id]
                    if (!plan) return null
                    return (
                      <div key={u.id} className="px-5 py-4 hover:bg-white/5 transition">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-[10px]">
                              {u.full_name?.charAt(0)}
                            </div>
                            <p className="text-sm font-medium text-white">{u.full_name}</p>
                          </div>
                          <button
                            onClick={() => savePlan(u.id, innoCompany?.id)}
                            disabled={!plan.dirty || saving === u.id}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition',
                              plan.dirty
                                ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                : savedId === u.id
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'text-white/20 cursor-default'
                            )}
                          >
                            {saving === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> :
                              savedId === u.id ? <Check className="w-3 h-3" /> :
                              <Save className="w-3 h-3" />}
                            {saving === u.id ? '' : savedId === u.id ? 'Готово' : 'Сохр.'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-white/30 mb-0.5">Выручка ₽</label>
                            <input type="number" value={plan.revenue_plan || ''}
                              onChange={e => updatePlan(u.id, 'revenue_plan', Number(e.target.value))}
                              placeholder="0"
                              className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-blue-400/50" />
                          </div>
                          <div>
                            <label className="block text-[10px] text-white/30 mb-0.5">Штуки</label>
                            <input type="number" value={plan.units_plan || ''}
                              onChange={e => updatePlan(u.id, 'units_plan', Number(e.target.value))}
                              placeholder="0"
                              className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-blue-400/50" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* БОНДА */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 bg-orange-500/10">
                <h2 className="text-lg font-heading font-bold text-orange-400">БОНДА</h2>
                <p className="text-xs text-white/40">Штуки проданных ФИНДИРов</p>
              </div>

              {bondaUsers.length === 0 ? (
                <div className="p-8 text-center text-white/30 text-sm">Нет активных менеджеров</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {bondaUsers.map((u: any) => {
                    const plan = plans[u.id]
                    if (!plan) return null
                    return (
                      <div key={u.id} className="px-5 py-4 hover:bg-white/5 transition">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-[10px]">
                              {u.full_name?.charAt(0)}
                            </div>
                            <p className="text-sm font-medium text-white">{u.full_name}</p>
                          </div>
                          <button
                            onClick={() => savePlan(u.id, bondaCompany?.id)}
                            disabled={!plan.dirty || saving === u.id}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition',
                              plan.dirty
                                ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                                : savedId === u.id
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'text-white/20 cursor-default'
                            )}
                          >
                            {saving === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> :
                              savedId === u.id ? <Check className="w-3 h-3" /> :
                              <Save className="w-3 h-3" />}
                            {saving === u.id ? '' : savedId === u.id ? 'Готово' : 'Сохр.'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <label className="block text-[10px] text-white/30 mb-0.5">ФИНДИРы (шт.)</label>
                            <input type="number" value={plan.findir_plan || ''}
                              onChange={e => updatePlan(u.id, 'findir_plan', Number(e.target.value))}
                              placeholder="0"
                              className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white outline-none focus:border-orange-400/50" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
    </MobileRestricted>
  )
}
