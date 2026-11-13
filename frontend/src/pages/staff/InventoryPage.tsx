import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { InventoryItem, Prices } from '../../domain/types'
import { Button } from '../../components/ui/Button'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { NumberStepper } from '../../components/staff/NumberStepper'
import { parseEuroAmount } from '../../lib/staffInput'
import styles from './SettingsRows.module.css'

const LOAD_ERROR = 'Could not load prices and stock. Check the connection and try again.'

export function InventoryPage() {
  const [rows, setRows] = useState<InventoryItem[]>([])
  const [prices, setPrices] = useState<Prices | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const custom = rows.filter(row => row.kind === 'custom')
  const colors = [...new Set(custom.map(row => row.color))]
  const legacy = (color: InventoryItem['color']) => color === 'grey' || color === 'white'
  const colorCards = (old: boolean) => colors.filter(color => legacy(color) === old).map(color => <article key={color} className={styles.stockCard} aria-label={`${color} bases`}>
    <h2><span className={styles.swatch} style={{ background: `var(--ornament-${color})` }} role="img" aria-label={`${color}`} /></h2>
    {custom.filter(row => row.color === color).map(row => <StockRow key={row.id} item={row} />)}
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
    <StaffBackLink to="/staff/agenda" label="Agenda" /><h1>Stock</h1><p>Custom = bases ready to paint. Finished = painted in advance.</p>
    {loading && <p role="status">Loading prices and stock…</p>}
    {error && <div role="alert"><p>{error}</p><Button tone="staff" onClick={() => { setLoading(true); setError(''); setRetry(n => n + 1) }}>Try again</Button></div>}
    {!loading && !error && prices && !rows.length && <p>No stock rows configured.</p>}
    {prices && <div className={styles.list}>
      <PricesCard initial={prices} />
      {colors.some(color => !legacy(color)) && <h2>Custom bases</h2>}
      {colorCards(false)}
      {rows.filter(row => row.kind === 'finished').map(row => <article key={row.id} className={`${styles.stockCard} ${styles.finishedCard}`} aria-label="Finished ornaments"><h2>Finished ornaments</h2><StockRow item={row} /></article>)}
      {colors.some(legacy) && <><h2>No longer sold</h2>{colorCards(true)}</>}
    </div>}
  </section>
}

type PriceField = 'customPrice' | 'finishedPrice' | 'nameExtra'
type PriceDraft = Record<PriceField, string>

const PRICE_FIELDS: { key: PriceField; label: string; id: string }[] = [
  { key: 'customPrice', label: 'Custom ornament', id: 'price-custom' },
  { key: 'finishedPrice', label: 'Finished ornament', id: 'price-finished' },
  { key: 'nameExtra', label: 'Name on the back (extra)', id: 'price-name' },
]
const MAX_PRICE = 999.99

/** The message for a draft that the server would reject, or null when it can be sent. */
function priceError(field: PriceField, text: string): string | null {
  const value = parseEuroAmount(text)
  if (field === 'nameExtra') return Number.isFinite(value) && value >= 0 && value <= MAX_PRICE ? null : 'Enter an amount from 0.00 to 999.99.'
  return Number.isFinite(value) && value >= 0.5 && value <= MAX_PRICE ? null : 'Enter a price from 0.50 to 999.99.'
}

function draftFrom(prices: Prices): PriceDraft {
  return { customPrice: prices.customPrice.toFixed(2), finishedPrice: prices.finishedPrice.toFixed(2), nameExtra: prices.nameExtra.toFixed(2) }
}

function PricesCard({ initial }: { initial: Prices }) {
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState<PriceDraft>(() => draftFrom(initial))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [alert, setAlert] = useState('')
  const errors = Object.fromEntries(PRICE_FIELDS.map(field => [field.key, priceError(field.key, draft[field.key])])) as Record<PriceField, string | null>
  const valid = PRICE_FIELDS.every(field => errors[field.key] === null)
  // Compare in cents so 49.9 and 49.90 are the same price; an unparsable draft counts as changed.
  const dirty = PRICE_FIELDS.some(field => Math.round(parseEuroAmount(draft[field.key]) * 100) !== Math.round(saved[field.key] * 100))

  function edit(field: PriceField, text: string) {
    setDraft(current => ({ ...current, [field]: text }))
    setStatus('')
  }
  function tidy(field: PriceField) {
    if (priceError(field, draft[field]) === null) setDraft(current => ({ ...current, [field]: parseEuroAmount(current[field]).toFixed(2) }))
  }
  async function save() {
    if (busy || !valid || !dirty) return
    setBusy(true); setAlert(''); setStatus('')
    try {
      const next = await api.prices.update({
        customPrice: parseEuroAmount(draft.customPrice),
        finishedPrice: parseEuroAmount(draft.finishedPrice),
        nameExtra: parseEuroAmount(draft.nameExtra),
        expectedRevision: saved.revision,
      })
      setSaved(next); setDraft(draftFrom(next)); setStatus('Saved')
    } catch (err) {
      if ((err as { code?: string }).code === 'PRICES_CHANGED') {
        try {
          const fresh = await api.prices.get()
          setSaved(fresh); setDraft(draftFrom(fresh))
          setAlert('Someone else changed the prices. The current prices are shown; check them and save again.')
        } catch { setAlert('Could not load the current prices. Check the connection and try again.') }
      } else setAlert(err instanceof Error ? err.message : 'Could not save prices. Try again.')
    } finally { setBusy(false) }
  }

  return <article className={styles.stockCard} aria-labelledby="prices-heading">
    <h2 id="prices-heading">Prices</h2>
    <p className={styles.hint}>New prices apply to new sales and the web shop. Existing orders keep their price.</p>
    <div className={styles.priceFields}>
      {PRICE_FIELDS.map(field => {
        const problem = errors[field.key]
        return <div key={field.key} className={styles.priceField}>
          <label htmlFor={field.id}>{field.label}</label>
          <div className={styles.euroBox}>
            <span aria-hidden="true">€</span>
            <input
              id={field.id}
              inputMode="decimal"
              autoComplete="off"
              value={draft[field.key]}
              disabled={busy}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? `${field.id}-error` : undefined}
              onChange={event => edit(field.key, event.target.value)}
              onBlur={() => tidy(field.key)}
            />
          </div>
          {problem && <p id={`${field.id}-error`} className={styles.fieldError}>{problem}</p>}
        </div>
      })}
    </div>
    <div className={styles.priceActions}>
      <Button tone="staff" disabled={busy || !valid || !dirty} onClick={() => void save()}>{busy ? 'Saving…' : 'Save prices'}</Button>
      <p className={styles.priceStatus} role="status">{dirty ? 'Unsaved changes' : status}</p>
    </div>
    {alert && <p className={styles.error} role="alert">{alert}</p>}
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
  const name = item.kind === 'finished' ? 'Finished ornaments' : `Custom · ${item.color} · ${item.finish ?? 'shiny'}`
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
      <h3>{item.kind === 'finished' ? 'Available' : item.finish === 'matte' ? 'Matte' : 'Shiny'}</h3>
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
