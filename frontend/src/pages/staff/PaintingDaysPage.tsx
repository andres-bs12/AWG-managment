import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { PaintingDay } from '../../domain/types'
import { Button } from '../../components/ui/Button'
import { NumberStepper } from '../../components/staff/NumberStepper'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { InsetNote } from '../../components/public/PublicForm'
import { addUtcDays, formatDateLabel, utcWeekday } from '../../lib/time'
import { useStaffClock } from '../../lib/staffClock'
import styles from './SettingsRows.module.css'

export function PaintingDaysPage() {
  const clock = useStaffClock()
  const [today, setToday] = useState(clock.date)
  const [seasonEnd, setSeasonEnd] = useState<string | null>(null)
  const [days, setDays] = useState<PaintingDay[]>([])
  const [error, setError] = useState('')
  const [offset, setOffset] = useState(0)
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(true)
  const from = addUtcDays(today, -((utcWeekday(today) + 6) % 7) + offset * 28)
  const to = seasonEnd ? [addUtcDays(from, 27), seasonEnd].sort()[0] : from
  useEffect(() => {
    let active = true
    Promise.all([api.shop.getConfig(), api.agenda.listDays()]).then(([config, agenda]) => {
      if (active) { setSeasonEnd(config.seasonEnd); setToday(agenda.find(day => day.marketDay.isToday)?.marketDay.date ?? clock.date) }
    }).catch(err => { if (active) { setError(err instanceof Error ? err.message : 'Could not load calendar.'); setLoading(false) } })
    return () => { active = false }
  }, [retry, clock.date])
  useEffect(() => {
    if (!seasonEnd) return
    if (from > to) { setDays([]); setLoading(false); return }
    let active = true
    api.paintingDays.list(from, to).then(rows => { if (active) { setDays(rows); setError('') } }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load painting days.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [from, to, seasonEnd, retry])
  const weeks = Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, index * 7 + 7))
  return <section className={styles.page}>
    <StaffBackLink to="/staff/agenda" label="Agenda" /><h1>Painting days</h1>
    <InsetNote><p>These limits apply to automatic suggestions, including stall days. Manual moves and sales may exceed them. Weekday and stall defaults are awaiting the owner's decision.</p></InsetNote>
    <nav className={styles.range} aria-label="Painting day ranges"><Button tone="staff" variant="secondary" disabled={offset === 0 || loading} onClick={() => { setLoading(true); setOffset(n => n - 1) }}>Previous 4 weeks</Button><Button tone="staff" variant="secondary" disabled={!seasonEnd || to >= seasonEnd || loading} onClick={() => { setLoading(true); setOffset(n => n + 1) }}>Next 4 weeks</Button></nav>
    {loading && <p role="status">Loading painting days…</p>}
    {error && <div role="alert"><p>{error}</p><Button tone="staff" onClick={() => { setLoading(true); setRetry(n => n + 1) }}>Retry</Button></div>}
    {!loading && !error && !days.length && <p>No painting days in this range.</p>}
    {weeks.map(week => <section key={week[0].date}><h2>Week of {formatDateLabel(week[0].date)}</h2><div className={styles.list}>{week.map(day => <DayRow key={day.date} day={day} />)}</div></section>)}
  </section>
}
function DayRow({ day }: { day: PaintingDay }) {
  const [open, setOpen] = useState(day.open)
  const [max, setMax] = useState(String(day.maxPaintings))
  const [booked, setBooked] = useState(day.booked)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState({ open: day.open, max: day.maxPaintings })
  const [notice, setNotice] = useState('')
  const number = Number(max)
  const valid = max.trim() !== '' && Number.isInteger(number) && number >= 0 && number <= 10
  async function save() {
    if (busy) return
    if (!valid) { setError('Enter a whole number from 0 to 10.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await api.paintingDays.update(day.date, open, number)
      setOpen(result.open); setMax(String(result.maxPaintings)); setBooked(result.booked); setSaved({ open: result.open, max: result.maxPaintings }); setNotice('Saved')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save day.') }
    finally { setBusy(false) }
  }
  const label = formatDateLabel(day.date)
  return <article className={styles.row}>
    <div className={styles.name}><h3>{label}</h3><p>{booked}/{saved.max} booked{(open !== saved.open || number !== saved.max) ? ' · Unsaved changes' : ''}</p>{notice && <p role="status">{notice}</p>}</div>
    <label><input type="checkbox" role="switch" aria-label={`Painting open ${label}`} checked={open} disabled={busy} onChange={event => setOpen(event.target.checked)} /> {open ? 'Open' : 'Closed'}</label>
    <NumberStepper label={`Max paintings for ${label}`} value={max} onChange={setMax} max={10} disabled={busy} />
    <Button tone="staff" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</Button>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </article>
}
