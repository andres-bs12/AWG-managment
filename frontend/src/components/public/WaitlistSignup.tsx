import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useLocale } from '../../i18n/LocaleContext'
import { Button } from '../ui/Button'
import { Field } from '../ui/Field'
import styles from './WaitlistSignup.module.css'

type State = 'idle' | 'busy' | 'success' | 'error'

/** The existing API is a next-season waitlist, not a per-colour restock alert. */
export function WaitlistSignup({ onJoin = api.shop.joinWaitlist, initialState = 'idle' }: { onJoin?: typeof api.shop.joinWaitlist; initialState?: State }) {
  const { t, locale } = useLocale()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>(initialState)
  async function join() {
    if (state === 'busy' || !input.current?.reportValidity()) return
    setState('busy')
    try { await onJoin(email.trim(), locale); setState('success') } catch { setState('error') }
  }
  return <div className={styles.signup} aria-busy={state === 'busy'}>
    <p>{t('waitlistScope')}</p>
    {state === 'success' ? <p role="status">{t('waitlistSuccess')}</p> : <>
      <Field label={t('waitlistEmail')} htmlFor={id} error={state === 'error' ? t('waitlistError') : undefined}><input ref={input} id={id} type="email" required autoComplete="email" value={email} disabled={state === 'busy'} onChange={event => setEmail(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void join() } }} /></Field>
      <Button disabled={state === 'busy'} aria-busy={state === 'busy'} onClick={() => void join()}>{t(state === 'busy' ? 'saving' : 'waitlistSubmit')}</Button>
      <p>{t('waitlistPrivacy')} <Link to="/datenschutz">{t('privacy')}</Link>.</p>
    </>}
  </div>
}
