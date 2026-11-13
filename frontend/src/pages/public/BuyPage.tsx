import { paintedNameValid } from '../../lib/paintedName'
import { PageHeader, PublicPage, PublicState, FormActions } from '../../components/public/PublicForm'
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
import { keepFormFocusVisible } from '../../lib/publicFormFocus'
import { petNameFromBack } from '../../lib/petName'
import { phoneValid } from '../../lib/phone'
import styles from './BuyPage.module.css'
import { MAX_PHOTOS, pickupTimes } from './buy/shared'
import { OrnamentOverview } from '../../components/public/OrnamentOverview'
import { BuyItemsStep } from './buy/BuyItemsStep'
import { BuyPetStep } from './buy/BuyPetStep'
import { BuyDateStep } from './buy/BuyDateStep'
import { BuyContactStep } from './buy/BuyContactStep'
import { BuyReviewStep } from './buy/BuyReviewStep'
import { CartRows } from './buy/CartRows'

const VIENNA_POSTAL = /^1(0[1-9]|1[0-9]|2[0-3])0$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Contact errors that mean "left empty" (metrics report them as required, the rest as invalid). */
const MISSING = new Set(['formNeedName', 'formNeedEmail', 'formNeedPhone', 'formNeedStreet'])

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
  const [activeUid, setActiveUid] = useState(draft.items[0].uid)
  const [removed, setRemoved] = useState<{ item: BuyItem; index: number; label: string } | null>(null)
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
  const editorBar = useRef<HTMLDivElement>(null)
  const [barStuck, setBarStuck] = useState(false)

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
    // Start from the top first: when the new step is shorter than the old scroll position, Linux
    // WebKit otherwise lands every later programmatic scroll (this one, focus, scrollIntoView)
    // short by the nav's offset until the page next reaches the top.
    window.scrollTo({ top: 0, behavior: 'instant' })
    navRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [step])
  useEffect(() => {
    const id = pendingErrorFocus.current
    if (!id) return
    const target = document.getElementById(id)
    if (!target || !target.getClientRects().length) return
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'center' })
    pendingErrorFocus.current = null
  }, [step, activeUid, errors])

  const multi = draft.items.length > 1
  const designReady = !!config?.enabled && !config.seasonOver && step === 0 && multi
  useEffect(() => {
    // The slim editor bar is the first row of its panel: once their tops differ, the bar is stuck.
    if (!designReady) return
    let frame = 0
    const measure = () => {
      const bar = editorBar.current
      const panel = bar?.parentElement
      if (bar && panel) setBarStuck(bar.getBoundingClientRect().top - panel.getBoundingClientRect().top > 1)
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure) }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    schedule()
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule) }
  }, [designReady, activeUid])

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
    // Toggling or clearing the name unpins the side, so an empty back never stays selected.
    if (partial.withName !== undefined || partial.backName?.trim() === '') setSides(current => { const next = { ...current }; delete next[uid]; return next })
    for (const field of ['color', 'finish'] as const) if (partial[field]) void api.metrics.track({ event: 'buy_choice', field, value: partial[field] }).catch(() => {})
    if (partial.withName !== undefined) void api.metrics.track({ event: 'buy_choice', field: 'name', value: partial.withName ? 'on' : 'off' }).catch(() => {})
    // A paid name on the back is the pet's name: it is asked once and identifies the ornament too.
    setDraft((current) => ({ ...current, items: current.items.map((item) => { if (item.uid !== uid) return item; const next = { ...item, ...partial }; return { ...next, petName: next.withName ? petNameFromBack(next.backName) : '' } }) }))
    const fields: Record<string, string> = { color: 'color', finish: 'finish', withName: 'back', backName: 'back', petName: 'pet', note: 'note', photos: 'photos' }; setErrors(current => { const next = { ...current }; Object.keys(partial).forEach(key => delete next[`${fields[key]}-${uid}`]); return next }); setServerError('')
  }
  function validate(currentStep: number) {
    const found: Record<string, string> = {}
    if (currentStep === 0) {
      if (!draft.items.length) found['buy-add'] = 'shopNeedItem'
      for (const item of draft.items) {
        if (!shopConfig.colors.some((option) => option.color === item.color && option.inStock)) found[`color-${item.uid}`] = 'shopChooseColor'
        if (!item.finish || (item.color && !shopConfig.colors.some(option => option.color === item.color && option.finish === item.finish && option.inStock))) found[`finish-${item.uid}`] = 'shopChooseFinish'
        if (item.withName && !paintedNameValid(item.backName)) found[`back-${item.uid}`] = item.backName ? 'paintedNameTooLong' : 'shopBackNameRequired'
      }
    }
    if (currentStep === 1) for (const item of draft.items) {
      if (!item.photos.length) found[`photos-${item.uid}`] = 'shopNeedPhotoShop'
    }
    if (currentStep === 2 && draft.deliveryKind === 'vienna' && (datesState !== 'ready' || !dates.some((date) => date.date === draft.deliveryDate))) found['buy-date'] = 'shopNeedDate'
    if (currentStep === 2 && draft.deliveryKind === 'market') {
      const day = pickupState === 'ready' ? pickupDays.find((entry) => entry.date === draft.deliveryDate) : undefined
      if (!day) found['buy-date'] = 'shopNeedPickupDay'
      else if (!pickupTimes(day).includes(draft.pickupTime)) found['buy-time'] = 'shopNeedPickupTime'
    }
    if (currentStep === 3) {
      if (!draft.customerName.trim()) found['buy-name'] = 'formNeedName'
      if (!draft.email.trim()) found['buy-email'] = 'formNeedEmail'
      else if (!EMAIL.test(draft.email.trim())) found['buy-email'] = 'invalidEmail'
      if (!draft.phone.trim()) found['buy-phone'] = 'formNeedPhone'
      else if (!phoneValid(draft.phone)) found['buy-phone'] = 'phoneInvalid'
      if (draft.deliveryKind === 'vienna' && !draft.line1.trim()) found['buy-line1'] = 'formNeedStreet'
      if (draft.deliveryKind === 'vienna' && !VIENNA_POSTAL.test(draft.postalCode.trim())) found['buy-postal'] = 'shopPostalInvalid'
    }
    if (currentStep === 4 && !draft.acceptTerms) found['buy-terms'] = 'shopNeedTerms'
    return found
  }
  function validateField(id: string) {
    const error = validate(3)[id]
    setErrors(current => { const next = { ...current }; if (error) next[id] = error; else if (!current[id]?.startsWith('api:')) delete next[id]; return next })
    setValidFields(current => error ? current.filter(value => value !== id) : [...new Set([...current, id])])
    const field = ({ 'buy-name': 'customerName', 'buy-email': 'email', 'buy-phone': 'phone', 'buy-line1': 'line1', 'buy-postal': 'postalCode' } as Record<string, string>)[id]
    if (error && field) void api.metrics.track({ event: 'buy_validation_error', step: 'delivery', field, code: MISSING.has(error) ? 'required' : 'invalid' }).catch(() => {})
  }
  /** First problem = first unfinished ornament, in the order its fields are asked. */
  function firstError(found: Record<string, string>) {
    const fields = ['color', 'finish', 'back', 'pet', 'photos', 'note']
    for (const item of draft.items) for (const field of fields) if (found[`${field}-${item.uid}`]) return `${field}-${item.uid}`
    return Object.keys(found)[0]
  }
  function showErrors(found: Record<string, string>) {
    setErrors(found)
    if (Object.keys(found).length) {
      const first = firstError(found)
      pendingErrorFocus.current = first
      const item = draft.items.find(entry => first.endsWith(`-${entry.uid}`))
      if (item) setActiveUid(item.uid)
    }
    return Object.keys(found).length > 0
  }
  function go(next: number) { void api.metrics.track({ event: 'buy_step', step: (['design', 'delivery', 'review'] as const)[next] }).catch(() => {}); didNavigate.current = true; setErrors({}); setServerError(''); setPreviewChoice(null); setRemoved(null); void navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { state: { buyStep: next } }) }
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
        items: draft.items.map((item) => ({ kind: 'custom', withName: item.withName, color: item.color || undefined, finish: item.finish || undefined, petName: item.withName ? petNameFromBack(item.backName) : '', backName: item.withName ? item.backName.trim() : undefined, note: item.note.trim() || undefined, photos: item.photos })),
      })
      // Only follow Stripe Checkout or a same-origin URL (the mock success page).
      const target = new URL(result.checkoutUrl, window.location.origin)
      if (target.origin !== window.location.origin && target.origin !== 'https://checkout.stripe.com') throw Object.assign(new Error('Unexpected checkout URL.'), { code: 'PAYMENT_PROVIDER' })
      try { sessionStorage.setItem('awg-checkout-pending', result.orderCode) } catch { /* storage unavailable */ }
      window.location.assign(target.href)
    } catch (error) {
      const problem = apiError(error, locale, t('shopCheckoutError')); const field = problem.field ?? ''; const match = field.match(/^items\[(\d+)\]\.(\w+)/); const item = match ? draft.items[Number(match[1])] : ['petName', 'backName', 'photos'].includes(field) ? draft.items[0] : undefined; const itemFields: Record<string, [number, string]> = { petName: [0, 'back'], photos: [1, 'photos'], color: [0, 'color'], finish: [0, 'finish'], backName: [0, 'back'], note: [1, 'note'] }; const simple: Record<string, [number, string]> = { customerName: [3, 'buy-name'], email: [3, 'buy-email'], phone: [3, 'buy-phone'], 'address.line1': [3, 'buy-line1'], 'address.line2': [3, 'buy-line2'], 'address.city': [3, 'buy-city'], address: [3, 'buy-line1'], 'address.postalCode': [3, 'buy-postal'], deliveryDate: [2, 'buy-date'], pickupTime: [2, 'buy-time'] }; const itemField = match?.[2] ?? field; const target = item && itemFields[itemField] && (itemField !== 'petName' || item.withName) ? [itemFields[itemField][0], `${itemFields[itemField][1]}-${item.uid}`] as const : simple[field];
      if (target) { go(target[0] < 2 ? 0 : 1); showErrors({ [target[1]]: (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') ? `api:${error.code}` : 'shopFixErrors' }) } else setServerError(problem.text)
      busyRef.current = false; setBusy(false)
    }
  }

  const stepProps = { t, draft, config, itemPrice, patch, patchItem, err, described, photoErrors: Object.fromEntries(Object.entries(photoErrors).map(([key, value]) => [key, value ? t(value) : ''])), addFiles, dates, datesState, setDatesRetry, pickupDays, pickupState, formatDate, serverError }

  const activeItem = draft.items.find(item => item.uid === activeUid) ?? draft.items[0]
  function next() {
    if (step === 2) { void pay(); return }
    if (step === 1) { const found = { ...validate(2), ...validate(3) }; if (!showErrors(found)) { setReturnReview(false); go(2) }; return }
    // One ornament is one page on every screen size: the whole design is checked at once.
    const found = { ...validate(0), ...validate(1) }
    if (!showErrors(found)) { if (returnReview) { setReturnReview(false); go(2) } else go(1) }
  }
  function back() {
    setReturnReview(false)
    if (step > 0) go(step - 1)
  }
  function selectItem(uid: string) {
    setActiveUid(uid); setPreviewChoice(null)
    requestAnimationFrame(() => {
      // With one ornament left there is no editor heading; land on its first choice instead.
      const heading = document.getElementById('ornament-editor-heading') ?? document.getElementById(`color-${uid}`)
      if (!heading) return
      heading.focus({ preventScroll: true })
      heading.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
  }
  function addItem() {
    if (draft.items.length >= shopConfig.maxItems) return
    const item = newItem()
    setRemoved(null)
    patch({ items: [...draft.items, item] })
    setActiveUid(item.uid); setPreviewChoice(null)
    // A new ornament starts at the top of the step, where its title and large preview are.
    requestAnimationFrame(() => {
      headingRef.current?.focus({ preventScroll: true })
      navRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
  }
  function removeItem(uid: string) {
    if (draft.items.length <= 1) return
    const index = draft.items.findIndex(item => item.uid === uid)
    const rest = draft.items.filter(item => item.uid !== uid)
    const gone = draft.items[index]
    // Keep the removed ornament (photos included) until the next step so one tap brings it back.
    setRemoved({ item: gone, index, label: `${t('ornamentN', { n: index + 1 })}${gone.petName.trim() ? ` – ${gone.petName.trim()}` : ''}` })
    patch({ items: rest })
    setErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => !key.endsWith(`-${uid}`))))
    setPhotoErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => key !== uid)))
    const nextUid = activeUid === uid ? rest[Math.min(index, rest.length - 1)].uid : activeUid
    setActiveUid(nextUid); setPreviewChoice(null)
    requestAnimationFrame(() => {
      // Focus moves to the remaining ornament, but the undo notice must stay in view.
      (document.getElementById('ornament-editor-heading') ?? document.getElementById(`color-${nextUid}`))?.focus({ preventScroll: true })
      document.getElementById('buy-undo')?.scrollIntoView({ block: 'center', behavior: 'instant' })
    })
  }
  function undoRemove() {
    if (!removed || draft.items.length >= shopConfig.maxItems) return
    const items = [...draft.items]
    items.splice(Math.min(removed.index, items.length), 0, removed.item)
    setRemoved(null)
    patch({ items })
    selectItem(removed.item.uid)
  }
  const activeIndex = draft.items.findIndex(item => item.uid === activeItem.uid)
  return <form data-public-page className={`${publicForm.page} ${styles.shop}`} noValidate onFocus={keepFormFocusVisible} onSubmit={(event) => { event.preventDefault(); next() }}>
    <PageHeader title={t('shopTitle')}>{step === 0 && <p>{t('shopLead')}</p>}</PageHeader>
    {storageError ? <p role="status">{t('shopStorageError')}</p> : null}
    {params.get('cancelled') ? <p className={styles.notice} role="status">{t('shopCancelled')}</p> : null}
    <div ref={navRef}><ProgressSteps labels={stepLabels} current={step} label={t('progress', { n: step + 1, total: stepLabels.length })} compact /></div>
    <section className={styles.step} aria-labelledby="buy-heading">
      <h2 id="buy-heading" ref={headingRef} tabIndex={-1}>{step === 0 ? draft.items.length > 1 ? t('designHeadingN', { n: activeIndex + 1, total: draft.items.length }) : t('designHeading') : stepLabels[step]}</h2>
      {step === 0 && <div className={styles.design}>
        <div data-public-preview className={styles.previewPane}>
          <OrnamentPreview key={activeItem.uid} item={{ ...activeItem, ...previewChoice }} side={sides[activeItem.uid]} onSideChange={side => setSides(current => ({ ...current, [activeItem.uid]: side }))} />
          <div className={styles.previewSummary}><span>{t('shopTotal')}</span><strong data-buy-total><AnimatedPrice value={total} locale={locale} /></strong></div>
        </div>
        <div className={styles.optionsPane}>
          {/* A single ornament needs no list: the editor comes first and adding another is offered at the end. */}
          {draft.items.length > 1 && <div className={styles.ornamentOverview}><OrnamentOverview items={draft.items.map(item => ({ ...item, price: itemPrice(item) }))} activeUid={activeItem.uid} maxItems={config.maxItems} onEdit={uid => { setActiveUid(uid); setPreviewChoice(null) }} onRemove={removeItem} onAdd={addItem} /></div>}
          {removed && <p id="buy-undo" className={styles.undo} role="status"><span>{t('multiRemoved', { ornament: removed.label })}</span><button type="button" className={styles.linkBtn} onClick={undoRemove}>{t('undo')}</button></p>}
          <div className={styles.itemPanel} key={activeItem.uid}>
            {/* Phones: the large preview scrolls away; this slim bar keeps saying which ornament is open. */}
            {draft.items.length > 1 && <div ref={editorBar} data-public-sticky className={styles.editorBar} data-stuck={barStuck}>
              <div data-public-sticky-content className={styles.editorBarContent}>
                <span className={styles.editorArt} aria-hidden="true"><OrnamentPreview item={{ ...activeItem, ...previewChoice }} static /></span>
                <h3 id="ornament-editor-heading" className={styles.editorHeading} tabIndex={-1}>{t('multiEditorHeading', { n: activeIndex + 1, total: draft.items.length })}{activeItem.petName.trim() ? ` – ${activeItem.petName.trim()}` : ''}</h3>
              </div>
            </div>}
            <BuyItemsStep {...stepProps} activeUid={activeItem.uid} preview={setPreviewChoice} />
            <div className={styles.petGroup}><BuyPetStep {...stepProps} activeUid={activeItem.uid} /></div>
          </div>
          {draft.items.length === 1 && <div className={styles.addSingle}><Button id="buy-add" variant="secondary" size="lg" fullWidth disabled={draft.items.length >= config.maxItems} onClick={addItem}>{t('multiAddAnother')}</Button></div>}
          {err('buy-add') && <p className={styles.error} role="alert">{err('buy-add')}</p>}
        </div>
      </div>}
      {step === 1 && <><BuyDateStep {...stepProps} /><div className={styles.deliveryContact}><BuyContactStep {...stepProps} withAddress={!pickup} validateField={validateField} validFields={validFields} /></div></>}
      {step === 2 && <BuyReviewStep {...stepProps} go={(index, uid, _sub, field) => { pendingErrorFocus.current = field ?? null; if (uid) setActiveUid(uid); setChangedSection(uid ?? (index === 3 ? 'contact' : 'delivery')); setReturnReview(true); go(index < 2 ? 0 : 1) }} itemsTotal={itemsTotal} deliveryFee={deliveryFee} total={total} changed={changedSection} />}
    </section>
    <aside hidden={step !== 1} className={styles.cart} aria-label={t('shopCart')}><h2>{t('shopCart')}</h2><CartRows t={t} count={draft.items.length} itemsTotal={itemsTotal} deliveryFee={deliveryFee} total={total} pickup={pickup} live /></aside>
    <FormActions className={styles.actions}><div className={styles.mobileTotal} hidden={step === 2}><span>{t('shopTotal')}</span><strong data-buy-total><AnimatedPrice value={total} locale={locale} /></strong></div>{step === 1 && <Button variant="secondary" disabled={busy} onClick={back}>{t('back')}</Button>}<Button type="submit" size="lg" disabled={busy} aria-busy={busy}>{step === 2 ? busy ? t('shopPaying') : t('shopPayStripe') : t('continue')}</Button>{step === 2 && <small className={styles.stripeLine}>{t('secureStripe')}</small>}{/* Review: paying comes first in reading order (phones stack the buttons); wider screens put Back on the left with CSS order. */}{step === 2 && <Button variant="secondary" className={styles.reviewBack} disabled={busy} onClick={back}>{t('back')}</Button>}</FormActions>
  </form>
}
