'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CalendarRange, Plus, X } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { cn, getMonthName } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser } from '@/lib/supabase/queries'
import { getPeriods, getCompanies, createPeriod, updatePeriodStatus } from '@/lib/supabase/admin-queries'

const STATUSES = [
  { value: 'draft', label: 'Черновик', cls: 'bg-gray-100 text-gray-700' },
  { value: 'active', label: 'Активен', cls: 'bg-green-100 text-green-700' },
  { value: 'closed', label: 'Закрыт', cls: 'bg-red-100 text-red-700' },
]

export default function AdminPeriodsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [periods, setPeriods] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ company_id: '', year: 2026, month: 4 })

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser(supabase)
        if (!user) { router.push('/login'); return }
        if (!['admin', 'director'].includes(user.role)) { router.push('/dashboard'); return }
        setCurrentUser(user)

        const [periodsData, companiesData] = await Promise.all([
          getPeriods(supabase),
          getCompanies(supabase),
        ])
        setPeriods(periodsData)
        setCompanies(companiesData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await createPeriod(supabase, form)
      const periodsData = await getPeriods(supabase)
      setPeriods(periodsData)
      setShowForm(false)
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(periodId: string, status: string) {
    try {
      await updatePeriodStatus(supabase, periodId, status)
      setPeriods(periods.map(p => p.id === periodId ? { ...p, status } : p))
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-brand-50"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
  }

  return (
    <div className="flex min-h-screen bg-brand-50">
      <Sidebar role={currentUser?.role || 'admin'} userName={currentUser?.full_name || ''} companyName={currentUser?.company?.name || 'ИННО'} />

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CalendarRange className="w-7 h-7 text-brand-400" />
              <h1 className="text-2xl font-heading font-bold text-brand-900">Периоды</h1>
            </div>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-brand-400 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition">
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Отмена' : 'Новый период'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-brand-100 p-6 mb-6">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Компания</label>
                  <select required value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}
                    className="w-full px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm outline-none">
                    <option value="">Выберите</option>
                    {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Год</label>
                  <input type="number" required value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Месяц</label>
                  <select required value={form.month} onChange={e => setForm({ ...form, month: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm outline-none">
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="bg-brand-400 hover:bg-brand-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-50">
                {saving ? 'Создаём...' : 'Создать период'}
              </button>
            </form>
          )}

          <div className="bg-white rounded-2xl border border-brand-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-100 bg-brand-50">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase">Период</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase">Компания</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase">Статус</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase">Действия</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p: any) => {
                  const st = STATUSES.find(s => s.value === p.status) || STATUSES[0]
                  return (
                    <tr key={p.id} className="border-b border-brand-50 hover:bg-brand-50/50 transition">
                      <td className="px-6 py-4 text-sm font-medium text-brand-900">{getMonthName(p.month)} {p.year}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.company?.name || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', st.cls)}>{st.label}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <select value={p.status} onChange={e => changeStatus(p.id, e.target.value)}
                          className="text-xs bg-brand-50 border border-brand-100 rounded-lg px-2 py-1.5 outline-none">
                          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  )
                })}
                {periods.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">Нет периодов</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
