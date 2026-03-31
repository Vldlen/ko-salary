'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { cn, formatMoney } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getMeetings, upsertMeeting, getDeals } from '@/lib/supabase/queries'

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

type MeetingField = 'scheduled' | 'new_completed' | 'repeat_completed' | 'mentor' | 'next_day' | 'rescheduled'

const ROW_CONFIG: { key: string; label: string; field?: MeetingField; type?: string }[] = [
  { key: 'scheduled', label: 'Назначенных на утро', field: 'scheduled' },
  { key: 'new_completed', label: 'Проведенных новых', field: 'new_completed' },
  { key: 'repeat_completed', label: 'Проведенных повторных', field: 'repeat_completed' },
  { key: 'mentor', label: 'Встреч как ментор', field: 'mentor' },
  { key: 'next_day', label: 'Встреч на завтра', field: 'next_day' },
  { key: 'rescheduled', label: 'Перенесённых', field: 'rescheduled' },
  { key: 'invoiced', label: 'Выставленные счета ₽', type: 'deals' },
  { key: 'paid', label: 'Оплаченные счета ₽', type: 'deals' },
]

const MEETING_FIELDS: MeetingField[] = ['scheduled', 'new_completed', 'repeat_completed', 'mentor', 'next_day', 'rescheduled']

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

export default function MeetingsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const [deals, setDeals] = useState<any[]>([])
  // Local editable state: { "2026-03-02__scheduled": "3", ... }
  const [cellValues, setCellValues] = useState<Record<string, string>>({})
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Build cell key
  const cellKey = (date: string, field: MeetingField) => `${date}__${field}`

  useEffect(() => {
    async function load() {
      try {
        const currentUser = await getCurrentUser(supabase)
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)

        const activePeriod = await getActivePeriod(supabase, currentUser.company_id)
        if (!activePeriod) { setLoading(false); return }
        setPeriod(activePeriod)

        const [meetingsData, dealsData] = await Promise.all([
          getMeetings(supabase, currentUser.id, activePeriod.id),
          getDeals(supabase, currentUser.id, activePeriod.id),
        ])
        setMeetings(meetingsData || [])
        setDeals(dealsData || [])

        // Initialize cell values from loaded meetings
        const initial: Record<string, string> = {}
        const days = getDaysInMonth(activePeriod.year, activePeriod.month)
        for (const day of days) {
          const m = (meetingsData || []).find((mt: MeetingRow) => mt.date === day)
          for (const field of MEETING_FIELDS) {
            const val = m ? (m[field] || 0) : 0
            initial[`${day}__${field}`] = val > 0 ? String(val) : ''
          }
        }
        setCellValues(initial)
      } catch (err) {
        console.error('Meetings load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  const getDealsSum = useCallback((date: string, type: 'invoiced' | 'paid'): number => {
    if (type === 'invoiced') {
      return deals
        .filter((d: any) => d.status === 'waiting_payment' && d.created_at?.slice(0, 10) === date)
        .reduce((sum: number, d: any) => sum + Number(d.revenue || 0), 0)
    }
    if (type === 'paid') {
      return deals
        .filter((d: any) => d.status === 'paid' && (d.paid_at?.slice(0, 10) === date || (!d.paid_at && d.updated_at?.slice(0, 10) === date)))
        .reduce((sum: number, d: any) => sum + Number(d.revenue || 0), 0)
    }
    return 0
  }, [deals])

  // Handle cell value change (local only)
  const handleChange = useCallback((key: string, value: string) => {
    // Allow only digits
    const clean = value.replace(/\D/g, '')
    setCellValues(prev => ({ ...prev, [key]: clean }))
    setDirtyKeys(prev => new Set(prev).add(key))
  }, [])

  // Save a single cell on blur
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
      const meetingData = {
        user_id: user.id,
        period_id: period.id,
        date,
        scheduled: existing?.scheduled || 0,
        new_completed: existing?.new_completed || 0,
        repeat_completed: existing?.repeat_completed || 0,
        mentor: existing?.mentor || 0,
        next_day: existing?.next_day || 0,
        rescheduled: existing?.rescheduled || 0,
        [field]: newValue,
      }
      await upsertMeeting(supabase, meetingData)

      // Update local meetings state
      setMeetings(prev => {
        const idx = prev.findIndex(m => m.date === date)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], [field]: newValue }
          return updated
        }
        return [...prev, meetingData as MeetingRow]
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

  // Navigate with keyboard
  const handleKeyDown = useCallback((e: React.KeyboardEvent, date: string, field: MeetingField, allDays: string[]) => {
    const fieldIdx = MEETING_FIELDS.indexOf(field)
    const dayIdx = allDays.indexOf(date)
    let nextField: MeetingField | null = null
    let nextDate: string | null = null

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      // Move right to next date, same field
      if (dayIdx < allDays.length - 1) {
        nextDate = allDays[dayIdx + 1]
        nextField = field
      } else if (fieldIdx < MEETING_FIELDS.length - 1) {
        // Wrap to first date, next row
        nextDate = allDays[0]
        nextField = MEETING_FIELDS[fieldIdx + 1]
      }
    } else if (e.key === 'ArrowRight') {
      if (dayIdx < allDays.length - 1) {
        nextDate = allDays[dayIdx + 1]
        nextField = field
      }
    } else if (e.key === 'ArrowLeft') {
      if (dayIdx > 0) {
        nextDate = allDays[dayIdx - 1]
        nextField = field
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (fieldIdx < MEETING_FIELDS.length - 1) {
        nextDate = date
        nextField = MEETING_FIELDS[fieldIdx + 1]
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (fieldIdx > 0) {
        nextDate = date
        nextField = MEETING_FIELDS[fieldIdx - 1]
      }
    }

    if (nextDate && nextField) {
      const nextKey = cellKey(nextDate, nextField)
      inputRefs.current[nextKey]?.focus()
      inputRefs.current[nextKey]?.select()
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    )
  }

  const year = period?.year || 2026
  const month = period?.month || 3
  const allDays = getDaysInMonth(year, month)

  const monthName = period
    ? `${['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][period.month - 1]} ${period.year}`
    : '...'

  // Today for highlighting
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex h-screen bg-brand-50">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold text-brand-900">Встречи</h1>
              <p className="text-brand-500 text-sm mt-1">{monthName} • Нажмите на ячейку и вводите число, Tab/Enter — следующая, стрелки — навигация</p>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-brand-100 bg-white shadow-sm overflow-x-auto">
            <table className="text-xs border-collapse w-max">
              {/* Header: dates */}
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-brand-800 text-white text-left py-2 px-3 font-semibold min-w-[200px] border-r border-brand-700">
                    Показатель
                  </th>
                  {allDays.map((date) => {
                    const isToday = date === today
                    return (
                      <th
                        key={date}
                        className={cn(
                          'text-center py-1.5 px-1 font-semibold min-w-[52px] border-r border-brand-700 last:border-r-0',
                          isToday ? 'bg-blue-600 text-white' : 'bg-brand-800 text-white'
                        )}
                      >
                        <div className="text-[10px] opacity-70">{getDayName(date)}</div>
                        <div>{formatDateShort(date)}</div>
                      </th>
                    )
                  })}
                  {/* Totals column */}
                  <th className="bg-brand-900 text-white text-center py-1.5 px-2 font-semibold min-w-[60px]">
                    Итого
                  </th>
                </tr>
              </thead>

              <tbody>
                {ROW_CONFIG.map((row, rowIdx) => {
                  const isDealsRow = row.type === 'deals'
                  const isEven = rowIdx % 2 === 0

                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        'border-b border-brand-100 last:border-b-0',
                        isDealsRow ? 'bg-emerald-50' : isEven ? 'bg-white' : 'bg-brand-50/50'
                      )}
                    >
                      {/* Row label */}
                      <td className={cn(
                        'sticky left-0 z-10 py-2 px-3 font-medium text-brand-800 border-r border-brand-100 whitespace-nowrap text-xs',
                        isDealsRow ? 'bg-emerald-50' : isEven ? 'bg-white' : 'bg-brand-50'
                      )}>
                        {row.label}
                      </td>

                      {/* Data cells */}
                      {allDays.map((date) => {
                        const isToday = date === today

                        if (isDealsRow) {
                          const val = getDealsSum(date, row.key as 'invoiced' | 'paid')
                          return (
                            <td key={date} className={cn(
                              'py-1.5 px-1 text-center text-xs border-r border-brand-100 last:border-r-0',
                              isToday && 'bg-blue-50'
                            )}>
                              {val > 0 ? <span className="text-emerald-700 font-medium">{formatMoney(val)}</span> : <span className="text-brand-200">—</span>}
                            </td>
                          )
                        }

                        const field = row.field!
                        const key = cellKey(date, field)
                        const isSaving = savingKeys.has(key)

                        return (
                          <td key={date} className={cn(
                            'py-0.5 px-0.5 text-center border-r border-brand-100 last:border-r-0',
                            isToday && 'bg-blue-50'
                          )}>
                            <input
                              ref={(el) => { inputRefs.current[key] = el }}
                              type="text"
                              inputMode="numeric"
                              value={cellValues[key] ?? ''}
                              onChange={(e) => handleChange(key, e.target.value)}
                              onBlur={() => handleBlur(key)}
                              onKeyDown={(e) => handleKeyDown(e, date, field, allDays)}
                              onFocus={(e) => e.target.select()}
                              className={cn(
                                'w-full h-7 text-center text-xs rounded-sm border-0 outline-none transition-colors',
                                'focus:ring-2 focus:ring-blue-400 focus:bg-white focus:shadow-sm',
                                'hover:bg-brand-100',
                                isSaving ? 'bg-yellow-50 text-yellow-700' : 'bg-transparent',
                                cellValues[key] ? 'text-brand-900 font-medium' : 'text-brand-300'
                              )}
                              placeholder="·"
                            />
                          </td>
                        )
                      })}

                      {/* Totals */}
                      <td className={cn(
                        'py-1.5 px-2 text-center font-bold text-xs border-l-2 border-brand-200',
                        isDealsRow ? 'text-emerald-700' : 'text-brand-900'
                      )}>
                        {isDealsRow
                          ? (() => {
                              const total = allDays.reduce((s, d) => s + getDealsSum(d, row.key as 'invoiced' | 'paid'), 0)
                              return total > 0 ? formatMoney(total) : '—'
                            })()
                          : (() => {
                              const field = row.field!
                              const total = allDays.reduce((s, d) => s + (parseInt(cellValues[cellKey(d, field)]) || 0), 0)
                              return total > 0 ? total : '—'
                            })()
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
