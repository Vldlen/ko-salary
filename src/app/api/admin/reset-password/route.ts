import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/supabase/api-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, new_password } = body

    if (!user_id || !new_password) {
      return NextResponse.json({ error: 'user_id и new_password обязательны' }, { status: 400 })
    }

    const auth = await withApiAuth(['admin', 'director'])
    if (auth instanceof NextResponse) return auth
    const { supabaseAdmin } = auth

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
