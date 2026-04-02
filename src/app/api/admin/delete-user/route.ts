import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json()
    if (!user_id) {
      return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 })
    }

    // 1. Verify requesting user is admin/director
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

    // Prevent self-deletion
    if (user_id === sessionUser.id) {
      return NextResponse.json({ error: 'Нельзя удалить самого себя' }, { status: 400 })
    }

    // 2. Use service role for cascading delete
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 3. Delete related data first (in case no CASCADE)
    await supabaseAdmin.from('individual_plans').delete().eq('user_id', user_id)
    await supabaseAdmin.from('one_time_payments').delete().eq('user_id', user_id)
    await supabaseAdmin.from('salary_results').delete().eq('user_id', user_id)
    await supabaseAdmin.from('meetings').delete().eq('user_id', user_id)
    await supabaseAdmin.from('deals').delete().eq('user_id', user_id)

    // 4. Delete user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user_id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // 5. Delete auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user_id)
    if (authError) {
      console.error('Auth delete error (profile already removed):', authError.message)
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (err: any) {
    console.error('Delete user error:', err)
    return NextResponse.json({ error: err.message || 'Внутренняя ошибка' }, { status: 500 })
  }
}
