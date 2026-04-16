import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

type UserRole = 'admin' | 'director' | 'rop' | 'manager' | 'founder'

interface AuthResult {
  sessionUser: { id: string }
  currentUser: { id: string; role: UserRole }
  supabaseSession: SupabaseClient
  supabaseAdmin: SupabaseClient
}

/**
 * Универсальная авторизация для API routes.
 * Проверяет сессию, роль, создаёт admin client.
 *
 * @param allowedRoles — роли, которым разрешён доступ
 * @returns AuthResult или NextResponse с ошибкой
 *
 * Пример:
 * ```ts
 * const auth = await withApiAuth(['admin', 'director'])
 * if (auth instanceof NextResponse) return auth
 * const { supabaseAdmin, currentUser } = auth
 * ```
 */
export async function withApiAuth(
  allowedRoles: UserRole[]
): Promise<AuthResult | NextResponse> {
  const cookieStore = cookies()

  const supabaseSession = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value, options }: any) => {
            try { cookieStore.set(name, value, options) } catch {}
          })
        },
      },
    }
  )

  const { data: { user: sessionUser } } = await supabaseSession.auth.getUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { data: currentUser } = await supabaseSession
    .from('users')
    .select('id, role')
    .eq('id', sessionUser.id)
    .single()

  if (!currentUser || !allowedRoles.includes(currentUser.role as UserRole)) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  return { sessionUser, currentUser, supabaseSession, supabaseAdmin }
}

/**
 * Создаёт admin Supabase client (service role) без проверки сессии.
 * Для внутренних server-side операций (cron jobs, etc.)
 */
export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
