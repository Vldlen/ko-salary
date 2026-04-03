import { NextRequest, NextResponse } from 'next/server'
import { sendTeamReport } from '@/lib/telegram'

// Vercel Cron sends GET with Authorization header
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const chatIds = (process.env.TELEGRAM_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean)

  if (chatIds.length === 0) {
    return NextResponse.json({ error: 'No TELEGRAM_CHAT_IDS configured' }, { status: 400 })
  }

  const results = []
  for (const chatId of chatIds) {
    try {
      await sendTeamReport(chatId)
      results.push({ chatId, status: 'ok' })
    } catch (err: any) {
      results.push({ chatId, status: 'error', error: err.message })
    }
  }

  return NextResponse.json({ ok: true, results })
}
