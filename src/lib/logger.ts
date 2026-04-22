/**
 * Минимальный логгер с фильтрацией в проде.
 *
 * Цель — не сливать в консоль продакшна чувствительные payload'ы (токены,
 * ID пользователей, содержимое запросов). В dev — полный stacktrace для отладки.
 *
 * Поддерживается настройка через window.__KO_DEBUG__ = true — тогда даже в проде
 * включаются подробные логи (для одноразовой отладки с Ctrl+Shift+I).
 */

const isProd = process.env.NODE_ENV === 'production'

type LogMeta = Record<string, unknown> | unknown

function debugEnabled(): boolean {
  if (!isProd) return true
  if (typeof window !== 'undefined' && (window as any).__KO_DEBUG__) return true
  return false
}

/**
 * Сокращает Error до message (без stack) и вырезает явно чувствительные поля.
 */
function sanitize(meta: LogMeta): unknown {
  if (!meta) return meta
  if (meta instanceof Error) {
    return { name: meta.name, message: meta.message }
  }
  if (typeof meta === 'object' && meta !== null) {
    const safe: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
      const lower = k.toLowerCase()
      if (
        lower.includes('password') ||
        lower.includes('token') ||
        lower.includes('secret') ||
        lower === 'authorization' ||
        lower === 'cookie'
      ) {
        safe[k] = '[redacted]'
      } else if (v instanceof Error) {
        safe[k] = { name: v.name, message: v.message }
      } else {
        safe[k] = v
      }
    }
    return safe
  }
  return meta
}

export const logger = {
  error(context: string, meta?: LogMeta) {
    if (debugEnabled()) {
      // В dev/debug выводим как есть — включая stack, чтобы можно было дебажить.
      console.error(`[ko-salary] ${context}`, meta)
    } else {
      // В проде — только message без stack и без sensitive полей.
      console.error(`[ko-salary] ${context}`, sanitize(meta))
    }
  },
  warn(context: string, meta?: LogMeta) {
    if (debugEnabled()) {
      console.warn(`[ko-salary] ${context}`, meta)
    } else {
      console.warn(`[ko-salary] ${context}`, sanitize(meta))
    }
  },
  info(context: string, meta?: LogMeta) {
    if (debugEnabled()) {
      console.log(`[ko-salary] ${context}`, meta)
    }
    // В проде info не выводится вообще.
  },
}
