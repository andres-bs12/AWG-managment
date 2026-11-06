import { apiError } from '../../lib/apiError'
import { ProgressSteps } from '../../components/ui/ProgressSteps'
import { OrderReceipt } from '../../components/public/OrderReceipt'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { readFormToken } from '../../api/formTokens'
import { GiftBoxReady } from '../../components/public/GiftBoxReady'
import { PaintingOrnament } from '../../components/public/PaintingOrnament'
import { SleighWipe } from '../../components/public/SleighWipe'
import { TrackDialog } from '../../components/public/TrackDialog'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { Field } from '../../components/ui/Field'
import { useLocale } from '../../i18n/LocaleContext'
import { formatDateLabel, formatHour } from '../../lib/time'
import type { Address, TrackView } from '../../domain/types'
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

  const [fetchPhase, setPhase] = useState<Phase>(codeParam ? 'checking' : 'idle')
  const [reloadKey, setReloadKey] = useState(0)
  const [loaded, setLoaded] = useState<TrackView | null>(null)
  const [fetchError, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(!codeParam)
  const [addr, setAddr] = useState<Address>({ line1: '', city: 'Vienna', postalCode: '' })
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [addressField, setAddressField] = useState('')

  useEffect(() => {
    if (!codeParam) return

    let cancelled = false
    setPhase('checking')
    setLoaded(null)
    setError('')
    setEditing(false)
    setSaved(false)

    api.tracking
      .getByCode(codeParam)
      .then((data) => {
        if (cancelled) return
        setLoaded(data)
        setError('')
        if (data.delivery.address) setAddr(data.delivery.address)
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
        setError(apiError(err, locale, t('trackNotFound')).text)
        setPhase('done')
        setDialogOpen(true)
      })

    return () => {
      cancelled = true
      timers.current.forEach(window.clearTimeout)
      timers.current = []
    }
  }, [codeParam, reloadKey, t, locale])

  /** Without a code in the URL there is nothing to show, whatever a previous lookup left behind. */
  const phase: Phase = codeParam ? fetchPhase : 'idle'
  const view = codeParam ? loaded : null
  const error = codeParam ? fetchError : ''

  async function saveAddress() {
    if (!view || savingAddress) return
    setSavingAddress(true)
    setAddressError('')
    setAddressField('')
    try {
      const next = await api.tracking.updateViennaAddress(view.code, addr)
      setLoaded(next)
      setEditing(false)
      setSaved(true)
    } catch (err) {
      const problem = apiError(err, locale, t('addressSaveError'))
      const field = problem.field?.replace(/^address\./, '') ?? ''
      setAddressField(['line1', 'line2', 'postalCode', 'city'].includes(field) ? field : '')
      setAddressError(problem.text)
    } finally {
      setSavingAddress(false)
    }
  }

  const hasFormToken = !!view && !!readFormToken(view.code)
  const status = view?.status ?? 'preparing'
  const statusLabel =
    status === 'cancelled' ? (locale === 'de' ? 'Storniert' : 'Cancelled') : status === 'delivered' ? t('delivered') : status === 'ready' ? t('ready') : t('preparing')
  const stepIndex = status === 'delivered' ? 2 : status === 'ready' ? 1 : 0
  const steps = [t('stepPainting'), t('ready'), t('stepHandover')]
  /** Sleigh only after a hit — misses stay in the dialog without this animation. */
  const showWipe = phase === 'loading' || phase === 'leaving'

  /** Two short lines: the slot the customer picked, then how long the stall is still around. */
  const whenLines: string[] = []
  if (view) {
    const when = view.when
    if (when.kind === 'vienna') {
      whenLines.push([t('whenVienna'), when.date ? formatDateLabel(when.date, locale === 'de' ? 'de-AT' : 'en-GB') : ''].filter(Boolean).join(' · '))
    } else if (when.kind === 'market') {
      const head = [
        when.date ? formatDateLabel(when.date, locale === 'de' ? 'de-AT' : 'en-GB') : null,
        when.fromHour != null ? t('whenFrom', { time: formatHour(when.fromHour) }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
      if (head) whenLines.push(head)
      if (when.marketName && when.untilHour != null) {
        whenLines.push(t('whenAtUntil', { market: when.marketName, time: formatHour(when.untilHour) }))
      }
    }
    if (whenLines.length === 0) whenLines.push(t('whenTbd'))
  }

  return (
    <div className={styles.page}>
      {showWipe ? <SleighWipe label={t('sleigh')} leaving={phase === 'leaving'} /> : null}
      {/* The form was saved even if loading the order below fails: confirm it regardless. */}
      {formSaved && <p className={styles.savedBanner} role="status">{t('formSavedBanner')}</p>}

      {view && phase === 'done' ? (
        <section className={styles.card} aria-live="polite">
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
                status === 'cancelled' ? '' : status === 'preparing' ? styles.chipWork : status === 'delivered' ? styles.chipDone : styles.chipReady
              }`}
            >
              {statusLabel}
            </span>
            <h1 className={styles.title}>{view.customerName && view.customerName !== 'Walk-in' ? t('trackGreeting', { name: view.customerName }) : (locale === 'de' ? 'Deine Bestellung' : 'Your order')}</h1>

            {status === 'cancelled' ? <p>{locale === 'de' ? 'Diese Bestellung wurde storniert.' : 'This order has been cancelled.'}</p> : <ProgressSteps labels={steps} current={stepIndex} label={statusLabel} />}

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
                  {whenLines[1] ? <span className={styles.whenExtra}>{whenLines[1]}</span> : null}
                </dd>
              </div>}
            </dl>

            <OrderReceipt items={view.items} total={view.total} paymentState={view.paymentState} />

            {status !== 'cancelled' && view.delivery.kind === 'vienna' ? (
              <div className={styles.address}>
                {!editing ? (
                  <>
                    {saved ? <p className={styles.saved}>{t('addressSaved')}</p> : null}
                    {hasFormToken ? <Button variant="secondary" fullWidth onClick={() => setEditing(true)}>
                      {t('editAddress')}
                    </Button> : <p>{locale === 'de' ? 'Öffne deinen persönlichen Formularlink, um die Lieferadresse zu ändern.' : 'Open your personal form link to change the delivery address.'}</p>}
                  </>
                ) : (
                  <div>
                    <Field label={t('street')} htmlFor="line1" error={addressField === 'line1' ? addressError : undefined}>
                      <input
                        id="line1"
                        value={addr.line1}
                        onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
                      />
                    </Field>
                    <Field label={t('extra')} htmlFor="line2" error={addressField === 'line2' ? addressError : undefined}>
                      <input
                        id="line2"
                        value={addr.line2 ?? ''}
                        onChange={(e) => setAddr({ ...addr, line2: e.target.value })}
                      />
                    </Field>
                    <Field label={t('postal')} htmlFor="postal" error={addressField === 'postalCode' ? addressError : undefined}>
                      <input
                        id="postal"
                        value={addr.postalCode}
                        onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })}
                      />
                    </Field>
                    <Field label={t('city')} htmlFor="city" error={addressField === 'city' ? addressError : undefined}>
                      <input id="city" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
                    </Field>
                    {addressError && !addressField ? <p role="alert" className={styles.addressError}>{addressError}</p> : null}
                    <Button fullWidth disabled={savingAddress} onClick={() => void saveAddress()}>
                      {savingAddress ? t('saving') : t('saveAddress')}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            <div className={styles.actions}>
              <ButtonLink to="/" variant="secondary" className={styles.homeBtn}>
                {t('backHome')}
              </ButtonLink>
              <button type="button" className={styles.another} onClick={() => setDialogOpen(true)}>
                {t('trackAnother')}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {!view && phase !== 'checking' && phase !== 'loading' && phase !== 'leaving' ? (
        <section className={styles.card}>
          <div className={styles.artSmall} aria-hidden="true">
            <PaintingOrnament label={t('artPainting')} />
          </div>
          <div className={styles.details}>
            <h1 className={styles.title}>{error ? t('trackMissTitle') : t('trackTitle')}</h1>
            <p className={styles.sub}>{error || t('trackLead')}</p>
            <Button size="lg" fullWidth className={styles.openBtn} onClick={() => setDialogOpen(true)}>
              {t('trackOpen')}
            </Button>
            <div className={styles.actions}>
              <ButtonLink to="/" variant="secondary" className={styles.homeBtn}>
                {t('backHome')}
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : null}

      {dialogOpen ? (
        <TrackDialog
          onClose={() => setDialogOpen(false)}
          initialCode={codeParam ?? ''}
          error={error}
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
