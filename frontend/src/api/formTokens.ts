const PREFIX = 'awg-form-token:'
const MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000
const tokenKey = (code: string) => PREFIX + code.trim().toUpperCase()

/** Only successful customer submissions/checkouts may call this; viewing a form grants no storage. */
export function rememberFormToken(code: string, token: string, persist = true, now = Date.now()): void {
  try {
    if (!persist || localStorage.getItem('awg-staff-token')) {
      forgetFormToken(code)
      return
    }
    localStorage.setItem(tokenKey(code), JSON.stringify({ token, savedAt: now }))
  } catch { /* Storage is optional; the customer can use the original form link. */ }
}

export function readFormToken(code: string, now = Date.now()): string | null {
  return readTokenAtKey(tokenKey(code), now)
}

function readTokenAtKey(key: string, now: number): string | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    try {
      const entry: unknown = JSON.parse(raw)
      if (entry && typeof entry === 'object' && 'token' in entry && 'savedAt' in entry
        && typeof entry.token === 'string' && entry.token.length > 0
        && typeof entry.savedAt === 'number' && Number.isFinite(entry.savedAt)
        && entry.savedAt > 0 && entry.savedAt <= now && now - entry.savedAt < MAX_AGE_MS) return entry.token
    } catch { /* Undated legacy tokens cannot be safely migrated. */ }
    localStorage.removeItem(key)
  } catch { /* Storage unavailable. */ }
  return null
}

export function forgetFormToken(code: string): void {
  try { localStorage.removeItem(tokenKey(code)) } catch { /* Storage unavailable. */ }
}

function formTokenKeys(): string[] {
  try {
    return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key): key is string => key !== null && key.startsWith(PREFIX))
  } catch { return [] }
}

/** Prune on app startup as well as on read; reads never extend the lifetime. */
export function pruneFormTokens(now = Date.now()): void {
  for (const key of formTokenKeys()) readTokenAtKey(key, now)
}

/** Logout also removes legacy entries, including tokens belonging to other orders. */
export function clearFormTokens(): void {
  for (const key of formTokenKeys()) {
    try { localStorage.removeItem(key) } catch { /* Storage unavailable. */ }
  }
}
