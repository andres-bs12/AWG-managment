import { StaffText } from '../../components/staff/StaffText'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { api } from '../../api/client'
import type { PaintingDay } from '../../domain/types'
import { Button } from '../../components/ui/Button'
import { NumberStepper } from '../../components/staff/NumberStepper'
import { StaffBackLink } from '../../components/staff/StaffBackLink'
import { InsetNote } from '../../components/public/PublicForm'
import { MonthPicker } from '../../components/staff/MonthPicker'
import pickerStyles from '../../components/staff/MonthPicker.module.css'
import { firstSelectableDay, isSelectable, loadWindow, monthOf } from '../../lib/monthGrid'
import { formatDateLabel, formatHour, parseHour } from '../../lib/time'
import { useStaffClock } from '../../lib/staffClock'
import styles from './SettingsRows.module.css'

/**
 * Saves that failed after their row was gone (range change or leaving the page). They stay here for this
 * browser session, so the page can show them and retry instead of losing the edit silently.
 */
type LostSave = { date: string; open: boolean; max: number; openHour: number; closeHour: number; message: string }
let lostSaves: LostSave[] = []
const lostListeners = new Set<() => void>()
function setLostSaves(next: LostSave[]) { lostSaves = next; lostListeners.forEach(listener => listener()) }
function subscribeLost(listener: () => void) { lostListeners.add(listener); return () => { lostListeners.delete(listener) } }
function recordLostSave(save: LostSave) { setLostSaves([...lostSaves.filter(row => row.date !== save.date), save]) }
function clearLostSave(date: string) { if (lostSaves.some(row => row.date === date)) setLostSaves(lostSaves.filter(row => row.date !== date)) }

export function LostSaves({ onSaved }: { onSaved: () => void }) {
  const rows = useSyncExternalStore(subscribeLost, () => lostSaves)
  const [busy, setBusy] = useState(false)
  if (!rows.length) return null
  async function retry() {
    setBusy(true)
    for (const row of rows) {
      // A newer edit in the visible row replaces (and clears) this entry; never send the older value then.
      if (!lostSaves.includes(row)) continue
      try { await api.paintingDays.update(row.date, row.open, row.max, { openHour: row.openHour, closeHour: row.closeHour }); if (lostSaves.includes(row)) clearLostSave(row.date) }
      catch (err) { if (lostSaves.includes(row)) recordLostSave({ ...row, message: err instanceof Error ? err.message : row.message }) }
    }
    setBusy(false)
    onSaved()
  }
  return <div className={styles.lost} role="alert">
    <p>Not saved: {rows.map(row => `${formatDateLabel(row.date)} (${row.open ? `max ${row.max}` : 'closed'})`).join(', ')}. {rows[rows.length - 1].message}</p>
    <Button tone="staff" disabled={busy} onClick={() => void retry()}>{busy ? 'Saving…' : 'Retry'}</Button>
  </div>
}

export function PaintingDaysPage() {
  const clock = useStaffClock()
  const [today, setToday] = useState(clock.date)
  const [seasonEnd, setSeasonEnd] = useState<string | null>(null)
  const [month, setMonth] = useState(() => monthOf(clock.date))
  const [selected, setSelected] = useState<string | null>(null)
  const [days, setDays] = useState<PaintingDay[]>([])
  const [error, setError] = useState('')
  const [configRetry, setConfigRetry] = useState(0)
  const [reload, setReload] = useState(0)
  // Bumped on every server load, so the open DayRow restarts from fresh values (e.g. after a retried save).
  const [loaded, setLoaded] = useState(0)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    Promise.all([api.shop.getConfig(), api.agenda.listDays()]).then(([config, agenda]) => {
      if (!active) return
      const nextToday = agenda.find(day => day.marketDay.isToday)?.marketDay.date ?? clock.date
      setSeasonEnd(config.seasonEnd)
      setToday(nextToday)
      // Start on today, or on the first day that can be chosen when today is past the season.
      setMonth(monthOf(nextToday))
      setSelected(isSelectable(nextToday, nextToday, config.seasonEnd) ? nextToday : firstSelectableDay(monthOf(nextToday), nextToday, config.seasonEnd))
    }).catch(err => { if (active) { setError(err instanceof Error ? err.message : 'Could not load calendar.'); setLoading(false) } })
    return () => { active = false }
  }, [configRetry, clock.date])
  useEffect(() => {
    if (!seasonEnd) return
    const range = loadWindow(month, today, seasonEnd)
    let active = true
    const request = range ? api.paintingDays.list(range.from, range.to) : Promise.resolve<PaintingDay[]>([])
    request.then(rows => { if (active) { setDays(rows); setLoaded(n => n + 1); setError('') } }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load painting days.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [month, today, seasonEnd, reload])
  function changeMonth(next: string) {
    setMonth(next)
    setLoading(true)
    setError('')
    // Keep the selection only when it is already in the new month; otherwise pick its first selectable day.
    setSelected(current => current && monthOf(current) === next && isSelectable(current, today, seasonEnd) ? current : firstSelectableDay(next, today, seasonEnd))
  }
  function retry() {
    setLoading(true)
    setError('')
    if (seasonEnd) setReload(n => n + 1)
    else setConfigRetry(n => n + 1)
  }
  // A saved day replaces its row so the calendar cell shows the new status without reloading the month.
  function handleSaved(saved: PaintingDay) {
    setDays(current => current.map(day => day.date === saved.date ? saved : day))
  }
  const selectedDay = selected ? days.find(day => day.date === selected) : undefined
  return <section className={styles.page}>
    <StaffBackLink to="/staff/agenda" label="Agenda" /><h1>Painting days</h1>
    <InsetNote><p>Hours and limits apply to automatic suggestions. Manual bookings stay in the agenda. Changes save automatically.</p></InsetNote>
    <LostSaves onSaved={() => { setLoading(true); setReload(n => n + 1) }} />
    {loading && <p role="status">Loading painting days…</p>}
    {error && <div role="alert"><p>{error}</p><Button tone="staff" onClick={retry}>Try again</Button></div>}
    {seasonEnd && <div className={pickerStyles.workspace}>
      <MonthPicker month={month} today={today} seasonEnd={seasonEnd} days={days} selected={selected} onMonthChange={changeMonth} onSelect={setSelected} />
      <section className={pickerStyles.panel} aria-labelledby="painting-day-heading">
        {selected && <h2 id="painting-day-heading">{formatDateLabel(selected)}</h2>}
        {selectedDay
          ? <DayRow key={`${selectedDay.date}:${loaded}`} day={selectedDay} showDate={false} onSaved={handleSaved} onEdit={handleSaved} />
          : !loading && !error && <p>No painting day is open for choosing in this month.</p>}
      </section>
    </div>}
  </section>
}
/** One compact row per day. Every change saves on its own (toggles at once, typed numbers after a pause), in order. */
export function DayRow({ day, showDate = true, onSaved, onEdit }: { day: PaintingDay; showDate?: boolean; onSaved?: (day: PaintingDay) => void; onEdit?: (day: PaintingDay) => void }) {
  const [start, setStart] = useState(formatHour(day.openHour))
  const [end, setEnd] = useState(formatHour(day.closeHour))
  const [open, setOpen] = useState(day.open)
  const [max, setMax] = useState(String(day.maxPaintings))
  const [booked, setBooked] = useState(day.booked)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  // `latest` is what the screen shows; `queue` waits to be sent; `running` guards one request at a time.
  const latest = useRef({ open: day.open, max: day.maxPaintings, openHour: day.openHour, closeHour: day.closeHour })
  // Every edit, valid or not, bumps the revision; a response only applies to the revision it was sent for.
  const revision = useRef(0)
  const queue = useRef<{ open: boolean; max: number; openHour: number; closeHour: number; revision: number } | null>(null)
  const running = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const flushRef = useRef<() => void>(() => {})
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function flush() {
    if (running.current) return
    running.current = true
    try {
      while (queue.current) {
        const next = queue.current
        queue.current = null
        setState('saving'); setError('')
        try {
          const result = await api.paintingDays.update(day.date, next.open, next.max, { openHour: next.openHour, closeHour: next.closeHour })
          clearLostSave(day.date)
          onSaved?.(result)
          setBooked(result.booked)
          // Only reflect the server when nothing newer was typed meanwhile.
          if (next.revision !== revision.current) continue
          setOpen(result.open); setMax(String(result.maxPaintings)); setStart(formatHour(result.openHour)); setEnd(formatHour(result.closeHour)); latest.current = { open: result.open, max: result.maxPaintings, openHour: result.openHour, closeHour: result.closeHour }
          setState(queue.current || timer.current !== undefined ? 'saving' : 'saved')
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Could not save day.'
          if (!mounted.current) { recordLostSave({ date: day.date, open: next.open, max: next.max, openHour: next.openHour, closeHour: next.closeHour, message }); continue }
          if (next.revision !== revision.current) continue
          setError(message); setState('error')
        }
      }
    } finally { running.current = false }
  }
  flushRef.current = () => { void flush() }
  // Leaving the page or the range during the pause still sends the last edit.
  useEffect(() => () => {
    if (timer.current !== undefined) { window.clearTimeout(timer.current); timer.current = undefined; queue.current = { ...latest.current, revision: revision.current }; flushRef.current() }
  }, [])
  function send(wait: number) {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { timer.current = undefined; queue.current = { ...latest.current, revision: revision.current }; void flush() }, wait)
  }
  function change(nextOpen: boolean, nextMax: string, wait: number, nextStart = start, nextEnd = end) {
    setOpen(nextOpen); setMax(nextMax); setStart(nextStart); setEnd(nextEnd)
    revision.current += 1
    queue.current = null
    clearLostSave(day.date)
    window.clearTimeout(timer.current); timer.current = undefined
    const number = Number(nextMax)
    if (nextMax.trim() === '' || !Number.isInteger(number) || number < 0 || number > 10) { setError('Enter a whole number from 0 to 10.'); setState('error'); return }
    const openHour = parseHour(nextStart), closeHour = parseHour(nextEnd)
    if (!nextStart || !nextEnd || !Number.isFinite(openHour) || !Number.isFinite(closeHour) || openHour < 0 || closeHour >= 24 || openHour >= closeHour || !Number.isInteger(openHour * 4) || !Number.isInteger(closeHour * 4)) { setError('Choose painting hours from 00:00 to 23:45 in 15-minute steps, with end after start.'); setState('error'); return }
    latest.current = { open: nextOpen, max: number, openHour, closeHour }
    // Tell the page at once, so reopening this day before the save answers shows the edit, not the old value.
    onEdit?.({ ...day, open: nextOpen, maxPaintings: number, openHour, closeHour })
    setError(''); setState('saving')
    send(wait)
  }
  const label = formatDateLabel(day.date)
  const limit = Number(max)
  const over = Number.isFinite(limit) && booked > (open ? limit : 0)
  return <article className={styles.dayRow}>
    <div className={styles.name}>{showDate && <h3>{label}</h3>}<p data-over={over || undefined}><StaffText>{`${booked}/${open ? max : 0} booked${over ? ' · Over limit; existing bookings remain' : ''}${!open ? ' · Closed' : ''}`}</StaffText></p></div>
    <label className={styles.toggle}><input type="checkbox" role="switch" checked={open} onChange={event => change(event.target.checked, max, 0)} /> Open<span className="visually-hidden">, {label}</span></label>
    <NumberStepper label={`Max paintings for ${label}`} value={max} onChange={value => change(open, value, 400)} max={10} disabled={!open} />
    <div className={styles.hours}>
      <label htmlFor={`paint-start-${day.date}`}>Start<input id={`paint-start-${day.date}`} type="time" step="900" value={start} disabled={!open} aria-label={`Painting starts ${label}`} onChange={event => change(open, max, 400, event.target.value, end)} /></label>
      <label htmlFor={`paint-end-${day.date}`}>End<input id={`paint-end-${day.date}`} type="time" step="900" value={end} disabled={!open} aria-label={`Painting ends ${label}`} onChange={event => change(open, max, 400, start, event.target.value)} /></label>
    </div>
    <p className={styles.saveState} role="status">{state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : ''}</p>
    {error && <p className={styles.error} role="alert">{error}{state === 'error' && error !== 'Enter a whole number from 0 to 10.' && !error.startsWith('Choose painting hours') ? <> <Button tone="staff" variant="secondary" onClick={() => send(0)}>Retry</Button></> : null}</p>}
  </article>
}
