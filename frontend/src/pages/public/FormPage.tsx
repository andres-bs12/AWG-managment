import { formatDateLabel, formatHour } from '../../lib/time'
import { ProgressSteps } from '../../components/ui/ProgressSteps'
import { useEffect, useMemo, useState, useRef, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { OrnamentLoader } from '../../components/public/OrnamentLoader'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { Field } from '../../components/ui/Field'
import type { Address, CustomerFormView, OrderItem, Photo } from '../../domain/types'
import { useLocale } from '../../i18n/LocaleContext'
import styles from './Panel.module.css'
import { MAX_PHOTOS, colorKeys } from './buy/shared'

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
  address: Address
}

const empty: Draft = {
  customerName: '',
  phone: '',
  email: '',
  items: [],
  address: { line1: '', line2: '', postalCode: '', city: 'Wien' },
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
    customerName: view.customer.name === 'Walk-in' ? '' : view.customer.name,
    address: view.address ?? { line1: '', line2: '', postalCode: '', city: 'Wien' },
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
      address: parsed.address ?? { line1: '', line2: '', postalCode: '', city: 'Wien' },
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      items: parsed.items.map((item) => ({
        orderItemId: item.orderItemId,
        petName: item.petName ?? '',
        backName: item.backName ?? '',
        note: item.note ?? '',
        photos: Array.isArray(item.photos) ? item.photos.filter(photo => !photo.dataUrl.startsWith('data:')) : [],
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
  const sendLock = useRef(false)
  const [storageError, setStorageError] = useState(false)
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
        let saved: string | null = null
        try { saved = sessionStorage.getItem(draftKey(token)) } catch { setStorageError(true) }
        const restored = saved ? parseDraft(saved, itemIds) : null
        setDraft(restored ?? draftFromView(data))
      })
      .catch(() => {
        if (!cancelled) setError(locale === 'de' ? 'Das Formular konnte nicht geladen werden. Bitte versuche es erneut.' : 'Could not load the form. Please try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, locale])

  useEffect(() => {
    if (!token || loadedToken !== token || loading || step === 'done') return
    try { sessionStorage.setItem(draftKey(token), JSON.stringify({ ...draft, items: draft.items.map(item => ({ ...item, photos: item.photos.filter(photo => !photo.dataUrl.startsWith('data:')) })) })) } catch { window.setTimeout(() => setStorageError(true), 0) }
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
      ? [t('whenVienna'), handoff.date ? formatDateLabel(handoff.date, intlLocale) : ''].filter(Boolean).join(' · ')
      : handoff.kind === 'unknown'
        ? t('whenTbd')
        : [handoff.marketName, handoff.date ? formatDateLabel(handoff.date, intlLocale) : '', handoff.fromHour != null ? t('whenFrom', { time: formatHour(handoff.fromHour) }) : ''].filter(Boolean).join(' · '),
  ))]

  function ornamentTitle(index: number, item: OrderItem | undefined) {
    const color = item?.color ? t(colorKeys[item.color]) : ''
    return color ? t('ornamentWithColor', { n: index + 1, color }) : t('ornamentN', { n: index + 1 })
  }

  function sourceFor(orderItemId: string) {
    return formItems.find((item) => item.id === orderItemId)
  }

  function patch(partial: Partial<Pick<Draft, 'customerName' | 'phone' | 'email'>>) {
    setDraft((d) => ({ ...d, ...partial }))
    setFieldError(current => { const next = { ...current }; Object.keys(partial).forEach(key => delete next[key]); return next })
  }

  function patchItem(orderItemId: string, partial: Partial<Omit<ItemDraft, 'orderItemId'>>) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((item) => (item.orderItemId === orderItemId ? { ...item, ...partial } : item)),
    }))
    setFieldError(current => { const next = { ...current }; Object.keys(partial).forEach(key => delete next[`${key}:${orderItemId}`]); return next })
  }

  async function addFiles(orderItemId: string, files: File[]) {
    const current = draft.items.find((item) => item.orderItemId === orderItemId)
    if (!current) return
    const available = MAX_PHOTOS - current.photos.length
    const next: Photo[] = []
    let message = files.length > available ? t('shopPhotoLimit') : ''
    for (const file of files.slice(0, available)) {
      if (!file.type.startsWith('image/')) { message = locale === 'de' ? 'Bitte wähle eine Bilddatei.' : 'Please choose an image file.'; continue }
      if (file.size > 10 * 1024 * 1024) { message = locale === 'de' ? 'Das Foto ist größer als 10 MB.' : 'The photo is larger than 10 MB.'; continue }
      try { next.push(await api.uploads.toPhoto(file)) } catch { message = locale === 'de' ? 'Das Foto konnte nicht gelesen werden.' : 'Could not read the photo.' }
    }
    patchItem(orderItemId, { photos: [...current.photos, ...next] })
    if (message) setFieldError(previous => ({ ...previous, [`photos:${orderItemId}`]: message }))
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
      if (view?.needsAddress) {
        if (!draft.address.line1.trim()) errs.line1 = t('required')
        if (!/^1(0[1-9]|1[0-9]|2[0-3])0$/.test(draft.address.postalCode.trim())) errs.postalCode = t('shopPostalInvalid')
        if (!draft.address.city.trim()) errs.city = t('required')
      }
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
    if (sendLock.current) return
    for (const current of ['photos', 'names', 'contact', 'extras'] as const) {
      const errs = errorsFor(current)
      if (Object.keys(errs).length) {
        setFieldError(errs)
        setStep(current)
        return
      }
    }
    sendLock.current = true
    setSending(true)
    try {
      const result = await api.forms.submitForm(token, {
        address: view?.needsAddress ? draft.address : undefined,
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
      try { sessionStorage.removeItem(draftKey(token)) } catch { setStorageError(true) }
      setOrderCode(result.orderCode)
      setStep('done')
    } catch (err) {
      const { code, field } = err as { code?: string; field?: string }
      const addressFields: Record<string, string> = { 'address.line1': 'line1', 'address.postalCode': 'postalCode', 'address.city': 'city', address: 'line1' }
      if (field && addressFields[field]) { setStep('contact'); setFieldError({ [addressFields[field]]: code === 'POSTAL_OUTSIDE_VIENNA' ? t('shopPostalInvalid') : t('required') }); return }
      setError(code === 'FORM_LOCKED' ? (locale === 'de' ? 'Die Bemalung hat begonnen. Änderungen sind nicht mehr möglich.' : 'Painting has started. Changes are no longer possible.') : (locale === 'de' ? 'Das Formular konnte nicht gespeichert werden. Bitte prüfe deine Angaben und versuche es erneut.' : 'Could not save the form. Please check your details and try again.'))
    } finally {
      sendLock.current = false
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
            <span key={photo.id}><img src={photo.dataUrl} alt={photo.name} /><Button variant="secondary" aria-label={t('shopRemovePhoto', { name: photo.name })} onClick={() => patchItem(item.orderItemId, { photos: item.photos.filter(p => p.id !== photo.id) })}>{t('shopRemovePhoto', { name: photo.name })}</Button></span>
          ))}
        </div>
        <p>{t('shopPhotosCount', { n: item.photos.length, max: MAX_PHOTOS })}</p><p>{t('shopPhotosWarning')}</p>
        <div className={styles.actions}>
          <Button variant="secondary" disabled={item.photos.length >= MAX_PHOTOS} onClick={() => document.getElementById(cameraId)?.click()}>
            {t('takePhoto')}
          </Button>
          <Button variant="secondary" disabled={item.photos.length >= MAX_PHOTOS} onClick={() => document.getElementById(galleryId)?.click()}>
            {t('addPhoto')}
          </Button>
          <input
            id={cameraId}
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              void addFiles(item.orderItemId, Array.from(e.target.files ?? []))
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
              void addFiles(item.orderItemId, Array.from(e.target.files ?? []))
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

  if (view && !view.editable && step !== 'done') return <div className={styles.panel}><p>{locale === 'de' ? 'Die Bemalung hat begonnen. Änderungen sind nicht mehr möglich.' : 'Painting has started. Changes are no longer possible.'}</p><ButtonLink to="/">{t('backHome')}</ButtonLink></div>

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
      {storageError ? <p role="status">{locale === 'de' ? 'Der Entwurf konnte nicht gespeichert werden.' : 'The draft could not be saved.'}</p> : null}
      {view?.editable ? <p>{locale === 'de' ? 'Du kannst deine Angaben bis zum Beginn der Bemalung ändern.' : 'You can still change your details until painting starts.'}</p> : null}
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
              id="customerName" maxLength={120}
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
                    <input id={`petName-${item.orderItemId}`} maxLength={60} value={item.petName} onChange={(e) => patchItem(item.orderItemId, { petName: e.target.value })} />
                  </Field>
                </section>
              ))
            : single ? (
                <Field label={t('petName')} htmlFor="petName" error={fieldError[`petName:${single.orderItemId}`]}>
                  <input id="petName" maxLength={60} value={single.petName} onChange={(e) => patchItem(single.orderItemId, { petName: e.target.value })} />
                </Field>
              ) : null}
        </>
      ) : null}

      {step === 'contact' ? (
        <>
          <h1>{t('formContact')}</h1>
          {view?.needsAddress ? <>
            <Field label={t('shopStreet')} htmlFor="form-line1" error={fieldError.line1}><input id="form-line1" maxLength={200} value={draft.address.line1} onChange={e => { setDraft(d => ({ ...d, address: { ...d.address, line1: e.target.value } })); setFieldError(x => ({ ...x, line1: '' })) }} /></Field>
            <Field label={t('shopLine2')} htmlFor="form-line2"><input id="form-line2" maxLength={200} value={draft.address.line2 ?? ''} onChange={e => setDraft(d => ({ ...d, address: { ...d.address, line2: e.target.value } }))} /></Field>
            <Field label={t('shopPostal')} htmlFor="form-postal" error={fieldError.postalCode}><input id="form-postal" maxLength={4} inputMode="numeric" value={draft.address.postalCode} onChange={e => { setDraft(d => ({ ...d, address: { ...d.address, postalCode: e.target.value } })); setFieldError(x => ({ ...x, postalCode: '' })) }} /></Field>
            <Field label={t('shopCity')} htmlFor="form-city" error={fieldError.city}><input id="form-city" maxLength={120} value={draft.address.city} onChange={e => { setDraft(d => ({ ...d, address: { ...d.address, city: e.target.value } })); setFieldError(x => ({ ...x, city: '' })) }} /></Field>
          </> : null}
          <Field label={t('phone')} htmlFor="phone" error={fieldError.phone}>
            <input
              id="phone" maxLength={40}
              type="tel"
              autoComplete="tel"
              value={draft.phone}
              onChange={(e) => patch({ phone: e.target.value })}
            />
          </Field>
          <Field label={t('email')} htmlFor="email" error={fieldError.email}>
            <input
              id="email" maxLength={200}
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
                      <textarea id={`note-${item.orderItemId}`} maxLength={1000} value={item.note} onChange={(e) => patchItem(item.orderItemId, { note: e.target.value })} />
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
                    <textarea id="note" maxLength={1000} value={single.note} onChange={(e) => patchItem(single.orderItemId, { note: e.target.value })} />
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
                          {source?.color ? t(colorKeys[source.color]) : t('colorUnknown')}
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
                          {orderItems[0].color ? t(colorKeys[orderItems[0].color]) : t('colorUnknown')}
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
              {view?.needsAddress ? <ReviewRow label={t('editAddress')} onEdit={() => setStep('contact')}>{[draft.address.line1, draft.address.line2, draft.address.postalCode, draft.address.city].filter(Boolean).join(', ')}</ReviewRow> : null}
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
                          {item.color ? ` · ${t(colorKeys[item.color])}` : ''}
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
