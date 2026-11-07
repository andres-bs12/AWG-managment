import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { InventoryItem } from '../../domain/types'
import { Button } from '../../components/ui/Button'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { NumberStepper } from '../../components/staff/NumberStepper'
import { InsetNote } from '../../components/public/PublicForm'
import styles from './SettingsRows.module.css'

export function InventoryPage() {
  const [rows, setRows] = useState<InventoryItem[]>([])
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
    api.inventory.list().then(next => { if (active) { setRows(next); setError('') } }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load stock.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [retry])
  return <section className={styles.page}>
    <StaffBackLink to="/staff/agenda" label="Agenda" /><h1>Stock</h1><p>Custom = bases ready to paint. Finished = painted in advance.</p>
    {loading && <p role="status">Loading stock…</p>}
    {error && <div role="alert"><p>{error}</p><Button tone="staff" onClick={() => { setLoading(true); setRetry(n => n + 1) }}>Retry</Button></div>}
    {!loading && !error && !rows.length && <p>No stock rows configured.</p>}
    <div className={styles.list}>{colorCards(false)}
      {rows.filter(row => row.kind === 'finished').map(row => <article key={row.id} className={styles.stockCard} aria-label="Finished ornaments"><h2>Finished ornaments</h2><StockRow item={row} /></article>)}
      {colors.some(legacy) && <><h2>No longer sold</h2>{colorCards(true)}</>}
    </div>
  </section>
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
      {dirty && <p>Unsaved changes</p>}{notice && !dirty && <p role="status">{notice}</p>}{saved <= 1 && <InsetNote><p>{saved === 0 ? 'Sold out' : 'Low stock: last one'}</p></InsetNote>}
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
