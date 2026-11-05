import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { OrnamentLoader } from '../../components/public/OrnamentLoader'
import { Button } from '../../components/ui/Button'
import type { Photo, ShopConfig, ShopDeliveryDate } from '../../domain/types'
import { useLocale } from '../../i18n/LocaleContext'
import { loadBuyDraft, saveBuyDraft, type BuyDraft, type BuyItem } from '../../lib/buyDraft'
import { formatEur } from '../../lib/money'
import styles from './BuyPage.module.css'
import panel from './Panel.module.css'
import { MAX_PHOTOS } from './buy/shared'
import { BuyItemsStep } from './buy/BuyItemsStep'
import { BuyPetStep } from './buy/BuyPetStep'
import { BuyDateStep } from './buy/BuyDateStep'
import { BuyContactStep } from './buy/BuyContactStep'
import { BuyReviewStep } from './buy/BuyReviewStep'

const VIENNA_POSTAL = /^1(0[1-9]|1[0-9]|2[0-3])0$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function BuyPage() {
  const { t, locale } = useLocale()
  const [params] = useSearchParams()
  const [config, setConfig] = useState<ShopConfig | null>(null)
  const [configFailed, setConfigFailed] = useState(false)
  const [configRetry, setConfigRetry] = useState(0)
  const [draft, setDraft] = useState<BuyDraft>(loadBuyDraft)
  const [step, setStep] = useState(0)
  const [dates, setDates] = useState<ShopDeliveryDate[]>([])
  const [datesState, setDatesState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [datesRetry, setDatesRetry] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const didNavigate = useRef(false)
  const pendingErrorFocus = useRef(false)

  useEffect(() => {
    let active = true
    api.shop.getConfig().then((value) => { if (active) setConfig(value) }).catch(() => { if (active) setConfigFailed(true) })
    return () => { active = false }
  }, [configRetry])
  useEffect(() => { saveBuyDraft(draft) }, [draft])
  useEffect(() => {
    if (!didNavigate.current || pendingErrorFocus.current) return
    headingRef.current?.focus()
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [step])

  const signature = draft.items.map((item) => `${item.color}:${item.withName ? 1 : 0}`).join(',')
  useEffect(() => {
    if (!config?.enabled || !signature) return
    let active = true
    const timer = window.setTimeout(() => setDatesState('loading'), 0)
    const items = signature.split(',').map((entry) => ({ kind: 'custom' as const, withName: entry.endsWith(':1') }))
    api.shop.listDeliveryDates(items).then((list) => {
      window.clearTimeout(timer)
      if (!active) return
      setDates(list)
      setDatesState('ready')
      setDraft((current) => current.deliveryDate && !list.some((date) => date.date === current.deliveryDate) ? { ...current, deliveryDate: '' } : current)
    }).catch(() => {
      window.clearTimeout(timer)
      if (!active) return
      setDates([])
      setDatesState('error')
    })
    return () => { active = false; window.clearTimeout(timer) }
  }, [signature, config?.enabled, datesRetry])

  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale === 'de' ? 'de-AT' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), [locale])
  const formatDate = (date: string) => dateFmt.format(new Date(`${date}T12:00:00`))
  const stepLabels = [t('shopStepItems'), t('shopStepPet'), t('shopStepDate'), t('shopStepContact'), t('shopStepPay')]
  if (configFailed) return <div className={panel.panel}><h1>{t('shopTitle')}</h1><p role="alert">{t('shopLoadError')}</p><Button onClick={() => { setConfigFailed(false); setConfigRetry((value) => value + 1) }}>{t('shopRetry')}</Button></div>
  if (!config) return <div className={panel.panel}><OrnamentLoader /></div>
  if (!config.enabled) return <div className={panel.panel}><h1>{t('shopSoonTitle')}</h1><p className={panel.lead}>{t('shopSoonBody')}</p></div>

  const shopConfig = config
  const itemPrice = (item: BuyItem) => shopConfig.customPrice + (item.withName ? shopConfig.nameExtra : 0)
  const itemsTotal = draft.items.reduce((sum, item) => sum + itemPrice(item), 0)
  const total = draft.items.length ? itemsTotal + shopConfig.deliveryFee : 0
  const err = (key: string) => errors[key]
  const described = (key: string, hint = false) => [hint ? `${key}-hint` : '', err(key) ? `${key}-error` : ''].filter(Boolean).join(' ') || undefined
  function patch(partial: Partial<BuyDraft>) { setDraft((current) => ({ ...current, ...partial })); setErrors({}); setServerError('') }
  function patchItem(uid: string, partial: Partial<BuyItem>) {
    setDraft((current) => ({ ...current, items: current.items.map((item) => item.uid === uid ? { ...item, ...partial } : item) }))
    setErrors({}); setServerError('')
  }
  function validate(currentStep: number) {
    const found: Record<string, string> = {}
    if (currentStep === 0) {
      if (!draft.items.length) found['buy-add'] = t('shopNeedItem')
      for (const item of draft.items) {
        if (!shopConfig.colors.some((option) => option.color === item.color && option.inStock)) found[`color-${item.uid}`] = t('shopChooseColor')
        if (item.withName && !item.backName.trim()) found[`back-${item.uid}`] = t('shopBackNameRequired')
      }
    }
    if (currentStep === 1) for (const item of draft.items) {
      if (!item.petName.trim()) found[`pet-${item.uid}`] = t('required')
      if (!item.photos.length) found[`photos-${item.uid}`] = t('shopNeedPhotoShop')
    }
    if (currentStep === 2 && (datesState !== 'ready' || !dates.some((date) => date.date === draft.deliveryDate))) found['buy-date'] = t('shopNeedDate')
    if (currentStep === 3) {
      if (!draft.customerName.trim()) found['buy-name'] = t('required')
      if (!draft.email.trim()) found['buy-email'] = t('required')
      else if (!EMAIL.test(draft.email.trim())) found['buy-email'] = t('invalidEmail')
      if (!draft.phone.trim()) found['buy-phone'] = t('required')
      if (!draft.line1.trim()) found['buy-line1'] = t('required')
      if (!VIENNA_POSTAL.test(draft.postalCode.trim())) found['buy-postal'] = t('shopPostalInvalid')
    }
    if (currentStep === 4 && !draft.acceptTerms) found['buy-terms'] = t('shopNeedTerms')
    return found
  }
  function showErrors(found: Record<string, string>) {
    setErrors(found)
    if (Object.keys(found).length) {
      pendingErrorFocus.current = true
      window.setTimeout(() => {
        document.getElementById(Object.keys(found)[0])?.focus()
        pendingErrorFocus.current = false
      }, 0)
    }
    return Object.keys(found).length > 0
  }
  function go(next: number) { didNavigate.current = true; setErrors({}); setServerError(''); setStep(next) }
  async function addFiles(uid: string, files: FileList | null) {
    if (!files) return
    const available = MAX_PHOTOS - (draft.items.find((item) => item.uid === uid)?.photos.length ?? MAX_PHOTOS)
    const results = await Promise.allSettled(Array.from(files).slice(0, available).map((file) => api.uploads.toPhoto(file)))
    const added = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []) as Photo[]
    setPhotoErrors((current) => ({ ...current, [uid]: results.some((result) => result.status === 'rejected') ? t('shopPhotoError') : files.length > available ? t('shopPhotoLimit') : '' }))
    setDraft((current) => ({ ...current, items: current.items.map((item) => item.uid === uid ? { ...item, photos: [...item.photos, ...added].slice(0, MAX_PHOTOS), photosNeedReload: added.length ? false : item.photosNeedReload } : item) }))
    setErrors({})
  }
  async function pay() {
    if (busyRef.current || showErrors(validate(4))) return
    // Availability can change while a customer is on a later step.
    for (let index = 0; index < 4; index++) {
      const found = validate(index)
      if (Object.keys(found).length) { go(index); showErrors(found); return }
    }
    busyRef.current = true; setBusy(true); setServerError('')
    try {
      const result = await api.shop.checkout({
        customerName: draft.customerName.trim(), email: draft.email.trim(), phone: draft.phone.trim(),
        address: { line1: draft.line1.trim(), line2: draft.line2.trim() || undefined, postalCode: draft.postalCode.trim(), city: 'Wien' },
        deliveryDate: draft.deliveryDate, acceptTerms: draft.acceptTerms,
        items: draft.items.map((item) => ({ kind: 'custom', withName: item.withName, color: item.color || undefined, petName: item.petName.trim(), backName: item.withName ? item.backName.trim() : undefined, note: item.note.trim() || undefined, photos: item.photos })),
      })
      window.location.assign(result.checkoutUrl)
    } catch {
      setServerError(t('shopCheckoutError'))
      busyRef.current = false; setBusy(false)
    }
  }

  const stepProps = { t, draft, config, itemPrice, patch, patchItem, err, described, photoErrors, addFiles, dates, datesState, setDatesRetry, formatDate, serverError }

  return <form className={`${panel.panel} ${styles.shop}`} noValidate onSubmit={(event) => { event.preventDefault(); if (step === 4) void pay(); else if (!showErrors(validate(step))) go(step + 1) }}>
    <h1>{t('shopTitle')}</h1><p className={panel.lead}>{t('shopLead')}</p>
    {params.get('cancelled') ? <p className={styles.notice} role="status">{t('shopCancelled')}</p> : null}
    <nav aria-label={t('shopProgress')}><ol className={styles.progress}>{stepLabels.map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} data-done={index < step}><span>{index + 1}</span>{label}</li>)}</ol></nav>
    <section className={styles.step} aria-labelledby="buy-heading">
      <h2 id="buy-heading" ref={headingRef} tabIndex={-1}>{stepLabels[step]}</h2>
      {step === 0 && <BuyItemsStep {...stepProps} />}
      {step === 1 && <BuyPetStep {...stepProps} />}
      {step === 2 && <BuyDateStep {...stepProps} />}
      {step === 3 && <BuyContactStep {...stepProps} />}
      {step === 4 && <BuyReviewStep {...stepProps} />}
    </section>
    <aside className={styles.cart} aria-label={t('shopCart')}><h2>{t('shopCart')}</h2><dl aria-live="polite"><div><dt>{t('shopItemsTotal')} ({draft.items.length})</dt><dd>{formatEur(itemsTotal)}</dd></div><div><dt>{t('shopDeliveryFee')}</dt><dd>{config.deliveryFee ? formatEur(config.deliveryFee) : t('shopFree')}</dd></div><div className={styles.cartTotal}><dt>{t('shopTotal')}</dt><dd>{formatEur(total)}</dd></div></dl></aside>
    <div className={styles.actions}><div className={styles.mobileTotal}><span>{t('shopTotal')}</span><strong>{formatEur(total)}</strong></div>{step > 0 && <Button variant="secondary" disabled={busy} onClick={() => go(step - 1)}>{t('back')}</Button>}<Button type="submit" size="lg" disabled={busy} aria-busy={busy}>{step === 4 ? busy ? t('shopPaying') : t('shopPayStripe') : t('continue')}</Button></div>
  </form>
}
