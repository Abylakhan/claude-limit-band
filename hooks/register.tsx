import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'limit-band', key: 'limits' } as const, [] as Limit[])
const billingDay = atom({ plugin: 'limit-band', key: 'billingDay' } as const, null as number | null)
const nowAtom = atom({ plugin: 'limit-band', key: 'now' } as const, 0)

const TZ_MS = 5 * 3600 * 1000 // Алматы, UTC+5
const DAY_MS = 24 * 3600 * 1000

const NAMES: Record<string, string> = { five_hour: '5ч', seven_day: 'Неделя', spend_limit: 'Расход' }

const pad = (n: number) => String(n).padStart(2, '0')

function bar(leftPct: number, width = 10): string {
  const full = Math.max(0, Math.min(width, Math.round((leftPct / 100) * width)))
  return '█'.repeat(full) + '░'.repeat(width - full)
}

function fmtReset(iso: string | undefined, now: number): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const local = new Date(t + TZ_MS)
  const hm = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
  if (t - now < DAY_MS) return `сброс в ${hm}`
  return `сброс ${pad(local.getUTCDate())}.${pad(local.getUTCMonth() + 1)} ${hm}`
}

function nextBilling(day: number, now: number): { date: string; days: number } {
  const local = new Date(now + TZ_MS)
  const y = local.getUTCFullYear()
  const m = local.getUTCMonth()
  const today = Date.UTC(y, m, local.getUTCDate())
  const at = (yy: number, mm: number) => {
    const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate()
    return Date.UTC(yy, mm, Math.min(day, last))
  }
  let target = at(y, m)
  if (target < today) target = at(y, m + 1)
  const d = new Date(target)
  return {
    date: `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`,
    days: Math.round((target - today) / DAY_MS),
  }
}

function toLimits(raw: { kind: string; percentUsed: number; resetsAt?: string }[]): Limit[] {
  return raw.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'billing',
      description: 'День оплаты подписки: /billing 15 (пусто — сбросить)',
    })
    const saved = await $.store.get('billingDay')
    await update($, billingDay, () => (typeof saved === 'number' ? saved : saved === null ? null : 23))
    try {
      const u = await $.session.usage()
      await update($, limits, () => toLimits(u.rateLimits))
    } catch {}
    const now = await $.clock.now()
    await update($, nowAtom, () => now)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, limits, () => toLimits(e.rateLimits))
    const now = await $.clock.now()
    await update($, nowAtom, () => now)
    return next(e)
  })

  on('command.run', { command: 'billing' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === '') {
      await $.store.set('billingDay', null)
      await update($, billingDay, () => null)
      return { text: 'День оплаты сброшен.' }
    }
    const day = Number(arg)
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return { text: 'Напиши число от 1 до 31, например: /billing 15' }
    }
    await $.store.set('billingDay', day)
    await update($, billingDay, () => day)
    const now = await $.clock.now()
    await update($, nowAtom, () => now)
    const b = nextBilling(day, now)
    return { text: `Запомнил: оплата ${day}-го числа. Следующая — ${b.date}, через ${b.days} дн.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, limits)
    const day = await read($, billingDay)
    const stored = await read($, nowAtom)
    const now = stored || (await $.clock.now())

    const parts = list.map(l => {
      const left = Math.max(0, Math.round((100 - l.percentUsed) * 10) / 10)
      const reset = fmtReset(l.resetsAt, now)
      return { text: `${NAMES[l.kind] ?? l.kind} ${bar(left)} ${left}%${reset ? ` (${reset})` : ''}`, low: left <= 15 }
    })

    let pay = '💳 Оплата: задай /billing <день>'
    let payWarn = false
    if (day !== null) {
      const b = nextBilling(day, now)
      pay = b.days === 0 ? `💳 Оплата сегодня (${b.date})` : `💳 Оплата ${b.date} (через ${b.days} дн.)`
      payWarn = b.days <= 3
    }

    return (
      <Box>
        {parts.length === 0 && <Text dimColor>Лимит {bar(0).replace(/█/g, '░')} —%  ·  </Text>}
        {parts.map((p, i) => (
          <Text key={`l${i}`} color={p.low ? 'red' : undefined} dimColor={!p.low}>
            {p.text}  ·  
          </Text>
        ))}
        <Text key="pay" color={payWarn ? 'yellow' : undefined} dimColor={!payWarn}>
          {pay}
        </Text>
      </Box>
    )
  })
}
