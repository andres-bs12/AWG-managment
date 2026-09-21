import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getDataSource } from '../../api/client'
import { resetStore } from '../../api/mock/store'
import { useAuth } from '../../auth/AuthContext'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/staff/agenda'
  const [email, setEmail] = useState('gaby@artwithgab.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/staff/agenda" replace />

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
    <div className={styles.page}>
    <div className={styles.card}>
      <h1>Staff sign in</h1>
      <p className={styles.hint}>Two accounts: Gaby and Andres. Same permissions.</p>
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" tone="staff" fullWidth size="lg" disabled={busy}>
          Enter
        </Button>
      </form>
      <p className={styles.accounts}>
        gaby@artwithgab.com / gaby
        <br />
        andres@artwithgab.com / andres
      </p>
      {getDataSource() === 'mock' ? (
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
    </div>
  )
}
