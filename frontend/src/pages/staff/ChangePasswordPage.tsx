import { useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import styles from './LoginPage.module.css'

export function ChangePasswordPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess(false)
    if (next.length < 10) { setError('Use at least 10 characters.'); return }
    if (next !== confirm) { setError('New passwords do not match.'); return }
    setBusy(true)
    try {
      await api.auth.changePassword(current, next)
      setCurrent(''); setNext(''); setConfirm(''); setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.')
    } finally { setBusy(false) }
  }

  return <section className={styles.card}>
    <h1>Change password</h1>
    <form onSubmit={submit}>
      {error && <p className={styles.err} role="alert">{error}</p>}
      {success && <p role="status">Password changed</p>}
      <Field label="Current password" htmlFor="current-password"><input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></Field>
      <Field label="New password" htmlFor="new-password"><input id="new-password" type="password" autoComplete="new-password" required value={next} onChange={e => setNext(e.target.value)} /></Field>
      <Field label="Confirm new password" htmlFor="confirm-password"><input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></Field>
      <Button type="submit" tone="staff" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</Button>
    </form>
  </section>
}
