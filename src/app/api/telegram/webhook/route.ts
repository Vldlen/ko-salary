import { NextRequest, NextResponse } from 'next/server'
import { sendMessage, sendTeamReport, sendCompanyReport, sendStatusText } from '@/lib/telegram'

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
      await sendMessage(chatId, '⛔ Этот чат не авторизован для получения отчётов.')
      return NextResponse.json({ ok: true })
    }

    const command = text.split('@')[0].toLowerCase()

    try {
      if (command === '/report') {
        await sendTeamReport(chatId)
      } else if (command === '/inno') {
        await sendCompanyReport(chatId, 'inno')
      } else if (command === '/bonda') {
        await sendCompanyReport(chatId, 'bonda')
      } else if (command === '/status') {
        await sendStatusText(chatId)
      } else if (command === '/start' || command === '/help') {
        await sendMessage(chatId, [
          '👋 <b>Пульс КО · бот</b>',
          '',
          '📊 <b>Команды:</b>',
          '/report — полный отчёт (ИННО + БОНДА)',
          '/inno — отчёт только ИННО',
          '/bonda — отчёт только БОНДА',
          '/status — краткая сводка текстом',
          '',
          `💬 ID чата: <code>${chatId}</code>`,
        ].join('\n'))
      } else if (command === '/chatid') {
        await sendMessage(chatId, `Chat ID: <code>${chatId}</code>`)
      }
    } catch (err: any) {
      console.error('Command execution error:', err)
      await sendMessage(chatId, `❌ Ошибка: ${err.message || 'Unknown error'}`).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Telegram webhook error:', err)
    return NextResponse.json({ ok: true })
  }
}
