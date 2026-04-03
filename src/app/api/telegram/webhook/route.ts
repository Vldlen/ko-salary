import { NextRequest, NextResponse } from 'next/server'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN!
const ALLOWED_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean)

// Verify webhook comes from Telegram
function verifyWebhook(request: NextRequest): boolean {
  const header = request.headers.get('x-telegram-bot-api-secret-token')
  return header === SECRET_TOKEN
}

async function sendPhoto(chatId: string, imageUrl: string, caption: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: imageUrl,
      caption,
      parse_mode: 'HTML',
    }),
  })
  return res.json()
}

async function sendMessage(chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  })
}

// Generate and send team report to a chat
export async function sendTeamReport(chatId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  // Get JSON data for caption
  const jsonRes = await fetch(`${baseUrl}/api/telegram/team-report?token=${SECRET_TOKEN}&format=json`)
  const data = await jsonRes.json()

  if (!data.members || data.members.length === 0) {
    await sendMessage(chatId, '⚠️ Нет данных для отчёта')
    return
  }

  // Build caption
  const pct = data.total.pct
  const emoji = pct >= 100 ? '🟢' : pct >= 75 ? '🔵' : pct >= 50 ? '🟡' : '🔴'
  const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(Math.round(n))

  let caption = `${emoji} <b>Пульс КО — ${data.period}</b>\n\n`
  caption += `💰 Выручка: <b>${fmt(data.total.fact)} ₽</b> / ${fmt(data.total.plan)} ₽ (${pct}%)\n`
  caption += `📊 Прогноз: <b>${fmt(data.total.fact + data.total.forecast)} ₽</b>\n`
  caption += `📋 Сделок оплач.: <b>${data.members.reduce((s: number, m: any) => s + m.deals_paid, 0)}</b>\n`
  caption += `🤝 Встреч: <b>${data.members.reduce((s: number, m: any) => s + m.meetings_fact, 0)}</b>\n`

  // Send image
  const imageUrl = `${baseUrl}/api/telegram/team-report?token=${SECRET_TOKEN}`

  try {
    await sendPhoto(chatId, imageUrl, caption)
  } catch (err) {
    // If image fails, send text-only
    caption += '\n\n👥 <b>По менеджерам:</b>\n'
    for (const m of data.members) {
      const mPct = m.revenue_plan > 0 ? Math.round(m.revenue_fact / m.revenue_plan * 100) : 0
      const mEmoji = mPct >= 100 ? '✅' : mPct >= 50 ? '🔹' : '🔸'
      caption += `${mEmoji} ${m.name} — ${fmt(m.revenue_fact)} ₽ (${mPct}%)\n`
    }
    await sendMessage(chatId, caption)
  }
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
