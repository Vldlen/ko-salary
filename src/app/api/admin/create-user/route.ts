import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/supabase/api-utils'
import { generateLogin, generatePassword } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { full_name, role, company_id, position_id } = body

    if (!full_name || !role) {
      return NextResponse.json({ error: 'ФИО и роль обязательны' }, { status: 400 })
    }
    if (['manager', 'rop'].includes(role) && (!company_id || !position_id)) {
      return NextResponse.json({ error: 'Для менеджера и РОПа нужна компания и должность' }, { status: 400 })
    }

    const auth = await withApiAuth(['admin', 'director'])
    if (auth instanceof NextResponse) return auth
    const { supabaseAdmin } = auth

    // Get existing logins to avoid duplicates
    const { data: existingUsers } = await supabaseAdmin
      .from('users')
      .select('login')

    const existingLogins = (existingUsers || [])
      .map((u: any) => u.login)
      .filter(Boolean)

    // Generate login and password
    const login = generateLogin(full_name, existingLogins)
    const password = generatePassword()
    const fakeEmail = `${login}@pulse.local`

    // Create auth user
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

    // Create profile in users table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: fakeEmail,
        login,
        full_name,
        role,
        company_id: company_id || null,
        position_id: position_id || null,
      })
      .select()
      .single()

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Return user with login and password so admin can copy them
    return NextResponse.json({
      user: profileData,
      credentials: { login, password }
    }, { status: 201 })

  } catch (err: any) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: err.message || 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}
