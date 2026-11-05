import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getDataSource } from '../../api/client'
import { resetStore, demoEmail, demoAccounts } from 'demo-source'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const { user, login, expired, offline, retrySession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const next = new URLSearchParams(location.search).get('next') ?? (location.state as { from?: string } | null)?.from
  const from = next?.startsWith('/staff/') && !next.startsWith('/staff/login') ? next : '/staff/agenda'
  const isMock = getDataSource() === 'mock'
  const [email, setEmail] = useState(demoEmail)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main data-staff-page className={styles.page}>
    <div className={styles.card}>
      <h1>Staff sign in</h1>
      {expired || new URLSearchParams(location.search).has('expired') ? <p role="status">Session expired, sign in again.</p> : null}
      {offline && <p role="status">Offline — retrying <Button tone="staff" variant="secondary" onClick={retrySession}>Retry session</Button></p>}
      {isMock ? <p className={styles.hint}>Two accounts: Gaby and Andres. Same permissions.</p> : null}
      <form onSubmit={onSubmit}>
        {error ? (
          <p className={styles.err} role="alert">
            {error}
          </p>
        ) : null}
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            enterKeyHint="go"
            // After a shared-iPad sign-out the email is already filled in; go straight to the password.
            autoFocus={Boolean(email)}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" tone="staff" fullWidth size="lg" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      {isMock ? (
        <p className={styles.accounts}>
          {demoAccounts}
        </p>
      ) : null}
      {isMock ? (
        <Button
          tone="staff"
          variant="ghost"
          fullWidth
          onClick={() => {
            resetStore()
          }}
        >
          Reset demo data
        </Button>
      ) : null}
    </div>
    </main>
  )
}
