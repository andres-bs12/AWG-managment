import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'
import type { StaffUser } from '../domain/types'

const TOKEN_KEY = 'awg-staff-token'

type AuthState = {
  user: StaffUser | null
  token: string | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) {
      setReady(true)
      return
    }
    api.auth
      .me(stored)
      .then((u) => {
        setToken(stored)
        setUser(u)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
      })
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login(email, password)
    localStorage.setItem(TOKEN_KEY, result.token)
    setToken(result.token)
    setUser(result.user)
  }, [])

  const logout = useCallback(async () => {
    // Start the server call while the token is still readable, then clear local state first so a
    // network error never leaves a shared stall device signed in (or with a sale draft behind).
    const request = api.auth.logout().catch(() => {})
    localStorage.removeItem(TOKEN_KEY)
    try { sessionStorage.removeItem('awg-sale-draft') } catch { /* storage unavailable */ }
    setToken(null)
    setUser(null)
    await request
  }, [])

  const value = useMemo(
    () => ({ user, token, ready, login, logout }),
    [user, token, ready, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
