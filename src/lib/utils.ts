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
    prospect: 'Перспектива',
    negotiation: 'Переговоры',
    waiting_payment: 'Ждём оплату',
    paid: 'Оплачено',
    cancelled: 'Отменено',
  }
  return labels[status] || status
}

export function getDealStatusColor(status: string): string {
  const colors: Record<string, string> = {
    prospect: 'bg-gray-100 text-gray-700',
    negotiation: 'bg-yellow-100 text-yellow-700',
    waiting_payment: 'bg-orange-100 text-orange-700',
    paid: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}
