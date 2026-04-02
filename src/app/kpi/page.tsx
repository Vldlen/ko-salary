'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, X, Check, Trash2, Pencil, ClipboardCheck, ExternalLink } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import ViewAsBar from '@/components/ViewAsBar'
import CustomSelect from '@/components/CustomSelect'
import { formatMoney, cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { useViewAs } from '@/lib/view-as-context'
import { getCurrentUser, getActivePeriod, getKpiEntries, createKpiEntry, updateKpiEntry, deleteKpiEntry } from '@/lib/supabase/queries'

const PRODUCT_OPTIONS = [
  { value: 'Чек-Ап', label: 'Чек-Ап' },
  { value: 'ФД', label: 'ФД' },
  { value: 'Bonda BI', label: 'Bonda BI' },
  { value: 'Другое', label: 'Другое' },
]

const EMPTY_FORM = {
  entry_date: new Date().toISOString().slice(0, 10),
  client_name: '',
  amo_link: '',
  product: 'Чек-Ап',
  comment: '',
}

export default function KpiPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const { viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs } = useViewAs()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([])

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingEntry, setEditingEntry] = useState<any>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)
      } catch (err) {
        console.error('KPI load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  useEffect(() => {
    if (!user) return
    const targetUserId = effectiveUserId(user.id)
    const targetCompanyId = effectiveCompanyId(user.company_id)

    async function loadEntries() {
      try {
        const activePeriod = await getActivePeriod(supabase, targetCompanyId)
        if (!activePeriod) { setPeriod(null); setEntries([]); return }
        setPeriod(activePeriod)
        const data = await getKpiEntries(supabase, targetUserId, activePeriod.id)
        setEntries(data)
      } catch (err) {
        console.error('KPI entries load error:', err)
      }
    }
    loadEntries()
  }, [supabase, user, viewAsUser, effectiveUserId, effectiveCompanyId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const entryData = {
        entry_date: form.entry_date,
        client_name: form.client_name,
        amo_link: form.amo_link || undefined,
        product: form.product,
        comment: form.comment || undefined,
      }

      if (editingEntry) {
        await updateKpiEntry(supabase, editingEntry.id, entryData)
      } else {
        await createKpiEntry(supabase, {
          ...entryData,
          user_id: user.id,
          period_id: period.id,
        })
      }

      const targetUserId = effectiveUserId(user.id)
      const data = await getKpiEntries(supabase, targetUserId, period.id)
      setEntries(data)
      setShowForm(false)
      setEditingEntry(null)
      setForm(EMPTY_FORM)
    } catch (err: any) {
      setError(err.message || 'Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(entryId: string) {
    if (!confirm('Удалить запись KPI?')) return
    try {
      await deleteKpiEntry(supabase, entryId)
      const targetUserId = effectiveUserId(user.id)
      const data = await getKpiEntries(supabase, targetUserId, period.id)
      setEntries(data)
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления')
    }
  }

  function openEdit(entry: any) {
    setEditingEntry(entry)
    setForm({
      entry_date: entry.entry_date,
      client_name: entry.client_name,
      amo_link: entry.amo_link || '',
      product: entry.product || 'Чек-Ап',
      comment: entry.comment || '',
    })
    setShowForm(true)
    setError('')
  }

  function openNew() {
    setEditingEntry(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setError('')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  // Count unique clients
  const uniqueClients = new Set(entries.map(e => e.client_name.toLowerCase().trim())).size

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }

  return (
    <MobileRestricted>
    <div className="flex h-screen">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || ''} />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <ViewAsBar userRole={user?.role || 'manager'} />

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold text-white">KPI записи</h1>
              <p className="text-sm text-white/40 mt-1">Встречи и чек-апы с клиентами</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg glass px-4 py-2">
              <span className="text-sm font-medium text-white">
                {period ? `${['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'][period.month-1]} ${period.year}` : '...'}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-3 gap-4">
            <div className="rounded-2xl glass p-6">
              <p className="text-sm font-medium text-blue-400">Записей за месяц</p>
              <p className="font-heading text-2xl font-bold text-white mt-2">{entries.length}</p>
            </div>
            <div className="rounded-2xl glass p-6">
              <p className="text-sm font-medium text-blue-400">Уникальных клиентов</p>
              <p className="font-heading text-2xl font-bold text-white mt-2">{uniqueClients}</p>
            </div>
            <div className="rounded-2xl glass p-6">
              <p className="text-sm font-medium text-emerald-400">Статус KPI</p>
              <p className={cn(
                "font-heading text-2xl font-bold mt-2",
                uniqueClients >= 5 ? 'text-emerald-400' : 'text-white/40'
              )}>
                {uniqueClients >= 5 ? 'Выполнен' : `${uniqueClients} / 5+`}
              </p>
            </div>
          </div>

          {/* Form */}
          {showForm && (
            <div className="mb-8 rounded-2xl glass p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">
                  {editingEntry ? 'Редактировать запись' : 'Новая запись'}
                </h2>
                <button onClick={() => { setShowForm(false); setEditingEntry(null); setForm(EMPTY_FORM) }}
                  className="rounded-lg p-2 text-blue-400 hover:bg-white/5">
                  <X size={20} />
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
              )}

              <form onSubmit={handleSave}>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Дата *</label>
                    <input type="date" required value={form.entry_date}
                      onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none date-input-clean cursor-pointer" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Клиент *</label>
                    <input type="text" required value={form.client_name}
                      onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      placeholder="Название компании" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Продукт</label>
                    <CustomSelect value={form.product} onChange={(v) => setForm({ ...form, product: v })} options={PRODUCT_OPTIONS} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Ссылка AMO CRM</label>
                    <input type="text" value={form.amo_link}
                      onChange={(e) => setForm({ ...form, amo_link: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      placeholder="https://..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-white mb-1">Комментарий</label>
                    <input type="text" value={form.comment}
                      onChange={(e) => setForm({ ...form, comment: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                      placeholder="Заметка..." />
                  </div>
                </div>

                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-3 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  {editingEntry ? 'Сохранить' : 'Добавить запись'}
                </button>
              </form>
            </div>
          )}

          {/* Entries Table */}
          <div className="mb-8 overflow-x-auto rounded-2xl glass">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">Дата</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">Клиент</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">Продукт</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">AMO</th>
                  <th className="px-4 py-4 text-left text-sm font-semibold text-white">Комментарий</th>
                  <th className="px-4 py-4 text-right text-sm font-semibold text-white">Действия</th>
                </tr>
              </thead>
              <tbody>
                {entries.length > 0 ? entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4 text-sm text-white">{formatDate(entry.entry_date)}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-white bg-emerald-500">
                          {entry.client_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="text-sm font-medium text-white">{entry.client_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full px-3 py-1 text-xs font-semibold bg-white/10 text-blue-400">
                        {entry.product || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {entry.amo_link ? (
                        <a href={entry.amo_link} target="_blank" rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm">
                          <ExternalLink size={14} /> AMO
                        </a>
                      ) : (
                        <span className="text-sm text-white/20">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-white/60 max-w-[200px] truncate">{entry.comment || '—'}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(entry)}
                          className="rounded-lg p-2 text-blue-400 hover:bg-white/5 transition-colors"
                          title="Редактировать">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(entry.id)}
                          className="rounded-lg p-2 text-red-400 hover:bg-red-50/10 transition-colors"
                          title="Удалить">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-blue-400">
                      <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-white/15" />
                      Нет записей за этот период
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add button */}
          {!showForm && user?.role === 'manager' && !isViewingAs && (
            <button onClick={openNew}
              className="flex items-center gap-2 rounded-2xl bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-600">
              <Plus size={20} />
              Новая запись
            </button>
          )}
        </div>
      </main>
    </div>
    </MobileRestricted>
  )
}
