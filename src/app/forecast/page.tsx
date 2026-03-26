'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, TrendingUp } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { useSupabase } from '@/lib/supabase/hooks'
import { getCurrentUser } from '@/lib/supabase/queries'

export default function ForecastPage() {
  const supabase = useSupabase()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const currentUser = await getCurrentUser(supabase)
      if (!currentUser) { router.push('/login'); return }
      setUser(currentUser)
      setLoading(false)
    }
    load()
  }, [supabase, router])

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-brand-50"><Loader2 className="w-8 h-8 animate-spin text-brand-400" /></div>

  return (
    <div className="flex min-h-screen bg-brand-50">
      <Sidebar role={user?.role || 'manager'} userName={user?.full_name || ''} companyName={user?.company?.name || 'ИННО'} />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto text-center mt-20">
          <TrendingUp className="w-16 h-16 text-brand-200 mx-auto mb-4" />
          <h1 className="text-2xl font-heading font-bold text-brand-900 mb-2">Прогноз</h1>
          <p className="text-gray-400">Раздел в разработке. Здесь будет прогноз зарплаты на основе текущих сделок и встреч.</p>
        </div>
      </main>
    </div>
  )
}
