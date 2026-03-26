'use client';

import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';
import { Plus, Calendar } from 'lucide-react';

const DEMO_MEETINGS_DATA = [
  { date: '2026-03-02', scheduled: 4, new_completed: 2, repeat_completed: 1, mentor: 0, next_day: 3, rescheduled: 1 },
  { date: '2026-03-03', scheduled: 3, new_completed: 1, repeat_completed: 2, mentor: 1, next_day: 2, rescheduled: 0 },
  { date: '2026-03-04', scheduled: 5, new_completed: 3, repeat_completed: 1, mentor: 0, next_day: 4, rescheduled: 1 },
  { date: '2026-03-05', scheduled: 3, new_completed: 2, repeat_completed: 0, mentor: 0, next_day: 2, rescheduled: 1 },
  { date: '2026-03-06', scheduled: 4, new_completed: 2, repeat_completed: 2, mentor: 1, next_day: 3, rescheduled: 0 },
  { date: '2026-03-09', scheduled: 3, new_completed: 1, repeat_completed: 1, mentor: 0, next_day: 2, rescheduled: 1 },
  { date: '2026-03-10', scheduled: 4, new_completed: 2, repeat_completed: 1, mentor: 0, next_day: 3, rescheduled: 1 },
  { date: '2026-03-11', scheduled: 3, new_completed: 1, repeat_completed: 2, mentor: 1, next_day: 2, rescheduled: 0 },
  { date: '2026-03-12', scheduled: 5, new_completed: 3, repeat_completed: 1, mentor: 0, next_day: 4, rescheduled: 1 },
  { date: '2026-03-13', scheduled: 2, new_completed: 1, repeat_completed: 0, mentor: 0, next_day: 1, rescheduled: 1 },
];

interface MeetingRow {
  date: string;
  scheduled: number;
  new_completed: number;
  repeat_completed: number;
  mentor: number;
  next_day: number;
  rescheduled: number;
}

function formatDateRu(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const dayName = days[date.getDay()];
  const day = date.getDate();
  return `${dayName}, ${day}`;
}

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00');
  const firstDay = new Date(2026, 2, 1);
  const days = Math.floor((date.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000));
  return Math.floor(days / 7) + 1;
}

function calculateSummaries(data: MeetingRow[]) {
  return {
    total: data.reduce((sum, row) => sum + row.scheduled, 0),
    new: data.reduce((sum, row) => sum + row.new_completed, 0),
    repeat: data.reduce((sum, row) => sum + row.repeat_completed, 0),
    completionPercent: Math.round(
      (data.reduce((sum, row) => sum + row.new_completed + row.repeat_completed, 0) /
        data.reduce((sum, row) => sum + row.scheduled, 0)) *
        100
    ),
  };
}

function getWeekRows(data: MeetingRow[], weekNum: number) {
  return data.filter((row) => getWeekNumber(row.date) === weekNum);
}

export default function MeetingsPage() {
  const summaries = calculateSummaries(DEMO_MEETINGS_DATA);
  const weeks = [1, 2, 3, 4];

  return (
    <div className="flex h-screen bg-brand-50">
      <Sidebar role="manager" userName="..." companyName="ИННО" />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading text-4xl font-bold text-brand-900 mb-2">Встречи</h1>
            <p className="text-brand-500">Март 2026</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className={cn(
              'rounded-2xl border border-brand-100 p-6 bg-white',
              'shadow-sm hover:shadow-md transition-shadow'
            )}>
              <p className="text-brand-500 text-sm font-medium mb-2">Всего встреч</p>
              <p className="font-heading text-3xl font-bold text-brand-900">{summaries.total}</p>
            </div>

            <div className={cn(
              'rounded-2xl border border-brand-100 p-6 bg-white',
              'shadow-sm hover:shadow-md transition-shadow'
            )}>
              <p className="text-brand-500 text-sm font-medium mb-2">Новые</p>
              <p className="font-heading text-3xl font-bold text-brand-900">{summaries.new}</p>
            </div>

            <div className={cn(
              'rounded-2xl border border-brand-100 p-6 bg-white',
              'shadow-sm hover:shadow-md transition-shadow'
            )}>
              <p className="text-brand-500 text-sm font-medium mb-2">Повторные</p>
              <p className="font-heading text-3xl font-bold text-brand-900">{summaries.repeat}</p>
            </div>

            <div className={cn(
              'rounded-2xl border border-brand-100 p-6 bg-white',
              'shadow-sm hover:shadow-md transition-shadow',
              'bg-gradient-to-br from-accent-50 to-white'
            )}>
              <p className="text-brand-500 text-sm font-medium mb-2">План выполнен</p>
              <p className="font-heading text-3xl font-bold text-accent">{summaries.completionPercent}%</p>
            </div>
          </div>

          {/* Meetings Table */}
          <div className={cn(
            'rounded-2xl border border-brand-100 bg-white p-6',
            'shadow-sm overflow-x-auto'
          )}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-100">
                  <th className="text-left py-4 px-4 font-heading font-semibold text-brand-900">Дата</th>
                  <th className="text-center py-4 px-4 font-heading font-semibold text-brand-900">Запланировано</th>
                  <th className="text-center py-4 px-4 font-heading font-semibold text-brand-900">Новые проведены</th>
                  <th className="text-center py-4 px-4 font-heading font-semibold text-brand-900">Повторные</th>
                  <th className="text-center py-4 px-4 font-heading font-semibold text-brand-900">Наставничество</th>
                  <th className="text-center py-4 px-4 font-heading font-semibold text-brand-900">Следующий день</th>
                  <th className="text-center py-4 px-4 font-heading font-semibold text-brand-900">Перенесены</th>
                  <th className="text-center py-4 px-4 font-heading font-semibold text-brand-900">Итого</th>
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => {
                  const weekRows = getWeekRows(DEMO_MEETINGS_DATA, week);
                  const weekTotals = calculateSummaries(weekRows);

                  return (
                    <tbody key={`week-${week}`}>
                      {/* Week rows */}
                      {weekRows.map((row, idx) => {
                        const total = row.new_completed + row.repeat_completed + row.mentor;
                        return (
                          <tr
                            key={row.date}
                            className={cn(
                              'border-b border-brand-100 hover:bg-brand-50 transition-colors',
                              idx === weekRows.length - 1 ? 'border-b-2 border-b-brand-100' : ''
                            )}
                          >
                            <td className="py-4 px-4 text-brand-900 font-medium">{formatDateRu(row.date)}</td>
                            <td className="py-4 px-4 text-center text-brand-500">{row.scheduled}</td>
                            <td className="py-4 px-4 text-center text-brand-500">{row.new_completed}</td>
                            <td className="py-4 px-4 text-center text-brand-500">{row.repeat_completed}</td>
                            <td className="py-4 px-4 text-center text-brand-500">{row.mentor}</td>
                            <td className="py-4 px-4 text-center text-brand-500">{row.next_day}</td>
                            <td className="py-4 px-4 text-center text-brand-500">{row.rescheduled}</td>
                            <td className="py-4 px-4 text-center font-heading font-semibold text-brand-900">{total}</td>
                          </tr>
                        );
                      })}

                      {/* Week summary row */}
                      <tr className="bg-brand-50 border-b border-brand-100">
                        <td className="py-4 px-4 font-heading font-semibold text-brand-900">Неделя {week}</td>
                        <td className="py-4 px-4 text-center font-heading font-semibold text-brand-900">
                          {weekTotals.total}
                        </td>
                        <td className="py-4 px-4 text-center font-heading font-semibold text-brand-900">
                          {weekTotals.new}
                        </td>
                        <td className="py-4 px-4 text-center font-heading font-semibold text-brand-900">
                          {weekTotals.repeat}
                        </td>
                        <td className="py-4 px-4 text-center font-heading font-semibold text-brand-900">0</td>
                        <td className="py-4 px-4 text-center font-heading font-semibold text-brand-900">
                          {weekRows.reduce((sum, row) => sum + row.next_day, 0)}
                        </td>
                        <td className="py-4 px-4 text-center font-heading font-semibold text-brand-900">
                          {weekRows.reduce((sum, row) => sum + row.rescheduled, 0)}
                        </td>
                        <td className="py-4 px-4 text-center font-heading font-semibold text-brand-900">
                          {weekTotals.new + weekTotals.repeat}
                        </td>
                      </tr>
                    </tbody>
                  );
                })}

                {/* Total row */}
                <tr className="bg-brand-100 border-t-2 border-t-brand-100">
                  <td className="py-4 px-4 font-heading font-bold text-brand-900">Итого</td>
                  <td className="py-4 px-4 text-center font-heading font-bold text-brand-900">
                    {summaries.total}
                  </td>
                  <td className="py-4 px-4 text-center font-heading font-bold text-brand-900">
                    {summaries.new}
                  </td>
                  <td className="py-4 px-4 text-center font-heading font-bold text-brand-900">
                    {summaries.repeat}
                  </td>
                  <td className="py-4 px-4 text-center font-heading font-bold text-brand-900">0</td>
                  <td className="py-4 px-4 text-center font-heading font-bold text-brand-900">
                    {DEMO_MEETINGS_DATA.reduce((sum, row) => sum + row.next_day, 0)}
                  </td>
                  <td className="py-4 px-4 text-center font-heading font-bold text-brand-900">
                    {DEMO_MEETINGS_DATA.reduce((sum, row) => sum + row.rescheduled, 0)}
                  </td>
                  <td className="py-4 px-4 text-center font-heading font-bold text-brand-900">
                    {summaries.new + summaries.repeat}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Add Day Button */}
          <div className="mt-8">
            <button
              className={cn(
                'flex items-center gap-2 px-6 py-3',
                'rounded-2xl border border-brand-100 bg-white',
                'font-heading font-semibold text-brand-900',
                'hover:bg-brand-50 hover:border-brand-400 transition-colors',
                'shadow-sm hover:shadow-md'
              )}
            >
              <Plus size={20} />
              Добавить день
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
