const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const SECRET_TOKEN = process.env.TELEGRAM_SECRET_TOKEN!

export async function sendPhoto(chatId: string, imageUrl: string, caption: string) {
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

export async function sendMessage(chatId: string, text: string) {
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

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

// Send both ИННО and БОНДА report images to a chat
export async function sendTeamReport(chatId: string) {
  const baseUrl = getBaseUrl()

  // Get JSON data to check if there are members
  const jsonRes = await fetch(`${baseUrl}/api/telegram/team-report?token=${SECRET_TOKEN}&format=json`)
  const data = await jsonRes.json()

  if ((!data.inno || data.inno.length === 0) && (!data.bonda || data.bonda.length === 0)) {
    await sendMessage(chatId, '⚠️ Нет данных для отчёта')
    return
  }

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1000) return `${Math.round(n / 1000)}K`
    return String(Math.round(n))
  }

  // Send ИННО report
  if (data.inno && data.inno.length > 0) {
    const totalPlan = data.inno.reduce((s: number, m: any) => s + m.revenue_plan, 0)
    const totalFact = data.inno.reduce((s: number, m: any) => s + m.revenue_fact, 0)
    const totalForecast = data.inno.reduce((s: number, m: any) => s + m.revenue_forecast, 0)
    const pct = totalPlan > 0 ? Math.round(totalFact / totalPlan * 100) : 0
    const emoji = pct >= 90 ? '🟢' : pct >= 70 ? '🔵' : pct >= 50 ? '🟡' : '🔴'

    const caption = `${emoji} <b>ИННО · Пульс КО</b>\n💰 Факт: ${fmt(totalFact)} / ${fmt(totalPlan)} (${pct}%)\n📊 Прогноз: +${fmt(totalForecast)}`

    const imageUrl = `${baseUrl}/api/telegram/team-report?token=${SECRET_TOKEN}&company=inno`

    try {
      await sendPhoto(chatId, imageUrl, caption)
    } catch {
      await sendMessage(chatId, caption)
    }
  }

  // Send БОНДА report
  if (data.bonda && data.bonda.length > 0) {
    const totalFact = data.bonda.reduce((s: number, m: any) => s + m.revenue_fact, 0)
    const totalForecast = data.bonda.reduce((s: number, m: any) => s + m.revenue_forecast, 0)

    const caption = `🟣 <b>БОНДА · Пульс КО</b>\n💰 Выручка: ${fmt(totalFact)}\n📊 Прогноз: +${fmt(totalForecast)}`

    const imageUrl = `${baseUrl}/api/telegram/team-report?token=${SECRET_TOKEN}&company=bonda`

    try {
      await sendPhoto(chatId, imageUrl, caption)
    } catch {
      await sendMessage(chatId, caption)
    }
  }
}
