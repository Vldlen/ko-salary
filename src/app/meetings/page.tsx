'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
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
  { key: 'scheduled', label: 'Кол-во назначенных встреч на утро', field: 'scheduled' },
  { key: 'new_completed', label: 'Кол-во проведенных встреч новых', field: 'new_completed' },
  { key: 'repeat_completed', label: 'Кол-во проведенных встреч повторных', field: 'repeat_completed' },
  { key: 'mentor', label: 'Кол-во встреч, как менторы', field: 'mentor' },
  { key: 'next_day', label: 'Кол-во встреч на завтра', field: 'next_day' },
  { key: 'rescheduled', label: 'Кол-во встреч перенесенных', field: 'rescheduled' },
  { key: 'invoiced', label: 'Выставленные счета сумма', type: 'deals' },
  { key: 'paid', label: 'Оплаченные счета сумма', type: 'deals' },
]

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay()
    // Include all days, skip weekends visually
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

        const [meetingsData, dealsData] = await Promise.all([
          getMeetings(supabase, currentUser.id, activePeriod.id),
          getDeals(supabase, currentUser.id, activePeriod.id),
        ])
        setMeetings(meetingsData || [])
        setDeals(dealsData || [])
      } catch (err) {
        console.error('Meetings load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  const getMeetingValue = useCallback((date: string, field: MeetingField): number => {
    const meeting = meetings.find(m => m.date === date)
    return meeting ? (meeting[field] || 0) : 0
  }, [meetings])

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
          </div>

          {/* Transposed Table: rows = metrics, columns = dates */}
          <div className="rounded-2xl border border-brand-100 bg-white shadow-sm overflow-x-auto">
            <table className="text-sm border-collapse">
              {/* Header row with dates */}
              <thead>
                <tr className="bg-brand-50">
                  <th className="sticky left-0 z-10 bg-brand-50 text-left py-3 px-4 font-bold text-brand-900 min-w-[280px] border-b border-r border-brand-100">
                    Дата
                  </th>
                  {allDays.map((date) => (
                    <th key={date} className="text-center py-3 px-2 font-bold text-brand-900 min-w-[90px] border-b border-brand-100 whitespace-nowrap">
                      {formatDateHeader(date)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {ROW_CONFIG.map((row, rowIdx) => {
                  const isDealsRow = row.type === 'deals'
                  const isLast = rowIdx === ROW_CONFIG.length - 1

                  return (
                    <tr
                      key={row.key}
                      className={cn(
                        'hover:bg-brand-50 transition-colors',
                        !isLast && 'border-b border-brand-100',
                        isDealsRow && 'bg-green-50/30'
                      )}
                    >
                      {/* Row label - sticky */}
                      <td className="sticky left-0 z-10 bg-white py-3 px-4 font-medium text-brand-900 border-r border-brand-100 whitespace-nowrap">
                        {row.label}
                      </td>

                      {/* Data cells for each date */}
                      {allDays.map((date) => {
                        if (isDealsRow) {
                          const val = getDealsSum(date, row.key as 'invoiced' | 'paid')
                          return (
                            <td key={date} className="py-3 px-2 text-center text-brand-900">
                              {val > 0 ? formatMoney(val) : ''}
                            </td>
                          )
                        }

                        const field = row.field!
                        const value = getMeetingValue(date, field)
                        const isEditing = editingCell?.date === date && editingCell?.field === field

                        return (
                          <td key={date} className="py-2 px-2 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleCellSave}
                                onKeyDown={handleCellKeyDown}
                                autoFocus
                                className="w-14 mx-auto rounded border border-brand-400 px-1 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                              />
                            ) : (
                              <span
                                onClick={() => handleCellClick(date, field, value)}
                                className={cn(
                                  'inline-block w-full py-1 rounded cursor-pointer transition-colors',
                                  'hover:bg-brand-100',
                                  value > 0 ? 'text-brand-900 font-medium' : 'text-brand-300'
                                )}
                              >
                                {value || ''}
                              </span>
                            )}
                          </td>
                        )
                      })}
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
