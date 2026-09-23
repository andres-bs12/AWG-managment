import { formatDateLabel, formatHour } from '../../lib/time'
import { ProgressSteps } from '../../components/ui/ProgressSteps'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { OrnamentLoader } from '../../components/public/OrnamentLoader'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { Field } from '../../components/ui/Field'
import type { CustomerFormView, Photo } from '../../domain/types'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './Panel.module.css'

type Step = 'photos' | 'names' | 'contact' | 'extras' | 'review' | 'done'

type Draft = {
  photos: Photo[]
  customerName: string
  petName: string
  phone: string
  email: string
  backName: string
  note: string
}

const empty: Draft = {
  photos: [],
  customerName: '',
  petName: '',
  phone: '',
  email: '',
  backName: '',
  note: '',
}

function draftKey(token: string) {
  return `awg-form-draft:${token}`
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function ReviewRow({ label, onEdit, children }: { label: string; onEdit?: () => void; children: ReactNode }) {
  const { t } = useLocale()
  return (
    <div className={styles.row}>
      <div className={styles.rowBody}>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
      {onEdit ? (
        <button type="button" className={styles.editLink} onClick={onEdit} aria-label={`${t('edit')}: ${label}`}>
          {t('edit')}
        </button>
      ) : null}
    </div>
  )
}

export function FormPage() {
  const { token = '' } = useParams()
  const { t, locale } = useLocale()
  const [view, setView] = useState<CustomerFormView | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadedToken, setLoadedToken] = useState('')
  const [step, setStep] = useState<Step>('photos')
  const [draft, setDraft] = useState<Draft>(empty)
  const [fieldError, setFieldError] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [orderCode, setOrderCode] = useState('')
  const [copyMessage, setCopyMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setView(null)
    setStep('photos')
    api.forms
      .getForm(token)
      .then((data) => {
        if (cancelled) return
        setView(data)
        setLoadedToken(token)
        const saved = sessionStorage.getItem(draftKey(token))
        if (saved) {
          setDraft(JSON.parse(saved) as Draft)
        } else {
          setDraft({
            ...empty,
            customerName: data.customer.name,
            phone: data.customer.phone,
            email: data.customer.email,
            petName: data.item.petName,
            backName: data.item.backName,
            note: data.item.note,
            photos: data.item.photos,
          })
        }
        if (data.alreadySubmitted) setStep('done')
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token || loadedToken !== token || loading || step === 'done') return
    sessionStorage.setItem(draftKey(token), JSON.stringify(draft))
  }, [draft, token, loadedToken, loading, step])

  const steps = useMemo<Step[]>(() => ['photos', 'names', 'contact', 'extras', 'review'], [])
  const stepIndex = Math.max(0, steps.indexOf(step))
  const total = steps.length
  const intlLocale = locale === 'de' ? 'de-AT' : 'en-GB'
  const money = (value: number) => new Intl.NumberFormat(locale === 'de' ? 'de-AT' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(value)
  const orderItems = view ? (view.items ?? [view.item]).map((item) => (item.id === view.item.id ? { ...item, petName: draft.petName } : item)) : []
  const handoffLines = [...new Set((view?.handoffs ?? []).map((handoff) =>
    handoff.kind === 'vienna'
      ? t('whenVienna')
      : handoff.kind === 'unknown'
        ? t('whenTbd')
        : [handoff.marketName, handoff.date ? formatDateLabel(handoff.date, intlLocale) : '', handoff.fromHour != null ? t('whenFrom', { time: formatHour(handoff.fromHour) }) : ''].filter(Boolean).join(' · '),
  ))]

  function patch(partial: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...partial }))
    setFieldError({})
  }

  async function addFiles(files: FileList | null) {
    if (!files) return
    const next: Photo[] = []
    for (const file of Array.from(files).slice(0, 4 - draft.photos.length)) {
      next.push(await api.uploads.toPhoto(file))
    }
    patch({ photos: [...draft.photos, ...next] })
  }

  function validate(current: Step): boolean {
    const errs: Record<string, string> = {}
    if (current === 'photos' && draft.photos.length < 1) errs.photos = t('needPhoto')
    if (current === 'names') {
      if (!draft.customerName.trim()) errs.customerName = t('required')
      if (!draft.petName.trim()) errs.petName = t('required')
    }
    if (current === 'contact') {
      if (!draft.phone.trim()) errs.phone = t('required')
      if (!draft.email.trim()) errs.email = t('required')
      else if (!isEmail(draft.email.trim())) errs.email = t('invalidEmail')
    }
    if (current === 'extras' && view?.withName && !draft.backName.trim()) errs.backName = t('required')
    setFieldError(errs)
    return Object.keys(errs).length === 0
  }

  function goNext() {
    if (!validate(step)) return
    const i = steps.indexOf(step)
    setStep(steps[Math.min(i + 1, steps.length - 1)])
  }

  function goBack() {
    const i = steps.indexOf(step)
    if (i <= 0) return
    setStep(steps[i - 1])
  }

  async function send() {
    if (!validate('photos') || !validate('names') || !validate('contact') || !validate('extras')) {
      setStep('photos')
      return
    }
    setSending(true)
    try {
      const result = await api.forms.submitForm(token, {
        customerName: draft.customerName,
        petName: draft.petName,
        phone: draft.phone,
        email: draft.email,
        backName: draft.backName,
        note: draft.note,
        photos: draft.photos,
      })
      sessionStorage.removeItem(draftKey(token))
      setOrderCode(result.orderCode)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.panel}>
        <OrnamentLoader />
      </div>
    )
  }

  if (error && !view) {
    return (
      <div className={styles.panel}>
        <h1>{t('brand')}</h1>
        <p role="alert">{error}</p>
        <ButtonLink to="/">{t('backHome')}</ButtonLink>
      </div>
    )
  }

  if (step === 'done') {
    const code = orderCode || view?.orderCode || ''
    return (
      <div className={styles.panel}>
        <h1>{t('formThanks')}</h1>
        <p className={styles.lead}>{t('saveCode')}</p>
        <div className={styles.codeBlock}>
          <span>{t('trackCode')}</span><strong>{code}</strong>
          <Button variant="secondary" onClick={() => { void navigator.clipboard.writeText(code).then(() => setCopyMessage(t('copiedCode'))).catch(() => setCopyMessage(t('copyFailed'))) }}>{t('copyCode')}</Button>
          <span role="status">{copyMessage}</span>
        </div>
        <ButtonLink to={`/track/${code}`} fullWidth>
          {t('goTrack')}
        </ButtonLink>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <ProgressSteps labels={[t('formPhotos'), t('formNames'), t('formContact'), t('formExtras'), t('review')]} current={stepIndex} label={t('progress', { n: stepIndex + 1, total })} compact />
      {error ? <p role="alert">{error}</p> : null}
      {step === 'photos' ? (
        <>
          <h1>{t('formPhotos')}</h1>
          <p className={styles.lead}>{t('formPhotosLead')}</p>
          {fieldError.photos ? <p role="alert">{fieldError.photos}</p> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {draft.photos.map((p) => (
              <img
                key={p.id}
                src={p.dataUrl}
                alt={p.name}
                width={88}
                height={88}
                style={{ objectFit: 'cover', borderRadius: 12 }}
              />
            ))}
          </div>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => document.getElementById('camera')?.click()}>
              {t('takePhoto')}
            </Button>
            <Button variant="secondary" onClick={() => document.getElementById('gallery')?.click()}>
              {t('addPhoto')}
            </Button>
            <input
              id="camera"
              className="visually-hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void addFiles(e.target.files)}
            />
            <input
              id="gallery"
              className="visually-hidden"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => void addFiles(e.target.files)}
            />
          </div>
        </>
      ) : null}

      {step === 'names' ? (
        <>
          <h1>{t('formNames')}</h1>
          <Field label={t('yourName')} htmlFor="customerName" error={fieldError.customerName}>
            <input
              id="customerName"
              autoComplete="name"
              value={draft.customerName}
              onChange={(e) => patch({ customerName: e.target.value })}
            />
          </Field>
          <Field label={t('petName')} htmlFor="petName" error={fieldError.petName}>
            <input id="petName" value={draft.petName} onChange={(e) => patch({ petName: e.target.value })} />
          </Field>
        </>
      ) : null}

      {step === 'contact' ? (
        <>
          <h1>{t('formContact')}</h1>
          <Field label={t('phone')} htmlFor="phone" error={fieldError.phone}>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(e) => patch({ phone: e.target.value })}
            />
          </Field>
          <Field label={t('email')} htmlFor="email" error={fieldError.email}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(e) => patch({ email: e.target.value })}
            />
          </Field>
        </>
      ) : null}

      {step === 'extras' ? (
        <>
          <h1>{t('formExtras')}</h1>
          {view?.withName ? (
            <Field label={t('backName')} htmlFor="backName" hint={t('backNameHint')} error={fieldError.backName}>
              <input
                id="backName"
                maxLength={6}
                value={draft.backName}
                onChange={(e) => patch({ backName: e.target.value.slice(0, 6) })}
              />
            </Field>
          ) : null}
          <Field label={t('note')} htmlFor="note">
            <textarea id="note" value={draft.note} onChange={(e) => patch({ note: e.target.value })} />
          </Field>
        </>
      ) : null}

      {step === 'review' ? (
        <>
          <h1>{t('review')}</h1>
          <p className={styles.lead}>{t('reviewLead')}</p>

          <section className={styles.reviewCard} aria-labelledby="review-ornament">
            <h2 id="review-ornament">{t('reviewOrnament')}</h2>
            <dl className={styles.rows}>
              <ReviewRow label={t('formPhotos')} onEdit={() => setStep('photos')}>
                <span className={styles.photos}>{draft.photos.map(photo => <img key={photo.id} src={photo.dataUrl} alt={photo.name} />)}</span>
              </ReviewRow>
              <ReviewRow label={t('petName')} onEdit={() => setStep('names')}>{draft.petName}</ReviewRow>
              {orderItems.length === 1 ? (
                <ReviewRow label={t('colour')}>
                  <span className={styles.itemLine}>
                    <span className={styles.colorDot} data-color={orderItems[0].color ?? 'none'} aria-hidden="true" />
                    {orderItems[0].color ? t(orderItems[0].color === 'red' ? 'colorRed' : 'colorGrey') : t('colorUnknown')}
                  </span>
                </ReviewRow>
              ) : null}
              {view?.withName ? <ReviewRow label={t('backName')} onEdit={() => setStep('extras')}>{draft.backName}</ReviewRow> : null}
              {draft.note ? <ReviewRow label={t('noteLabel')} onEdit={() => setStep('extras')}>{draft.note}</ReviewRow> : null}
            </dl>
          </section>

          <section className={styles.reviewCard} aria-labelledby="review-details">
            <h2 id="review-details">{t('reviewDetails')}</h2>
            <dl className={styles.rows}>
              <ReviewRow label={t('yourName')} onEdit={() => setStep('names')}>{draft.customerName}</ReviewRow>
              <ReviewRow label={t('phone')} onEdit={() => setStep('contact')}>{draft.phone}</ReviewRow>
              <ReviewRow label={t('email')} onEdit={() => setStep('contact')}>{draft.email}</ReviewRow>
            </dl>
          </section>

          {view ? (
            <section className={styles.reviewCard} data-tone="fixed" aria-labelledby="review-order">
              <h2 id="review-order">{t('reviewOrder')}</h2>
              <dl className={styles.rows}>
                {handoffLines.length ? (
                  <ReviewRow label={t('pickupWhen')}>
                    {handoffLines.map((line) => <span key={line} className={styles.line}>{line}</span>)}
                  </ReviewRow>
                ) : null}
                {orderItems.length > 1 ? (
                  <ReviewRow label={t('reviewItems')}>
                    {orderItems.map((item) => (
                      <span key={item.id} className={styles.itemLine}>
                        <span className={styles.colorDot} data-color={item.color ?? 'none'} aria-hidden="true" />
                        <span>
                          {item.petName || t(item.kind === 'custom' ? 'customOrnament' : 'finishedOrnament')}
                          {item.color ? ` · ${t(item.color === 'red' ? 'colorRed' : 'colorGrey')}` : ''}
                        </span>
                        {item.cost != null ? <span className={styles.itemPrice}>{money(item.cost)}</span> : null}
                      </span>
                    ))}
                  </ReviewRow>
                ) : null}
                {view.total != null ? (
                  <div className={styles.totalRow}>
                    <dt>{t('orderTotal')}</dt>
                    <dd>
                      <strong>{money(view.total)}</strong>
                      {view.paymentState ? <span className={styles.payState} data-paid={view.paymentState === 'paid'}>{t(`payment_${view.paymentState}`)}</span> : null}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className={styles.fixedNote}>{t('reviewFromStall')}</p>
            </section>
          ) : null}
        </>
      ) : null}

      <div className={styles.actions} style={{ marginTop: 24 }}>
        {step !== 'review' ? (
          <Button fullWidth size="lg" onClick={goNext}>
            {t('continue')}
          </Button>
        ) : (
          <Button fullWidth size="lg" disabled={sending} onClick={() => void send()}>
            {t('send')}
          </Button>
        )}
        {stepIndex > 0 ? (
          <Button variant="ghost" fullWidth onClick={goBack}>
            {t('back')}
          </Button>
        ) : (
          <Link to="/">{t('backHome')}</Link>
        )}
      </div>
    </div>
  )
}
