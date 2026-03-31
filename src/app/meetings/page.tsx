'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, ChevronDown } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { cn } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getMeetings, upsertMeeting } from '@/lib/supabase/queries'

interface MeetingRow {
  id?: string
  user_id: string
  period_id: string
  date: string
  scheduled: number
  new_completed: number
  repeat_completed: number
  mentor: number
  next_day: number
  rescheduled: number
}

const FIELDS = ['scheduled', 'new_completed', 'repeat_completed', 'mentor', 'next_day', 'rescheduled'] as const
type MeetingField = typeof FIELDS[number]

function formatDateRu(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  const dayName = days[date.getDay()]
  const day = date.getDate()
  return `${dayName}, ${day}`
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().slice(0, 10)
}

function groupByWeek(data: MeetingRow[]): Map<string, MeetingRow[]> {
  const weeks = new Map<string, MeetingRow[]>()
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date))
  for (const row of sorted) {
    const monday = getMonday(row.date)
    if (!weeks.has(monday)) weeks.set(monday, [])
    weeks.get(monday)!.push(row)
  }
  return weeks
}

function weekSum(rows: MeetingRow[], field: MeetingField): number {
  return rows.reduce((sum, row) => sum + (row[field] || 0), 0)
}

function getNextWorkday(meetings: MeetingRow[]): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find the latest date in existing meetings
  const existingDates = new Set(meetings.map(m => m.date))

  // Start from today or the day after the latest meeting
  let candidate = new Date(today)
  if (meetings.length > 0) {
    const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date))
    const lastDate = new Date(sorted[0].date + 'T00:00:00')
    if (lastDate >= today) {
      candidate = new Date(lastDate)
      candidate.setDate(candidate.getDate() + 1)
    }
  }

  // Skip weekends and existing dates
  for (let i = 0; i < 30; i++) {
    const dayOfWeek = candidate.getDay()
    const dateStr = candidate.toISOString().slice(0, 10)
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !existingDates.has(dateStr)) {
      return dateStr
    }
    candidate.setDate(candidate.getDate() + 1)
  }

  return candidate.toISOString().slice(0, 10)
}

export default function MeetingsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const [editingCell, setEditingCell] = useState<{ date: string; field: MeetingField } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)

        const activePeriod = await getActivePeriod(supabase, currentUser.company_id)
        if (!activePeriod) { setLoading(false); return }
        setPeriod(activePeriod)

        const meetingsData = await getMeetings(supabase, currentUser.id, activePeriod.id)
        setMeetings(meetingsData || [])
      } catch (err) {
        console.error('Meetings load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  const handleCellClick = useCallback((date: string, field: MeetingField, currentValue: number) => {
    setEditingCell({ date, field })
    setEditValue(String(currentValue))
  }, [])

  const handleCellSave = useCallback(async () => {
    if (!editingCell || !user || !period) return
    setSaving(true)
    try {
      const newValue = parseInt(editValue) || 0
      const existing = meetings.find(m => m.date === editingCell.date)

      const meetingData = {
        user_id: user.id,
        period_id: period.id,
        date: editingCell.date,
        scheduled: existing?.scheduled || 0,
        new_completed: existing?.new_completed || 0,
        repeat_completed: existing?.repeat_completed || 0,
        mentor: existing?.mentor || 0,
        next_day: existing?.next_day || 0,
        rescheduled: existing?.rescheduled || 0,
        [editingCell.field]: newValue,
      }

      await upsertMeeting(supabase, meetingData)

      // Refresh data
      const meetingsData = await getMeetings(supabase, user.id, period.id)
      setMeetings(meetingsData || [])
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
      setEditingCell(null)
    }
  }, [editingCell, editValue, meetings, user, period, supabase])

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCellSave()
    if (e.key === 'Escape') setEditingCell(null)
  }, [handleCellSave])

  const handleAddDay = useCallback(async () => {
    if (!user || !period) return
    const nextDate = getNextWorkday(meetings)

    setSaving(true)
    try {
      await upsertMeeting(supabase, {
        user_id: user.id,
        period_id: period.id,
        date: nextDate,
        scheduled: 0,
        new_completed: 0,
        repeat_completed: 0,
        mentor: 0,
        next_day: 0,
        rescheduled: 0,
      })

      const meetingsData = await getMeetings(supabase, user.id, period.id)
      setMeetings(meetingsData || [])
    } catch (err) {
      console.error('Add day error:', err)
    } finally {
      setSaving(false)
    }
  }, [user, period, meetings, supabase])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    )
  }

  const weeks = groupByWeek(meetings)
  const totalScheduled = meetings.reduce((s, m) => s + (m.scheduled || 0), 0)
  const totalNew = meetings.reduce((s, m) => s + (m.new_completed || 0), 0)
  const totalRepeat = meetings.reduce((s, m) => s + (m.repeat_completed || 0), 0)
  const totalCompleted = totalNew + totalRepeat
  const completionPercent = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0

  const monthName = period
    ? `${['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][period.month - 1]} ${period.year}`
    : '...'

  return (
    <div className="flex h-screen bg-brand-50">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="font-heading text-3xl font-bold text-brand-900">Встречи</h1>
              <p className="text-brand-500 mt-1">{monthName}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-brand-100 bg-white px-4 py-2">
              <span className="text-sm font-medium text-brand-900">{monthName}</span>
              <ChevronDown size={18} className="text-brand-400" />
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="rounded-2xl border border-brand-100 p-6 bg-white shadow-sm">
              <p className="text-brand-500 text-sm font-medium mb-2">Запланировано</p>
              <p className="font-heading text-3xl font-bold text-brand-900">{totalScheduled}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 p-6 bg-white shadow-sm">
              <p className="text-brand-500 text-sm font-medium mb-2">Новые</p>
              <p className="font-heading text-3xl font-bold text-brand-900">{totalNew}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 p-6 bg-white shadow-sm">
              <p className="text-brand-500 text-sm font-medium mb-2">Повторные</p>
              <p className="font-heading text-3xl font-bold text-brand-900">{totalRepeat}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 p-6 bg-gradient-to-br from-accent-50 to-white shadow-sm">
              <p className="text-brand-500 text-sm font-medium mb-2">Выполнение плана</p>
              <p className="font-heading text-3xl font-bold text-accent">{completionPercent}%</p>
            </div>
          </div>

          {/* Meetings Table */}
          <div className="rounded-2xl border border-brand-100 bg-white shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-100 bg-brand-50">
                  <th className="text-left py-4 px-4 font-semibold text-brand-900 min-w-[100px]">Дата</th>
                  <th className="text-center py-4 px-4 font-semibold text-brand-900">Запланировано</th>
                  <th className="text-center py-4 px-4 font-semibold text-brand-900">Новые</th>
                  <th className="text-center py-4 px-4 font-semibold text-brand-900">Повторные</th>
                  <th className="text-center py-4 px-4 font-semibold text-brand-900">Наставничество</th>
                  <th className="text-center py-4 px-4 font-semibold text-brand-900">След. день</th>
                  <th className="text-center py-4 px-4 font-semibold text-brand-900">Перенесены</th>
                  <th className="text-center py-4 px-4 font-semibold text-brand-900">Итого</th>
                </tr>
              </thead>
              <tbody>
                {meetings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-brand-500">
                      Нет данных о встречах. Нажмите «Добавить день» чтобы начать.
                    </td>
                  </tr>
                ) : (
                  Array.from(weeks.entries()).map(([monday, weekRows], weekIdx) => {
                    const weekNumber = weekIdx + 1
                    return (
                      <tbody key={monday}>
                        {weekRows.map((row) => {
                          const total = (row.new_completed || 0) + (row.repeat_completed || 0) + (row.mentor || 0)
                          return (
                            <tr key={row.date} className="border-b border-brand-100 hover:bg-brand-50 transition-colors">
                              <td className="py-3 px-4 text-brand-900 font-medium">{formatDateRu(row.date)}</td>
                              {FIELDS.map((field) => {
                                const isEditing = editingCell?.date === row.date && editingCell?.field === field
                                const value = row[field] || 0
                                return (
                                  <td key={field} className="py-3 px-4 text-center">
                                    {isEditing ? (
                                      <input
                                        type="number"
                                        min="0"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={handleCellSave}
                                        onKeyDown={handleCellKeyDown}
                                        autoFocus
                                        className="w-14 rounded-lg border border-brand-400 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                                      />
                                    ) : (
                                      <button
                                        onClick={() => handleCellClick(row.date, field, value)}
                                        className={cn(
                                          'w-10 h-8 rounded-lg text-sm font-medium transition-colors',
                                          'hover:bg-brand-100 cursor-pointer',
                                          value > 0 ? 'text-brand-900' : 'text-brand-300'
                                        )}
                                      >
                                        {value}
                                      </button>
                                    )}
                                  </td>
                                )
                              })}
                              <td className="py-3 px-4 text-center font-semibold text-brand-900">{total}</td>
                            </tr>
                          )
                        })}

                        {/* Week summary */}
                        <tr className="bg-brand-50 border-b-2 border-brand-200">
                          <td className="py-3 px-4 font-semibold text-brand-900">Неделя {weekNumber}</td>
                          {FIELDS.map((field) => (
                            <td key={field} className="py-3 px-4 text-center font-semibold text-brand-900">
                              {weekSum(weekRows, field)}
                            </td>
                          ))}
                          <td className="py-3 px-4 text-center font-semibold text-brand-900">
                            {weekRows.reduce((s, r) => s + (r.new_completed || 0) + (r.repeat_completed || 0) + (r.mentor || 0), 0)}
                          </td>
                        </tr>
                      </tbody>
                    )
                  })
                )}

                {/* Grand total */}
                {meetings.length > 0 && (
                  <tr className="bg-brand-100 border-t-2 border-brand-200">
                    <td className="py-4 px-4 font-bold text-brand-900">Итого</td>
                    {FIELDS.map((field) => (
                      <td key={field} className="py-4 px-4 text-center font-bold text-brand-900">
                        {meetings.reduce((s, m) => s + (m[field] || 0), 0)}
                      </td>
                    ))}
                    <td className="py-4 px-4 text-center font-bold text-brand-900">{totalCompleted}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add Day Button */}
          <div className="mt-8">
            <button
              onClick={handleAddDay}
              disabled={saving}
              className={cn(
                'flex items-center gap-2 px-6 py-3',
                'rounded-2xl bg-brand-500 text-white',
                'font-semibold text-sm',
                'hover:bg-brand-600 transition-colors',
                'shadow-sm hover:shadow-md',
                'disabled:opacity-50'
              )}
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              Добавить день
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
