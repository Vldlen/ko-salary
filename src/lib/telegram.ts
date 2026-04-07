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

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}K`
  return String(Math.round(n))
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

  const fmt = fmtK

  // Send ИННО report
  if (data.inno && data.inno.length > 0) {
    const totalPlan = data.inno.reduce((s: number, m: any) => s + m.revenue_plan, 0)
    const totalFact = data.inno.reduce((s: number, m: any) => s + m.revenue_fact, 0)
    const totalForecast = data.inno.reduce((s: number, m: any) => s + m.revenue_forecast, 0)
    const pct = totalPlan > 0 ? Math.round(totalFact / totalPlan * 100) : 0
    const emoji = pct >= 90 ? '🟢' : pct >= 70 ? '🔵' : pct >= 50 ? '🟡' : '🔴'

    const caption = `${emoji} <b>ИННО · Пульс КО</b>\n💰 Факт: ${fmt(totalFact)} / ${fmt(totalPlan)} (${pct}%)\n📊 Прогноз: +${fmt(totalForecast)}`

    const cb = Date.now()
    const imageUrl = `${baseUrl}/api/telegram/team-report?token=${SECRET_TOKEN}&company=inno&_=${cb}`

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

    const cb = Date.now()
    const imageUrl = `${baseUrl}/api/telegram/team-report?token=${SECRET_TOKEN}&company=bonda&_=${cb}`

    try {
      await sendPhoto(chatId, imageUrl, caption)
    } catch {
      await sendMessage(chatId, caption)
    }
  }
}

// Send report for a single company
export async function sendCompanyReport(chatId: string, company: 'inno' | 'bonda') {
  const baseUrl = getBaseUrl()
  const jsonRes = await fetch(`${baseUrl}/api/telegram/team-report?token=${SECRET_TOKEN}&format=json`)
  const data = await jsonRes.json()

  const members = company === 'inno' ? data.inno : data.bonda
  if (!members || members.length === 0) {
    await sendMessage(chatId, `⚠️ Нет данных по ${company === 'inno' ? 'ИННО' : 'БОНДА'}`)
    return
  }

  const totalFact = members.reduce((s: number, m: any) => s + m.revenue_fact, 0)
  const totalForecast = members.reduce((s: number, m: any) => s + m.revenue_forecast, 0)
  const totalPlan = members.reduce((s: number, m: any) => s + m.revenue_plan, 0)

  let caption: string
  if (company === 'inno') {
    const pct = totalPlan > 0 ? Math.round(totalFact / totalPlan * 100) : 0
    const emoji = pct >= 90 ? '🟢' : pct >= 70 ? '🔵' : pct >= 50 ? '🟡' : '🔴'
    caption = `${emoji} <b>ИННО · Пульс КО</b>\n💰 Факт: ${fmtK(totalFact)} / ${fmtK(totalPlan)} (${pct}%)\n📊 Прогноз: +${fmtK(totalForecast)}`
  } else {
    caption = `🟣 <b>БОНДА · Пульс КО</b>\n💰 Выручка: ${fmtK(totalFact)}\n📊 Прогноз: +${fmtK(totalForecast)}`
  }

  const cb = Date.now()
  const imageUrl = `${baseUrl}/api/telegram/team-report?token=${SECRET_TOKEN}&company=${company}&_=${cb}`

  try {
    await sendPhoto(chatId, imageUrl, caption)
  } catch {
    await sendMessage(chatId, caption)
  }
}

// Send text-only status summary
export async function sendStatusText(chatId: string) {
  const baseUrl = getBaseUrl()
  const jsonRes = await fetch(`${baseUrl}/api/telegram/team-report?token=${SECRET_TOKEN}&format=json`)
  const data = await jsonRes.json()

  if ((!data.inno || data.inno.length === 0) && (!data.bonda || data.bonda.length === 0)) {
    await sendMessage(chatId, '⚠️ Нет данных для отчёта')
    return
  }

  const lines: string[] = [`📊 <b>Пульс КО · Сводка</b>\n`]

  // ИННО
  if (data.inno && data.inno.length > 0) {
    const totalPlan = data.inno.reduce((s: number, m: any) => s + m.revenue_plan, 0)
    const totalFact = data.inno.reduce((s: number, m: any) => s + m.revenue_fact, 0)
    const totalForecast = data.inno.reduce((s: number, m: any) => s + m.revenue_forecast, 0)
    const pct = totalPlan > 0 ? Math.round(totalFact / totalPlan * 100) : 0

    lines.push(`🔵 <b>ИННО</b> — ${fmtK(totalFact)} / ${fmtK(totalPlan)} (${pct}%)`)
    lines.push(`   прогноз: +${fmtK(totalForecast)}`)

    for (const m of data.inno) {
      const mPct = m.revenue_plan > 0 ? Math.round(m.revenue_fact / m.revenue_plan * 100) : 0
      const bar = mPct >= 90 ? '✅' : mPct >= 50 ? '🔹' : '🔸'
      lines.push(`   ${bar} ${m.name} — ${fmtK(m.revenue_fact)}/${fmtK(m.revenue_plan)} (${mPct}%) · встреч: ${m.meetings_fact}`)
    }
    lines.push('')
  }

  // БОНДА
  if (data.bonda && data.bonda.length > 0) {
    const totalFact = data.bonda.reduce((s: number, m: any) => s + m.revenue_fact, 0)
    const totalForecast = data.bonda.reduce((s: number, m: any) => s + m.revenue_forecast, 0)

    lines.push(`🟣 <b>БОНДА</b> — ${fmtK(totalFact)}`)
    lines.push(`   прогноз: +${fmtK(totalForecast)}`)

    for (const m of data.bonda) {
      const bar = m.revenue_fact > 0 ? '✅' : m.revenue_forecast > 0 ? '🔹' : '🔸'
      lines.push(`   ${bar} ${m.name} — ${fmtK(m.revenue_fact)} · ФД:${m.fd_count} BI:${m.bi_count} · встреч: ${m.meetings_fact}`)
    }
  }

  await sendMessage(chatId, lines.join('\n'))
}
