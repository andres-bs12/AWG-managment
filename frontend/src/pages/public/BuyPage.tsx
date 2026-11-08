import { PageHeader, PublicPage, PublicState, StickyActions } from '../../components/public/PublicForm'
import { ProgressSteps } from '../../components/ui/ProgressSteps'
import publicForm from '../../components/public/PublicForm.module.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import { SeasonClosed } from '../../components/public/SeasonClosed'
import { AnimatedPrice } from '../../components/public/AnimatedPrice'
import { OrnamentPreview, type OrnamentSide } from '../../components/public/OrnamentPreview'
import { OrnamentLoader } from '../../components/public/OrnamentLoader'
import { Button } from '../../components/ui/Button'
import type { Photo, ShopConfig, ShopDeliveryDate, ShopPickupDay } from '../../domain/types'
import { useLocale } from '../../i18n/LocaleContext'
import { loadBuyDraft, newItem, saveBuyDraft, type BuyDraft, type BuyItem } from '../../lib/buyDraft'
import { apiError } from '../../lib/apiError'
import { formatEur } from '../../lib/money'
import styles from './BuyPage.module.css'
import { MAX_PHOTOS, pickupTimes } from './buy/shared'
import { OrnamentOverview } from '../../components/public/OrnamentOverview'
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
  const location = useLocation()
  const navigate = useNavigate()
  const entry = useRef({ pathname: location.pathname, search: location.search, hash: location.hash })
  const [config, setConfig] = useState<ShopConfig | null>(null)
  const [configFailed, setConfigFailed] = useState(false)
  const [configRetry, setConfigRetry] = useState(0)
  const [draft, setDraft] = useState<BuyDraft>(loadBuyDraft)
  const requestedStep = location.state?.buyStep
  const step = requestedStep === 1 || requestedStep === 2 ? requestedStep : 0
  const [previewChoice, setPreviewChoice] = useState<Partial<BuyItem> | null>(null)
  const [changedSection, setChangedSection] = useState('')
  const [returnReview, setReturnReview] = useState(false)
  const [substep, setSubstep] = useState(0)
  const [activeUid, setActiveUid] = useState(draft.items[0].uid)
  const [sides, setSides] = useState<Record<string, OrnamentSide>>({})
  const [dates, setDates] = useState<ShopDeliveryDate[]>([])
  const [datesState, setDatesState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [datesRetry, setDatesRetry] = useState(0)
  const [pickupDays, setPickupDays] = useState<ShopPickupDay[]>([])
  const [pickupState, setPickupState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [validFields, setValidFields] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const navRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const didNavigate = useRef(false)
  const pendingErrorFocus = useRef<string | null>(null)

  useEffect(() => {
    // Reload returns to design so reference photos can be added again. During
    // this visit, router history keeps all three screens on the mounted form.
    void navigate(entry.current, { replace: true, state: { buyStep: 0 } })
  }, [navigate])
  useEffect(() => { void api.metrics.track({ event: 'buy_view' }).catch(() => {}) }, [])
  useEffect(() => {
    let active = true
    api.shop.getConfig().then((value) => { if (active) setConfig(value) }).catch(() => { if (active) setConfigFailed(true) })
    return () => { active = false }
  }, [configRetry])
  useEffect(() => { if (!saveBuyDraft(draft)) { const timer = window.setTimeout(() => setStorageError(true), 0); return () => window.clearTimeout(timer) } }, [draft])
  useEffect(() => {
    // Abandon only the checkout this browser just started, never one named by a crafted link.
    const code = params.get('cancelled')
    let pending: string | null = null
    try { pending = sessionStorage.getItem('awg-checkout-pending') } catch { /* storage unavailable */ }
    if (code && pending && code.toUpperCase() === pending.toUpperCase()) {
      try { sessionStorage.removeItem('awg-checkout-pending') } catch { /* storage unavailable */ }
      void api.shop.abandonCheckout(code).catch(() => {})
    }
  }, [params])
  useEffect(() => {
    if (!didNavigate.current || pendingErrorFocus.current) return
    headingRef.current?.focus({ preventScroll: true })
    navRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [step, substep])
  useEffect(() => {
    const id = pendingErrorFocus.current
    if (!id) return
    const target = document.getElementById(id)
    if (!target || !target.getClientRects().length) return
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'center' })
    pendingErrorFocus.current = null
  }, [step, substep, activeUid, errors])

  const signature = draft.items.map((item) => `${item.color}:${item.withName ? 1 : 0}`).join(',')
  useEffect(() => {
    if (!config?.enabled || config.seasonOver) return
    let active = true
    const timer = window.setTimeout(() => setDatesState('loading'), 0)
    const items = signature ? signature.split(',').map((entry) => ({ kind: 'custom' as const, withName: entry.endsWith(':1') })) : [{ kind: 'custom' as const, withName: false }]
    api.shop.listDeliveryDates(items).then((list) => {
      window.clearTimeout(timer)
      if (!active) return
      setDates(list)
      setDatesState('ready')
      setDraft((current) => current.deliveryKind === 'vienna' && current.deliveryDate && !list.some((date) => date.date === current.deliveryDate) ? { ...current, deliveryDate: '' } : current)
    }).catch(() => {
      window.clearTimeout(timer)
      if (!active) return
      setDates([])
      setDatesState('error')
    })
    return () => { active = false; window.clearTimeout(timer) }
  }, [signature, config?.enabled, config?.seasonOver, datesRetry])
  const pickup = draft.deliveryKind === 'market'
  useEffect(() => {
    if (!pickup || !config?.enabled || config.seasonOver) return
    let active = true
    const timer = window.setTimeout(() => setPickupState('loading'), 0)
    const items = signature ? signature.split(',').map((entry) => ({ kind: 'custom' as const, withName: entry.endsWith(':1') })) : [{ kind: 'custom' as const, withName: false }]
    api.shop.listPickupDays(items).then((list) => {
      window.clearTimeout(timer)
      if (!active) return
      setPickupDays(list)
      setPickupState('ready')
      setDraft((current) => current.deliveryKind === 'market' && current.deliveryDate && !list.some((day) => day.date === current.deliveryDate) ? { ...current, deliveryDate: '', pickupTime: '' } : current)
    }).catch(() => {
      window.clearTimeout(timer)
      if (!active) return
      setPickupDays([])
      setPickupState('error')
    })
    return () => { active = false; window.clearTimeout(timer) }
  }, [pickup, signature, config?.enabled, config?.seasonOver, datesRetry])

  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale === 'de' ? 'de-AT' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), [locale])
  const formatDate = (date: string) => dateFmt.format(new Date(`${date}T12:00:00`))
  const stepLabels = ['premiumDesign', 'stepShortDelivery', 'premiumReview'].map(key => t(key))
  if (configFailed) return <PublicState title={t('shopTitle')} error><p>{t('shopLoadError')}</p><Button onClick={() => { setConfigFailed(false); setConfigRetry(value => value + 1) }}>{t('shopRetry')}</Button></PublicState>
  if (!config) return <PublicPage><OrnamentLoader /></PublicPage>
  if (config.seasonOver) return <SeasonClosed />
  if (!config.enabled) return <PublicState title={t('shopSoonTitle')}><p>{t('shopSoonBody')}</p></PublicState>

  const shopConfig = config
  const itemPrice = (item: BuyItem) => shopConfig.customPrice + (item.withName ? shopConfig.nameExtra : 0)
  const itemsTotal = draft.items.reduce((sum, item) => sum + itemPrice(item), 0)
  const deliveryFee = draft.deliveryKind === 'market' ? 0 : shopConfig.deliveryFee
  const total = draft.items.length ? itemsTotal + deliveryFee : 0
  const err = (key: string) => errors[key]?.startsWith('api:') ? apiError({ code: errors[key].slice(4) }, locale, t('shopCheckoutError')).text : errors[key] ? t(errors[key]) : undefined
  const described = (key: string, hint = false) => [hint ? `${key}-hint` : '', err(key) ? `${key}-error` : ''].filter(Boolean).join(' ') || undefined
  function patch(partial: Partial<BuyDraft>) { if (partial.deliveryKind && partial.deliveryKind !== draft.deliveryKind) void api.metrics.track({ event: 'buy_choice', field: 'delivery', value: partial.deliveryKind }).catch(() => {}); const changedFields: Record<string, string> = { customerName: 'buy-name', email: 'buy-email', phone: 'buy-phone', line1: 'buy-line1', postalCode: 'buy-postal' }; setValidFields(current => current.filter(id => !Object.keys(partial).some(key => changedFields[key] === id))); setDraft((current) => ({ ...current, ...partial })); const fields: Record<string, string> = { customerName: 'buy-name', email: 'buy-email', phone: 'buy-phone', line1: 'buy-line1', line2: 'buy-line2', postalCode: 'buy-postal', deliveryDate: 'buy-date', pickupTime: 'buy-time', deliveryKind: 'buy-date', acceptTerms: 'buy-terms' }; setErrors(current => { const next = { ...current }; Object.keys(partial).forEach(key => delete next[fields[key]]); return next }); setServerError('') }
  function patchItem(uid: string, partial: Partial<BuyItem>) {
    if (partial.withName !== undefined) setSides(current => ({ ...current, [uid]: partial.withName ? 'back' : 'front' }))
    for (const field of ['color', 'finish'] as const) if (partial[field]) void api.metrics.track({ event: 'buy_choice', field, value: partial[field] }).catch(() => {})
    if (partial.withName !== undefined) void api.metrics.track({ event: 'buy_choice', field: 'name', value: partial.withName ? 'on' : 'off' }).catch(() => {})
    setDraft((current) => ({ ...current, items: current.items.map((item) => item.uid === uid ? { ...item, ...partial } : item) }))
    const fields: Record<string, string> = { color: 'color', finish: 'finish', withName: 'back', backName: 'back', petName: 'pet', note: 'note', photos: 'photos' }; setErrors(current => { const next = { ...current }; Object.keys(partial).forEach(key => delete next[`${fields[key]}-${uid}`]); return next }); setServerError('')
  }
  function validate(currentStep: number) {
    const found: Record<string, string> = {}
    if (currentStep === 0) {
      if (!draft.items.length) found['buy-add'] = 'shopNeedItem'
      for (const item of draft.items) {
        if (!shopConfig.colors.some((option) => option.color === item.color && option.inStock)) found[`color-${item.uid}`] = 'shopChooseColor'
        if (item.color && !shopConfig.colors.some(option => option.color === item.color && option.finish === item.finish && option.inStock)) found[`finish-${item.uid}`] = 'shopChooseFinish'
        if (item.withName && !item.backName.trim()) found[`back-${item.uid}`] = 'shopBackNameRequired'
      }
    }
    if (currentStep === 1) for (const item of draft.items) {
      if (!item.petName.trim()) found[`pet-${item.uid}`] = 'required'
      if (!item.photos.length) found[`photos-${item.uid}`] = 'shopNeedPhotoShop'
    }
    if (currentStep === 2 && draft.deliveryKind === 'vienna' && (datesState !== 'ready' || !dates.some((date) => date.date === draft.deliveryDate))) found['buy-date'] = 'shopNeedDate'
    if (currentStep === 2 && draft.deliveryKind === 'market') {
      const day = pickupState === 'ready' ? pickupDays.find((entry) => entry.date === draft.deliveryDate) : undefined
      if (!day) found['buy-date'] = 'shopNeedPickupDay'
      else if (!pickupTimes(day).includes(draft.pickupTime)) found['buy-time'] = 'shopNeedPickupTime'
    }
    if (currentStep === 3) {
      if (!draft.customerName.trim()) found['buy-name'] = 'required'
      if (!draft.email.trim()) found['buy-email'] = 'required'
      else if (!EMAIL.test(draft.email.trim())) found['buy-email'] = 'invalidEmail'
      if (!draft.phone.trim()) found['buy-phone'] = 'required'
      if (draft.deliveryKind === 'vienna' && !draft.line1.trim()) found['buy-line1'] = 'required'
      if (draft.deliveryKind === 'vienna' && !VIENNA_POSTAL.test(draft.postalCode.trim())) found['buy-postal'] = 'shopPostalInvalid'
    }
    if (currentStep === 4 && !draft.acceptTerms) found['buy-terms'] = 'shopNeedTerms'
    return found
  }
  function validateField(id: string) {
    const error = validate(3)[id]
    setErrors(current => { const next = { ...current }; if (error) next[id] = error; else delete next[id]; return next })
    setValidFields(current => error ? current.filter(value => value !== id) : [...new Set([...current, id])])
    const field = ({ 'buy-name': 'customerName', 'buy-email': 'email', 'buy-phone': 'phone', 'buy-line1': 'line1', 'buy-postal': 'postalCode' } as Record<string, string>)[id]
    if (error && field) void api.metrics.track({ event: 'buy_validation_error', step: 'delivery', field, code: error === 'required' ? 'required' : 'invalid' }).catch(() => {})
  }
  function showErrors(found: Record<string, string>) {
    setErrors(found)
    if (Object.keys(found).length) {
      const first = Object.keys(found)[0]
      pendingErrorFocus.current = first
      const item = draft.items.find(entry => first.endsWith(`-${entry.uid}`))
      if (item) { setActiveUid(item.uid); setSubstep(first.startsWith('pet-') || first.startsWith('photos-') || first.startsWith('note-') ? 2 : first.startsWith('back-') ? 1 : 0) }
    }
    return Object.keys(found).length > 0
  }
  function go(next: number) { void api.metrics.track({ event: 'buy_step', step: (['design', 'delivery', 'review'] as const)[next] }).catch(() => {}); didNavigate.current = true; setErrors({}); setServerError(''); setPreviewChoice(null); void navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { state: { buyStep: next } }) }
  async function addFiles(uid: string, files: File[] | null) {
    if (!files) return
    const available = MAX_PHOTOS - (draft.items.find((item) => item.uid === uid)?.photos.length ?? MAX_PHOTOS)
    const selected = files.slice(0, available)
    const results = await Promise.allSettled(selected.map((file) => api.uploads.toPhoto(file)))
    const added = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []) as Photo[]
    setPhotoErrors((current) => ({ ...current, [uid]: results.some((result) => result.status === 'rejected') ? (selected.some(file => file.size > 10 * 1024 * 1024) ? 'photoTooLarge' : 'photoInvalid') : files.length > available ? 'shopPhotoLimit' : '' }))
    setDraft((current) => ({ ...current, items: current.items.map((item) => item.uid === uid ? { ...item, photos: [...item.photos, ...added].slice(0, MAX_PHOTOS), photosNeedReload: added.length ? false : item.photosNeedReload } : item) }))
    if (added.length) void api.metrics.track({ event: 'buy_photo_added' }).catch(() => {})
    if (added.length) setErrors(current => { const next = { ...current }; delete next[`photos-${uid}`]; return next })
  }
  async function pay() {
    if (busyRef.current || showErrors(validate(4))) return
    // Availability can change while a customer is on a later step.
    for (let index = 0; index < 4; index++) {
      const found = validate(index)
      if (Object.keys(found).length) { go(index < 2 ? 0 : 1); showErrors(found); return }
    }
    void api.metrics.track({ event: 'buy_pay_click' }).catch(() => {})
    busyRef.current = true; setBusy(true); setServerError('')
    try {
      const wanted = draft.items.map(item => ({ kind: 'custom' as const, withName: item.withName }))
      let stillAvailable: boolean
      if (pickup) {
        const days = await api.shop.listPickupDays(wanted)
        setPickupDays(days); setPickupState('ready')
        stillAvailable = days.some(day => day.date === draft.deliveryDate)
      } else {
        const availableDates = await api.shop.listDeliveryDates(wanted)
        setDates(availableDates); setDatesState('ready')
        stillAvailable = availableDates.some(date => date.date === draft.deliveryDate)
      }
      if (!stillAvailable) {
        setDraft(current => ({ ...current, deliveryDate: '', pickupTime: '' }))
        go(1)
        showErrors({ 'buy-date': 'shopDateUnavailable' })
        busyRef.current = false; setBusy(false)
        return
      }
      const result = await api.shop.checkout({
        customerName: draft.customerName.trim(), email: draft.email.trim(), phone: draft.phone.trim(),
        ...(pickup
          ? { deliveryKind: 'market' as const, pickupTime: draft.pickupTime }
          : { address: { line1: draft.line1.trim(), line2: draft.line2.trim() || undefined, postalCode: draft.postalCode.trim(), city: 'Wien' } }),
        deliveryDate: draft.deliveryDate, acceptTerms: draft.acceptTerms,
        items: draft.items.map((item) => ({ kind: 'custom', withName: item.withName, color: item.color || undefined, finish: item.finish || undefined, petName: item.petName.trim(), backName: item.withName ? item.backName.trim() : undefined, note: item.note.trim() || undefined, photos: item.photos })),
      })
      // Only follow Stripe Checkout or a same-origin URL (the mock success page).
      const target = new URL(result.checkoutUrl, window.location.origin)
      if (target.origin !== window.location.origin && target.origin !== 'https://checkout.stripe.com') throw Object.assign(new Error('Unexpected checkout URL.'), { code: 'PAYMENT_PROVIDER' })
      try { sessionStorage.setItem('awg-checkout-pending', result.orderCode) } catch { /* storage unavailable */ }
      window.location.assign(target.href)
    } catch (error) {
      const problem = apiError(error, locale, t('shopCheckoutError')); const field = problem.field ?? ''; const match = field.match(/^items\[(\d+)\]\.(\w+)/); const item = match ? draft.items[Number(match[1])] : undefined; const itemFields: Record<string, [number, string]> = { petName: [1, 'pet'], photos: [1, 'photos'], color: [0, 'color'], finish: [0, 'finish'], backName: [0, 'back'], note: [1, 'note'] }; const simple: Record<string, [number, string]> = { customerName: [3, 'buy-name'], email: [3, 'buy-email'], phone: [3, 'buy-phone'], 'address.line1': [3, 'buy-line1'], 'address.line2': [3, 'buy-line2'], 'address.city': [3, 'buy-city'], address: [3, 'buy-line1'], 'address.postalCode': [3, 'buy-postal'], deliveryDate: [2, 'buy-date'], pickupTime: [2, 'buy-time'] }; const target = field === 'photos' && draft.items[0] ? [1, `photos-${draft.items[0].uid}`] as const : match && item && itemFields[match[2]] ? [itemFields[match[2]][0], `${itemFields[match[2]][1]}-${item.uid}`] as const : simple[field];
      if (target) { go(target[0] < 2 ? 0 : 1); showErrors({ [target[1]]: (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') ? `api:${error.code}` : 'shopFixErrors' }) } else setServerError(problem.text)
      busyRef.current = false; setBusy(false)
    }
  }

  const stepProps = { t, draft, config, itemPrice, patch, patchItem, err, described, photoErrors: Object.fromEntries(Object.entries(photoErrors).map(([key, value]) => [key, value ? t(value) : ''])), addFiles, dates, datesState, setDatesRetry, pickupDays, pickupState, formatDate, serverError }

  const activeItem = draft.items.find(item => item.uid === activeUid) ?? draft.items[0]
  function next() {
    if (step === 2) { void pay(); return }
    if (step === 1) { const found = { ...validate(2), ...validate(3) }; if (!showErrors(found)) { setReturnReview(false); go(2) }; return }
    const mobile = window.matchMedia('(max-width: 1023px)').matches
    if (mobile && substep < 2) {
      const all = validate(0)
      const found = Object.fromEntries(Object.entries(all).filter(([key]) => key.endsWith(`-${activeItem.uid}`) && (substep === 0 ? key.startsWith('color-') || key.startsWith('finish-') : key.startsWith('back-'))))
      if (!showErrors(found)) { didNavigate.current = true; setSubstep(substep + 1) }
      return
    }
    const found = { ...validate(0), ...validate(1) }
    if (!showErrors(found)) { if (returnReview) { setReturnReview(false); go(2) } else go(1) }
  }
  function back() {
    if (step === 0 && substep > 0) { didNavigate.current = true; setSubstep(substep - 1) }
    else if (step > 0) go(step - 1)
  }
  function selectItem(uid: string) {
    setActiveUid(uid); setSubstep(0); setPreviewChoice(null)
    requestAnimationFrame(() => {
      // With one ornament left there is no editor heading; land on its first choice instead.
      const heading = document.getElementById('ornament-editor-heading') ?? document.getElementById(`color-${uid}`)
      if (!heading) return
      heading.focus({ preventScroll: true })
      heading.scrollIntoView({ block: 'start', behavior: 'instant' })
      // The compact preview can stick above the editor; reveal its heading below it.
      const scroller = heading.closest<HTMLElement>('[data-public-scroll]')
      const preview = document.querySelector<HTMLElement>('[data-public-preview]')
      const rect = heading.getBoundingClientRect()
      const artwork = preview?.getBoundingClientRect()
      const overlaps = artwork && rect.left < artwork.right && rect.right > artwork.left
      const gap = parseFloat(getComputedStyle(heading).getPropertyValue('--space-4'))
      const top = Math.max(0, scroller?.getBoundingClientRect().top ?? 0, overlaps && preview && getComputedStyle(preview).position === 'sticky' ? artwork.bottom : 0) + gap
      if (rect.top < top) (scroller ?? window).scrollBy({ top: rect.top - top, behavior: 'instant' })
    })
  }
  function addItem() {
    if (draft.items.length >= shopConfig.maxItems) return
    const item = newItem()
    patch({ items: [...draft.items, item] })
    selectItem(item.uid)
  }
  function removeItem(uid: string) {
    if (draft.items.length <= 1) return
    const index = draft.items.findIndex(item => item.uid === uid)
    const rest = draft.items.filter(item => item.uid !== uid)
    patch({ items: rest })
    setErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.endsWith(`-${uid}`))))
    setPhotoErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== uid)))
    selectItem(activeUid === uid ? rest[Math.min(index, rest.length - 1)].uid : activeUid)
  }
  return <form data-public-page className={`${publicForm.page} ${styles.shop}`} noValidate onFocus={(event) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || target.tabIndex < 0 || target.closest('[data-sticky-actions][data-docked="true"]')) return
    // Native focus scrolling can leave a control under the sticky preview or
    // actions, or just a fraction of a pixel outside the viewport.
    requestAnimationFrame(() => {
      if (document.activeElement !== target) return
      // The public shell is the vertical scroller. A horizontally scrolling ancestor (e.g. the item tabs)
      // also computes overflow-y:auto, so it must not be mistaken for it.
      let scroller = target.closest<HTMLElement>('[data-public-scroll]') ?? target.parentElement
      while (scroller && !scroller.hasAttribute('data-public-scroll') && !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) scroller = scroller.parentElement
      const rect = target.getBoundingClientRect()
      const viewport = scroller?.getBoundingClientRect()
      const viewportTop = Math.max(0, viewport?.top ?? 0)
      const viewportBottom = Math.min(window.innerHeight, viewport?.bottom ?? window.innerHeight)
      const previewElement = document.querySelector<HTMLElement>(`.${styles.previewPane}`)
      const actionsElement = document.querySelector<HTMLElement>(`.${styles.actions}`)
      const preview = !previewElement?.contains(target) ? previewElement?.getBoundingClientRect() : undefined
      const actions = !actionsElement?.contains(target) ? actionsElement?.getBoundingClientRect() : undefined
      const overlaps = (other: DOMRect) => rect.left < other.right && rect.right > other.left
      const top = preview && overlaps(preview) && preview.top <= viewportTop + 1 && preview.bottom > viewportTop ? preview.bottom + 8 : viewportTop + 8
      const bottom = actions && overlaps(actions) && actions.bottom >= viewportBottom - 1 && actions.top < viewportBottom ? actions.top - 8 : viewportBottom - 8
      const delta = rect.top < top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0
      if (delta) (scroller ?? window).scrollBy({ top: delta, behavior: 'instant' })
    })
  }} onSubmit={(event) => { event.preventDefault(); next() }}>
    <PageHeader title={t('shopTitle')}>{step === 0 && <p>{t('shopLead')}</p>}</PageHeader>
    {storageError ? <p role="status">{t('shopStorageError')}</p> : null}
    {params.get('cancelled') ? <p className={styles.notice} role="status">{t('shopCancelled')}</p> : null}
    <div ref={navRef}><ProgressSteps labels={stepLabels} current={step} label={t('progress', { n: step + 1, total: stepLabels.length })} compact /></div>
    <section className={styles.step} aria-labelledby="buy-heading">
      <h2 id="buy-heading" ref={headingRef} tabIndex={-1}>{stepLabels[step]}</h2>
      {step === 0 && <div className={styles.design} data-substep={substep}>
        <div data-public-preview className={styles.previewPane}>
          <OrnamentPreview key={activeItem.uid} item={{ ...activeItem, ...previewChoice }} side={sides[activeItem.uid]} onSideChange={side => setSides(current => ({ ...current, [activeItem.uid]: side }))} />
          <div className={styles.previewSummary}><span>{t('shopTotal')}</span><strong data-buy-total><AnimatedPrice value={total} locale={locale} /></strong></div>
        </div>
        <div className={styles.optionsPane}>
          {/* A single ornament needs no list: the editor comes first and adding another is offered at the end. */}
          {draft.items.length > 1 && <div className={styles.ornamentOverview}><OrnamentOverview items={draft.items.map(item => ({ ...item, price: itemPrice(item) }))} activeUid={activeItem.uid} maxItems={config.maxItems} onEdit={selectItem} onAdd={addItem} onRemove={removeItem} /></div>}
          <div className={styles.itemPanel} key={activeItem.uid}>
            {draft.items.length > 1 && <h3 id="ornament-editor-heading" className={styles.editorHeading} tabIndex={-1}>{t('multiEditorHeading', { n: draft.items.findIndex(item => item.uid === activeItem.uid) + 1, total: draft.items.length })}{activeItem.petName.trim() ? ` – ${activeItem.petName.trim()}` : ''}</h3>}
            <BuyItemsStep {...stepProps} activeUid={activeItem.uid} preview={setPreviewChoice} />
            <div className={styles.petGroup}><BuyPetStep {...stepProps} activeUid={activeItem.uid} /></div>
          </div>
          {draft.items.length === 1 && <div className={styles.addSingle}><Button id="buy-add" variant="secondary" size="lg" fullWidth disabled={draft.items.length >= config.maxItems} onClick={addItem}>{t('multiAddAnother')}</Button></div>}
          {err('buy-add') && <p className={styles.error} role="alert">{err('buy-add')}</p>}
        </div>
      </div>}
      {step === 1 && <><BuyDateStep {...stepProps} /><div className={styles.deliveryContact}><BuyContactStep {...stepProps} withAddress={!pickup} validateField={validateField} validFields={validFields} /></div></>}
      {step === 2 && <BuyReviewStep {...stepProps} go={(index, uid, sub, field) => { pendingErrorFocus.current = field ?? null; if (uid) setActiveUid(uid); if (sub !== undefined) setSubstep(sub); setChangedSection(uid ?? (index === 3 ? 'contact' : 'delivery')); setReturnReview(true); go(index < 2 ? 0 : 1) }} itemsTotal={itemsTotal} deliveryFee={deliveryFee} total={total} changed={changedSection} />}
    </section>
    <aside hidden={step !== 1} className={styles.cart} aria-label={t('shopCart')}><h2>{t('shopCart')}</h2><dl aria-live="polite"><div><dt>{t('shopItemsTotal')} ({draft.items.length})</dt><dd>{formatEur(itemsTotal, locale)}</dd></div><div><dt>{t('shopDeliveryFee')}</dt><dd>{deliveryFee ? formatEur(deliveryFee, locale) : t('shopFree')}</dd></div><div className={styles.cartTotal}><dt>{t('shopTotal')}</dt><dd>{formatEur(total, locale)}</dd></div></dl></aside>
    <StickyActions className={styles.actions}><div className={styles.mobileTotal} hidden={step === 2}><span>{t('shopTotal')}</span><strong data-buy-total><AnimatedPrice value={total} locale={locale} /></strong></div>{(step > 0 || substep > 0) && <Button variant="secondary" disabled={busy} onClick={back}>{t('back')}</Button>}<Button type="submit" size="lg" disabled={busy} aria-busy={busy}>{step === 2 ? busy ? t('shopPaying') : `${t('shopPayStripe')} · ${formatEur(total, locale)}` : t('continue')}</Button>{step === 2 && <small className={styles.stripeLine}>{t('secureStripe')}</small>}</StickyActions>
  </form>
}
