import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Verify requesting user is admin/director/rop
    const cookieStore = cookies()
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value, options }: any) => {
              try { cookieStore.set(name, value, options) } catch (e) {}
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
      .select('role')
      .eq('id', sessionUser.id)
      .single()

    if (!currentUser || !['admin', 'director', 'rop'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, company_id, role, is_active, fired_at, deleted_at, company:companies(name), position:positions(name)')
      .eq('role', 'manager')
      .eq('is_active', true)
      .is('fired_at', null)
      .is('deleted_at', null)
      .order('full_name')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ managers: users || [] })
  } catch (err: any) {
    console.error('Get managers error:', err)
    return NextResponse.json({ error: err.message || 'Внутренняя ошибка' }, { status: 500 })
  }
}
