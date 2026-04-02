'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Eye, Plus, X, Check, Trash2, Pencil, ExternalLink, ClipboardCheck } from 'lucide-react'
import MobileRestricted from '@/components/MobileRestricted'
import Sidebar from '@/components/Sidebar'
import ViewAsBar from '@/components/ViewAsBar'
import CustomSelect from '@/components/CustomSelect'
import { cn, formatMoney } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { useViewAs } from '@/lib/view-as-context'
import { getCurrentUser, getActivePeriod, getMeetings, upsertMeeting, getKpiEntries, createKpiEntry, updateKpiEntry, deleteKpiEntry } from '@/lib/supabase/queries'

type MeetingField = 'scheduled' | 'new_completed' | 'repeat_completed' | 'mentor' | 'next_day' | 'rescheduled' | 'invoiced_sum' | 'paid_sum'

type RowConfig = { key: MeetingField; label: string; bondaLabel?: string; isMoney?: boolean }

const ROW_CONFIG: RowConfig[] = [
  { key: 'scheduled', label: 'Назначенных на утро', bondaLabel: 'Встречи на сегодня' },
  { key: 'new_completed', label: 'Проведенных новых', bondaLabel: 'Проведено новых' },
  { key: 'repeat_completed', label: 'Проведенных повторных', bondaLabel: 'Проведено повторных' },
  { key: 'mentor', label: 'Встреч как ментор', bondaLabel: 'Назначено check-up' },
  { key: 'next_day', label: 'Встреч на завтра', bondaLabel: 'Разобрано check-up' },
  { key: 'rescheduled', label: 'Перенесённых', bondaLabel: 'Перенесённых' },
  { key: 'invoiced_sum', label: 'Выставленные счета ₽', bondaLabel: 'Выставленные счета ₽', isMoney: true },
  { key: 'paid_sum', label: 'Оплаченные счета ₽', bondaLabel: 'Оплаченные счета ₽', isMoney: true },
]

const ALL_FIELDS: MeetingField[] = ROW_CONFIG.map(r => r.key)

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}`
}

function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()]
}

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      days.push(dateStr)
    }
  }
  return days
}

const BONDA_KPI_PRODUCTS = [
  { value: 'Чек-Ап', label: 'Чек-Ап' },
  { value: 'ФД', label: 'ФД' },
  { value: 'Bonda BI', label: 'Bonda BI' },
  { value: 'Другое', label: 'Другое' },
]

const INNO_KPI_PRODUCTS = [
  { value: 'Новый клиент', label: 'Новый клиент' },
  { value: 'Повторный', label: 'Повторный' },
  { value: 'Ментор', label: 'Ментор' },
  { value: 'Другое', label: 'Другое' },
]

const EMPTY_KPI_FORM = {
  entry_date: new Date().toISOString().slice(0, 10),
  client_name: '',
  amo_link: '',
  product: '',
  comment: '',
}

export default function MeetingsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const { viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs } = useViewAs()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [meetings, setMeetings] = useState<any[]>([])
  const [cellValues, setCellValues] = useState<Record<string, string>>({})
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // KPI entries state
  const [kpiEntries, setKpiEntries] = useState<any[]>([])
  const [showKpiForm, setShowKpiForm] = useState(false)
  const [editingKpi, setEditingKpi] = useState<any>(null)
  const [kpiForm, setKpiForm] = useState(EMPTY_KPI_FORM)
  const [kpiSaving, setKpiSaving] = useState(false)
  const [kpiError, setKpiError] = useState('')

  const cellKey = (date: string, field: MeetingField) => `${date}__${field}`

  // Load current user once
  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)
      } catch (err) {
        console.error('Meetings load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  // Load meetings data — re-runs when viewAsUser changes
  useEffect(() => {
    if (!user) return
    const targetUserId = effectiveUserId(user.id)
    const targetCompanyId = effectiveCompanyId(user.company_id)

    // Admin without viewAs — show empty (director/rop see own data)
    if (user.role === 'admin' && !isViewingAs) {
      setMeetings([])
      setPeriod(null)
      setCellValues({})
      setKpiEntries([])
      return
    }

    async function loadMeetings() {
      try {
        const activePeriod = await getActivePeriod(supabase, targetCompanyId)
        if (!activePeriod) { setPeriod(null); setMeetings([]); setCellValues({}); setKpiEntries([]); return }
        setPeriod(activePeriod)

        const meetingsData = await getMeetings(supabase, targetUserId, activePeriod.id)
        setMeetings(meetingsData || [])

        // Load KPI entries for all companies
        const kpiData = await getKpiEntries(supabase, targetUserId, activePeriod.id)
        setKpiEntries(kpiData)

        // Initialize cell values
        const initial: Record<string, string> = {}
        const days = getDaysInMonth(activePeriod.year, activePeriod.month)
        for (const day of days) {
          const m = (meetingsData || []).find((mt: any) => mt.date === day)
          for (const field of ALL_FIELDS) {
            const val = m ? (m[field] || 0) : 0
            initial[cellKey(day, field)] = val > 0 ? String(val) : ''
          }
        }
        setCellValues(initial)
      } catch (err) {
        console.error('Meetings load error:', err)
      }
    }
    loadMeetings()
  }, [supabase, user, viewAsUser, effectiveUserId, effectiveCompanyId, isViewingAs])

  const handleChange = useCallback((key: string, value: string) => {
    const clean = value.replace(/\D/g, '')
    setCellValues(prev => ({ ...prev, [key]: clean }))
    setDirtyKeys(prev => new Set(prev).add(key))

    // Debounce: автосохранение через 800мс после последнего ввода
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(() => {
      // Триггерим blur-сохранение через фокус
      inputRefs.current[key]?.blur()
    }, 800)
  }, [])

  const handleBlur = useCallback(async (key: string) => {
    if (!dirtyKeys.has(key) || !user || !period) return

    const [date, field] = key.split('__') as [string, MeetingField]
    const newValue = parseInt(cellValues[key]) || 0

    setDirtyKeys(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
    setSavingKeys(prev => new Set(prev).add(key))

    try {
      const existing = meetings.find(m => m.date === date)
      const meetingData: any = {
        user_id: user.id,
        period_id: period.id,
        date,
        scheduled: existing?.scheduled || 0,
        new_completed: existing?.new_completed || 0,
        repeat_completed: existing?.repeat_completed || 0,
        mentor: existing?.mentor || 0,
        next_day: existing?.next_day || 0,
        rescheduled: existing?.rescheduled || 0,
        invoiced_sum: existing?.invoiced_sum || 0,
        paid_sum: existing?.paid_sum || 0,
        [field]: newValue,
      }
      await upsertMeeting(supabase, meetingData)

      setMeetings(prev => {
        const idx = prev.findIndex(m => m.date === date)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], [field]: newValue }
          return updated
        }
        return [...prev, meetingData]
      })
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [dirtyKeys, cellValues, meetings, user, period, supabase])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, date: string, field: MeetingField, allDays: string[]) => {
    const fieldIdx = ALL_FIELDS.indexOf(field)
    const dayIdx = allDays.indexOf(date)
    let nextField: MeetingField | null = null
    let nextDate: string | null = null

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (dayIdx < allDays.length - 1) {
        nextDate = allDays[dayIdx + 1]
        nextField = field
      } else if (fieldIdx < ALL_FIELDS.length - 1) {
        nextDate = allDays[0]
        nextField = ALL_FIELDS[fieldIdx + 1]
      }
    } else if (e.key === 'ArrowRight') {
      if (dayIdx < allDays.length - 1) { nextDate = allDays[dayIdx + 1]; nextField = field }
    } else if (e.key === 'ArrowLeft') {
      if (dayIdx > 0) { nextDate = allDays[dayIdx - 1]; nextField = field }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (fieldIdx < ALL_FIELDS.length - 1) { nextDate = date; nextField = ALL_FIELDS[fieldIdx + 1] }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (fieldIdx > 0) { nextDate = date; nextField = ALL_FIELDS[fieldIdx - 1] }
    }

    if (nextDate && nextField) {
      const nextKey = cellKey(nextDate, nextField)
      inputRefs.current[nextKey]?.focus()
      inputRefs.current[nextKey]?.select()
    }
  }, [])

  // === KPI handlers ===
  const viewCompName = isViewingAs ? (viewAsUser?.company?.name || '') : (user?.company?.name || '')
  const isBonda = viewCompName.toUpperCase().includes('БОНД')

  async function handleKpiSave(e: React.FormEvent) {
    e.preventDefault()
    setKpiSaving(true)
    setKpiError('')
    try {
      const entryData = {
        entry_date: kpiForm.entry_date,
        client_name: kpiForm.client_name,
        amo_link: kpiForm.amo_link || undefined,
        product: kpiForm.product,
        comment: kpiForm.comment || undefined,
      }
      if (editingKpi) {
        await updateKpiEntry(supabase, editingKpi.id, entryData)
      } else {
        await createKpiEntry(supabase, { ...entryData, user_id: user.id, period_id: period.id })
      }
      const targetUserId = effectiveUserId(user.id)
      const data = await getKpiEntries(supabase, targetUserId, period.id)
      setKpiEntries(data)
      setShowKpiForm(false)
      setEditingKpi(null)
      setKpiForm(EMPTY_KPI_FORM)
    } catch (err: any) {
      setKpiError(err.message || 'Ошибка при сохранении')
    } finally {
      setKpiSaving(false)
    }
  }

  async function handleKpiDelete(entryId: string) {
    if (!confirm('Удалить запись KPI?')) return
    try {
      await deleteKpiEntry(supabase, entryId)
      const targetUserId = effectiveUserId(user.id)
      const data = await getKpiEntries(supabase, targetUserId, period.id)
      setKpiEntries(data)
    } catch (err: any) {
      alert(err.message || 'Ошибка удаления')
    }
  }

  function openKpiEdit(entry: any) {
    setEditingKpi(entry)
    setKpiForm({
      entry_date: entry.entry_date,
      client_name: entry.client_name,
      amo_link: entry.amo_link || '',
      product: entry.product || 'Чек-Ап',
      comment: entry.comment || '',
    })
    setShowKpiForm(true)
    setKpiError('')
  }

  function openKpiNew() {
    setEditingKpi(null)
    setKpiForm(EMPTY_KPI_FORM)
    setShowKpiForm(true)
    setKpiError('')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    )
  }

  const year = period?.year || 2026
  const month = period?.month || 3
  const allDays = getDaysInMonth(year, month)

  const monthName = period
    ? `${['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][period.month - 1]} ${period.year}`
    : '...'

  const today = new Date().toISOString().slice(0, 10)

  // Summary stats from cellValues
  const totalCompleted = allDays.reduce((s, d) =>
    s + (parseInt(cellValues[cellKey(d, 'new_completed')]) || 0)
      + (parseInt(cellValues[cellKey(d, 'repeat_completed')]) || 0), 0)
  const totalRescheduled = allDays.reduce((s, d) =>
    s + (parseInt(cellValues[cellKey(d, 'rescheduled')]) || 0), 0)
  const totalScheduled = allDays.reduce((s, d) =>
    s + (parseInt(cellValues[cellKey(d, 'scheduled')]) || 0), 0)

  return (
    <MobileRestricted>
    <div className="flex h-screen">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <ViewAsBar userRole={user?.role || 'manager'} />

          {/* Empty prompt for admin without viewAs */}
          {user?.role === 'admin' && !isViewingAs && (
            <div className="glass rounded-2xl p-12 text-center">
              <Eye className="w-12 h-12 text-white/15 mx-auto mb-4" />
              <h2 className="text-lg font-heading font-bold text-white mb-2">Выберите менеджера</h2>
              <p className="text-sm text-white/40">Нажмите «Выбрать менеджера» чтобы просмотреть его встречи</p>
            </div>
          )}

          {(isViewingAs || user?.role !== 'admin') && (<>
          <div className="mb-6">
            <h1 className="font-heading text-2xl font-bold text-white">Встречи</h1>
            <p className="text-blue-400 text-sm mt-1">
              {monthName}{isViewingAs ? ` — ${viewAsUser?.full_name}` : ''}
            </p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-blue-400 mb-1">Назначено</p>
              <p className="text-2xl font-bold text-white">{totalScheduled}</p>
            </div>
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-blue-400 mb-1">Проведено</p>
              <p className="text-2xl font-bold text-emerald-600">{totalCompleted}</p>
              <p className="text-[10px] text-blue-400 mt-0.5">новых + повторных</p>
            </div>
            <div className="rounded-xl glass p-4">
              <p className="text-xs text-blue-400 mb-1">Перенесено</p>
              <p className="text-2xl font-bold text-amber-600">{totalRescheduled}</p>
            </div>
          </div>

          <div className="rounded-xl glass overflow-x-auto">
            <table className="text-xs border-collapse w-max">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-[#151929] text-white text-left py-2 px-3 font-semibold min-w-[200px] border-r border-white/20">
                    Показатель
                  </th>
                  {allDays.map((date) => {
                    const isToday = date === today
                    return (
                      <th
                        key={date}
                        className={cn(
                          'text-center py-1.5 px-1 font-semibold min-w-[52px] border-r border-white/20 last:border-r-0',
                          isToday ? 'bg-blue-600 text-white' : 'bg-white/10 text-white'
                        )}
                      >
                        <div className="text-[10px] opacity-70">{getDayName(date)}</div>
                        <div>{formatDateShort(date)}</div>
                      </th>
                    )
                  })}
                  <th className="sticky right-0 z-20 bg-[#151929] text-white text-center py-1.5 px-2 font-semibold min-w-[70px] border-l-2 border-white/20">
                    Итого
                  </th>
                </tr>
              </thead>

              <tbody>
                {ROW_CONFIG.map((row, rowIdx) => {
                  const isMoney = row.isMoney
                  const isEven = rowIdx % 2 === 0

                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        'border-b border-white/10 last:border-b-0',
                        isMoney ? 'bg-emerald-500/10' : isEven ? 'bg-white/5' : 'bg-white/2'
                      )}
                    >
                      <td className={cn(
                        'sticky left-0 z-10 py-2 px-3 font-medium text-white border-r border-white/10 whitespace-nowrap text-xs',
                        isMoney ? 'bg-[#0f1a1a]' : 'bg-[#111827]'
                      )}>
                        {isBonda && row.bondaLabel ? row.bondaLabel : row.label}
                      </td>

                      {allDays.map((date) => {
                        const isToday = date === today
                        const field = row.key
                        const key = cellKey(date, field)
                        const isSaving = savingKeys.has(key)

                        return (
                          <td key={date} className={cn(
                            'py-0.5 px-0.5 text-center border-r border-white/10 last:border-r-0',
                            isToday && 'bg-blue-500/10'
                          )}>
                            <input
                              ref={(el) => { inputRefs.current[key] = el }}
                              type="text"
                              inputMode="numeric"
                              readOnly={isViewingAs}
                              value={cellValues[key] ?? ''}
                              onChange={(e) => !isViewingAs && handleChange(key, e.target.value)}
                              onBlur={() => !isViewingAs && handleBlur(key)}
                              onKeyDown={(e) => handleKeyDown(e, date, field, allDays)}
                              onFocus={(e) => e.target.select()}
                              className={cn(
                                'w-full h-7 text-center text-xs rounded-sm border-0 outline-none transition-colors',
                                'focus:ring-2 focus:ring-blue-400 focus:bg-white/10 focus:shadow-sm',
                                'hover:bg-white/10',
                                isSaving ? 'bg-yellow-500/20 text-yellow-200' : 'bg-transparent',
                                cellValues[key] ? (isMoney ? 'text-emerald-400 font-medium' : 'text-white font-medium') : 'text-white/30'
                              )}
                              placeholder="·"
                            />
                          </td>
                        )
                      })}

                      <td className={cn(
                        'sticky right-0 z-10 py-1.5 px-2 text-center font-bold text-xs border-l-2 border-white/20',
                        isMoney ? 'text-emerald-400 bg-[#0f1a1a]' : 'text-white bg-[#111827]'
                      )}>
                        {(() => {
                          const total = allDays.reduce((s, d) => s + (parseInt(cellValues[cellKey(d, row.key)]) || 0), 0)
                          if (total === 0) return '—'
                          return isMoney ? formatMoney(total) : total
                        })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* KPI записи */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-heading font-bold text-white">KPI записи</h2>
                  <p className="text-xs text-white/40 mt-0.5">
                    Встречи и чек-апы · {kpiEntries.length} записей · {new Set(kpiEntries.map((e: any) => e.client_name?.toLowerCase().trim())).size} уник. клиентов
                  </p>
                </div>
                {!showKpiForm && user?.role === 'manager' && !isViewingAs && (
                  <button onClick={openKpiNew}
                    className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors">
                    <Plus size={16} />
                    Новая запись
                  </button>
                )}
              </div>

              {/* KPI Form */}
              {showKpiForm && (
                <div className="mb-6 rounded-xl glass p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-white">
                      {editingKpi ? 'Редактировать запись' : 'Новая запись'}
                    </h3>
                    <button onClick={() => { setShowKpiForm(false); setEditingKpi(null); setKpiForm(EMPTY_KPI_FORM) }}
                      className="rounded-lg p-1.5 text-blue-400 hover:bg-white/5">
                      <X size={16} />
                    </button>
                  </div>

                  {kpiError && (
                    <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">{kpiError}</div>
                  )}

                  <form onSubmit={handleKpiSave}>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Дата *</label>
                        <input type="date" required value={kpiForm.entry_date}
                          onChange={(e) => setKpiForm({ ...kpiForm, entry_date: e.target.value })}
                          onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none date-input-clean cursor-pointer" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Клиент *</label>
                        <input type="text" required value={kpiForm.client_name}
                          onChange={(e) => setKpiForm({ ...kpiForm, client_name: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          placeholder="Компания" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Продукт</label>
                        <CustomSelect value={kpiForm.product} onChange={(v) => setKpiForm({ ...kpiForm, product: v })} options={isBonda ? BONDA_KPI_PRODUCTS : INNO_KPI_PRODUCTS} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">AMO CRM</label>
                        <input type="text" value={kpiForm.amo_link}
                          onChange={(e) => setKpiForm({ ...kpiForm, amo_link: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          placeholder="https://..." />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/60 mb-1">Комментарий</label>
                        <input type="text" value={kpiForm.comment}
                          onChange={(e) => setKpiForm({ ...kpiForm, comment: e.target.value })}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                          placeholder="Заметка..." />
                      </div>
                    </div>
                    <button type="submit" disabled={kpiSaving}
                      className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors">
                      {kpiSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      {editingKpi ? 'Сохранить' : 'Добавить'}
                    </button>
                  </form>
                </div>
              )}

              {/* KPI Entries Table */}
              <div className="rounded-xl glass overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="px-3 py-3 text-left text-xs font-semibold text-white">Дата</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-white">Клиент</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-white">Продукт</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-white">AMO</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-white">Комментарий</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-white"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiEntries.length > 0 ? kpiEntries.map((entry: any) => (
                      <tr key={entry.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-3 py-2.5 text-xs text-white">
                          {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white bg-emerald-500">
                              {entry.client_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="text-xs font-medium text-white">{entry.client_name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-white/10 text-blue-400">
                            {entry.product || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {entry.amo_link ? (
                            <a href={entry.amo_link} target="_blank" rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-xs">
                              <ExternalLink size={12} /> AMO
                            </a>
                          ) : (
                            <span className="text-xs text-white/20">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-white/50 max-w-[180px] truncate">{entry.comment || '—'}</td>
                        <td className="px-3 py-2.5">
                          {user?.role === 'manager' && !isViewingAs && (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openKpiEdit(entry)}
                                className="rounded p-1.5 text-blue-400 hover:bg-white/5 transition-colors">
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => handleKpiDelete(entry.id)}
                                className="rounded p-1.5 text-red-400 hover:bg-red-50/10 transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-xs text-white/30">
                          <ClipboardCheck className="w-6 h-6 mx-auto mb-1.5 text-white/10" />
                          Нет записей за этот период
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </>)}
        </div>
      </main>
    </div>
    </MobileRestricted>
  )
}
