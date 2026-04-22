import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/supabase/api-utils'

export async function GET(request: NextRequest) {
  try {
    const auth = await withApiAuth(['admin', 'director', 'rop', 'founder'])
    if (auth instanceof NextResponse) return auth
    const { supabaseAdmin } = auth

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, company_id, role, is_active, fired_at, deleted_at, company:companies(name, company_type), position:positions(name)')
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
