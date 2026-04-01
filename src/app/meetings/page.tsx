'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { cn, formatMoney } from '@/lib/utils'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser, getActivePeriod, getMeetings, upsertMeeting } from '@/lib/supabase/queries'

type MeetingField = 'scheduled' | 'new_completed' | 'repeat_completed' | 'mentor' | 'next_day' | 'rescheduled' | 'invoiced_sum' | 'paid_sum'

const ROW_CONFIG: { key: MeetingField; label: string; isMoney?: boolean }[] = [
  { key: 'scheduled', label: 'Назначенных на утро' },
  { key: 'new_completed', label: 'Проведенных новых' },
  { key: 'repeat_completed', label: 'Проведенных повторных' },
  { key: 'mentor', label: 'Встреч как ментор' },
  { key: 'next_day', label: 'Встреч на завтра' },
  { key: 'rescheduled', label: 'Перенесённых' },
  { key: 'invoiced_sum', label: 'Выставленные счета ₽', isMoney: true },
  { key: 'paid_sum', label: 'Оплаченные счета ₽', isMoney: true },
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

export default function MeetingsPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [period, setPeriod] = useState<any>(null)
  const [meetings, setMeetings] = useState<any[]>([])
  const [cellValues, setCellValues] = useState<Record<string, string>>({})
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

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

        const meetingsData = await getMeetings(supabase, currentUser.id, activePeriod.id)
        setMeetings(meetingsData || [])

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
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  const handleChange = useCallback((key: string, value: string) => {
    const clean = value.replace(/\D/g, '')
    setCellValues(prev => ({ ...prev, [key]: clean }))
    setDirtyKeys(prev => new Set(prev).add(key))
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
    <div className="flex h-screen bg-brand-50">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />

      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="font-heading text-2xl font-bold text-brand-900">Встречи</h1>
            <p className="text-brand-500 text-sm mt-1">{monthName}</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl bg-white border border-brand-100 shadow-sm p-4">
              <p className="text-xs text-brand-500 mb-1">Назначено</p>
              <p className="text-2xl font-bold text-brand-900">{totalScheduled}</p>
            </div>
            <div className="rounded-xl bg-white border border-brand-100 shadow-sm p-4">
              <p className="text-xs text-brand-500 mb-1">Проведено</p>
              <p className="text-2xl font-bold text-emerald-600">{totalCompleted}</p>
              <p className="text-[10px] text-brand-400 mt-0.5">новых + повторных</p>
            </div>
            <div className="rounded-xl bg-white border border-brand-100 shadow-sm p-4">
              <p className="text-xs text-brand-500 mb-1">Перенесено</p>
              <p className="text-2xl font-bold text-amber-600">{totalRescheduled}</p>
            </div>
          </div>

          <div className="rounded-xl border border-brand-100 bg-white shadow-sm overflow-x-auto">
            <table className="text-xs border-collapse w-max">
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
                  <th className="bg-brand-900 text-white text-center py-1.5 px-2 font-semibold min-w-[60px]">
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
                        'border-b border-brand-100 last:border-b-0',
                        isMoney ? 'bg-emerald-50' : isEven ? 'bg-white' : 'bg-brand-50/50'
                      )}
                    >
                      <td className={cn(
                        'sticky left-0 z-10 py-2 px-3 font-medium text-brand-800 border-r border-brand-100 whitespace-nowrap text-xs',
                        isMoney ? 'bg-emerald-50' : isEven ? 'bg-white' : 'bg-brand-50'
                      )}>
                        {row.label}
                      </td>

                      {allDays.map((date) => {
                        const isToday = date === today
                        const field = row.key
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
                                cellValues[key] ? (isMoney ? 'text-emerald-700 font-medium' : 'text-brand-900 font-medium') : 'text-brand-300'
                              )}
                              placeholder="·"
                            />
                          </td>
                        )
                      })}

                      <td className={cn(
                        'py-1.5 px-2 text-center font-bold text-xs border-l-2 border-brand-200',
                        isMoney ? 'text-emerald-700' : 'text-brand-900'
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
        </div>
      </main>
    </div>
  )
}
