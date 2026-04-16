'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const email = login.includes('@') ? login : `${login.toLowerCase().trim()}@pulse.local`

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Неверный логин или пароль')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh relative overflow-hidden">
      {/* Ambient light orbs */}
      <div className="absolute top-[-15%] right-[-8%] w-[600px] h-[600px] bg-gradient-to-bl from-blue-500/20 via-indigo-500/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[-15%] left-[-8%] w-[500px] h-[500px] bg-gradient-to-tr from-orange-500/10 via-rose-500/10 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-[35%] left-[25%] w-[350px] h-[350px] bg-gradient-to-r from-blue-400/10 via-cyan-400/05 to-transparent rounded-full blur-3xl" />

      <div className="relative glass-strong rounded-3xl p-8 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 mb-4 shadow-xl shadow-blue-500/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>
          </div>
          <h1 className="text-2xl font-heading font-bold text-white">Пульс КО</h1>
          <p className="text-white/40 mt-1 text-sm">Пульс коммерческого отдела</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Логин</label>
            <input
              type="text"
              value={login}
              onChange={e => setLogin(e.target.value)}
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-blue-400/25 focus:border-blue-400/50 outline-none transition-all duration-200 text-white placeholder-white/30 hover:bg-white/[0.06] hover:border-white/[0.12]"
              placeholder="v.petrov"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-blue-400/25 focus:border-blue-400/50 outline-none transition-all duration-200 text-white placeholder-white/30 hover:bg-white/[0.06] hover:border-white/[0.12]"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 px-4 py-2.5 rounded-xl border border-red-500/20">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-semibold py-3 rounded-xl transition-all duration-300 disabled:opacity-50 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 glass-btn"
          >
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>

        <p className="text-center text-xs text-white/30 mt-6">INNO Clouds</p>
      </div>
    </div>
  )
}
