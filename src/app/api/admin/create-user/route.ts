import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, full_name, role, company_id, position_id } = body

    if (!email || !password || !full_name || !role || !company_id || !position_id) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 })
    }

    // 1. Verify the requesting user is admin/director using their session
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

    // Check role in users table
    const { data: adminUser } = await supabaseSession
      .from('users')
      .select('role')
      .eq('id', sessionUser.id)
      .single()

    if (!adminUser || !['admin', 'director'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    // 2. Create auth user using service role key (bypasses rate limits)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { full_name }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Не удалось создать пользователя' }, { status: 500 })
    }

    // 3. Create profile in users table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        role,
        company_id,
        position_id,
      })
      .select()
      .single()

    if (profileError) {
      // Rollback: delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    return NextResponse.json({ user: profileData }, { status: 201 })

  } catch (err: any) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: err.message || 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
