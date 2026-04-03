import { NextRequest, NextResponse } from 'next/server'
import { sendMessage, sendTeamReport, sendCompanyReport, sendStatusText } from '@/lib/telegram'

export const runtime = 'edge'

const SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN!
const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean)

function verifyWebhook(request: NextRequest): boolean {
  const header = request.headers.get('x-telegram-bot-api-secret-token')
  return header === SECRET_TOKEN
}

export async function POST(request: NextRequest) {
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

    if (ALLOWED_CHAT_IDS.length > 0 && !ALLOWED_CHAT_IDS.includes(chatId)) {
      sendMessage(chatId, '⛔ Этот чат не авторизован для получения отчётов.').catch(console.error)
      return NextResponse.json({ ok: true })
    }

    const command = text.split('@')[0].toLowerCase()

    // Fire-and-forget: return 200 immediately, process in background
    // This prevents Telegram from timing out and retrying
    if (command === '/report') {
      sendTeamReport(chatId).catch(console.error)
    } else if (command === '/inno') {
      sendCompanyReport(chatId, 'inno').catch(console.error)
    } else if (command === '/bonda') {
      sendCompanyReport(chatId, 'bonda').catch(console.error)
    } else if (command === '/status') {
      sendStatusText(chatId).catch(console.error)
    } else if (command === '/start' || command === '/help') {
      sendMessage(chatId, [
        '👋 <b>Пульс КО · бот</b>',
        '',
        '📊 <b>Команды:</b>',
        '/report — полный отчёт (ИННО + БОНДА)',
        '/inno — отчёт только ИННО',
        '/bonda — отчёт только БОНДА',
        '/status — краткая сводка текстом',
        '',
        `💬 ID чата: <code>${chatId}</code>`,
      ].join('\n')).catch(console.error)
    } else if (command === '/chatid') {
      sendMessage(chatId, `Chat ID: <code>${chatId}</code>`).catch(console.error)
    }

    // Return immediately — Telegram gets 200 OK fast, no retries
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Telegram webhook error:', err)
    return NextResponse.json({ ok: true })
  }
}
