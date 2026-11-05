import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { PaintingDay } from '../../domain/types'
import { Button } from '../../components/ui/Button'
import { ButtonLink } from '../../components/ui/ButtonLink'
import styles from './SettingsRows.module.css'

function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }
export function PaintingDaysPage() {
  const [days, setDays] = useState<PaintingDay[]>([]); const [error, setError] = useState('')
  useEffect(() => { const start = new Date(); const end = new Date(start); end.setDate(end.getDate() + 41); api.paintingDays.list(localDate(start), localDate(end)).then(setDays).catch(() => setError('Could not load painting days.')) }, [])
  return <main className={styles.page}><ButtonLink to="/staff/agenda" tone="staff" variant="ghost">← Agenda</ButtonLink><h1>Painting days</h1><p>Automatic suggestions respect these limits. Manual moves and sales can go over the limit.</p>{error && <p role="alert">{error}</p>}<div className={styles.list}>{days.map(day => <DayRow key={day.date} day={day} />)}</div></main>
}
function DayRow({ day }: { day: PaintingDay }) {
  const [open, setOpen] = useState(day.open); const [max, setMax] = useState(String(day.maxPaintings)); const [booked, setBooked] = useState(day.booked)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const number = Number(max); const valid = max.trim() !== '' && Number.isInteger(number) && number >= 0 && number <= 10
  async function save() { if (!valid) { setError('Enter a whole number from 0 to 10.'); return } setBusy(true); setError(''); try { const result = await api.paintingDays.update(day.date, open, number); setOpen(result.open); setMax(String(result.maxPaintings)); setBooked(result.booked) } catch (e) { setError(e instanceof Error ? e.message : 'Could not save day.') } finally { setBusy(false) } }
  const label = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${day.date}T12:00:00`))
  return <div className={styles.row}><span className={styles.name}>{label}<br /><small>{booked} / {max || '0'} booked / max</small></span><label><input type="checkbox" role="switch" checked={open} disabled={busy} onChange={e => setOpen(e.target.checked)} /> {open ? 'Open' : 'Closed'}</label><div className={styles.stepper}><button type="button" aria-label={`Decrease max for ${label}`} disabled={busy} onClick={() => setMax(String(Math.max(0, (valid ? number : 0) - 1)))}>−</button><input type="number" aria-label={`Max paintings for ${label}`} min="0" max="10" step="1" value={max} disabled={busy} onChange={e => setMax(e.target.value)} /><button type="button" aria-label={`Increase max for ${label}`} disabled={busy} onClick={() => setMax(String(Math.min(10, (valid ? number : 0) + 1)))}>+</button></div><Button tone="staff" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</Button>{error && <p className={styles.error} role="alert">{error}</p>}</div>
}
