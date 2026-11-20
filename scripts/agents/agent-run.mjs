#!/usr/bin/env node
// Agent run registry. Every delegated agent is launched through `run` (CLIs) or
// registered with `start`/`finish` (Claude Code subagents). State lives in
// .agents/runs/<id>/{status.json,log.txt}; the dashboard only reads those files.
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
// One shared folder outside the repo: every chat, worktree and checkout feeds the same panel.
const HOME_DIR = join(homedir(), '.awg-agents')
const RUNS = process.env.AGENTS_DIR ?? join(HOME_DIR, 'runs')
const ID_RE = /^[0-9a-z-]+$/
const TERMINAL = new Set(['done', 'failed', 'limit'])

// Text that means "the model stopped for a reason that is not the task".
const LIMIT_RE = /usage limit|hit your .*limit|rate.?limit|quota|\b429\b|resource.?exhausted|try again at/i
const ERROR_RE = /operation not permitted|permission denied|denied|app-server|ECONNREFUSED|authentication|not logged in|unauthorized|panic|fatal/i
// Some CLIs exit 0 while doing nothing (agy: tool auto-denied in headless mode). They print almost
// nothing, so this only counts when the whole output was tiny; a long review that merely quotes
// these words (as Neon's audit of this very file did) is a success.
const SILENT_FAIL_RE = /no output produced|auto-denied|cannot prompt for/i
const SILENT_FAIL_MAX_BYTES = 1500
const TAIL_CHARS = 700 // limit/error wording only counts near the end of the output

const now = () => new Date().toISOString()
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'agent'

function parseFlags(argv) {
  const flags = {}
  const rest = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') { rest.push(...argv.slice(i + 1)); break }
    if (!a.startsWith('--')) { rest.push(a); continue }
    const eq = a.indexOf('=')
    if (eq > 0) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue } // --key=value
    const next = argv[i + 1]
    flags[a.slice(2)] = next === undefined || next.startsWith('--') ? '' : argv[++i]
  }
  return { flags, rest }
}

function writeStatus(id, patch) {
  const dir = join(RUNS, id)
  const file = join(dir, 'status.json')
  let cur = {}
  try { cur = JSON.parse(readFileSync(file, 'utf8')) } catch { /* first write */ }
  // A finished run never goes back to running (a late ping must not undo `finish`).
  if (TERMINAL.has(cur.state) && patch.state && !TERMINAL.has(patch.state)) delete patch.state
  const next = { ...cur, ...patch, id, updatedAt: now() }
  const tmp = `${file}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`
  writeFileSync(tmp, JSON.stringify(next, null, 2))
  renameSync(tmp, file)
  return next
}

function create({ name, model, title, cli, pid, cwd }) {
  const stamp = now().replace(/[-:T]/g, '').slice(0, 14)
  const id = `${stamp}-${slug(name)}-${randomBytes(2).toString('hex')}`
  mkdirSync(RUNS, { recursive: true })
  mkdirSync(join(RUNS, id)) // not recursive: a collision must fail loudly, never share a run
  writeStatus(id, {
    name, model, title: title ?? '', cli: cli ?? '', pid: pid ?? null,
    cwd: cwd ?? null, state: 'starting', startedAt: now(), lastOutputAt: null, endedAt: null,
    exitCode: null, note: '', lastLine: '',
  })
  return id
}

function existingId(id) {
  if (!id || !ID_RE.test(id) || !existsSync(join(RUNS, id, 'status.json'))) {
    console.error(`unknown run id: ${id ?? '(missing)'}`)
    process.exit(2)
  }
  return id
}

const lastMatching = (text, re) => text.split('\n').reverse().find((l) => re.test(l))?.trim().slice(0, 200)

function classify(code, signal, text, totalBytes) {
  if (signal) return { state: 'failed', note: `killed by ${signal}` }
  const tail = text.slice(-TAIL_CHARS)
  if (code === 0) {
    const silent = totalBytes < SILENT_FAIL_MAX_BYTES && lastMatching(text, SILENT_FAIL_RE)
    return silent ? { state: 'failed', note: silent } : { state: 'done', note: '' }
  }
  const limit = lastMatching(tail, LIMIT_RE)
  if (limit) return { state: 'limit', note: limit }
  return { state: 'failed', note: lastMatching(tail, ERROR_RE) ?? `exit code ${code}` }
}

function run({ flags, rest }) {
  if (!flags.name || !flags.model || rest.length === 0) {
    console.error('usage: agent-run.mjs run --name N --model "Model" --title "short title" -- <command...>')
    process.exit(2)
  }
  const cwd = process.cwd()
  const id = create({ name: flags.name, model: flags.model, title: flags.title, cli: rest[0], cwd })
  if (flags.pending) removePending(flags.pending)
  const log = createWriteStream(join(RUNS, id, 'log.txt'), { flags: 'a' })
  log.on('error', () => { /* a full disk must not kill the agent */ })
  process.stdout.on('error', () => { /* EPIPE: the caller stopped reading */ })
  console.error(`[agent-run] id=${id}`)

  // stdin is always closed: a CLI waiting on stdin hung for hours once. Own process group so a
  // stop signal reaches the CLI's helpers too.
  const child = spawn(rest[0], rest.slice(1), { stdio: ['ignore', 'pipe', 'pipe'], cwd, detached: true })
  writeStatus(id, { pid: child.pid, state: 'running' })

  let buf = ''
  let totalBytes = 0
  let dirty = false
  let lastLine = ''
  const onData = (chunk) => {
    log.write(chunk)
    process.stdout.write(chunk)
    totalBytes += chunk.length
    buf = (buf + chunk.toString()).slice(-8000)
    const line = buf.split('\n').reverse().find((l) => l.trim())
    if (line) lastLine = line.trim().slice(0, 240)
    dirty = true
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  const flush = setInterval(() => {
    if (dirty) { dirty = false; writeStatus(id, { lastOutputAt: now(), lastLine }) }
  }, 1000)

  const stop = (sig) => () => { try { process.kill(-child.pid, sig) } catch { child.kill(sig) } }
  for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, stop(sig))

  let finished = false
  const finalize = (code, signal) => {
    if (finished) return
    finished = true
    clearInterval(flush)
    const exit = code ?? (signal ? 128 : 1)
    const { state, note } = classify(exit, signal, buf, totalBytes)
    writeStatus(id, { state, note, endedAt: now(), exitCode: exit, lastLine, lastOutputAt: now() })
    log.end(() => process.exit(exit))
    setTimeout(() => process.exit(exit), 1500).unref()
  }
  child.on('error', (e) => {
    if (finished) return
    finished = true
    clearInterval(flush)
    writeStatus(id, { state: 'failed', endedAt: now(), exitCode: -1, note: `could not start: ${e.message}` })
    log.end(() => process.exit(1))
  })
  // 'close' waits for the pipes; a helper that keeps them open must not hide that the CLI ended.
  child.on('exit', (code, signal) => setTimeout(() => finalize(code, signal), 2000).unref())
  child.on('close', finalize)
}

function start({ flags }) {
  if (!flags.name || !flags.model) { console.error('usage: start --name N --model "Model" --title "…"'); process.exit(2) }
  const id = create({ name: flags.name, model: flags.model, title: flags.title, cli: 'claude-subagent' })
  writeStatus(id, { state: 'running', lastOutputAt: now() })
  console.log(id)
}

function ping({ rest, flags }) {
  const id = existingId(rest[0])
  const patch = { lastOutputAt: now() }
  if (flags.note) patch.lastLine = flags.note
  writeStatus(id, patch)
}

function finish({ rest, flags }) {
  const id = existingId(rest[0])
  const state = flags.state || 'done'
  if (!TERMINAL.has(state)) { console.error('state must be done|failed|limit'); process.exit(2) }
  writeStatus(id, { state, endedAt: now(), exitCode: state === 'done' ? 0 : 1, note: flags.note ?? '', lastOutputAt: now() })
}

// Claude's own usage can only be read by the orchestrator (MCP tool), so it records it here.
function usage({ rest, flags }) {
  if (rest[0] !== 'claude') { console.error('usage: usage claude --five N --five-reset ISO --week N --week-reset ISO'); process.exit(2) }
  const ms = (iso) => (iso ? Date.parse(iso) : null)
  const file = process.env.AGENTS_USAGE_FILE ?? join(HOME_DIR, 'usage-claude.json')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify({
    updatedAt: Date.now(),
    fiveHour: { pct: Number(flags.five), resetsAt: ms(flags['five-reset']) },
    week: { pct: Number(flags.week), resetsAt: ms(flags['week-reset']) },
  }, null, 2))
}

// Queued work that has no agent yet, shown under "Pendiente" in the panel.
const PENDING_FILE = process.env.AGENTS_PENDING_FILE ?? join(HOME_DIR, 'pending.json')
function readPending() {
  try { const list = JSON.parse(readFileSync(PENDING_FILE, 'utf8')); return Array.isArray(list) ? list : [] } catch { return [] }
}
function writePending(list) {
  mkdirSync(dirname(PENDING_FILE), { recursive: true })
  const tmp = PENDING_FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(list, null, 2))
  renameSync(tmp, PENDING_FILE)
}
function removePending(key) {
  const list = readPending()
  const next = list.filter((p) => p.id !== key && p.name !== key)
  if (next.length !== list.length) writePending(next)
}
function pending({ rest, flags }) {
  const action = rest[0]
  if (action === 'add') {
    if (!flags.title) { console.error('usage: pending add --title "…" [--name N] [--model "Model"] [--after "…"]'); process.exit(2) }
    const id = 'p' + randomBytes(3).toString('hex')
    const list = readPending()
    list.push({ id, name: flags.name ?? id, title: flags.title, model: flags.model ?? '', after: flags.after ?? '', addedAt: now() })
    writePending(list)
    console.log(id)
  } else if (action === 'done' && rest[1]) {
    removePending(rest[1])
  } else if (action === 'list') {
    for (const p of readPending()) console.log(`${p.id}\t${p.name}\t${p.title}${p.after ? ` (after ${p.after})` : ''}`)
  } else {
    console.error('usage: pending add|done <id|name>|list'); process.exit(2)
  }
}

const [cmd, ...argv] = process.argv.slice(2)
const parsed = parseFlags(argv)
const commands = { run, start, ping, finish, usage, pending }
if (!commands[cmd]) {
  console.error('commands: pending add|done|list | run [--pending id] | start | ping <id> | finish <id> --state done|failed|limit | usage claude …')
  process.exit(2)
}
commands[cmd](parsed)
