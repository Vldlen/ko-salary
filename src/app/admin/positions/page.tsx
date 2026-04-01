'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Building2, Plus, X } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser } from '@/lib/supabase/queries'
import { getPositions, getCompanies, createPosition } from '@/lib/supabase/admin-queries'

export default function AdminPositionsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [positions, setPositions] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', company_id: '' })

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser(supabase)
        if (!user) { router.push('/login'); return }
        if (!['admin', 'director'].includes(user.role)) { router.push('/dashboard'); return }
        setCurrentUser(user)

        const [posData, compData] = await Promise.all([
          getPositions(supabase),
          getCompanies(supabase),
        ])
        setPositions(posData)
        setCompanies(compData)
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
      await createPosition(supabase, form)
      const posData = await getPositions(supabase)
      setPositions(posData)
      setShowForm(false)
      setForm({ name: '', company_id: '' })
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={currentUser?.role || 'admin'} userName={currentUser?.full_name || ''} companyName={currentUser?.company?.name || 'ИННО'} />

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Building2 className="w-7 h-7 text-blue-400" />
              <h1 className="text-2xl font-heading font-bold text-white">Должности</h1>
            </div>
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-blue-400 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition">
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Отмена' : 'Новая должность'}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="glass rounded-2xl p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Название</label>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none"
                    placeholder="Менеджер отдела продаж" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Компания</label>
                  <select required value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none">
                    <option value="">Выберите</option>
                    {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="bg-blue-400 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-50">
                {saving ? 'Создаём...' : 'Создать должность'}
              </button>
            </form>
          )}

          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-white/50 uppercase">Должность</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-white/50 uppercase">Компания</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-white/50 uppercase">Схемы мотивации</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p: any) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-6 py-4 text-sm font-medium text-white">{p.name}</td>
                    <td className="px-6 py-4 text-sm text-white/70">{p.company?.name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-white/70">
                      {p.motivation_schemas?.length > 0
                        ? p.motivation_schemas.map((s: any) => s.name).join(', ')
                        : <span className="text-white/30">Нет схем</span>
                      }
                    </td>
                  </tr>
                ))}
                {positions.length === 0 && (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-white/40">Нет должностей</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
