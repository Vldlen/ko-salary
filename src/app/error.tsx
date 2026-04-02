'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="glass rounded-2xl p-8 max-w-md text-center">
        <AlertTriangle className="w-12 h-12 text-orange-400 mx-auto mb-4" />
        <h2 className="text-xl font-heading font-bold text-white mb-2">Что-то пошло не так</h2>
        <p className="text-sm text-white/50 mb-6">
          Произошла ошибка при загрузке страницы. Попробуйте обновить.
        </p>
        <button
          onClick={reset}
          className="flex items-center gap-2 mx-auto bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-medium text-sm transition"
        >
          <RefreshCw className="w-4 h-4" />
          Попробовать снова
        </button>
      </div>
    </div>
  )
}
