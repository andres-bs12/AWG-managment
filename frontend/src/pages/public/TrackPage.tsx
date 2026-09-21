import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
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

/** The sleigh must stay long enough to read, even when the API answers instantly. */
const MIN_WIPE_MS = 1500
const WIPE_OUT_MS = 380

type Phase = 'idle' | 'loading' | 'leaving' | 'done'

export function TrackPage() {
  const { t, locale } = useLocale()
  const { code: codeParam } = useParams()
  const navigate = useNavigate()
  const timers = useRef<number[]>([])

  const [fetchPhase, setPhase] = useState<Phase>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [loaded, setLoaded] = useState<TrackView | null>(null)
  const [fetchError, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(!codeParam)
  const [addr, setAddr] = useState<Address>({ line1: '', city: 'Vienna', postalCode: '' })
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!codeParam) return

    let cancelled = false
    const startedAt = Date.now()
    setPhase('loading')
    setError('')
    setEditing(false)
    setSaved(false)

    const finish = (apply: () => void) => {
      const wait = Math.max(0, MIN_WIPE_MS - (Date.now() - startedAt))
      timers.current.push(
        window.setTimeout(() => {
          if (cancelled) return
          apply()
          setPhase('leaving')
          timers.current.push(
            window.setTimeout(() => {
              if (!cancelled) setPhase('done')
            }, WIPE_OUT_MS),
          )
        }, wait),
      )
    }

    api.tracking
      .getByCode(codeParam)
      .then((data) => {
        if (cancelled) return
        finish(() => {
          setLoaded(data)
          setError('')
          if (data.delivery.address) setAddr(data.delivery.address)
        })
      })
      .catch((err: Error) => {
        if (cancelled) return
        finish(() => {
          setLoaded(null)
          setError(err.message || t('trackNotFound'))
          setDialogOpen(true)
        })
      })

    return () => {
      cancelled = true
      timers.current.forEach(window.clearTimeout)
      timers.current = []
    }
  }, [codeParam, reloadKey, t])

  /** Without a code in the URL there is nothing to show, whatever a previous lookup left behind. */
  const phase: Phase = codeParam ? fetchPhase : 'idle'
  const view = codeParam ? loaded : null
  const error = codeParam ? fetchError : ''

  async function saveAddress() {
    if (!view) return
    const next = await api.tracking.updateViennaAddress(view.code, addr)
    setLoaded(next)
    setEditing(false)
    setSaved(true)
  }

  const status = view?.status ?? 'preparing'
  const statusLabel = status === 'ready' ? t('ready') : status === 'delivered' ? t('delivered') : t('preparing')
  const stepIndex = status === 'delivered' ? 2 : status === 'ready' ? 1 : 0
  const steps = [t('stepPainting'), t('stepReady'), t('stepHandover')]
  const showWipe = phase === 'loading' || phase === 'leaving'

  /** Two short lines: the slot the customer picked, then how long the stall is still around. */
  const whenLines: string[] = []
  if (view) {
    const when = view.when
    if (when.kind === 'vienna') {
      whenLines.push(t('whenVienna'))
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

      {view && phase === 'done' ? (
        <section className={styles.card} aria-live="polite">
          <div className={styles.art}>
            {status === 'preparing' ? (
              <PaintingOrnament label={t('artPainting')} />
            ) : (
              <GiftBoxReady label={t('artReady')} />
            )}
          </div>

          <div className={styles.details}>
            <span className={`${styles.chip} ${status === 'preparing' ? styles.chipWork : styles.chipReady}`}>
              {statusLabel}
            </span>
            <h1 className={styles.title}>{t('trackGreeting', { name: view.customerName })}</h1>

            <ol className={styles.steps} style={{ '--progress': `${(stepIndex / (steps.length - 1)) * 100}%` } as CSSProperties}>
              {steps.map((label, i) => {
                const state = i < stepIndex ? 'past' : i === stepIndex ? 'now' : 'next'
                return (
                  <li key={label} data-state={state} aria-current={state === 'now' ? 'step' : undefined}>
                    <span className={styles.stepDot} aria-hidden="true" />
                    <span className={styles.stepLabel}>{label}</span>
                    {state === 'next' ? null : (
                      <span className="visually-hidden">{state === 'now' ? t('stepCurrent') : t('stepDone')}</span>
                    )}
                  </li>
                )
              })}
            </ol>

            <dl className={styles.facts}>
              <div>
                <dt>{t('trackCode')}</dt>
                <dd className={styles.code}>{view.code}</dd>
              </div>
              <div>
                <dt>{t('pickupWhen')}</dt>
                <dd>
                  {whenLines[0]}
                  {whenLines[1] ? <span className={styles.whenExtra}>{whenLines[1]}</span> : null}
                </dd>
              </div>
            </dl>

            <div className={styles.includes}>
              <h2 className={styles.includesTitle}>{t('orderIncludes')}</h2>
              <ul className={styles.items}>
                {view.items.map((item, i) => (
                  <li key={`${item.petName}-${item.kind}-${i}`}>
                    <span className={styles.itemDot} aria-hidden="true" />
                    <span>{item.kind === 'custom' && item.petName ? item.petName : t('itemNotPersonalised')}</span>
                  </li>
                ))}
              </ul>
            </div>

            {view.delivery.kind === 'vienna' ? (
              <div className={styles.address}>
                {!editing ? (
                  <>
                    {saved ? <p className={styles.saved}>{t('addressSaved')}</p> : null}
                    <Button variant="secondary" fullWidth onClick={() => setEditing(true)}>
                      {t('editAddress')}
                    </Button>
                  </>
                ) : (
                  <div>
                    <Field label={t('street')} htmlFor="line1">
                      <input
                        id="line1"
                        value={addr.line1}
                        onChange={(e) => setAddr({ ...addr, line1: e.target.value })}
                      />
                    </Field>
                    <Field label={t('extra')} htmlFor="line2">
                      <input
                        id="line2"
                        value={addr.line2 ?? ''}
                        onChange={(e) => setAddr({ ...addr, line2: e.target.value })}
                      />
                    </Field>
                    <Field label={t('postal')} htmlFor="postal">
                      <input
                        id="postal"
                        value={addr.postalCode}
                        onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })}
                      />
                    </Field>
                    <Field label={t('city')} htmlFor="city">
                      <input id="city" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
                    </Field>
                    <Button fullWidth onClick={() => void saveAddress()}>
                      {t('saveAddress')}
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

      {!view && phase !== 'loading' && phase !== 'leaving' ? (
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
