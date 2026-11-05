import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import { clearFormTokens } from '../api/formTokens'
import type { StaffUser } from '../domain/types'

const TOKEN_KEY = 'awg-staff-token'
type AuthState = {
  user: StaffUser | null; token: string | null; ready: boolean; offline: boolean; expired: boolean
  retrySession: () => void
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [offline, setOffline] = useState(false)
  const [expired, setExpired] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const retrySession = useCallback(() => setAttempt(value => value + 1), [])

  useEffect(() => {
    const expire = () => { setToken(null); setUser(null); setOffline(false); setExpired(true); setReady(true) }
    const storage = (event: StorageEvent) => { if (event.key === TOKEN_KEY && !event.newValue) expire() }
    window.addEventListener('awg-session-expired', expire)
    window.addEventListener('storage', storage)
    return () => { window.removeEventListener('awg-session-expired', expire); window.removeEventListener('storage', storage) }
  }, [])

  useEffect(() => {
    let active = true
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) { setReady(true); return }
    api.auth.me(stored).then(next => {
      if (!active || localStorage.getItem(TOKEN_KEY) !== stored) return
      setToken(stored); setUser(next); setOffline(false)
    }).catch(error => {
      if (!active) return
      if ((error as { status?: number }).status === 401) {
        localStorage.removeItem(TOKEN_KEY); setUser(null); setToken(null); setOffline(false); setExpired(true)
      } else { setOffline(true) }
    }).finally(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [attempt])

  useEffect(() => {
    if (!offline) return
    const timer = window.setInterval(retrySession, 15_000)
    window.addEventListener('online', retrySession)
    return () => { window.clearInterval(timer); window.removeEventListener('online', retrySession) }
  }, [offline, retrySession])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login(email, password)
    localStorage.setItem(TOKEN_KEY, result.token)
    setToken(result.token); setUser(result.user); setOffline(false); setExpired(false); setReady(true)
  }, [])

  const logout = useCallback(async () => {
    // Start while the token is readable; never wait for market Wi-Fi to secure the iPad.
    void api.auth.logout().catch(() => {})
    clearFormTokens()
    localStorage.removeItem(TOKEN_KEY)
    try { sessionStorage.removeItem('awg-sale-draft'); sessionStorage.removeItem('awg-staff-hub') } catch { /* storage unavailable */ }
    setToken(null); setUser(null); setOffline(false); setExpired(false); setReady(true)
  }, [])

  const value = useMemo(() => ({ user, token, ready, offline, expired, retrySession, login, logout }), [user, token, ready, offline, expired, retrySession, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
