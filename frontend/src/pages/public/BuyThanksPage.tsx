import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { useLocale } from '../../i18n/LocaleContext'
import { clearBuyDraft } from '../../lib/buyDraft'
import styles from './Panel.module.css'

export function BuyThanksPage() {
  const { t } = useLocale()
  const [params] = useSearchParams()
  const code = (params.get('code') ?? '').trim()
  const [copyMessage, setCopyMessage] = useState('')

  useEffect(() => {
    if (code) clearBuyDraft()
  }, [code])

  if (!code) {
    return (
      <div className={styles.panel}>
        <h1>{t('shopThanksTitle')}</h1>
        <p className={styles.lead}>{t('shopThanksNoCode')}</p>
        <ButtonLink to="/track" fullWidth>{t('track')}</ButtonLink>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <h1>{t('shopThanksTitle')}</h1>
      <p className={styles.lead} role="status">{t('shopThanksLead')}</p>
      <p className={styles.lead}>{t('shopThanksPlan')}</p>
      <div className={styles.codeBlock}>
        <span>{t('trackCode')}</span>
        <strong>{code}</strong>
        <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(code).then(() => setCopyMessage(t('copiedCode'))).catch(() => setCopyMessage(t('copyFailed'))) }}>{t('copyCode')}</Button>
        <span role="status">{copyMessage}</span>
      </div>
      <ButtonLink to={`/track/${encodeURIComponent(code)}`} fullWidth>{t('goTrack')}</ButtonLink>
    </div>
  )
}
