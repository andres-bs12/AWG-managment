import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { InventoryItem } from '../../domain/types'
import { Button } from '../../components/ui/Button'
import styles from './SettingsRows.module.css'

export function InventoryPage() {
  const [rows, setRows] = useState<InventoryItem[]>([])
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0)
  useEffect(() => { api.inventory.list().then(rows => { setRows(rows); setError('') }).catch(() => setError('Could not load stock.')).finally(() => setLoading(false)) }, [retry])
  return <main className={styles.page}><h1>Stock</h1><p>Custom = bases ready to paint. Finished = painted in advance.</p>{loading && <p role="status">Loading stock…</p>}{error && <><p role="alert">{error}</p><Button tone="staff" onClick={() => { setLoading(true); setRetry(n => n + 1) }}>Retry</Button></>}<div className={styles.list}>{rows.filter(row => row.color !== 'grey' && row.color !== 'white').map(row => <StockRow key={row.id} item={row} />)}{rows.some(row => row.color === 'grey' || row.color === 'white') && <><h2>No longer sold</h2>{rows.filter(row => row.color === 'grey' || row.color === 'white').map(row => <StockRow key={row.id} item={row} />)}</>}</div></main>
}
function StockRow({ item }: { item: InventoryItem }) {
  const [quantity, setQuantity] = useState(String(item.quantity)); const [saved, setSaved] = useState(item.quantity)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const value = Number(quantity); const valid = quantity.trim() !== '' && Number.isInteger(value) && value >= 0 && value <= 10000
  const name = item.kind === 'finished' ? 'Finished ornaments' : `Custom · ${item.color} · ${item.finish ?? "shiny"}`
  async function save() { if (!valid) { setError('Enter a whole number from 0 to 10000.'); return } setBusy(true); setError(''); setNotice(''); try { const result = await api.inventory.update(item.id, value, saved); setQuantity(String(result.quantity)); setSaved(result.quantity); setNotice('Saved') } catch (e) { if ((e as { code?: string }).code === 'STOCK_CHANGED') { try { const fresh = (await api.inventory.list()).find(row => row.id === item.id); if (fresh) { setQuantity(String(fresh.quantity)); setSaved(fresh.quantity) } setError('Stock changed. The latest quantity was loaded; review and save again.') } catch { setError('Stock changed, but could not reload. Please retry.') } } else setError('Could not save stock. Please retry.') } finally { setBusy(false) } }
  return <div className={styles.row} data-low={saved <= 1}><span className={styles.name}>{name}{saved <= 1 && ' · Low stock'}{value !== saved && ' · Unsaved changes'}{notice && <small role="status"> · {notice}</small>}</span><div className={styles.stepper}><button type="button" aria-label={`Decrease ${name}`} disabled={busy} onClick={() => setQuantity(String(Math.max(0, (valid ? value : 0) - 1)))}>−</button><input type="number" min="0" max="10000" step="1" aria-label={`${name} quantity`} value={quantity} disabled={busy} onChange={e => setQuantity(e.target.value)} /><button type="button" aria-label={`Increase ${name}`} disabled={busy} onClick={() => setQuantity(String(Math.min(10000, (valid ? value : 0) + 1)))}>+</button></div><Button tone="staff" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</Button>{error && <p className={styles.error} role="alert">{error}</p>}</div>
}
