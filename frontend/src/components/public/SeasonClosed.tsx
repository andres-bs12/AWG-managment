import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/client'
import { useLocale } from '../../i18n/LocaleContext'
import { Button } from '../ui/Button'
import panel from '../../pages/public/Panel.module.css'
import styles from './SeasonClosed.module.css'

export function SeasonClosed() {
  const { t, locale } = useLocale(); const [email, setEmail] = useState(''); const [state, setState] = useState<'idle' | 'busy' | 'success' | 'error'>('idle')
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setState('busy'); try { await api.shop.joinWaitlist(email.trim(), locale); setState('success') } catch { setState('error') } }
  return <section className={`${panel.panel} ${styles.closed}`}><div className={styles.sky} aria-hidden="true"><svg className={styles.sleigh} viewBox="0 0 240 105"><path d="M22 77 Q50 102 110 84 L136 56 H37 Z" fill="#b82d36"/><path d="M22 91 Q65 110 127 89" fill="none" stroke="#e5b64d" strokeWidth="5" strokeLinecap="round"/><circle cx="80" cy="42" r="16" fill="#f4c8a9"/><path d="M62 42 Q65 11 89 24 L99 36 L75 34 Z" fill="#b82d36"/><circle cx="99" cy="36" r="5" fill="white"/><path d="M67 45 Q80 70 92 43 Q89 63 80 64 Q70 61 67 45" fill="white"/><path d="M49 73 Q50 46 68 48 L89 55 L100 76" fill="#b82d36"/><circle cx="161" cy="36" r="14" fill="#a8754b"/><path d="M160 23 l-7 -14 m5 9 l-11 -2 m17 7 l7 -14 m-5 9 l11 -2" stroke="#725039" strokeWidth="4" fill="none"/><path d="M147 47 Q171 38 184 55 L178 72 H145 Z" fill="#a8754b"/><path d="M150 68 l-8 14 m31 -14 l11 13 M124 68 L148 56" stroke="#725039" strokeWidth="4" fill="none"/><circle cx="174" cy="35" r="3" fill="#be3039"/></svg></div><h1>{t('seasonClosedTitle')}</h1><p>{t('seasonClosedBody')}</p>{state === 'success' ? <p role="status">{t('waitlistSuccess')}</p> : <form onSubmit={event => void submit(event)}><label htmlFor="waitlist-email">{t('waitlistEmail')}</label><div className={styles.form}><input id="waitlist-email" type="email" required autoComplete="email" value={email} disabled={state === 'busy'} onChange={event => setEmail(event.target.value)} /><Button type="submit" disabled={state === 'busy'}>{state === 'busy' ? t('saving') : t('waitlistSubmit')}</Button></div>{state === 'error' && <p role="alert">{t('waitlistError')}</p>}<p className={styles.privacy}>{t('waitlistPrivacy')} <Link to="/datenschutz">{t('privacy')}</Link>.</p></form>}</section>
}
