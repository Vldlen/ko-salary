'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Неверный email или пароль')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-brand-400/10 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl" />

      <div className="relative bg-white rounded-3xl shadow-xl shadow-brand-400/10 p-8 w-full max-w-md border border-brand-100">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 mb-4">
            <span className="text-white font-bold text-xl">КО</span>
          </div>
          <h1 className="text-2xl font-heading font-bold text-brand-900">Salary</h1>
          <p className="text-gray-400 mt-1 text-sm">Система расчёта зарплат</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-brand-50 border border-brand-100 rounded-xl focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 outline-none transition text-brand-900 placeholder-gray-300"
              placeholder="ivan@inno.team"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-brand-50 border border-brand-100 rounded-xl focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 outline-none transition text-brand-900 placeholder-gray-300"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 px-4 py-2.5 rounded-xl border border-red-100">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand-400 to-brand-600 hover:from-brand-500 hover:to-brand-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-brand-400/25"
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-300 mt-6">INNO Clouds</p>
      </div>
    </div>
  )
}
