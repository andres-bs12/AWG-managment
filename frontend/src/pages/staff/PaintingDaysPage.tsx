import { useEffect, useRef, useState } from 'react'
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
  // Past days cannot change anything any more; changes save on their own, so there is no Save button.
  const upcoming = days.filter(day => day.date >= today)
  const weeks = Array.from({ length: Math.ceil(upcoming.length / 7) }, (_, index) => upcoming.slice(index * 7, index * 7 + 7))
  return <section className={styles.page}>
    <StaffBackLink to="/staff/agenda" label="Agenda" /><h1>Painting days</h1>
    <InsetNote><p>These limits apply to automatic suggestions, including stall days. Manual moves and sales may exceed them. Changes save automatically. Weekday and stall defaults are awaiting the owner's decision.</p></InsetNote>
    <nav className={styles.range} aria-label="Painting day ranges"><Button tone="staff" variant="secondary" disabled={offset === 0 || loading} onClick={() => { setLoading(true); setOffset(n => n - 1) }}>Previous 4 weeks</Button><Button tone="staff" variant="secondary" disabled={!seasonEnd || to >= seasonEnd || loading} onClick={() => { setLoading(true); setOffset(n => n + 1) }}>Next 4 weeks</Button></nav>
    {loading && <p role="status">Loading painting days…</p>}
    {error && <div role="alert"><p>{error}</p><Button tone="staff" onClick={() => { setLoading(true); setRetry(n => n + 1) }}>Retry</Button></div>}
    {!loading && !error && !upcoming.length && <p>No painting days in this range.</p>}
    {weeks.map(week => <section key={week[0].date}><h2>Week of {formatDateLabel(week[0].date)}</h2><div className={styles.list}>{week.map(day => <DayRow key={day.date} day={day} />)}</div></section>)}
  </section>
}
/** One compact row per day. Every change saves on its own (toggles at once, typed numbers after a pause), in order. */
function DayRow({ day }: { day: PaintingDay }) {
  const [open, setOpen] = useState(day.open)
  const [max, setMax] = useState(String(day.maxPaintings))
  const [booked, setBooked] = useState(day.booked)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const pending = useRef<{ open: boolean; max: number } | null>(null)
  const running = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  async function flush() {
    if (running.current) return
    running.current = true
    try {
      while (pending.current) {
        const next = pending.current
        pending.current = null
        setState('saving'); setError('')
        try {
          const result = await api.paintingDays.update(day.date, next.open, next.max)
          setBooked(result.booked)
          if (!pending.current) { setOpen(result.open); setMax(String(result.maxPaintings)) }
          setState('saved')
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not save day.'); setState('error')
        }
      }
    } finally { running.current = false }
  }
  function change(nextOpen: boolean, nextMax: string, wait: number) {
    setOpen(nextOpen); setMax(nextMax)
    window.clearTimeout(timer.current)
    const number = Number(nextMax)
    if (nextMax.trim() === '' || !Number.isInteger(number) || number < 0 || number > 10) { setError('Enter a whole number from 0 to 10.'); setState('error'); return }
    setError(''); setState('idle')
    timer.current = window.setTimeout(() => { pending.current = { open: nextOpen, max: number }; void flush() }, wait)
  }
  const label = formatDateLabel(day.date)
  const limit = Number(max)
  const over = open && Number.isFinite(limit) && booked > limit
  return <article className={styles.dayRow}>
    <div className={styles.name}><h3>{label}</h3><p data-over={over || undefined}>{booked}/{open ? max : 0} booked{over ? ' · Over limit' : ''}</p></div>
    <label className={styles.toggle}><input type="checkbox" role="switch" aria-label={`Painting open ${label}`} checked={open} onChange={event => change(event.target.checked, max, 0)} /> {open ? 'Open' : 'Closed'}</label>
    <NumberStepper label={`Max paintings for ${label}`} value={max} onChange={value => change(open, value, 400)} max={10} disabled={!open} />
    <p className={styles.saveState} role="status">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : ''}</p>
    {error && <p className={styles.error} role="alert">{error}</p>}
  </article>
}
