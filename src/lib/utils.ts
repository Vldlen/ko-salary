import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' \u20BD'
}

export function formatPercent(value: number): string {
  return `${value}%`
}

export function getMonthName(month: number): string {
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ]
  return months[month - 1] || ''
}

export function getDealStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    no_invoice: 'Нет счёта',
    waiting_payment: 'Жду оплату',
    paid: 'Оплачено',
  }
  return labels[status] || status
}

export function getDealStatusColor(status: string): string {
  const colors: Record<string, string> = {
    no_invoice: 'bg-white/10 text-white/60',
    waiting_payment: 'bg-orange-500/20 text-orange-400',
    paid: 'bg-emerald-500/20 text-emerald-400',
  }
  return colors[status] || 'bg-white/10 text-white/60'
}
