import { OrderTimeline } from '../../components/public/OrderTimeline'
import { PublicPage, PageHeader } from '../../components/public/PublicForm'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { OrnamentPreview } from '../../components/public/OrnamentPreview'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import type { TrackView } from '../../domain/types'
import { useLocale } from '../../i18n/LocaleContext'
import { clearBuyDraft } from '../../lib/buyDraft'
import { DELIVERY_WINDOW_END_HOUR, DELIVERY_WINDOW_START_HOUR, deliveryDatePhrase, icsHour } from '../../lib/deliveryWindow'
import styles from './Panel.module.css'
import buyStyles from './BuyPage.module.css'

/** RFC 5545 TEXT escaping: no value can break out into another calendar property. */
const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n|\r/g, '\\n')

/** Decimal hour → "HH:mm". */
const clock = (hour: number) => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`

export function BuyThanksPage() {
  const { t, locale } = useLocale()
  const [params] = useSearchParams()
  const code = (params.get('code') ?? '').trim()
  const [copyMessage, setCopyMessage] = useState('')
  const [view, setView] = useState<TrackView | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [seqValue, setSeqValue] = useState<number | null>(null)

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

  function downloadCalendar(when: TrackView['when']) {
    const date = when.date!
    const day = date.replaceAll('-', '')
    const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
    const end = next.toISOString().slice(0, 10).replaceAll('-', '')
    const pickupAt = when.kind === 'market' && when.fromHour != null ? when.fromHour : null
    // A market pickup is a 30-minute appointment in Vienna time; a delivery is 18:00–20:00 in Vienna time.
    const span = pickupAt != null
      ? [`DTSTART;TZID=Europe/Vienna:${day}T${clock(pickupAt).replace(':', '')}00`, `DTEND;TZID=Europe/Vienna:${day}T${clock(pickupAt + 0.5).replace(':', '')}00`]
      : when.kind === 'vienna'
        ? [`DTSTART;TZID=Europe/Vienna:${day}T${icsHour(DELIVERY_WINDOW_START_HOUR)}`, `DTEND;TZID=Europe/Vienna:${day}T${icsHour(DELIVERY_WINDOW_END_HOUR)}`]
        : [`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${end}`]
    const summary = when.kind === 'market' ? t('calendarPickupSummary', { market: when.marketName ?? '' }) : t('calendarSummary')
    const description = when.kind === 'market' ? t('calendarPickupDescription') : t('calendarDescription')
    const calendar = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ArtWithGab//Delivery//EN', 'BEGIN:VEVENT', `UID:${code.replace(/[^A-Za-z0-9-]/g, '')}@artwithgab.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, ...span, `SUMMARY:${icsText(summary)}`, `DESCRIPTION:${icsText(description)}`, ...(when.kind === 'market' && when.marketName ? [`LOCATION:${icsText(when.marketName)}`] : []), 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n')
    const url = URL.createObjectURL(new Blob([calendar], { type: 'text/calendar;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'artwithgab-delivery.ics'; link.click(); URL.revokeObjectURL(url)
  }

  if (!code) return <PublicPage variant="status"><h1>{t('shopThanksTitle')}</h1><p>{t('shopThanksNoCode')}</p><ButtonLink to="/track" fullWidth>{t('track')}</ButtonLink></PublicPage>
  const longDate = (date: string) => new Intl.DateTimeFormat(locale === 'de' ? 'de-AT' : 'en-GB', { dateStyle: 'long' }).format(new Date(`${date}T12:00:00`))
  const when = view?.when
  const handoffLabel = when?.kind === 'market'
    ? <>{t('pickupTimeline')}{when.date && <> · {[when.marketName, longDate(when.date), when.fromHour != null && t('timeOClock', { time: clock(when.fromHour) })].filter(Boolean).join(' · ')}</>}</>
    : <>{t('deliveryTimeline')}{when?.date && <> · {deliveryDatePhrase(when.date, locale)}</>}</>
  // Owner: the title alone, no explanation under it.
  const seqEnds = [t('seqHardest'), t('seqEasiest')]
  return <PublicPage variant="status">
    {!view ? <><h1>{t('confirmingPayment')}</h1><p role="status">{timedOut ? t('confirmationFallback') : t('confirmingPayment')}</p></> : <>
      <PageHeader title={t('shopThanksTitle')} />
      {view.items.length > 0 && <div className={buyStyles.thanksPreviews}>{view.items.map((entry, index) => (
        <OrnamentPreview key={index} item={{ color: entry.color ?? '', finish: entry.finish ?? '', withName: entry.withName, backName: entry.backName }} static />
      ))}</div>}
      <OrderTimeline labels={[t('paidTimeline'), t('paintingTimeline'), handoffLabel]} />
      {view.when.kind !== 'unknown' && view.when.date && <Button variant="secondary" onClick={() => downloadCalendar(view.when)}>{t(view.when.kind === 'market' ? 'addPickupCalendar' : 'addCalendar')}</Button>}
      <fieldset className={buyStyles.seq}><legend>{t('seqQuestion')}</legend>
        <div className={buyStyles.seqScale}>
          <span className={buyStyles.seqEnd}>{seqEnds[0]}</span>
          {[1, 2, 3, 4, 5].map(value => (
            <label key={value} className={buyStyles.seqOption} data-selected={seqValue === value}>
              <input className={buyStyles.choiceInput} type="radio" name="buy-seq" value={value} checked={seqValue === value} disabled={seqValue != null && seqValue !== value} onChange={() => { if (seqValue != null) return; setSeqValue(value); void api.metrics.track({ event: 'buy_seq', value: String(value) }).catch(() => {}) }} />
              <span>{value}</span>
            </label>
          ))}
          <span className={buyStyles.seqEnd}>{seqEnds[1]}</span>
        </div>
        {seqValue != null && <p role="status" className={buyStyles.seqThanks}>{t('seqThanks')}</p>}
      </fieldset>
    </>}
    <div className={styles.codeBlock}><span>{t('trackCode')}</span><strong>{code}</strong><Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(code).then(() => setCopyMessage(t('copiedCode'))).catch(() => setCopyMessage(t('copyFailed'))) }}>{t('copyCode')}</Button><span role="status">{copyMessage}</span></div>
    <ButtonLink to={`/track/${encodeURIComponent(code)}`} fullWidth>{t('goTrack')}</ButtonLink>
  </PublicPage>
}
