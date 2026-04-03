import { NextRequest, NextResponse } from 'next/server'
import { sendMessage, sendTeamReport } from '@/lib/telegram'

const SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN!
const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean)

// Verify webhook comes from Telegram
function verifyWebhook(request: NextRequest): boolean {
  const header = request.headers.get('x-telegram-bot-api-secret-token')
  return header === SECRET_TOKEN
}

export async function POST(request: NextRequest) {
  // Verify webhook
  if (!verifyWebhook(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const message = body.message

    if (!message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId = String(message.chat.id)
    const text = message.text.trim()

    // Check if chat is allowed (if TELEGRAM_CHAT_IDS is set)
    if (ALLOWED_CHAT_IDS.length > 0 && !ALLOWED_CHAT_IDS.includes(chatId)) {
      await sendMessage(chatId, '⛔ Этот чат не авторизован для получения отчётов.')
      return NextResponse.json({ ok: true })
    }

    // Commands
    if (text === '/report' || text === '/report@' + (process.env.TELEGRAM_BOT_USERNAME || '')) {
      await sendTeamReport(chatId)
    } else if (text === '/start') {
      await sendMessage(chatId, `👋 Пульс КО бот\n\nID этого чата: <code>${chatId}</code>\n\nКоманды:\n/report — текущий отчёт по команде`)
    } else if (text === '/chatid') {
      await sendMessage(chatId, `Chat ID: <code>${chatId}</code>`)
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Telegram webhook error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
