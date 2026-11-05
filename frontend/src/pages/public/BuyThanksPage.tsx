import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { OrnamentPreview } from '../../components/public/OrnamentPreview'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import type { TrackView } from '../../domain/types'
import { useLocale } from '../../i18n/LocaleContext'
import { clearBuyDraft } from '../../lib/buyDraft'
import styles from './Panel.module.css'
import buyStyles from './BuyPage.module.css'

export function BuyThanksPage() {
  const { t, locale } = useLocale()
  const [params] = useSearchParams()
  const code = (params.get('code') ?? '').trim()
  const [copyMessage, setCopyMessage] = useState('')
  const [view, setView] = useState<TrackView | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [answered, setAnswered] = useState(false)

  useEffect(() => {
    if (!code) return
    let active = true
    let timer = 0
    const deadline = Date.now() + 60000
    // A stalled Track request must not keep the customer waiting indefinitely.
    const timeout = window.setTimeout(() => { if (active) setTimedOut(true) }, 60000)
    async function poll() {
      try {
        const result = await api.tracking.getByCode(code)
        if (!active) return
        if (result.paymentState === 'paid') { window.clearTimeout(timeout); setView(result); clearBuyDraft(); return }
      } catch { /* A temporary failure or webhook delay is retried until the deadline. */ }
      if (!active) return
      if (Date.now() >= deadline) setTimedOut(true)
      else timer = window.setTimeout(poll, 3000)
    }
    void poll()
    return () => { active = false; window.clearTimeout(timer); window.clearTimeout(timeout) }
  }, [code])

  function downloadCalendar(date: string) {
    const day = date.replaceAll('-', '')
    const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
    const end = next.toISOString().slice(0, 10).replaceAll('-', '')
    const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ArtWithGab//Delivery//EN', 'BEGIN:VEVENT', `UID:${code}@artwithgab.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, `DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${t('calendarSummary')}`, `DESCRIPTION:${t('calendarDescription')}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n')
    const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'artwithgab-delivery.ics'; link.click(); URL.revokeObjectURL(url)
  }

  if (!code) return <div className={styles.panel}><h1>{t('shopThanksTitle')}</h1><p>{t('shopThanksNoCode')}</p><ButtonLink to="/track" fullWidth>{t('track')}</ButtonLink></div>
  const item = view?.items[0]
  return <div className={styles.panel}>
    {!view ? <><h1>{t('confirmingPayment')}</h1><p role="status">{timedOut ? t('confirmationFallback') : t('confirmingPayment')}</p></> : <>
      <h1>{t('shopThanksTitle')}</h1><p className={styles.lead}>{t('shopThanksPlan')}</p>
      {item && <div className={buyStyles.thanksPreview}><OrnamentPreview item={{ uid: 'thanks', color: item.color ?? '', finish: item.finish ?? '', withName: item.withName, backName: item.backName, petName: item.petName, note: '', photos: [], photosNeedReload: false }} /></div>}
      <ol className={buyStyles.thanksTimeline}><li>{t('paidTimeline')} ✓</li><li>{t('paintingTimeline')}</li><li>{t('deliveryTimeline')}{view.when.date && <> · {new Intl.DateTimeFormat(locale === 'de' ? 'de-AT' : 'en-GB', { dateStyle: 'long' }).format(new Date(`${view.when.date}T12:00:00`))} · {t('evening')}</>}</li></ol>
      {view.when.kind === 'vienna' && view.when.date && <Button variant="secondary" onClick={() => downloadCalendar(view.when.date!)}>{t('addCalendar')}</Button>}
      <fieldset className={buyStyles.seq}><legend>{t('seqQuestion')}</legend>{answered ? <p role="status">{t('seqThanks')}</p> : <div>{[1, 2, 3, 4, 5, 6, 7].map(value => <button type="button" key={value} onClick={() => { setAnswered(true); void api.metrics.track({ event: 'buy_seq', value: String(value) }).catch(() => {}) }}>{value}</button>)}</div>}</fieldset>
    </>}
    <div className={styles.codeBlock}><span>{t('trackCode')}</span><strong>{code}</strong><Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(code).then(() => setCopyMessage(t('copiedCode'))).catch(() => setCopyMessage(t('copyFailed'))) }}>{t('copyCode')}</Button><span role="status">{copyMessage}</span></div>
    <ButtonLink to={`/track/${encodeURIComponent(code)}`} fullWidth>{t('goTrack')}</ButtonLink>
  </div>
}
