'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserCog, Plus, X, Check, Ban } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser } from '@/lib/supabase/queries'
import { getUsers, getCompanies, getPositions, createUserProfile, updateUserProfile } from '@/lib/supabase/admin-queries'

const ROLES = [
  { value: 'manager', label: 'Менеджер' },
  { value: 'rop', label: 'РОП' },
  { value: 'director', label: 'Комдир' },
  { value: 'admin', label: 'Администратор' },
]

export default function AdminUsersPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    email: '', full_name: '', password: '', role: 'manager', company_id: '', position_id: ''
  })

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser(supabase)
        if (!user) { router.push('/login'); return }
        if (!['admin', 'director'].includes(user.role)) { router.push('/dashboard'); return }
        setCurrentUser(user)

        const [usersData, companiesData, positionsData] = await Promise.all([
          getUsers(supabase),
          getCompanies(supabase),
          getPositions(supabase),
        ])
        setUsers(usersData)
        setCompanies(companiesData)
        setPositions(positionsData)
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
    setError('')
    try {
      await createUserProfile(supabase, {
        email: form.email,
        full_name: form.full_name,
        password: form.password,
        role: form.role,
        company_id: form.company_id,
        position_id: form.position_id,
      })
      // Refresh users list
      const usersData = await getUsers(supabase)
      setUsers(usersData)
      setShowForm(false)
      setForm({ email: '', full_name: '', password: '', role: 'manager', company_id: '', position_id: '' })
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании пользователя')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(userId: string, currentActive: boolean) {
    try {
      await updateUserProfile(supabase, userId, { is_active: !currentActive })
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentActive } : u))
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-brand-50"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>
  }

  const filteredPositions = form.company_id
    ? positions.filter((p: any) => p.company_id === form.company_id)
    : positions

  return (
    <div className="flex min-h-screen bg-brand-50">
      <Sidebar role={currentUser?.role || 'admin'} userName={currentUser?.full_name || ''} companyName={currentUser?.company?.name || 'ИННО'} />

      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <UserCog className="w-7 h-7 text-brand-400" />
              <h1 className="text-2xl font-heading font-bold text-brand-900">Сотрудники</h1>
              <span className="text-sm text-gray-400 bg-brand-100 px-2 py-0.5 rounded-full">{users.length}</span>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-brand-400 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Отмена' : 'Добавить сотрудника'}
            </button>
          </div>

          {/* Create form */}
          {showForm && (
            <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-brand-100 p-6 mb-6">
              <h2 className="text-lg font-semibold text-brand-900 mb-4">Новый сотрудник</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">ФИО</label>
                  <input type="text" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 outline-none"
                    placeholder="Иванов Иван Иванович" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 outline-none"
                    placeholder="ivan@inno.team" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Пароль</label>
                  <input type="text" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 outline-none"
                    placeholder="Минимум 6 символов" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Роль</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 outline-none">
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Компания</label>
                  <select required value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value, position_id: '' })}
                    className="w-full px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 outline-none">
                    <option value="">Выберите компанию</option>
                    {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Должность</label>
                  <select required value={form.position_id} onChange={e => setForm({ ...form, position_id: e.target.value })}
                    className="w-full px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-xl text-sm focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 outline-none">
                    <option value="">Выберите должность</option>
                    {filteredPositions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              {error && <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-xl mb-4">{error}</div>}
              <button type="submit" disabled={saving}
                className="bg-brand-400 hover:bg-brand-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-50">
                {saving ? 'Создаём...' : 'Создать сотрудника'}
              </button>
            </form>
          )}

          {/* Users table */}
          <div className="bg-white rounded-2xl border border-brand-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-100 bg-brand-50">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Сотрудник</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Роль</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Компания</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Должность</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Статус</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-brand-50 hover:bg-brand-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-sm">
                          {u.full_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-brand-900">{u.full_name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full',
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'director' ? 'bg-blue-100 text-blue-700' :
                        u.role === 'rop' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      )}>
                        {ROLES.find(r => r.value === u.role)?.label || u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{u.company?.name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{u.position?.name || '—'}</td>
                    <td className="px-6 py-4">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full',
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      )}>
                        {u.is_active ? 'Активен' : 'Отключён'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => toggleActive(u.id, u.is_active)}
                        className={cn('text-xs font-medium px-3 py-1.5 rounded-lg transition',
                          u.is_active
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                        )}
                      >
                        {u.is_active ? <Ban className="w-4 h-4 inline mr-1" /> : <Check className="w-4 h-4 inline mr-1" />}
                        {u.is_active ? 'Отключить' : 'Включить'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Нет сотрудников</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
