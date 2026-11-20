import { apiError } from '../../lib/apiError'
import { ProgressSteps } from '../../components/ui/ProgressSteps'
import { OrderReceipt } from '../../components/public/OrderReceipt'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { InstagramIcon, INSTAGRAM_URL } from '../../components/public/InstagramLink'
import { GiftBoxReady } from '../../components/public/GiftBoxReady'
import { PaintingOrnament } from '../../components/public/PaintingOrnament'
import { SleighWipe } from '../../components/public/SleighWipe'
import { TrackDialog } from '../../components/public/TrackDialog'
import { MarketMapLink } from '../../components/public/MarketMapLink'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { useLocale } from '../../i18n/LocaleContext'
import { formatDateLabel, formatHour } from '../../lib/time'
import { deliveryDatePhrase } from '../../lib/deliveryWindow'
import { formatArrivalRange, TRACKING_BASE_URL } from '../../lib/postShipping'
import type { TrackView } from '../../domain/types'
import styles from './TrackPage.module.css'

/** Wipe only runs after a code resolves — keep it readable even when the API is instant. */
const MIN_WIPE_MS = 1500
const WIPE_OUT_MS = 380

type Phase = 'idle' | 'checking' | 'loading' | 'leaving' | 'done'

export function TrackPage() {
  const { t, locale } = useLocale()
  const { code: codeParam } = useParams()
  const navigate = useNavigate()
  // Arriving from the QR form: confirm the save once, here where the order state is shown.
  const formSaved = !!(useLocation().state as { formSaved?: boolean } | null)?.formSaved
  const timers = useRef<number[]>([])
  const savedNotice = useRef<HTMLParagraphElement>(null)

  const savedFocused = useRef(false)
  const staffDevice = useSearchParams()[0].get('staff') === '1'
  // One anonymous page view per visit; the stall iPad (?staff=1) is not a visitor.
  useEffect(() => { if (!staffDevice) void api.metrics.track({ event: 'track_view' }).catch(() => {}) }, [staffDevice])
  const dialogOpener = useRef<HTMLButtonElement | null>(null)

  const [fetchPhase, setPhase] = useState<Phase>(codeParam ? 'checking' : 'idle')
  const [reloadKey, setReloadKey] = useState(0)
  const [loaded, setLoaded] = useState<TrackView | null>(null)
  const [fetchError, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(!codeParam)
  const [copyMessage, setCopyMessage] = useState('')

  useEffect(() => {
    if (!codeParam) return

    let cancelled = false
    setPhase('checking')
    setDialogOpen(false)
    setLoaded(null)
    setError('')

    api.tracking
      .getByCode(codeParam)
      .then((data) => {
        if (cancelled) return
        setLoaded(data)
        setError('')
        if (formSaved) { setPhase('done'); return }
        setPhase('loading')
        timers.current.push(
          window.setTimeout(() => {
            if (cancelled) return
            setPhase('leaving')
            timers.current.push(
              window.setTimeout(() => {
                if (!cancelled) setPhase('done')
              }, WIPE_OUT_MS),
            )
          }, MIN_WIPE_MS),
        )
      })
      .catch((err) => {
        if (cancelled) return
        setLoaded(null)
        // Name the code that was looked up, so a typo is easy to spot.
        const notFound = !(err && typeof err === 'object' && 'code' in err) || (err as { code?: string }).code === 'ORDER_NOT_FOUND'
        setError(notFound ? t('trackMissBody', { code: codeParam.toUpperCase() }) : apiError(err, locale, t('trackNotFound')).text)
        setPhase('done')
        setDialogOpen(false)
      })

    return () => {
      cancelled = true
      timers.current.forEach(window.clearTimeout)
      timers.current = []
    }
  }, [codeParam, reloadKey, t, locale, formSaved])

  /** Without a code in the URL there is nothing to show, whatever a previous lookup left behind. */
  const phase: Phase = codeParam ? fetchPhase : 'idle'
  const view = codeParam ? loaded : null
  const error = codeParam ? fetchError : ''
  // The confirmation lives inside the card, so it is focused once the card is on screen.
  useEffect(() => {
    if (!formSaved || phase !== 'done' || savedFocused.current) return
    savedFocused.current = true
    savedNotice.current?.focus()
  }, [formSaved, phase])

  const status = view?.status ?? 'preparing'
  const isPost = view?.when.kind === 'post' || view?.delivery?.kind === 'post'
  const done = status === 'shipped' || status === 'delivered'
  const statusLabel =
    status === 'cancelled' ? t('orderCancelled') : status === 'shipped' ? t('shipped') : status === 'delivered' ? t('delivered') : status === 'ready' ? t('ready') : t('preparing')
  const stepIndex = done ? 2 : status === 'ready' ? 1 : 0
  const steps = [t('stepPainting'), t('ready'), isPost ? t('stepShipping') : t('stepHandover')]
  /** Sleigh only after a hit — misses use the page recovery state without this animation. */
  const showWipe = phase === 'loading' || phase === 'leaving'

  /** Two short lines: the slot or arrival range, then how long the stall is still around. */
  const whenLines: string[] = []
  let marketWhen: ReactNode = null
  // The server builds the link; only ever follow the Post's own tracking page.
  const trackingUrl = view?.trackingUrl?.startsWith(TRACKING_BASE_URL) ? view.trackingUrl : null
  if (view) {
    const when = view.when
    if (isPost) {
      whenLines.push(t('methodPost'))
      const arrivalFrom = when.arrivalFrom ?? view.delivery?.arrivalFrom ?? view.items[0]?.arrivalFrom
      const arrivalTo = when.arrivalTo ?? view.delivery?.arrivalTo ?? view.items[0]?.arrivalTo
      if (arrivalFrom && arrivalTo) {
        whenLines.push(t('estimatedArrivalPhrase', { range: formatArrivalRange(arrivalFrom, arrivalTo, locale) }))
      }
    } else if (when.kind === 'vienna') {
      // What on the first line, when on the second.
      whenLines.push(t('whenVienna'))
      if (when.date) whenLines.push(deliveryDatePhrase(when.date, locale))
    } else if (when.kind === 'market') {
      const head = [
        when.date ? formatDateLabel(when.date, locale === 'de' ? 'de-AT' : 'en-GB') : null,
        when.fromHour != null ? t('whenFrom', { time: formatHour(when.fromHour) }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
      if (head) whenLines.push(head)
      if (when.marketName && when.untilHour != null) {
        // The market in the sentence is the Google Maps link.
        const [before, after] = t('whenAtUntil', { market: '\u0001', time: formatHour(when.untilHour) }).split('\u0001')
        marketWhen = <>{before}<MarketMapLink name={when.marketName} inline />{after}</>
      }
    }
    if (whenLines.length === 0 && !marketWhen) whenLines.push(t('whenTbd'))
  }

  // Track has no fee field: for Post orders the difference between total and ornaments is the shipping line.
  const itemsSum = view ? view.items.reduce((sum, item) => sum + (item.cost ?? 0), 0) : 0
  const shippingFee = view && isPost && view.total != null && view.items.every(item => item.cost != null) && view.total - itemsSum > 0.005
    ? Math.round((view.total! - itemsSum) * 100) / 100 : undefined

  // The form was saved even if loading the order fails: both cards confirm it, at the card's content width.
  const savedBanner = formSaved ? <p ref={savedNotice} tabIndex={-1} className={styles.savedBanner} role="status">{t('formSavedBanner')}</p> : null

  return (
    <div className={styles.page}>
      {showWipe ? <SleighWipe label={t('sleigh')} leaving={phase === 'leaving'} /> : null}

      {view && phase === 'done' ? (
        <section className={styles.card} aria-live="polite">
          {savedBanner}
          <div className={styles.art}>
            {status === 'cancelled' ? null : status === 'preparing' ? (
              <PaintingOrnament label={t('artPainting')} />
            ) : (
              <GiftBoxReady label={t('artReady')} />
            )}
          </div>

          <div className={styles.details}>
            <span
              className={`${styles.chip} ${
                status === 'cancelled' ? '' : status === 'preparing' ? styles.chipWork : done ? styles.chipDone : styles.chipReady
              }`}
            >
              {statusLabel}
            </span>
            <h1 className={styles.title}>{view.customerName && view.customerName !== 'Walk-in' ? t('trackGreeting', { name: view.customerName }) : (locale === 'de' ? 'Deine Bestellung' : 'Your order')}</h1>

            {status === 'cancelled' ? <p>{t('orderCancelledBody')}</p> : <ProgressSteps labels={steps} current={stepIndex} label={t('shopProgress')} />}

            <dl className={styles.facts}>
              <div>
                <dt>{t('trackCode')}</dt>
                <dd className={styles.codeRow}><span className={styles.code}>{view.code}</span>
                  <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(view.code).then(() => setCopyMessage('copiedCode')).catch(() => setCopyMessage('copyFailed')) }}>{t('copyCode')}</Button>
                  <span role="status" className={styles.copyStatus}>{copyMessage && t(copyMessage)}</span></dd>
              </div>
              {status !== 'cancelled' && <div>
                <dt>{t('pickupWhen')}</dt>
                <dd>
                  {whenLines[0]}
                  {marketWhen ? <span className={styles.whenExtra}>{marketWhen}</span> : null}
                  {whenLines[1] ? <span className={styles.whenExtra}>{whenLines[1].split(/(\d+\.?–\d+\.?)/).map((part, i) => i % 2 === 1 ? <span key={i} className={styles.noBreak}>{part}</span> : part)}</span> : null}
                  {trackingUrl ? (
                    <a className={styles.trackingLink} href={trackingUrl} target="_blank" rel="noopener noreferrer">
                      {t('trackParcel')}
                    </a>
                  ) : null}
                </dd>
              </div>}
            </dl>

            <OrderReceipt items={view.items} total={view.total} paymentState={view.paymentState} shipping={shippingFee} />

            <a className={styles.instagram} href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              <InstagramIcon className={styles.instagramIcon} />
              <span>{t('trackInstagram')}</span>
            </a>

            <div className={styles.actions}>
              <ButtonLink to="/" variant="secondary">
                {t('backHome')}
              </ButtonLink>
              <button type="button" className={styles.another} onClick={event => { dialogOpener.current = event.currentTarget; setDialogOpen(true) }}>
                {t('trackAnother')}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {!view && (!!codeParam || !dialogOpen) && phase !== 'checking' && phase !== 'loading' && phase !== 'leaving' ? (
        <section className={`${styles.card} ${error ? styles.emptyCard : ''}`}>
          {savedBanner}
          {!error && <div className={styles.artSmall} aria-hidden="true">
            <PaintingOrnament label={t('artPainting')} />
          </div>}
          <div className={styles.details}>
            <h1 className={styles.title}>{error ? t('trackMissTitle') : t('trackTitle')}</h1>
            <p className={styles.sub}>{error || t('trackLead')}</p>
            <Button size="lg" fullWidth className={styles.openBtn} onClick={event => { dialogOpener.current = event.currentTarget; setDialogOpen(true) }}>
              {t(error ? 'trackAnother' : 'trackOpen')}
            </Button>
            <div className={styles.actions}>
              <ButtonLink to="/" variant="secondary">
                {t('backHome')}
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : null}

      {dialogOpen ? (
        <TrackDialog
          openerRef={dialogOpener}
          onClose={() => setDialogOpen(false)}
          initialCode={codeParam ?? ''}
          onSubmit={(next) => {
            setDialogOpen(false)
            setError('')
            if (next === codeParam) {
              setReloadKey((key) => key + 1)
            } else {
              navigate(`/track/${encodeURIComponent(next)}`)
            }
          }}
        />
      ) : null}
    </div>
  )
}
