import { formatDateLabel, formatHour } from '../../lib/time'
import { ProgressSteps } from '../../components/ui/ProgressSteps'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { OrnamentLoader } from '../../components/public/OrnamentLoader'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { Field } from '../../components/ui/Field'
import type { CustomerFormView, OrderItem, Photo } from '../../domain/types'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './Panel.module.css'

type Step = 'photos' | 'names' | 'contact' | 'extras' | 'review' | 'done'

type ItemDraft = {
  orderItemId: string
  petName: string
  backName: string
  note: string
  photos: Photo[]
}

type Draft = {
  customerName: string
  phone: string
  email: string
  items: ItemDraft[]
}

const empty: Draft = {
  customerName: '',
  phone: '',
  email: '',
  items: [],
}

function draftKey(token: string) {
  return `awg-form-draft:${token}`
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function formTargets(view: CustomerFormView): OrderItem[] {
  const all = view.items ?? [view.item]
  const custom = all.filter((item) => item.kind === 'custom')
  return custom.length ? custom : [view.item]
}

function draftFromView(view: CustomerFormView): Draft {
  return {
    customerName: view.customer.name,
    phone: view.customer.phone,
    email: view.customer.email,
    items: formTargets(view).map((item) => ({
      orderItemId: item.id,
      petName: item.petName,
      backName: item.backName,
      note: item.note,
      photos: item.photos,
    })),
  }
}

function parseDraft(raw: string, itemIds: string[]): Draft | null {
  try {
    const parsed = JSON.parse(raw) as Partial<Draft>
    if (typeof parsed.customerName !== 'string' || !Array.isArray(parsed.items)) return null
    if (parsed.items.length !== itemIds.length) return null
    if (parsed.items.some((item, index) => item?.orderItemId !== itemIds[index])) return null
    return {
      customerName: parsed.customerName,
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      items: parsed.items.map((item) => ({
        orderItemId: item.orderItemId,
        petName: item.petName ?? '',
        backName: item.backName ?? '',
        note: item.note ?? '',
        photos: Array.isArray(item.photos) ? item.photos : [],
      })),
    }
  } catch {
    return null
  }
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
        const itemIds = formTargets(data).map((item) => item.id)
        const saved = sessionStorage.getItem(draftKey(token))
        const restored = saved ? parseDraft(saved, itemIds) : null
        setDraft(restored ?? draftFromView(data))
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
  const formItems = useMemo(() => (view ? formTargets(view) : []), [view])
  const multi = formItems.length > 1
  const orderItems = view
    ? (view.items ?? [view.item]).map((item) => {
        const filled = draft.items.find((row) => row.orderItemId === item.id)
        return filled ? { ...item, petName: filled.petName } : item
      })
    : []
  const handoffLines = [...new Set((view?.handoffs ?? []).map((handoff) =>
    handoff.kind === 'vienna'
      ? t('whenVienna')
      : handoff.kind === 'unknown'
        ? t('whenTbd')
        : [handoff.marketName, handoff.date ? formatDateLabel(handoff.date, intlLocale) : '', handoff.fromHour != null ? t('whenFrom', { time: formatHour(handoff.fromHour) }) : ''].filter(Boolean).join(' · '),
  ))]

  function ornamentTitle(index: number, item: OrderItem | undefined) {
    const color = item?.color === 'red' ? t('colorRed') : item?.color === 'grey' ? t('colorGrey') : ''
    return color ? t('ornamentWithColor', { n: index + 1, color }) : t('ornamentN', { n: index + 1 })
  }

  function sourceFor(orderItemId: string) {
    return formItems.find((item) => item.id === orderItemId)
  }

  function patch(partial: Partial<Pick<Draft, 'customerName' | 'phone' | 'email'>>) {
    setDraft((d) => ({ ...d, ...partial }))
    setFieldError({})
  }

  function patchItem(orderItemId: string, partial: Partial<Omit<ItemDraft, 'orderItemId'>>) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((item) => (item.orderItemId === orderItemId ? { ...item, ...partial } : item)),
    }))
    setFieldError({})
  }

  async function addFiles(orderItemId: string, files: FileList | null) {
    if (!files) return
    const current = draft.items.find((item) => item.orderItemId === orderItemId)
    if (!current) return
    const next: Photo[] = []
    for (const file of Array.from(files).slice(0, 4 - current.photos.length)) {
      next.push(await api.uploads.toPhoto(file))
    }
    patchItem(orderItemId, { photos: [...current.photos, ...next] })
  }

  function errorsFor(current: Step): Record<string, string> {
    const errs: Record<string, string> = {}
    if (current === 'photos') {
      for (const item of draft.items) {
        if (item.photos.length < 1) errs[`photos:${item.orderItemId}`] = t('needPhoto')
      }
    }
    if (current === 'names') {
      if (!draft.customerName.trim()) errs.customerName = t('required')
      for (const item of draft.items) {
        if (!item.petName.trim()) errs[`petName:${item.orderItemId}`] = t('required')
      }
    }
    if (current === 'contact') {
      if (!draft.phone.trim()) errs.phone = t('required')
      if (!draft.email.trim()) errs.email = t('required')
      else if (!isEmail(draft.email.trim())) errs.email = t('invalidEmail')
    }
    if (current === 'extras') {
      for (const item of draft.items) {
        if (sourceFor(item.orderItemId)?.withName && !item.backName.trim()) errs[`backName:${item.orderItemId}`] = t('required')
      }
    }
    return errs
  }

  function validate(current: Step): boolean {
    const errs = errorsFor(current)
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
    for (const current of ['photos', 'names', 'contact', 'extras'] as const) {
      const errs = errorsFor(current)
      if (Object.keys(errs).length) {
        setFieldError(errs)
        setStep(current)
        return
      }
    }
    setSending(true)
    try {
      const result = await api.forms.submitForm(token, {
        customerName: draft.customerName,
        phone: draft.phone,
        email: draft.email,
        items: draft.items.map((item) => ({
          orderItemId: item.orderItemId,
          petName: item.petName,
          backName: item.backName,
          note: item.note,
          photos: item.photos,
        })),
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

  function photoFields(item: ItemDraft, title?: string) {
    const cameraId = `camera-${item.orderItemId}`
    const galleryId = `gallery-${item.orderItemId}`
    return (
      <section key={item.orderItemId} className={title ? styles.itemBlock : undefined} aria-labelledby={title ? `photos-${item.orderItemId}` : undefined}>
        {title ? <h2 id={`photos-${item.orderItemId}`}>{title}</h2> : null}
        {fieldError[`photos:${item.orderItemId}`] ? <p role="alert">{fieldError[`photos:${item.orderItemId}`]}</p> : null}
        <div className={styles.photoRow}>
          {item.photos.map((photo) => (
            <img key={photo.id} src={photo.dataUrl} alt={photo.name} />
          ))}
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => document.getElementById(cameraId)?.click()}>
            {t('takePhoto')}
          </Button>
          <Button variant="secondary" onClick={() => document.getElementById(galleryId)?.click()}>
            {t('addPhoto')}
          </Button>
          <input
            id={cameraId}
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              void addFiles(item.orderItemId, e.target.files)
              e.target.value = ''
            }}
          />
          <input
            id={galleryId}
            className="visually-hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              void addFiles(item.orderItemId, e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </section>
    )
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

  const single = draft.items[0]

  return (
    <div className={styles.panel}>
      <ProgressSteps labels={[t('formPhotos'), t('formNames'), t('formContact'), t('formExtras'), t('review')]} current={stepIndex} label={t('progress', { n: stepIndex + 1, total })} compact />
      {error ? <p role="alert">{error}</p> : null}
      {step === 'photos' ? (
        <>
          <h1>{t('formPhotos')}</h1>
          <p className={styles.lead}>{multi ? t('formPhotosLeadMulti') : t('formPhotosLead')}</p>
          {multi ? draft.items.map((item, index) => photoFields(item, ornamentTitle(index, sourceFor(item.orderItemId)))) : single ? photoFields(single) : null}
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
          {multi
            ? draft.items.map((item, index) => (
                <section key={item.orderItemId} className={styles.itemBlock}>
                  <h2>{ornamentTitle(index, sourceFor(item.orderItemId))}</h2>
                  <Field label={t('petName')} htmlFor={`petName-${item.orderItemId}`} error={fieldError[`petName:${item.orderItemId}`]}>
                    <input id={`petName-${item.orderItemId}`} value={item.petName} onChange={(e) => patchItem(item.orderItemId, { petName: e.target.value })} />
                  </Field>
                </section>
              ))
            : single ? (
                <Field label={t('petName')} htmlFor="petName" error={fieldError[`petName:${single.orderItemId}`]}>
                  <input id="petName" value={single.petName} onChange={(e) => patchItem(single.orderItemId, { petName: e.target.value })} />
                </Field>
              ) : null}
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
          {multi
            ? draft.items.map((item, index) => {
                const source = sourceFor(item.orderItemId)
                return (
                  <section key={item.orderItemId} className={styles.itemBlock}>
                    <h2>{ornamentTitle(index, source)}</h2>
                    {source?.withName ? (
                      <Field label={t('backName')} htmlFor={`backName-${item.orderItemId}`} hint={t('backNameHint')} error={fieldError[`backName:${item.orderItemId}`]}>
                        <input
                          id={`backName-${item.orderItemId}`}
                          maxLength={6}
                          value={item.backName}
                          onChange={(e) => patchItem(item.orderItemId, { backName: e.target.value.slice(0, 6) })}
                        />
                      </Field>
                    ) : null}
                    <Field label={t('note')} htmlFor={`note-${item.orderItemId}`}>
                      <textarea id={`note-${item.orderItemId}`} value={item.note} onChange={(e) => patchItem(item.orderItemId, { note: e.target.value })} />
                    </Field>
                  </section>
                )
              })
            : single ? (
                <>
                  {sourceFor(single.orderItemId)?.withName ? (
                    <Field label={t('backName')} htmlFor="backName" hint={t('backNameHint')} error={fieldError[`backName:${single.orderItemId}`]}>
                      <input
                        id="backName"
                        maxLength={6}
                        value={single.backName}
                        onChange={(e) => patchItem(single.orderItemId, { backName: e.target.value.slice(0, 6) })}
                      />
                    </Field>
                  ) : null}
                  <Field label={t('note')} htmlFor="note">
                    <textarea id="note" value={single.note} onChange={(e) => patchItem(single.orderItemId, { note: e.target.value })} />
                  </Field>
                </>
              ) : null}
        </>
      ) : null}

      {step === 'review' ? (
        <>
          <h1>{t('review')}</h1>
          <p className={styles.lead}>{t('reviewLead')}</p>

          {multi
            ? draft.items.map((item, index) => {
                const source = sourceFor(item.orderItemId)
                const title = ornamentTitle(index, source)
                return (
                  <section key={item.orderItemId} className={styles.reviewCard} aria-labelledby={`review-${item.orderItemId}`}>
                    <h2 id={`review-${item.orderItemId}`}>{title}</h2>
                    <dl className={styles.rows}>
                      <ReviewRow label={t('formPhotos')} onEdit={() => setStep('photos')}>
                        <span className={styles.photos}>{item.photos.map((photo) => <img key={photo.id} src={photo.dataUrl} alt={photo.name} />)}</span>
                      </ReviewRow>
                      <ReviewRow label={t('petName')} onEdit={() => setStep('names')}>{item.petName}</ReviewRow>
                      <ReviewRow label={t('colour')}>
                        <span className={styles.itemLine}>
                          <span className={styles.colorDot} data-color={source?.color ?? 'none'} aria-hidden="true" />
                          {source?.color ? t(source.color === 'red' ? 'colorRed' : 'colorGrey') : t('colorUnknown')}
                        </span>
                      </ReviewRow>
                      {source?.withName ? <ReviewRow label={t('backName')} onEdit={() => setStep('extras')}>{item.backName}</ReviewRow> : null}
                      {item.note ? <ReviewRow label={t('noteLabel')} onEdit={() => setStep('extras')}>{item.note}</ReviewRow> : null}
                    </dl>
                  </section>
                )
              })
            : single ? (
                <section className={styles.reviewCard} aria-labelledby="review-ornament">
                  <h2 id="review-ornament">{t('reviewOrnament')}</h2>
                  <dl className={styles.rows}>
                    <ReviewRow label={t('formPhotos')} onEdit={() => setStep('photos')}>
                      <span className={styles.photos}>{single.photos.map((photo) => <img key={photo.id} src={photo.dataUrl} alt={photo.name} />)}</span>
                    </ReviewRow>
                    <ReviewRow label={t('petName')} onEdit={() => setStep('names')}>{single.petName}</ReviewRow>
                    {orderItems.length === 1 ? (
                      <ReviewRow label={t('colour')}>
                        <span className={styles.itemLine}>
                          <span className={styles.colorDot} data-color={orderItems[0].color ?? 'none'} aria-hidden="true" />
                          {orderItems[0].color ? t(orderItems[0].color === 'red' ? 'colorRed' : 'colorGrey') : t('colorUnknown')}
                        </span>
                      </ReviewRow>
                    ) : null}
                    {sourceFor(single.orderItemId)?.withName ? <ReviewRow label={t('backName')} onEdit={() => setStep('extras')}>{single.backName}</ReviewRow> : null}
                    {single.note ? <ReviewRow label={t('noteLabel')} onEdit={() => setStep('extras')}>{single.note}</ReviewRow> : null}
                  </dl>
                </section>
              ) : null}

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
