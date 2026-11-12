import type { PaintingDay } from '../domain/types'

/** Pure calendar helpers for the painting-day month picker. Months are 'YYYY-MM', dates are ISO 'YYYY-MM-DD'. */

/** Sunday = 0, like Date#getUTCDay. */
function utcWeekday(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

const WEEKDAYS: { short: string; long: string }[] = [
  { short: 'Mon', long: 'Monday' },
  { short: 'Tue', long: 'Tuesday' },
  { short: 'Wed', long: 'Wednesday' },
  { short: 'Thu', long: 'Thursday' },
  { short: 'Fri', long: 'Friday' },
  { short: 'Sat', long: 'Saturday' },
  { short: 'Sun', long: 'Sunday' },
]

/** Monday first. */
export function weekdayHeaders(): { short: string; long: string }[] {
  return WEEKDAYS
}

export function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function monthStart(month: string): string {
  return `${month}-01`
}

export function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
}

export function monthEnd(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, '0')}`
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
}

/** `2026-11` → `November 2026`. */
export function monthTitle(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** `2026-11-16` → `Monday 16 November 2026`. */
export function spokenDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Whole Monday-first weeks for the month. `null` marks padding cells outside the month. */
export function monthGrid(month: string): (string | null)[] {
  const cells: (string | null)[] = []
  const lead = (utcWeekday(monthStart(month)) + 6) % 7
  for (let index = 0; index < lead; index += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth(month); day += 1) cells.push(`${month}-${String(day).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** A day can be chosen from today up to the season end (no end when the season end is unknown). */
export function isSelectable(isoDate: string, today: string, seasonEnd: string | null): boolean {
  return isoDate >= today && (seasonEnd === null || isoDate <= seasonEnd)
}

export function firstSelectableDay(month: string, today: string, seasonEnd: string | null): string | null {
  for (const cell of monthGrid(month)) {
    if (cell && isSelectable(cell, today, seasonEnd)) return cell
  }
  return null
}

/** The date range to load for a month, clamped to [today, seasonEnd]. `null` when nothing in the month is selectable. */
export function loadWindow(month: string, today: string, seasonEnd: string | null): { from: string; to: string } | null {
  const from = monthStart(month) < today ? today : monthStart(month)
  const to = seasonEnd !== null && seasonEnd < monthEnd(month) ? seasonEnd : monthEnd(month)
  return from > to ? null : { from, to }
}

export type DayStatus = { tone: 'closed' | 'full' | 'open'; short: string; spoken: string }

/** Calendar cell status: "Closed", "Full", or "booked/max". `null` when the day is not loaded. */
export function dayStatus(day: PaintingDay | undefined): DayStatus | null {
  if (!day) return null
  if (!day.open) return { tone: 'closed', short: 'Closed', spoken: 'closed' }
  if (day.booked >= day.maxPaintings) return { tone: 'full', short: 'Full', spoken: `${day.booked} of ${day.maxPaintings} booked, full` }
  return { tone: 'open', short: `${day.booked}/${day.maxPaintings}`, spoken: `${day.booked} of ${day.maxPaintings} booked` }
}
