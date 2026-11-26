import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/client'
import type { InventoryItem, PostCollectionDay, PostCollectionWeekday, Prices } from '../../domain/types'
import { Button } from '../../components/ui/Button'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { StaffText } from '../../components/staff/StaffText'
import { MarketStock } from './MarketStock'
import { NumberStepper } from '../../components/staff/NumberStepper'
import { formatStaffShortDate } from '../../lib/postShipping'
import { parseEuroAmount } from '../../lib/staffInput'
import { BACK_NAME_MAX_LIMIT, DEFAULT_BACK_NAME_MAX } from '../../lib/paintedName'
import { useStaffClock } from '../../lib/staffClock'
import { addUtcDays } from '../../lib/time'
import { ORNAMENT_SIZES, sizeLabel } from '../../lib/ornamentSize'
import styles from './SettingsRows.module.css'

const LOAD_ERROR = 'Could not load prices and stock. Check the connection and try again.'

const POST_WEEKDAYS: { value: PostCollectionWeekday; label: string; full: string }[] = [
  { value: 'monday', label: 'Mon', full: 'Monday' },
  { value: 'tuesday', label: 'Tue', full: 'Tuesday' },
  { value: 'wednesday', label: 'Wed', full: 'Wednesday' },
  { value: 'thursday', label: 'Thu', full: 'Thursday' },
  { value: 'friday', label: 'Fri', full: 'Friday' },
]

export function InventoryPage() {
  const [rows, setRows] = useState<InventoryItem[]>([])
  const [prices, setPrices] = useState<Prices | null>(null)
  const [pricesVersion, setPricesVersion] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const custom = rows.filter(row => row.kind === 'custom')
  const colors = [...new Set(custom.map(row => row.color))]
  const legacy = (color: InventoryItem['color']) => color === 'grey' || color === 'white'
  const colorCards = (old: boolean) => colors.filter(color => legacy(color) === old).map(color => <article key={color} className={styles.stockCard} aria-label={`${color} bases`}>
    <h2><span className={styles.swatch} style={{ background: `var(--ornament-${color})` }} role="img" aria-label={`${color}`} /></h2>
    {/* Bases are counted per size: Big first, then Medium, each with its Shiny and Matte rows. */}
    {ORNAMENT_SIZES.map(size => {
      const sized = custom.filter(row => row.color === color && (row.size ?? 'big') === size)
      return sized.length ? [<p key={size} className={styles.sizeLabel}>{sizeLabel(size)}</p>, ...sized.map(row => <StockRow key={row.id} item={row} />)] : null
    })}
  </article>)
  useEffect(() => {
    let active = true
    // Prices and stock load together; nothing editable renders until both have arrived.
    Promise.all([api.prices.get(), api.inventory.list()])
      .then(([nextPrices, nextRows]) => { if (active) { setPrices(nextPrices); setRows(nextRows); setError('') } })
      .catch(() => { if (active) setError(LOAD_ERROR) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])
  return <section className={styles.page}>
    <StaffBackLink to="/staff/agenda" label="Agenda" /><h1>Stock</h1>
    <MarketStock />
    {loading && <p role="status">Loading prices and stock…</p>}
    {error && <div role="alert"><p>{error}</p><Button tone="staff" onClick={() => { setLoading(true); setError(''); setRetry(n => n + 1) }}>Try again</Button></div>}
    {!loading && !error && prices && !custom.length && <p>No custom stock configured.</p>}
    {prices && <div className={styles.list}>
      <PricesCard initial={prices} onSaved={() => setPricesVersion(n => n + 1)} />
      <CollectionOverridesCard refreshKey={pricesVersion} />
      {colors.some(color => !legacy(color)) && <h2>Custom bases</h2>}
      {colorCards(false)}
      {colors.some(legacy) && <><h2>No longer sold</h2>{colorCards(true)}</>}
    </div>}
  </section>
}

type PriceField = 'customPrice' | 'customMediumPrice' | 'finishedPrice' | 'nameExtra' | 'shippingFee' | 'backNameMax'
type PriceDraft = Record<PriceField, string>

const PRICE_FIELDS: { key: PriceField; label: string; id: string; unit: 'euro' | 'letters' }[] = [
  { key: 'customPrice', label: 'Custom · Big 10 cm', id: 'price-custom', unit: 'euro' },
  { key: 'customMediumPrice', label: 'Custom · Medium 8 cm', id: 'price-custom-medium', unit: 'euro' },
  { key: 'finishedPrice', label: 'Finished ornament', id: 'price-finished', unit: 'euro' },
  { key: 'nameExtra', label: 'Name on the back (extra)', id: 'price-name', unit: 'euro' },
  { key: 'backNameMax', label: 'Name on the back (max. letters)', id: 'price-name-max', unit: 'letters' },
  { key: 'shippingFee', label: 'Post shipping', id: 'price-shipping', unit: 'euro' },
]
const MAX_PRICE = 999.99
const MAX_SHIPPING_FEE = 99.99

/** Parses a draft: whole letters for the back-name limit, euros for the rest. */
function parseField(field: PriceField, text: string): number {
  if (field === 'backNameMax') return /^\s*\d+\s*$/.test(text) ? Number(text.trim()) : Number.NaN
  return parseEuroAmount(text)
}

/** The message for a draft that the server would reject, or null when it can be sent. */
function priceError(field: PriceField, text: string): string | null {
  const value = parseField(field, text)
  if (field === 'backNameMax') return value >= 1 && value <= BACK_NAME_MAX_LIMIT ? null : `Enter a whole number from 1 to ${BACK_NAME_MAX_LIMIT}.`
  if (field === 'shippingFee') return Number.isFinite(value) && value >= 0 && value <= MAX_SHIPPING_FEE ? null : 'Enter an amount from 0.00 to 99.99.'
  if (field === 'nameExtra') return Number.isFinite(value) && value >= 0 && value <= MAX_PRICE ? null : 'Enter an amount from 0.00 to 999.99.'
  return Number.isFinite(value) && value >= 0.5 && value <= MAX_PRICE ? null : 'Enter a price from 0.50 to 999.99.'
}

function normalizeWeekdays(days?: PostCollectionWeekday[]): PostCollectionWeekday[] {
  const allowed = new Set(days ?? ['tuesday', 'friday'])
  return POST_WEEKDAYS.map(d => d.value).filter(d => allowed.has(d))
}

function draftFrom(prices: Prices): PriceDraft {
  return {
    customPrice: prices.customPrice.toFixed(2),
    customMediumPrice: prices.customMediumPrice.toFixed(2),
    finishedPrice: prices.finishedPrice.toFixed(2),
    nameExtra: prices.nameExtra.toFixed(2),
    shippingFee: (prices.shippingFee ?? 5).toFixed(2),
    backNameMax: String(prices.backNameMax ?? DEFAULT_BACK_NAME_MAX),
  }
}

function sameWeekdays(a: PostCollectionWeekday[], b: PostCollectionWeekday[]): boolean {
  return a.length === b.length && a.every((day, index) => day === b[index])
}

type QueuedPrices = {
  customPrice: number
  customMediumPrice: number
  finishedPrice: number
  nameExtra: number
  shippingFee: number
  backNameMax: number
  postCollectionDays: PostCollectionWeekday[]
  editSeq: number
}

function PricesCard({ initial, onSaved }: { initial: Prices; onSaved: () => void }) {
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState<PriceDraft>(() => draftFrom(initial))
  const [weekdays, setWeekdays] = useState<PostCollectionWeekday[]>(() => normalizeWeekdays(initial.postCollectionDays))
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [alert, setAlert] = useState('')
  const savedRef = useRef(initial)
  const editSeqRef = useRef(0)
  const queueRef = useRef<QueuedPrices | null>(null)
  const pendingPayloadRef = useRef<QueuedPrices | null>(null)
  const runningRef = useRef(false)
  const timerRef = useRef<number | undefined>(undefined)
  const flushRef = useRef<() => void>(() => {})
  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const errors = Object.fromEntries(PRICE_FIELDS.map(field => [field.key, priceError(field.key, draft[field.key])])) as Record<PriceField, string | null>
  const weekdayError = weekdays.length === 0 ? 'Choose at least one collection weekday.' : null

  function buildPayload(nextDraft: PriceDraft, nextWeekdays: PostCollectionWeekday[], allowSavedPriceFallback: boolean): QueuedPrices | null {
    if (!nextWeekdays.length) return null
    const current = savedRef.current
    const resolve = (field: PriceField, fallback: number) => {
      if (priceError(field, nextDraft[field]) === null) return parseField(field, nextDraft[field])
      return allowSavedPriceFallback ? fallback : Number.NaN
    }
    const customPrice = resolve('customPrice', current.customPrice)
    const customMediumPrice = resolve('customMediumPrice', current.customMediumPrice)
    const finishedPrice = resolve('finishedPrice', current.finishedPrice)
    const nameExtra = resolve('nameExtra', current.nameExtra)
    const shippingFee = resolve('shippingFee', current.shippingFee ?? 5)
    const backNameMax = resolve('backNameMax', current.backNameMax ?? DEFAULT_BACK_NAME_MAX)
    if (![customPrice, customMediumPrice, finishedPrice, nameExtra, shippingFee, backNameMax].every(Number.isFinite)) return null
    return {
      customPrice,
      customMediumPrice,
      finishedPrice,
      nameExtra,
      shippingFee,
      backNameMax,
      postCollectionDays: nextWeekdays,
      editSeq: editSeqRef.current,
    }
  }

  function differsFromSaved(payload: QueuedPrices): boolean {
    const current = savedRef.current
    const savedDays = normalizeWeekdays(current.postCollectionDays)
    const sameMoney = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100)
    return (
      !sameMoney(payload.customPrice, current.customPrice) ||
      !sameMoney(payload.customMediumPrice, current.customMediumPrice) ||
      !sameMoney(payload.finishedPrice, current.finishedPrice) ||
      !sameMoney(payload.nameExtra, current.nameExtra) ||
      !sameMoney(payload.shippingFee, current.shippingFee ?? 5) ||
      payload.backNameMax !== (current.backNameMax ?? DEFAULT_BACK_NAME_MAX) ||
      !sameWeekdays(payload.postCollectionDays, savedDays)
    )
  }

  async function flush() {
    if (runningRef.current) return
    runningRef.current = true
    try {
      while (queueRef.current) {
        const next = queueRef.current
        queueRef.current = null
        if (!differsFromSaved(next)) {
          if (mountedRef.current && next.editSeq === editSeqRef.current && timerRef.current === undefined) {
            setState('saved')
          }
          continue
        }
        if (mountedRef.current) {
          setState('saving')
          setAlert('')
        }
        try {
          const updated = await api.prices.update({
            customPrice: next.customPrice,
            customMediumPrice: next.customMediumPrice,
            finishedPrice: next.finishedPrice,
            nameExtra: next.nameExtra,
            shippingFee: next.shippingFee,
            backNameMax: next.backNameMax,
            postCollectionDays: next.postCollectionDays,
            expectedRevision: savedRef.current.revision,
          })
          savedRef.current = updated
          if (!mountedRef.current) continue
          setSaved(updated)
          onSaved()
          if (next.editSeq !== editSeqRef.current) continue
          setDraft(draftFrom(updated))
          setWeekdays(normalizeWeekdays(updated.postCollectionDays))
          setState(queueRef.current || timerRef.current !== undefined ? 'saving' : 'saved')
        } catch (err) {
          if ((err as { code?: string }).code === 'PRICES_CHANGED') {
            window.clearTimeout(timerRef.current)
            timerRef.current = undefined
            queueRef.current = null
            pendingPayloadRef.current = null
            try {
              const fresh = await api.prices.get()
              savedRef.current = fresh
              if (mountedRef.current) {
                setSaved(fresh)
                setDraft(draftFrom(fresh))
                setWeekdays(normalizeWeekdays(fresh.postCollectionDays))
                setState('error')
                setAlert('Someone else changed the prices or collection days. The current values are shown; check them and edit again if needed.')
              }
            } catch {
              if (mountedRef.current) {
                setState('error')
                setAlert('Could not load the current prices. Check the connection and try again.')
              }
            }
          } else if (mountedRef.current && next.editSeq === editSeqRef.current) {
            pendingPayloadRef.current = next
            setState('error')
            setAlert(err instanceof Error ? err.message : 'Could not save prices. Try again.')
          }
        }
      }
    } finally {
      runningRef.current = false
    }
  }

  useEffect(() => {
    flushRef.current = () => { void flush() }
  })

  // Flush any pending debounced price edit when leaving the page.
  useEffect(() => () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current)
      timerRef.current = undefined
      if (pendingPayloadRef.current) {
        queueRef.current = pendingPayloadRef.current
        pendingPayloadRef.current = null
        flushRef.current()
      }
    }
  }, [])

  function scheduleSave(payload: QueuedPrices | null, wait: number) {
    window.clearTimeout(timerRef.current)
    timerRef.current = undefined
    if (!payload) {
      queueRef.current = null
      pendingPayloadRef.current = null
      setState('idle')
      return
    }
    if (!differsFromSaved(payload)) {
      queueRef.current = null
      pendingPayloadRef.current = null
      setAlert('')
      setState(saved.revision > initial.revision ? 'saved' : 'idle')
      return
    }
    setAlert('')
    setState('saving')
    if (wait === 0) {
      pendingPayloadRef.current = null
      queueRef.current = payload
      void flush()
      return
    }
    pendingPayloadRef.current = payload
    timerRef.current = window.setTimeout(() => {
      timerRef.current = undefined
      if (pendingPayloadRef.current) {
        queueRef.current = pendingPayloadRef.current
        pendingPayloadRef.current = null
        void flush()
      }
    }, wait)
  }

  function edit(field: PriceField, text: string) {
    const nextDraft = { ...draft, [field]: text }
    setDraft(nextDraft)
    editSeqRef.current += 1
    scheduleSave(buildPayload(nextDraft, weekdays, false), 400)
  }

  function tidy(field: PriceField) {
    if (priceError(field, draft[field]) === null) {
      const value = parseField(field, draft[field])
      const nextDraft = { ...draft, [field]: field === 'backNameMax' ? String(value) : value.toFixed(2) }
      setDraft(nextDraft)
      if (timerRef.current !== undefined) {
        scheduleSave(buildPayload(nextDraft, weekdays, false), 0)
      }
    }
  }

  function toggleWeekday(day: PostCollectionWeekday) {
    const has = weekdays.includes(day)
    const raw = has ? weekdays.filter(d => d !== day) : [...weekdays, day]
    const nextWeekdays = POST_WEEKDAYS.map(entry => entry.value).filter(value => raw.includes(value))
    setWeekdays(nextWeekdays)
    editSeqRef.current += 1
    // Weekday chips autosave immediately (falling back to saved prices if a price input is mid-edit and invalid).
    scheduleSave(buildPayload(draft, nextWeekdays, true), 0)
  }

  return <article className={styles.stockCard} aria-labelledby="prices-heading">
    <h2 id="prices-heading">Prices &amp; Post</h2>
    <p className={styles.hint}>New prices, the name limit and Post collection days apply to new sales and the web shop. Existing orders keep their price and name. Changes save automatically.</p>
    <div className={styles.priceFields}>
      {PRICE_FIELDS.map(field => {
        const problem = errors[field.key]
        return <div key={field.key} className={styles.priceField}>
          <label htmlFor={field.id}>{field.label}</label>
          <div className={styles.euroBox}>
            {field.unit === 'euro' && <span aria-hidden="true">€</span>}
            <input
              id={field.id}
              inputMode={field.unit === 'euro' ? 'decimal' : 'numeric'}
              autoComplete="off"
              value={draft[field.key]}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? `${field.id}-error` : undefined}
              onChange={event => edit(field.key, event.target.value)}
              onBlur={() => tidy(field.key)}
            />
            {field.unit === 'letters' && <span aria-hidden="true">letters</span>}
          </div>
          {problem && <p id={`${field.id}-error`} className={styles.fieldError}>{problem}</p>}
        </div>
      })}
      <fieldset className={styles.weekdayGroup}>
        <legend>Post collection weekdays</legend>
        <p className={styles.hint}>Austrian public holidays automatically shift to the next working day.</p>
        <div className={styles.weekdayChips}>
          {POST_WEEKDAYS.map(day => {
            const checked = weekdays.includes(day.value)
            return <label key={day.value} className={styles.weekdayChip} data-selected={checked || undefined}>
              <input
                type="checkbox"
                checked={checked}
                aria-label={day.full}
                onChange={() => toggleWeekday(day.value)}
              />
              <span>{day.label}</span>
            </label>
          })}
        </div>
        {weekdayError && <p className={styles.fieldError} role="alert">{weekdayError}</p>}
      </fieldset>
    </div>
    <p className={styles.priceStatus} role="status">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : ''}</p>
    {alert && <p className={styles.error} role="alert">
      {alert}
      {pendingPayloadRef.current && <Button tone="staff" variant="secondary" onClick={() => {
        if (!pendingPayloadRef.current) return
        queueRef.current = pendingPayloadRef.current
        pendingPayloadRef.current = null
        void flush()
      }}>Retry</Button>}
    </p>}
  </article>
}

function CollectionOverridesCard({ refreshKey }: { refreshKey: number }) {
  const clock = useStaffClock()
  const from = clock.date
  const to = clock.date > '2026-12-24' ? addUtcDays(clock.date, 45) : '2026-12-24'
  const [days, setDays] = useState<PostCollectionDay[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dateInput, setDateInput] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    api.shipping.collectionDays(from, to)
      .then(list => { if (active) { setDays(list); setError('') } })
      .catch(() => { if (active) setError('Could not load Post collection overrides.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [from, to, refreshKey, reload])

  async function applyOverride(date: string, open: boolean | null) {
    if (busy || !date) return
    setBusy(true); setError(''); setStatus('')
    try {
      await api.shipping.setCollectionDay(date, open)
      setReload(n => n + 1)
      if (open === true) { setStatus(`Added extra collection on ${formatStaffShortDate(date)}.`); setDateInput('') }
      else if (open === false) { setStatus(`Cancelled collection on ${formatStaffShortDate(date)}.`); setDateInput('') }
      else setStatus(`Removed override for ${formatStaffShortDate(date)}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update collection date.')
    } finally {
      setBusy(false)
    }
  }

  const overrides = days.filter(day => day.override !== null)
  const upcoming = days.filter(day => day.open).slice(0, 4)

  return <article className={styles.stockCard} aria-labelledby="overrides-heading">
    <h2 id="overrides-heading">Post collection overrides</h2>
    {upcoming.length > 0 && <p className={styles.hint}><StaffText>{`Next collections: ${upcoming.map(day => formatStaffShortDate(day.date)).join(' · ')}`}</StaffText></p>}
    <div className={styles.overrideForm}>
      <div className={styles.priceField}>
        <label htmlFor="post-override-date">Date</label>
        <input
          id="post-override-date"
          type="date"
          className={styles.dateInput}
          value={dateInput}
          min={from}
          disabled={busy}
          onChange={event => { setDateInput(event.target.value); setError(''); setStatus('') }}
        />
      </div>
      <div className={styles.overrideButtons}>
        <Button tone="staff" variant="secondary" disabled={busy || !dateInput} onClick={() => void applyOverride(dateInput, true)}>Add extra date</Button>
        <Button tone="staff" variant="secondary" disabled={busy || !dateInput} onClick={() => void applyOverride(dateInput, false)}>Cancel date</Button>
      </div>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {status && <p className={styles.priceStatus} role="status">{status}</p>}
    {loading && !days.length ? (
      <p className={styles.hint} role="status">Loading collection dates…</p>
    ) : overrides.length === 0 ? (
      <p className={styles.hint}>No date overrides set.</p>
    ) : (
      <ul className={styles.overrideList} aria-label="Post collection date overrides">
        {overrides.map(day => (
          <li key={day.date} className={styles.overrideRow}>
            <div className={styles.overrideInfo}>
              <strong>{formatStaffShortDate(day.date)}</strong>
              <span className={styles.overrideTag} data-open={day.override ? 'true' : 'false'}>
                {day.override ? 'Extra collection' : 'Cancelled'}
              </span>
            </div>
            <Button tone="staff" variant="ghost" disabled={busy} aria-label={`Remove override for ${formatStaffShortDate(day.date)}`} onClick={() => void applyOverride(day.date, null)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
    )}
  </article>
}

function StockRow({ item }: { item: InventoryItem }) {
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [saved, setSaved] = useState(item.quantity)
  const [conflict, setConflict] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const value = Number(quantity)
  const valid = quantity.trim() !== '' && Number.isInteger(value) && value >= 0 && value <= 10000
  const name = `Custom · ${item.color} · ${item.finish ?? 'shiny'} · ${sizeLabel(item.size ?? 'big')}`
  async function save() {
    if (busy) return
    if (!valid) { setError('Enter a whole number from 0 to 10000.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api.inventory.update(item.id, value, saved)
      setQuantity(String(result.quantity)); setSaved(result.quantity); setConflict(null); setNotice('Saved')
    } catch (err) {
      if ((err as { code?: string }).code === 'STOCK_CHANGED') {
        try {
          const fresh = (await api.inventory.list()).find(row => row.id === item.id)
          if (!fresh) throw new Error('Stock row no longer exists.')
          setSaved(fresh.quantity); setConflict(fresh.quantity)
          setError(`Stock changed. Server now has ${fresh.quantity} (you typed ${quantity}). Choose which value to keep.`)
        } catch (reloadError) { setError(reloadError instanceof Error ? reloadError.message : 'Could not reload stock. Retry.') }
      } else setError(err instanceof Error ? err.message : 'Could not save stock. Retry.')
    } finally { setBusy(false) }
  }
  const dirty = valid && value !== saved
  return <div className={styles.stockRow} role="group" aria-label={name}>
    <div className={styles.name}>
      <h3>{item.finish === 'matte' ? 'Matte' : 'Shiny'}</h3>
      {dirty && <p>Unsaved changes</p>}{notice && !dirty && <p role="status">{notice}</p>}{saved === 0 && <p className={`${styles.flag} ${styles.soldOut}`}>Sold out</p>}{saved === 1 && <p className={`${styles.flag} ${styles.lowStock}`}>Low stock: last one</p>}
    </div>
    <NumberStepper label={`${name} quantity`} value={quantity} onChange={next => { setQuantity(next); setNotice('') }} max={10000} disabled={busy} />
    <Button tone="staff" disabled={busy || conflict !== null || !dirty} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</Button>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {conflict !== null && <div className={styles.conflict}>
      {/* Keeping the server value is the safe default: a sale may just have taken one. */}
      <Button tone="staff" disabled={busy} onClick={() => { setQuantity(String(conflict)); setConflict(null); setError('') }}>Keep {conflict}</Button>
      <Button tone="staff" variant="secondary" disabled={busy} onClick={() => void save()}>Save {quantity}</Button>
    </div>}
  </div>
}
