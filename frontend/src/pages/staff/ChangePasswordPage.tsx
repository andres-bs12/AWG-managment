import { useState, type FormEvent } from 'react'
import { api } from '../../api/client'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import styles from './LoginPage.module.css'

export function ChangePasswordPage() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [success, setSuccess] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess(false)
    // Check every field in one pass and show each problem under its own field.
    const problems: { next?: string; confirm?: string } = {}
    if (next.length < 10) problems.next = 'Use at least 10 characters.'
    else if (new TextEncoder().encode(next).length > 72) problems.next = 'Too long: use at most 72 characters (accented letters count double).'
    else if (next === current) problems.next = 'Choose a different password from the current one.'
    if (next !== confirm) problems.confirm = 'The passwords do not match.'
    setFieldErrors(problems)
    if (problems.next || problems.confirm) {
      document.getElementById(problems.next ? 'new-password' : 'confirm-password')?.focus()
      return
    }
    setBusy(true)
    try {
      await api.auth.changePassword(current, next)
      setCurrent(''); setNext(''); setConfirm(''); setSuccess(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not change password.'
      // The server sends no error code for this case; its message is the only signal.
      if (message === 'Current password is wrong.') {
        setFieldErrors({ current: message })
        document.getElementById('current-password')?.focus()
      } else setError(message)
    } finally { setBusy(false) }
  }

  return <section className={styles.card}>
    <StaffBackLink to="/staff/agenda" label="Agenda" />
    <h1>Change password</h1>
    <form onSubmit={submit}>
      {error && <p className={styles.err} role="alert">{error}</p>}
      {success && <p role="status">Password changed</p>}
      <Field label="Current password" htmlFor="current-password" error={fieldErrors.current}><input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></Field>
      <Field label="New password" htmlFor="new-password" hint="10–72 characters, different from the current one." error={fieldErrors.next}><input id="new-password" type="password" autoComplete="new-password" required value={next} onChange={e => setNext(e.target.value)} /></Field>
      <Field label="Confirm new password" htmlFor="confirm-password" error={fieldErrors.confirm}><input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></Field>
      <Button type="submit" tone="staff" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</Button>
    </form>
  </section>
}
