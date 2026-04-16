import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/supabase/api-utils'

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json()
    if (!user_id) {
      return NextResponse.json({ error: 'user_id обязателен' }, { status: 400 })
    }

    const auth = await withApiAuth(['admin', 'director'])
    if (auth instanceof NextResponse) return auth
    const { sessionUser, supabaseAdmin } = auth

    // Prevent self-deletion
    if (user_id === sessionUser.id) {
      return NextResponse.json({ error: 'Нельзя удалить самого себя' }, { status: 400 })
    }

    // Delete related data first (in case no CASCADE)
    await supabaseAdmin.from('individual_plans').delete().eq('user_id', user_id)
    await supabaseAdmin.from('one_time_payments').delete().eq('user_id', user_id)
    await supabaseAdmin.from('salary_results').delete().eq('user_id', user_id)
    await supabaseAdmin.from('meetings').delete().eq('user_id', user_id)
    await supabaseAdmin.from('deals').delete().eq('user_id', user_id)

    // Delete user profile
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', user_id)

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Delete auth user
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
