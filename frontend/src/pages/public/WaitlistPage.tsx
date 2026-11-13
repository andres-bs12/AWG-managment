import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../../api/client'
import { useLocale } from '../../i18n/LocaleContext'
import panel from './Panel.module.css'

export function WaitlistPage() {
  const { t } = useLocale()
  const { pathname } = useLocation()
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading')
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const token = window.location.hash.slice(1)
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    const action = pathname.endsWith('/confirm') ? api.shop.confirmWaitlist : api.shop.unsubscribeWaitlist
    void (token ? action(token) : Promise.reject(new Error('Missing token'))).then(() => setState('success')).catch(() => setState('error'))
  }, [pathname])
  return <main className={panel.panel}><h1>{t('waitlistPageTitle')}</h1><p role="status">{state === 'loading' ? t('saving') : state === 'error' ? t('waitlistLinkError') : t(pathname.endsWith('/confirm') ? 'waitlistConfirmed' : 'waitlistUnsubscribed')}</p></main>
}
