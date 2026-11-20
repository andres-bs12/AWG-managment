// Usage: node scripts/agents/dashboard-server.mjs (Node 20+, no dependencies).
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile, readdir, open, lstat, stat, rm } from 'node:fs/promises'
import { constants as FS } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const HOME_DIR = join(homedir(), '.awg-agents') // shared by every chat, worktree and checkout
const RUNS = process.env.AGENTS_DIR ?? join(HOME_DIR, 'runs')
const PORT = Number(process.env.AGENTS_PORT ?? 4747)
const STALL_MS = Number(process.env.AGENTS_STALL_MS ?? 300000)
const FILE_CHANGE_CACHE_MS = 15000
const MAX_STAT_FILES = 400
const IGNORED_SEGMENTS = new Set(['node_modules', 'target', 'test-results', 'playwright-report', '.agents'])
const ID = /^[0-9a-z-]+$/
const STATES = new Set(['starting', 'running', 'done', 'failed', 'limit'])
const FINISHED = new Set(['done', 'failed', 'limit'])
let lastViewedAt = null
const fileChangeCache = new Map() // runId -> { at, cwd, value }

// ---- subscription usage (5-hour and weekly windows) ----
const CODEX_DIR = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'sessions')
const PENDING_FILE = process.env.AGENTS_PENDING_FILE ?? join(HOME_DIR, 'pending.json')
async function listPending() {
  try {
    const list = JSON.parse(await readFile(PENDING_FILE, 'utf8'))
    return Array.isArray(list) ? list.slice(0, 50).map((p) => ({
      id: String(p.id ?? ''), title: String(p.title ?? ''), model: String(p.model ?? ''),
      after: String(p.after ?? ''), addedAt: p.addedAt ?? null,
    })) : []
  } catch { return [] }
}
const CLAUDE_USAGE = process.env.AGENTS_USAGE_FILE ?? join(HOME_DIR, 'usage-claude.json')
let codexCache = { at: 0, value: null }

const numericDirs = async (dir) => (await readdir(dir)).filter((n) => /^\d+$/.test(n)).sort().reverse()

// Codex writes its rate limits into every session log; read the newest one.
async function lastRateLimits(file) {
  const handle = await open(file, 'r')
  try {
    const { size } = await handle.stat()
    const len = Math.min(size, 400000)
    const buf = Buffer.alloc(len)
    await handle.read(buf, 0, len, size - len)
    const text = buf.toString('utf8')
    const at = text.lastIndexOf('"rate_limits":{')
    if (at < 0) return null
    const start = text.indexOf('{', at)
    let depth = 0
    let end = -1
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}' && --depth === 0) { end = i; break }
    }
    if (end < 0) return null
    const rl = JSON.parse(text.slice(start, end + 1))
    if (!rl.primary || !rl.secondary) return null
    return {
      fiveHour: { pct: rl.primary.used_percent, resetsAt: rl.primary.resets_at * 1000 },
      week: { pct: rl.secondary.used_percent, resetsAt: rl.secondary.resets_at * 1000 },
    }
  } finally { await handle.close() }
}

async function codexUsage() {
  if (Date.now() - codexCache.at < 20000) return codexCache.value
  let value = null
  try {
    outer: for (const y of await numericDirs(CODEX_DIR)) {
      for (const m of await numericDirs(join(CODEX_DIR, y))) {
        for (const d of await numericDirs(join(CODEX_DIR, y, m))) {
          const dir = join(CODEX_DIR, y, m, d)
          const files = await Promise.all((await readdir(dir)).filter((f) => f.endsWith('.jsonl'))
            .map(async (f) => ({ path: join(dir, f), t: (await stat(join(dir, f))).mtimeMs })))
          for (const f of files.sort((a, b) => b.t - a.t).slice(0, 5)) {
            const found = await lastRateLimits(f.path).catch(() => null)
            if (found) { value = { ...found, updatedAt: f.t }; break outer }
          }
        }
      }
    }
  } catch { /* no Codex logs yet */ }
  codexCache = { at: Date.now(), value }
  return value
}

async function claudeUsage() {
  try {
    const data = JSON.parse(await readFile(CLAUDE_USAGE, 'utf8'))
    return data?.fiveHour && data?.week ? data : null
  } catch { return null }
}

// A window whose reset time already passed is back to 0 %, whatever the old reading said.
function fresh(window, now) {
  if (!window) return null
  return window.resetsAt && window.resetsAt < now ? { ...window, pct: 0, resetsAt: null } : window
}

// Antigravity keeps live per-model-group quota in its local language server (127.0.0.1 only).
// Its port and local token sit in ~/.gemini/antigravity/daemon/hub_*.json; the token is never logged or sent anywhere else.
const HUB_DIR = join(process.env.GEMINI_HOME ?? join(homedir(), '.gemini'), 'antigravity', 'daemon')
let googleCache = { at: 0, value: null }

function groupName(labels) {
  const text = labels.join(' ')
  if (/Argon/.test(text)) return 'Argon'
  if (/Neon|Hydrogen|Flash/.test(text)) return 'Gemini 4'
  if (/Claude/.test(text)) return 'Opus/Sonnet'
  return labels[0].replace(/\s*\(.*\)/, '')
}

async function googleUsage(now) {
  if (now - googleCache.at < 15000) return googleCache.value
  let value = null
  try {
    for (const file of (await readdir(HUB_DIR)).filter((f) => /^hub_\d+\.json$/.test(f))) {
      let hub
      try { hub = JSON.parse(await readFile(join(HUB_DIR, file), 'utf8')) } catch { continue }
      if (!Number.isSafeInteger(hub.httpPort) || isDead(hub.pid)) continue
      const res = await fetch(`http://127.0.0.1:${hub.httpPort}/exa.language_server_pb.LanguageServerService/GetUserStatus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Connect-Protocol-Version': '1', 'X-Codeium-Csrf-Token': String(hub.csrfToken) },
        body: JSON.stringify({ metadata: { ideName: 'antigravity', extensionName: 'antigravity', locale: 'en' } }),
        signal: AbortSignal.timeout(3000),
      }).catch(() => null)
      if (!res?.ok) continue
      const models = (await res.json())?.userStatus?.cascadeModelConfigData?.clientModelConfigs ?? []
      const groups = new Map()
      for (const m of models) {
        const q = m.quotaInfo
        if (!q || typeof q.remainingFraction !== 'number' || !q.resetTime) continue
        const key = `${q.resetTime}|${q.remainingFraction}`
        if (!groups.has(key)) groups.set(key, { q, labels: [] })
        groups.get(key).labels.push(m.label)
      }
      const windows = [...groups.values()].map(({ q, labels }) => {
        const resetsAt = Date.parse(q.resetTime)
        const kind = resetsAt - now <= 6 * 3600 * 1000 ? '5 h' : 'semana'
        return { label: `${groupName(labels)} · ${kind}`, pct: (1 - q.remainingFraction) * 100, resetsAt }
      }).sort((x, y) => x.label.localeCompare(y.label))
      if (windows.length) { value = { windows, updatedAt: now }; break }
    }
  } catch { /* Antigravity not running */ }
  googleCache = { at: now, value }
  return value
}

async function usage(now) {
  const [claude, codex, google] = await Promise.all([claudeUsage(), codexUsage(), googleUsage(now)])
  const two = (v) => v && [
    { label: '5 horas', ...fresh(v.fiveHour, now) },
    { label: 'Semana', ...fresh(v.week, now) },
  ]
  const svc = (id, name, windows, updatedAt, note) => ({ id, name, windows: windows ?? [], updatedAt: updatedAt ?? null, note: windows ? '' : note })
  return { now, services: [
    svc('claude', 'Claude', two(claude), claude?.updatedAt, 'Sin datos todavía'),
    svc('codex', 'ChatGPT', two(codex), codex?.updatedAt, 'Sin datos todavía'),
    svc('google', 'Google', google?.windows.map((w) => ({ ...w, ...fresh(w, now) })), google?.updatedAt, 'Antigravity no está abierto'),
  ] }
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(body)
}

function json(res, status, body) {
  send(res, status, JSON.stringify(body), 'application/json; charset=utf-8')
}

function isDead(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0) } catch (error) { return error.code === 'ESRCH' }
  return false
}

function unquoteGitPath(p) {
  if (!p.startsWith('"') || !p.endsWith('"')) return p
  const bytes = []
  const inner = p.slice(1, -1)
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] !== '\\') { bytes.push(...Buffer.from(inner[i], 'utf8')); continue }
    const next = inner[++i]
    if (next === undefined) break
    if (/[0-7]/.test(next)) {
      const oct = inner.slice(i, i + 3)
      if (/^[0-7]{3}$/.test(oct)) { bytes.push(parseInt(oct, 8)); i += 2; continue }
    }
    const escapes = { a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11, '\\': 92, '"': 34 }
    bytes.push(escapes[next] ?? next.charCodeAt(0))
  }
  return Buffer.from(bytes).toString('utf8')
}

async function git(cwd, args) {
  const { stdout } = await execFileAsync('git', ['-C', cwd, ...args], {
    timeout: 3000,
    maxBuffer: 4 * 1024 * 1024,
  })
  return stdout
}

async function computeLastFileChange(cwd) {
  if (!(await lstat(cwd)).isDirectory()) return null
  const repoRoot = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim()
  if (!repoRoot) return null
  const statusOut = await git(cwd, ['-c', 'core.quotePath=false', 'status', '--porcelain', '-uall'])
  const candidates = []
  for (const line of statusOut.split(/\r?\n/)) {
    if (line.length < 4) continue
    const xy = line.slice(0, 2)
    if (xy[1] === 'D' || (xy[0] === 'D' && xy[1] === ' ')) continue
    let relPath = line.slice(3)
    if ((xy[0] === 'R' || xy[0] === 'C') && relPath.includes(' -> ')) {
      relPath = relPath.slice(relPath.lastIndexOf(' -> ') + 4)
    }
    relPath = unquoteGitPath(relPath)
    if (!relPath || relPath.startsWith('/') || relPath.includes('\0')) continue
    const segs = relPath.split('/')
    if (segs.some((s) => !s || s === '..' || IGNORED_SEGMENTS.has(s))) continue
    candidates.push(relPath)
    if (candidates.length >= MAX_STAT_FILES) break
  }
  if (!candidates.length) return null
  let latest = null
  for (let i = 0; i < candidates.length; i += 40) {
    const batch = await Promise.all(candidates.slice(i, i + 40).map(async (relPath) => {
      try {
        const info = await lstat(join(repoRoot, relPath))
        if (!info.isFile()) return null // never follow symlinks, directories or special files
        return { path: relPath, mtimeMs: info.mtimeMs }
      } catch { return null }
    }))
    for (const item of batch) {
      if (item && (!latest || item.mtimeMs > latest.mtimeMs)) latest = item
    }
  }
  return latest ? { path: latest.path, at: new Date(latest.mtimeMs).toISOString() } : null
}

async function lastFileChangeForRun(runId, cwd, now, inFlightByCwd) {
  if (typeof cwd !== 'string' || !cwd) return null
  const cached = fileChangeCache.get(runId)
  if (cached && cached.cwd === cwd && now - cached.at < FILE_CHANGE_CACHE_MS) {
    return cached.value
  }
  let promise = inFlightByCwd.get(cwd)
  if (!promise) {
    promise = computeLastFileChange(cwd).catch(() => null)
    inFlightByCwd.set(cwd, promise)
  }
  const value = await promise
  fileChangeCache.set(runId, { at: now, cwd, value })
  if (fileChangeCache.size > 200) {
    for (const [k, v] of fileChangeCache) {
      if (now - v.at >= 60000) fileChangeCache.delete(k)
    }
  }
  return value
}

async function listRuns(now, all = false) {
  let entries
  try { entries = await readdir(RUNS, { withFileTypes: true }) } catch { return [] }
  const newest = entries.filter((entry) => entry.isDirectory() && ID.test(entry.name)).sort((a, b) => b.name.localeCompare(a.name)).slice(0, all ? undefined : 150)
  const inFlightByCwd = new Map()
  const runs = await Promise.all(newest.map(async (entry) => {
    try {
      const run = JSON.parse(await readFile(join(RUNS, entry.name, 'status.json'), 'utf8'))
      if (!run || run.id !== entry.name || !STATES.has(run.state) ||
          typeof run.startedAt !== 'string' || !Number.isFinite(Date.parse(run.startedAt))) return null
      const finished = FINISHED.has(run.state)
      if (!all && finished && Date.parse(run.endedAt) < now - 86400000) return null
      const rawOutputAt = Date.parse(run.lastOutputAt ?? run.startedAt)
      const outputAt = Number.isFinite(rawOutputAt) ? rawOutputAt : Date.parse(run.startedAt)
      let displayState = finished ? run.state : 'working'
      let group = finished ? 'finished' : 'working'
      let note = run.note ?? ''
      let idleMs = null
      let lastFileChange = null
      if (!finished && run.cli !== 'claude-subagent' && isDead(run.pid) && now - Date.parse(run.startedAt) > 5000) {
        displayState = 'failed'
        group = 'finished'
        note = 'El proceso terminó sin avisar'
        fileChangeCache.delete(run.id)
      } else if (!finished) {
        if (!all) lastFileChange = await lastFileChangeForRun(run.id, run.cwd, now, inFlightByCwd)
        const fileAt = lastFileChange ? Date.parse(lastFileChange.at) : NaN
        const activityAt = Number.isFinite(fileAt) ? Math.max(outputAt, fileAt) : outputAt
        idleMs = Math.max(0, now - activityAt)
        if (idleMs > STALL_MS) displayState = 'stalled'
      } else {
        fileChangeCache.delete(run.id)
      }
      return {
        id: run.id, name: run.name ?? '', model: run.model ?? '', title: run.title ?? '',
        cwd: run.cwd ?? null, displayState, group, startedAt: run.startedAt, endedAt: run.endedAt ?? null,
        lastOutputAt: run.lastOutputAt ?? null, idleMs, exitCode: run.exitCode ?? null,
        note, lastLine: run.lastLine ?? '', lastFileChange,
      }
    } catch { return null } // A writer may be updating a status or removing a run.
  }))
  return runs.filter(Boolean).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)).slice(0, all ? undefined : 60)
}

// Deletes every run the panel shows as finished (also the ones hidden after 24 h). Working runs are never touched.
async function clearFinished(now) {
  let removed = 0
  for (const run of await listRuns(now, true)) {
    if (run.group !== 'finished' || !ID.test(run.id)) continue
    const dir = join(RUNS, run.id)
    if (!(await lstat(dir)).isDirectory()) continue // never follow a symlink out of the runs folder
    await rm(dir, { recursive: true, force: true })
    removed++
  }
  return removed
}

async function tail(id, count) {
  if (!(await lstat(join(RUNS, id))).isDirectory()) return null
  const file = await open(join(RUNS, id, 'log.txt'), FS.O_RDONLY | FS.O_NOFOLLOW | FS.O_NONBLOCK)
  try {
    const info = await file.stat()
    if (!info.isFile()) return null // FIFO, directory...: never read or block on it
    const size = info.size
    const start = Math.max(0, size - 16 * 1024)
    const buffer = Buffer.alloc(Math.min(size, 16 * 1024))
    const { bytesRead } = await file.read(buffer, 0, buffer.length, start)
    const lines = buffer.subarray(0, bytesRead).toString('utf8').split('\n')
    // Drop the first fragment when the read began in the middle of a line.
    if (start > 0) lines.shift()
    return lines.map((line) => line.trim()).filter(Boolean).slice(-count).map((line) => line.slice(0, 300))
  } finally { await file.close() }
}

const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== `localhost:${PORT}` && req.headers.host !== `127.0.0.1:${PORT}`) {
      return send(res, 403, 'Forbidden\n')
    }
    if (req.method === 'POST' && req.url === '/api/clear-finished') {
      // The custom header cannot be sent cross-origin without a CORS preflight, which this server never allows.
      if (req.headers['x-agents-action'] !== 'clear-finished') return send(res, 403, 'Forbidden\n')
      return json(res, 200, { removed: await clearFinished(Date.now()) })
    }
    if (req.method === 'POST' && req.url === '/api/usage/refresh') {
      if (req.headers['x-agents-action'] !== 'refresh-usage') return send(res, 403, 'Forbidden\n')
      codexCache.at = 0
      googleCache.at = 0 // force fresh reads of Codex and Antigravity; Claude's file is read on every request
      return json(res, 200, await usage(Date.now()))
    }
    if (req.method !== 'GET') return send(res, 404, 'Not found\n')
    // Parse only an origin-form path; never trust a supplied URL's authority.
    if (!req.url?.startsWith('/') || req.url.startsWith('//')) return send(res, 404, 'Not found\n')
    const url = new URL(`http://localhost:${PORT}${req.url}`)
    if (url.pathname === '/') {
      try { send(res, 200, await readFile(join(HERE, 'dashboard.html')), 'text/html; charset=utf-8') } catch (error) {
        if (error.code !== 'ENOENT') throw error
        send(res, 200, 'Agent panel is ready. dashboard.html has not been created yet.\n')
      }
      return
    }
    if (url.pathname === '/api/runs') {
      const now = Date.now()
      lastViewedAt = now
      return json(res, 200, { now, runs: await listRuns(now), pending: await listPending() })
    }
    if (url.pathname === '/api/usage') return json(res, 200, await usage(Date.now()))
    if (url.pathname === '/api/open') {
      return json(res, 200, { viewing: lastViewedAt !== null && Date.now() - lastViewedAt < 5000 })
    }
    const match = url.pathname.match(/^\/api\/runs\/([^/]+)\/tail$/)
    if (match) {
      let id
      try { id = decodeURIComponent(match[1]) } catch { return send(res, 400, 'Invalid run id\n') }
      if (!ID.test(id)) return send(res, 400, 'Invalid run id\n')
      const requested = Number(url.searchParams.get('n') ?? 12)
      const count = Number.isNaN(requested) ? 12 : Math.min(60, Math.max(1, Math.trunc(requested)))
      try {
        const lines = await tail(id, count)
        return lines === null ? send(res, 404, 'Run not found\n') : json(res, 200, { lines })
      } catch (error) {
        if (['ENOENT', 'ENOTDIR', 'ELOOP', 'EISDIR'].includes(error.code)) return send(res, 404, 'Run not found\n')
        throw error
      }
    }
    send(res, 404, 'Not found\n')
  } catch {
    if (!res.headersSent) send(res, 500, 'Unable to read agent panel data\n')
    else res.end()
  }
})

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`Agent panel already running on port ${PORT}`)
    process.exitCode = 0
  } else {
    console.error(`Agent panel: ${error.code ?? 'server error'}`)
    process.exitCode = 1
  }
})

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535 || !Number.isFinite(STALL_MS) || STALL_MS < 0) {
  console.error('Agent panel: invalid AGENTS_PORT or AGENTS_STALL_MS')
  process.exitCode = 1
} else {
  server.listen(PORT, '127.0.0.1', () => console.log(`Agent panel: http://localhost:${PORT}`))
}
