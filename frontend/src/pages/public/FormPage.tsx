import { paintedNameValid } from '../../lib/paintedName'
import { keepFormFocusVisible } from '../../lib/publicFormFocus'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../../api/client'
import type { CustomerFormView, OrderItem } from '../../domain/types'
import { useLocale } from '../../i18n/LocaleContext'
import { apiError } from '../../lib/apiError'
import { petNameFromBack } from '../../lib/petName'
import { phoneValid } from '../../lib/phone'
import { formatDateLabel, formatHour } from '../../lib/time'
import { deliveryDatePhrase } from '../../lib/deliveryWindow'
import { formDraftKey, restoreFormDraft, serializeFormDraft, type FormDraft, type FormItemDraft } from '../../lib/formDraft'
import { PublicPage, PageHeader, PublicState, ErrorSummary, FormActions } from '../../components/public/PublicForm'
import shell from '../../components/public/PublicForm.module.css'
import { ContactFields, type ContactValues } from '../../components/public/ContactFields'
import { OrnamentLoader } from '../../components/public/OrnamentLoader'
import { MAX_PHOTOS } from '../../components/public/PhotoTiles'
import { ProgressSteps } from '../../components/ui/ProgressSteps'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import { FormItems } from './form/FormItems'
import { FormReview } from './form/FormReview'
import styles from './FormPage.module.css'

type Step = 'details' | 'review'
type Terminal = 'expired' | 'invalid' | 'locked' | null
const empty: FormDraft = { customerName: '', phone: '', email: '', address: { line1: '', line2: '', postalCode: '', city: 'Wien' }, items: [] }
function targets(view: CustomerFormView): OrderItem[] {
  const custom = (view.items ?? [view.item]).filter(item => item.kind === 'custom')
  return custom.length ? custom : [view.item]
}
function fromView(view: CustomerFormView): FormDraft {
  return { customerName: view.customer.name === 'Walk-in' ? '' : view.customer.name, phone: view.customer.phone, email: view.customer.email,
    address: view.address ?? empty.address,
    items: targets(view).map(item => ({ orderItemId: item.id, petName: item.petName, backName: item.backName, note: item.note, photos: item.photos, photosNeedReload: false })),
  }
}
function terminalFor(error: unknown): Terminal {
  const problem = error as { code?: string; status?: number; message?: string } | null
  if (problem?.code === 'FORM_EXPIRED') return 'expired'
  if (problem?.code === 'FORM_LOCKED') return 'locked'
  if (problem?.status === 404 || problem?.code === 'NOT_FOUND' || problem?.message === 'This form link is not valid.') return 'invalid'
  return null
}

export function FormPage() {
  const { token = '' } = useParams()
  return <CustomerForm key={token} token={token} />
}

function CustomerForm({ token }: { token: string }) {
  const [searchParams] = useSearchParams()
  const staffHandoff = searchParams.get('staff') === '1'
  // One anonymous page view per form link; the stall iPad (?staff=1) is not a visitor.
  useEffect(() => { if (!staffHandoff) void api.metrics.track({ event: 'form_view' }).catch(() => {}) }, [staffHandoff])
  const { t, locale } = useLocale()
  const [view, setView] = useState<CustomerFormView | null>(null)
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [issue, setIssue] = useState<unknown>(null)
  const [terminal, setTerminal] = useState<Terminal>(null)
  const [step, setStep] = useState<Step>('details')
  const [draft, setDraft] = useState<FormDraft>(empty)
  // Store translation keys for local validation and translate server problems at render time.
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverField, setServerField] = useState<{ id: string; issue: unknown } | null>(null)
  const [validFields, setValidFields] = useState<string[]>([])
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({})
  const [reading, setReading] = useState(0)
  const [sending, setSending] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const navigate = useNavigate()
  const sendingRef = useRef(false)
  const uploads = useRef(new Set<string>())
  const focusRequest = useRef<string | null>('form-heading')
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let active = true
    api.forms.getForm(token).then(data => {
      if (!active) return
      const source = fromView(data)
      let restored = source
      try { const raw = sessionStorage.getItem(formDraftKey(token)); if (raw) restored = restoreFormDraft(raw, source) } catch { setStorageError(true) }
      setDraft(restored); setView(data); setTerminal(data.editable ? null : 'locked')
    }).catch(error => { if (active) { setIssue(error); setTerminal(terminalFor(error)) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, retry])

  useEffect(() => {
    if (loading || !view || terminal) return
    try { sessionStorage.setItem(formDraftKey(token), serializeFormDraft(draft)) } catch { const timer = window.setTimeout(() => setStorageError(true), 0); return () => window.clearTimeout(timer) }
  }, [draft, token, view, loading, step, terminal])

  useEffect(() => {
    if (loading) return
    if (terminal || !view) { const title = document.querySelector<HTMLElement>('main h1'); if (title) { title.tabIndex = -1; title.focus() }; return }
    const id = focusRequest.current
    if (id) {
      const field = document.getElementById(id) ?? document.getElementById(id.replace('photos-', 'photos-block-'))
      const details = field?.closest('details')
      if (details) details.open = true
      field?.focus(); focusRequest.current = null
    }
  }, [loading, terminal, step, errors, serverField, view])

  useEffect(() => {
    const title = loading ? t('formTitle') : terminal ? t(`form${terminal === 'expired' ? 'Expired' : terminal === 'invalid' ? 'Invalid' : 'Locked'}Title`) : step === 'review' ? t('formReviewStep') : t((view?.items ?? (view ? [view.item] : [])).length > 1 ? 'formTitleMany' : 'formTitle')
    document.title = `${title} · ${t('brand')}`
  }, [loading, terminal, step, view, t])

  const formItems = view ? targets(view) : []
  const displayedErrors = { ...Object.fromEntries(Object.entries(errors).map(([id, key]) => [id, t(key)])), ...(serverField ? { [serverField.id]: apiError(serverField.issue, locale, t('shopFixErrors')).text } : {}) }
  const allItems = view ? view.items ?? [view.item] : []
  const summaryErrors = Object.fromEntries(Object.entries(displayedErrors).map(([id, message]) => {
    const index = allItems.findIndex(item => ['pet', 'back', 'photos', 'note'].some(prefix => id === `${prefix}-${item.id}`))
    return [id, `${message}${allItems.length > 1 && index >= 0 ? ` · ${t('ornamentN', { n: index + 1 })}` : ''}`]
  }))
  const handoffs = [...new Set((view?.handoffs ?? []).map(handoff => handoff.kind === 'vienna'
    ? [t('whenVienna'), handoff.date ? deliveryDatePhrase(handoff.date, locale) : ''].filter(Boolean).join(' · ')
    : handoff.kind === 'unknown' ? t('whenTbd')
      : [handoff.marketName, handoff.date ? formatDateLabel(handoff.date, locale === 'de' ? 'de-AT' : 'en-GB') : '', handoff.fromHour != null ? t('whenFrom', { time: formatHour(handoff.fromHour) }) : ''].filter(Boolean).join(' · ')))]

  function clear(ids: string[]) {
    setValidFields(current => current.filter(id => !ids.includes(id)))
    setErrors(current => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.includes(id))))
    setServerField(current => current && ids.includes(current.id) ? null : current)
    setIssue(null)
  }
  function patchItem(id: string, partial: Partial<FormItemDraft>) {
    // A paid name on the back is the pet's name (same rule as /buy): it is asked once.
    const named = !!view && targets(view).find(source => source.id === id)?.withName
    setDraft(current => ({ ...current, items: current.items.map(item => { if (item.orderItemId !== id) return item; const next = { ...item, ...partial }; return named ? { ...next, petName: petNameFromBack(next.backName) } : next }) }))
    clear(Object.keys(partial).map(key => `${({ petName: 'pet', backName: 'back' } as Record<string, string>)[key] ?? key}-${id}`))
  }
  function patchContact(partial: Partial<ContactValues>) {
    const ids: Record<string, string> = { customerName: 'name', postalCode: 'postal' }
    clear(Object.keys(partial).map(key => `form-${ids[key] ?? key}`))
    setDraft(current => ({ ...current, customerName: partial.customerName ?? current.customerName, email: partial.email ?? current.email, phone: partial.phone ?? current.phone,
      address: { ...current.address, ...Object.fromEntries(Object.entries(partial).filter(([key]) => ['line1', 'line2', 'postalCode', 'city'].includes(key))) } }))
  }
  function validate(): Record<string, string> {
    const found: Record<string, string> = {}
    for (const item of draft.items) {
      const named = formItems.find(source => source.id === item.orderItemId)?.withName
      if (named && !paintedNameValid(item.backName)) found[`back-${item.orderItemId}`] = item.backName ? 'formPaintedNameTooLong' : 'formNeedBackName'
      if (!item.photos.length) found[`photos-${item.orderItemId}`] = 'shopNeedPhotoShop'
    }
    if (!draft.customerName.trim()) found['form-name'] = 'formNeedName'
    if (!draft.email.trim()) found['form-email'] = 'formNeedEmail'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) found['form-email'] = 'invalidEmail'
    if (!draft.phone.trim()) found['form-phone'] = 'formNeedPhone'
    else if (!phoneValid(draft.phone)) found['form-phone'] = 'phoneInvalid'
    if (view?.needsAddress) {
      if (!draft.address.line1.trim()) found['form-line1'] = 'formNeedStreet'
      if (!/^1(0[1-9]|1[0-9]|2[0-3])0$/.test(draft.address.postalCode.trim())) found['form-postal'] = 'shopPostalInvalid'
      if (!draft.address.city.trim()) found['form-city'] = 'required'
    }
    return found
  }
  function validateField(id: string) {
    const key = validate()[id]
    setValidFields(current => key ? current.filter(value => value !== id) : [...new Set([...current, id])])
    setErrors(current => { const next = { ...current }; if (key) next[id] = key; else delete next[id]; return next })
  }
  function showErrors(found: Record<string, string>): boolean {
    if (!Object.keys(found).length) return false
    focusRequest.current = Object.keys(found)[0]; setErrors(found); setServerField(null); setStep('details'); return true
  }
  function edit(id: string) { focusRequest.current = id; setErrors({}); setStep('details') }
  async function addFiles(id: string, files: File[]) {
    if (uploads.current.has(id)) return
    const current = draft.items.find(item => item.orderItemId === id)
    if (!current) return
    uploads.current.add(id); setReading(count => count + 1)
    const room = MAX_PHOTOS - current.photos.length
    try {
      const results = await Promise.allSettled(files.slice(0, room).map(file => api.uploads.toPhoto(file)))
      const photos = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
      setDraft(previous => ({ ...previous, items: previous.items.map(item => item.orderItemId === id ? { ...item, photos: [...item.photos, ...photos].slice(0, MAX_PHOTOS), photosNeedReload: photos.length ? false : item.photosNeedReload } : item) }))
      if (photos.length) clear([`photos-${id}`])
      setPhotoErrors(previous => ({ ...previous, [id]: results.some(result => result.status === 'rejected') ? files.slice(0, room).some(file => file.size > 10 * 1024 * 1024) ? 'photoTooLarge' : 'photoInvalid' : files.length > room ? 'shopPhotoLimit' : '' }))
    } finally { uploads.current.delete(id); setReading(count => count - 1) }
  }
  async function submit() {
    if (sendingRef.current || uploads.current.size || showErrors(validate())) return
    sendingRef.current = true; setSending(true); setIssue(null)
    try {
      const result = await api.forms.submitForm(token, { address: view?.needsAddress ? draft.address : undefined, customerName: draft.customerName, phone: draft.phone, email: draft.email,
        items: draft.items.map(({ orderItemId, petName, backName, note, photos }) => ({ orderItemId, petName: formItems.find(source => source.id === orderItemId)?.withName && backName.trim() ? petNameFromBack(backName) : petName, backName, note, photos })),
      }, { rememberToken: !staffHandoff })
      try { sessionStorage.removeItem(formDraftKey(token)) } catch { setStorageError(true) }
      // The Track page already shows the order state: go there and confirm the save once.
      // The stall iPad keeps ?staff=1 on Track too, so its redirect is not counted as a customer visit.
      void navigate(`/track/${encodeURIComponent(result.orderCode)}${staffHandoff ? '?staff=1' : ''}`, { replace: true, state: { formSaved: true } })
    } catch (error) {
      const terminal = terminalFor(error)
      if (terminal) { setTerminal(terminal); setIssue(error); return }
      const field = apiError(error, locale, t('formSaveError')).field ?? ''
      const match = field.match(/^items\[(\d+)\]\.(\w+)/)
      const item = match ? draft.items[Number(match[1])] : ['photos', 'petName', 'backName'].includes(field) ? draft.items[0] : undefined
      const name = match?.[2] ?? field
      const itemIds: Record<string, string> = { petName: 'back', backName: 'back', note: 'note', photos: 'photos' }
      const contactIds: Record<string, string> = { customerName: 'form-name', phone: 'form-phone', email: 'form-email', address: 'form-line1', 'address.line1': 'form-line1', 'address.line2': 'form-line2', 'address.postalCode': 'form-postal', 'address.city': 'form-city' }
      const id = item && itemIds[name] ? `${itemIds[name]}-${item.orderItemId}` : contactIds[field]
      if (id) { focusRequest.current = id; setErrors({}); setServerField({ id, issue: error }); setStep('details') } else setIssue(error)
    } finally { sendingRef.current = false; setSending(false) }
  }

  if (loading) return <PublicPage><OrnamentLoader /></PublicPage>
  if (terminal || !view) return <PublicState title={t(terminal === 'expired' ? 'formExpiredTitle' : terminal === 'invalid' ? 'formInvalidTitle' : terminal === 'locked' ? 'formLockedTitle' : 'formLoadTitle')} error={terminal !== 'locked'}>
    <p>{terminal ? t(`formState_${terminal}`) : apiError(issue, locale, t('formLoadError')).text}</p>
    {!terminal && <Button onClick={() => { setLoading(true); setIssue(null); setTerminal(null); focusRequest.current = 'form-heading'; setRetry(value => value + 1) }}>{t('shopRetry')}</Button>}
    {view && terminal === 'locked' ? <ButtonLink to={`/track/${encodeURIComponent(view.orderCode)}`}>{t('goTrack')}</ButtonLink> : <ButtonLink to="/">{t('backHome')}</ButtonLink>}
  </PublicState>

  const ornamentCount = allItems.length
  const stepLabels = [t(ornamentCount > 1 ? 'formOrnamentsMany' : 'formOrnamentsOne'), t('formReviewStep')]
  return <form data-public-page className={`${shell.page} ${styles.form}`} noValidate onFocus={keepFormFocusVisible} onSubmit={event => { event.preventDefault(); if (uploads.current.size) return; if (step === 'review') void submit(); else if (!showErrors(validate())) { setErrors({}); setServerField(null); focusRequest.current = 'form-heading'; setStep('review') } }}>
    <PageHeader title={t(ornamentCount > 1 ? 'formTitleMany' : 'formTitle')}><p>{t('formLead')}</p></PageHeader>
    <ProgressSteps labels={stepLabels} current={step === 'details' ? 0 : 1} label={t('progress', { n: step === 'details' ? 1 : 2, total: 2 })} compact />
    {storageError && <p className={styles.muted} role="status">{t('shopStorageError')}</p>}
    {issue != null && <p className={styles.error} role="alert">{apiError(issue, locale, t('formSaveError')).text}</p>}
    <section className={styles.step} aria-labelledby="form-heading">
      <header className={styles.stepHeader}>
        <h2 ref={heading} id="form-heading" tabIndex={-1}>{step === 'details' ? stepLabels[0] : stepLabels[1]}</h2>
        {step === 'details' && <p className={styles.muted}>{t('formCanEdit')}</p>}
      </header>
      <ErrorSummary errors={summaryErrors} onFocus={id => { const control = document.getElementById(id) ?? document.getElementById(id.replace('photos-', 'photos-block-')); const details = control?.closest('details'); if (details) details.open = true; control?.focus() }} />
      {step === 'details' ? <div className={styles.details}>
        <div className={styles.ornaments}><FormItems items={view.items ?? [view.item]} draft={draft.items} errors={displayedErrors} photoErrors={Object.fromEntries(Object.entries(photoErrors).map(([id, key]) => [id, key ? t(key) : '']))} patch={patchItem} addFiles={addFiles} validate={validateField} /></div>
        <div className={styles.contact}><ContactFields prefix="form" values={{ ...draft, ...draft.address, line2: draft.address.line2 ?? '' }} onChange={patchContact} error={id => displayedErrors[id]} onBlur={validateField} withAddress={view.needsAddress} announceErrors={false} validFields={validFields} deliveryPhone={view.needsAddress} /></div>
      </div> : <FormReview view={view} draft={draft} handoffs={handoffs} edit={edit} />}
    </section>
    <FormActions className={step === 'review' ? styles.reviewActions : ''}>
      {/* Keep blur validation from moving the button before a mouse click submits. */}
      <Button type="submit" size="lg" disabled={sending || reading > 0} aria-busy={sending || reading > 0} onMouseDown={event => event.preventDefault()}>{reading ? t('photoReading') : sending ? t('formSending') : step === 'details' ? t('continue') : t('send')}</Button>
      {step === 'review' && <Button className={styles.back} variant="secondary" size="lg" disabled={sending} onClick={() => { setErrors({}); focusRequest.current = 'form-heading'; setStep('details') }}>{t('back')}</Button>}
    </FormActions>
  </form>
}
