import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, new_password } = body

    if (!user_id || !new_password) {
      return NextResponse.json({ error: 'user_id и new_password обязательны' }, { status: 400 })
    }

    // Verify requesting user is admin/director
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

    const { data: adminUser } = await supabaseSession
      .from('users')
      .select('role')
      .eq('id', sessionUser.id)
      .single()

    if (!adminUser || !['admin', 'director'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    // Update password via admin API
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    )

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Reset password error:', err)
    return NextResponse.json({ error: err.message || 'Внутренняя ошибка' }, { status: 500 })
  }
}
