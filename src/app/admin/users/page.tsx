'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, UserCog, Plus, X, Check, Ban, Copy, Eye, EyeOff, Pencil } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser } from '@/lib/supabase/queries'
import { getUsers, getCompanies, getPositions, updateUserProfile } from '@/lib/supabase/admin-queries'

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
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [createdCreds, setCreatedCreds] = useState<{ login: string; password: string; name: string } | null>(null)
  const [editUser, setEditUser] = useState<any>(null)
  const [editForm, setEditForm] = useState({ company_id: '', position_id: '', role: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '', role: 'manager', company_id: '', position_id: ''
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
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          role: form.role,
          company_id: form.company_id,
          position_id: form.position_id,
        }),
      })
      const result = await res.json()
      if (!res.ok) {
        throw new Error(result.error || 'Ошибка при создании пользователя')
      }

      // Show credentials modal
      setCreatedCreds({
        login: result.credentials.login,
        password: result.credentials.password,
        name: form.full_name,
      })

      // Refresh users list
      const usersData = await getUsers(supabase)
      setUsers(usersData)
      setShowForm(false)
      setForm({ full_name: '', role: 'manager', company_id: '', position_id: '' })
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании пользователя')
    } finally {
      setSaving(false)
    }
  }

  async function blockUser(userId: string) {
    try {
      await updateUserProfile(supabase, userId, { is_active: false })
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: false } : u))
    } catch (err: any) { alert('Ошибка: ' + err.message) }
  }

  async function unblockUser(userId: string) {
    try {
      await updateUserProfile(supabase, userId, { is_active: true, fired_at: null })
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: true, fired_at: null } : u))
    } catch (err: any) { alert('Ошибка: ' + err.message) }
  }

  async function fireUser(userId: string) {
    if (!confirm('Уволить сотрудника? Данные сохранятся, но доступ будет закрыт.')) return
    try {
      const fired_at = new Date().toISOString()
      await updateUserProfile(supabase, userId, { is_active: false, fired_at })
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: false, fired_at } : u))
    } catch (err: any) { alert('Ошибка: ' + err.message) }
  }

  function getUserStatus(u: any): { label: string; color: string } {
    if (u.fired_at) return { label: 'Уволен', color: 'bg-red-500/20 text-red-300' }
    if (!u.is_active) return { label: 'Заблокирован', color: 'bg-orange-500/20 text-orange-300' }
    return { label: 'Активен', color: 'bg-green-500/20 text-green-300' }
  }

  function openEditUser(u: any) {
    setEditUser(u)
    setEditForm({
      company_id: u.company_id || '',
      position_id: u.position_id || '',
      role: u.role || 'manager',
    })
  }

  async function saveEditUser() {
    if (!editUser) return
    setEditSaving(true)
    try {
      const updates: any = { role: editForm.role }
      if (['manager', 'rop'].includes(editForm.role)) {
        updates.company_id = editForm.company_id || null
        updates.position_id = editForm.position_id || null
      } else {
        updates.company_id = null
        updates.position_id = null
      }
      await updateUserProfile(supabase, editUser.id, updates)
      // Refresh users to get joined company/position names
      const usersData = await getUsers(supabase)
      setUsers(usersData)
      setEditUser(null)
    } catch (err: any) {
      alert('Ошибка: ' + err.message)
    } finally {
      setEditSaving(false)
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
  }

  const filteredPositions = form.company_id
    ? positions.filter((p: any) => p.company_id === form.company_id)
    : positions

  return (
    <MobileRestricted>
    <div className="flex min-h-screen">
      <Sidebar role={currentUser?.role || 'admin'} userName={currentUser?.full_name || ''} companyName={currentUser?.company?.name || 'ИННО'} />

      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <UserCog className="w-7 h-7 text-blue-400" />
              <h1 className="text-2xl font-heading font-bold text-white">Сотрудники</h1>
              <span className="text-sm text-white/50 bg-white/10 px-2 py-0.5 rounded-full">{users.length}</span>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-blue-400 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Отмена' : 'Добавить сотрудника'}
            </button>
          </div>

          {/* Create form — no email/password, just name + role + company + position */}
          {showForm && (
            <form onSubmit={handleCreate} className="glass rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-1">Новый сотрудник</h2>
              <p className="text-sm text-white/40 mb-4">Логин и пароль создадутся автоматически</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-white/70 mb-1">ФИО</label>
                  <input type="text" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 outline-none"
                    placeholder="Петров Владлен Игоревич" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-1">Роль</label>
                  <select value={form.role} onChange={e => {
                      const role = e.target.value
                      setForm({ ...form, role, ...(!['manager', 'rop'].includes(role) ? { company_id: '', position_id: '' } : {}) })
                    }}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 outline-none">
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                {['manager', 'rop'].includes(form.role) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">Компания</label>
                      <select required value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value, position_id: '' })}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 outline-none">
                        <option value="">Выберите компанию</option>
                        {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-white/70 mb-1">Должность</label>
                      <select required value={form.position_id} onChange={e => setForm({ ...form, position_id: e.target.value })}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 outline-none">
                        <option value="">Выберите должность</option>
                        {filteredPositions.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
              </div>
              {error && <div className="text-red-400 text-sm bg-red-500/10 px-4 py-2 rounded-xl mb-4 border border-red-500/20">{error}</div>}
              <button type="submit" disabled={saving}
                className="bg-blue-400 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-50">
                {saving ? 'Создаём...' : 'Создать сотрудника'}
              </button>
            </form>
          )}

          {/* Credentials modal — shown after successful creation */}
          {createdCreds && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setCreatedCreds(null)}>
              <div className="glass-strong rounded-2xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-heading font-bold text-white">Сотрудник создан</h3>
                  <button onClick={() => setCreatedCreds(null)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-white/50 mb-4">Передайте эти данные сотруднику <span className="text-white font-medium">{createdCreds.name}</span></p>

                <div className="space-y-3">
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-white/40 mb-1">Ссылка</p>
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono text-emerald-400 truncate">{typeof window !== 'undefined' ? window.location.origin : ''}</code>
                      <button onClick={() => copyToClipboard(typeof window !== 'undefined' ? window.location.origin : '', 'modal-url')}
                        className="text-white/40 hover:text-white p-1 transition shrink-0">
                        {copiedId === 'modal-url' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-white/40 mb-1">Логин</p>
                    <div className="flex items-center justify-between">
                      <code className="text-lg font-mono text-blue-400">{createdCreds.login}</code>
                      <button onClick={() => copyToClipboard(createdCreds.login, 'modal-login')}
                        className="text-white/40 hover:text-white p-1 transition">
                        {copiedId === 'modal-login' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-white/40 mb-1">Пароль</p>
                    <div className="flex items-center justify-between">
                      <code className="text-lg font-mono text-orange-400">{createdCreds.password}</code>
                      <button onClick={() => copyToClipboard(createdCreds.password, 'modal-pass')}
                        className="text-white/40 hover:text-white p-1 transition">
                        {copiedId === 'modal-pass' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button onClick={() => {
                  const url = typeof window !== 'undefined' ? window.location.origin : ''
                  copyToClipboard(`${url}\nЛогин: ${createdCreds.login}\nПароль: ${createdCreds.password}`, 'modal-all')
                }}
                  className="w-full mt-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium text-sm px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                  {copiedId === 'modal-all' ? <><Check className="w-4 h-4" /> Скопировано!</> : <><Copy className="w-4 h-4" /> Скопировать всё</>}
                </button>
              </div>
            </div>
          )}

          {/* Edit user modal */}
          {editUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditUser(null)}>
              <div className="glass-strong rounded-2xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-heading font-bold text-white">Редактировать</h3>
                  <button onClick={() => setEditUser(null)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-white/50 mb-4">{editUser.full_name}</p>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Роль</label>
                    <select value={editForm.role} onChange={e => {
                        const role = e.target.value
                        setEditForm(prev => ({ ...prev, role, ...(!['manager', 'rop'].includes(role) ? { company_id: '', position_id: '' } : {}) }))
                      }}
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-blue-400/30">
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>

                  {['manager', 'rop'].includes(editForm.role) && (
                    <>
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Компания</label>
                        <select value={editForm.company_id} onChange={e => setEditForm(prev => ({ ...prev, company_id: e.target.value, position_id: '' }))}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-blue-400/30">
                          <option value="">Не выбрано</option>
                          {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1">Должность</label>
                        <select value={editForm.position_id} onChange={e => setEditForm(prev => ({ ...prev, position_id: e.target.value }))}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-blue-400/30">
                          <option value="">Не выбрано</option>
                          {positions.filter((p: any) => !editForm.company_id || p.company_id === editForm.company_id).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>

                <button onClick={saveEditUser} disabled={editSaving}
                  className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-medium text-sm px-4 py-2.5 rounded-xl transition disabled:opacity-50">
                  {editSaving ? 'Сохраняю...' : 'Сохранить'}
                </button>
              </div>
            </div>
          )}

          {/* Users table */}
          <div className="glass rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">Сотрудник</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">Логин</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">Пароль</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">Роль</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">Компания</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white/50 uppercase tracking-wider">Статус</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-white/50 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {u.full_name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{u.full_name}</p>
                          <p className="text-xs text-white/30 truncate">{u.position?.name || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <code className="text-sm font-mono text-blue-400">{u.login || '—'}</code>
                        {u.login && (
                          <button onClick={() => copyToClipboard(u.login, `login-${u.id}`)}
                            className="text-white/30 hover:text-white transition p-0.5">
                            {copiedId === `login-${u.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {u.password_plain ? (
                          <>
                            <code className="text-sm font-mono text-white/60">
                              {showPasswords[u.id] ? u.password_plain : '•••••••'}
                            </code>
                            <button onClick={() => setShowPasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                              className="text-white/30 hover:text-white transition p-0.5">
                              {showPasswords[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => copyToClipboard(u.password_plain, `pass-${u.id}`)}
                              className="text-white/30 hover:text-white transition p-0.5">
                              {copiedId === `pass-${u.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-white/30">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full',
                        u.role === 'admin' ? 'bg-purple-500/20 text-purple-300' :
                        u.role === 'director' ? 'bg-blue-500/20 text-blue-300' :
                        u.role === 'rop' ? 'bg-green-500/20 text-green-300' :
                        'bg-white/10 text-white/70'
                      )}>
                        {ROLES.find(r => r.value === u.role)?.label || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70 whitespace-nowrap">{u.company?.name || '—'}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const status = getUserStatus(u)
                        return (
                          <div>
                            <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full', status.color)}>
                              {status.label}
                            </span>
                            {u.fired_at && (
                              <p className="text-[10px] text-white/30 mt-1">
                                {new Date(u.fired_at).toLocaleDateString('ru-RU')}
                              </p>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditUser(u)}
                          className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition text-blue-400 hover:bg-blue-500/10"
                          title="Редактировать"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {u.is_active && !u.fired_at && (
                          <>
                            <button
                              onClick={() => blockUser(u.id)}
                              className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition text-orange-400 hover:bg-orange-500/10"
                              title="Заблокировать"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => fireUser(u.id)}
                              className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition text-red-400 hover:bg-red-500/10"
                              title="Уволить"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {(!u.is_active || u.fired_at) && (
                          <button
                            onClick={() => unblockUser(u.id)}
                            className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition text-green-400 hover:bg-green-500/10"
                            title="Разблокировать"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">Нет сотрудников</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
    </MobileRestricted>
  )
}
