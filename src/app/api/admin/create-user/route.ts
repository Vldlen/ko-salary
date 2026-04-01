import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { generateLogin, generatePassword } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { full_name, role, company_id, position_id } = body

    if (!full_name || !role || !company_id || !position_id) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 })
    }

    // 1. Verify the requesting user is admin/director
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

    const { data: adminUser } = await supabaseSession
      .from('users')
      .select('role')
      .eq('id', sessionUser.id)
      .single()

    if (!adminUser || !['admin', 'director'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 })
    }

    // 2. Use service role for user creation
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 3. Get existing logins to avoid duplicates
    const { data: existingUsers } = await supabaseAdmin
      .from('users')
      .select('login')

    const existingLogins = (existingUsers || [])
      .map((u: any) => u.login)
      .filter(Boolean)

    // 4. Generate login and password
    const login = generateLogin(full_name, existingLogins)
    const password = generatePassword()
    const fakeEmail = `${login}@pulse.local`

    // 5. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name, login }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Не удалось создать пользователя' }, { status: 500 })
    }

    // 6. Create profile in users table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: fakeEmail,
        login,
        password_plain: password,
        full_name,
        role,
        company_id,
        position_id,
      })
      .select()
      .single()

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // 7. Return user with login and password so admin can copy them
    return NextResponse.json({
      user: profileData,
      credentials: { login, password }
    }, { status: 201 })

  } catch (err: any) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: err.message || 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
