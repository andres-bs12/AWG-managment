import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { InventoryItem } from '../../domain/types'
import { Button } from '../../components/ui/Button'
import styles from './SettingsRows.module.css'

export function InventoryPage() {
  const [rows, setRows] = useState<InventoryItem[]>([])
  const [error, setError] = useState('')
  useEffect(() => { api.inventory.list().then(setRows).catch(() => setError('Could not load stock.')) }, [])
  return <main className={styles.page}><h1>Stock</h1><p>Custom = bases ready to paint. Finished = painted in advance.</p>{error && <p role="alert">{error}</p>}<div className={styles.list}>{rows.map(row => <StockRow key={row.id} item={row} />)}</div></main>
}
function StockRow({ item }: { item: InventoryItem }) {
  const [quantity, setQuantity] = useState(String(item.quantity)); const [saved, setSaved] = useState(item.quantity)
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const value = Number(quantity); const valid = quantity.trim() !== '' && Number.isInteger(value) && value >= 0 && value <= 10000
  const name = item.kind === 'finished' ? 'Finished ornaments' : `Custom · ${item.color}`
  async function save() { if (!valid) { setError('Enter a whole number from 0 to 10000.'); return } setBusy(true); setError(''); try { const result = await api.inventory.update(item.id, value); setQuantity(String(result.quantity)); setSaved(result.quantity) } catch (e) { setError(e instanceof Error ? e.message : 'Could not save stock.') } finally { setBusy(false) } }
  return <div className={styles.row} data-low={saved <= 1}><span className={styles.name}>{name}{saved <= 1 && ' · Low stock'}</span><div className={styles.stepper}><button type="button" aria-label={`Decrease ${name}`} disabled={busy} onClick={() => setQuantity(String(Math.max(0, (valid ? value : 0) - 1)))}>−</button><input type="number" min="0" max="10000" step="1" aria-label={`${name} quantity`} value={quantity} disabled={busy} onChange={e => setQuantity(e.target.value)} /><button type="button" aria-label={`Increase ${name}`} disabled={busy} onClick={() => setQuantity(String(Math.min(10000, (valid ? value : 0) + 1)))}>+</button></div><Button tone="staff" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</Button>{error && <p className={styles.error} role="alert">{error}</p>}</div>
}
