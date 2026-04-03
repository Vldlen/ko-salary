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

// ======== БОНДА helpers ========

export function getProductTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    findir: 'ФинДир',
    bonda_bi: 'Bonda BI',
    one_time_service: 'Разовая услуга',
    inno_license: 'Лицензия inno',
    inno_implementation: 'Внедрение',
  }
  return labels[type] || type
}

export function getSubscriptionPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    month: 'Месяц',
    quarter: 'Квартал',
    half_year: 'Полгода',
    year: 'Год',
  }
  return labels[period] || period
}

// ======== Login & Password generation ========

const TRANSLIT: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}

function transliterate(text: string): string {
  return text.toLowerCase().split('').map(c => TRANSLIT[c] ?? c).join('')
}

/**
 * Генерирует логин из ФИО: "Петров Владлен Игоревич" → "v.petrov"
 * Если такой занят (existingLogins), пробует "vl.petrov", "vla.petrov" и т.д.
 */
export function generateLogin(fullName: string, existingLogins: string[]): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) {
    // Только фамилия — используем как есть
    const base = transliterate(parts[0])
    if (!existingLogins.includes(base)) return base
    for (let i = 1; i <= 99; i++) {
      const candidate = `${base}${i}`
      if (!existingLogins.includes(candidate)) return candidate
    }
    return base
  }

  const surname = transliterate(parts[0]) // Петров → petrov
  const firstName = transliterate(parts[1]) // Владлен → vladlen

  // Пробуем v.petrov, vl.petrov, vla.petrov ...
  for (let len = 1; len <= firstName.length; len++) {
    const candidate = `${firstName.slice(0, len)}.${surname}`
    if (!existingLogins.includes(candidate)) return candidate
  }

  // Если все варианты заняты, добавляем цифру
  for (let i = 1; i <= 99; i++) {
    const candidate = `${firstName[0]}.${surname}${i}`
    if (!existingLogins.includes(candidate)) return candidate
  }

  return `${firstName[0]}.${surname}`
}

/**
 * Генерирует пароль: 6 цифр + 1 латинская буква, например "472915k"
 */
export function generatePassword(): string {
  const digits = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join('')
  const letter = String.fromCharCode(97 + Math.floor(Math.random() * 26)) // a-z
  return digits + letter
}
