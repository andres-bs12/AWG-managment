#!/usr/bin/env node
// Claude Code status line. Claude Code feeds it a JSON blob on stdin after every assistant message; when that
// blob carries the plan's rate limits, this records them for the agent panel (free, no model tokens) and prints
// a short line. The last raw blob (no credentials in it) is kept in statusline-last.json to inspect its shape.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const dir = join(homedir(), '.awg-agents')
let input = {}
try { input = JSON.parse(readFileSync(0, 'utf8')) } catch { /* no input: print only the fallback */ }

const atomic = (file, data) => {
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2))
  renameSync(tmp, file)
}
mkdirSync(dir, { recursive: true })
atomic(join(dir, 'statusline-last.json'), input)

const rl = input.rate_limits ?? input.rateLimits ?? {}
const five = rl.five_hour ?? rl.fiveHour
const week = rl.seven_day ?? rl.sevenDay ?? rl.weekly
const pct = (w) => w?.used_percentage ?? w?.used_percent ?? w?.utilization ?? w?.percentUsed
const resets = (w) => {
  const v = w?.resets_at ?? w?.resetsAt
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v // seconds or ms
  return v ? Date.parse(v) : null
}
if (pct(five) != null && pct(week) != null) {
  atomic(join(dir, 'usage-claude.json'), {
    updatedAt: Date.now(),
    fiveHour: { pct: Number(pct(five)), resetsAt: resets(five) },
    week: { pct: Number(pct(week)), resetsAt: resets(week) },
  })
}
const model = input.model?.display_name ?? input.model?.id ?? 'Claude'
console.log(pct(five) != null && pct(week) != null
  ? `${model} · 5 h ${Math.round(pct(five))}% · semana ${Math.round(pct(week))}%`
  : model)
