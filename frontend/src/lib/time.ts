export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Decimal hour (12.5 → 12:30). */
export function formatHour(h: number): string {
  const hh = Math.floor(h)
  let mm = Math.round((h - hh) * 60)
  let hour = hh
  if (mm === 60) {
    hour += 1
    mm = 0
  }
  return `${pad2(hour)}:${pad2(mm)}`
}

export function parseHour(value: string): number {
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h)) return 0
  return h + (Number.isNaN(m) ? 0 : m / 60)
}

export function formatDateLabel(isoDate: string, locale = 'en-GB'): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function weekdayShort(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
}

/** `2026-12-02` → `02/12`. */
export function formatDayMonth(isoDate: string): string {
  const [, m, d] = isoDate.split('-')
  return `${d}/${m}`
}

export function weekdayLong(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
}

export function durationHours(withName: boolean): number {
  return withName ? 1.25 : 1
}

export function minutesToHours(minutes: number): number {
  return minutes / 60
}

export function formatMinutes(minutes: number): string {
  if (minutes === 45) return '45 min'
  if (minutes === 60) return '1 h'
  if (minutes === 75) return '1 h 15'
  if (minutes % 60 === 0) return `${minutes / 60} h`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return `${h} h ${pad2(m)}`
}

/** True if half-open hour ranges overlap. */
export function hoursOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 < b1 - 0.01 && a1 > b0 + 0.01
}

export function utcWeekday(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function addUtcDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + delta))
  return next.toISOString().slice(0, 10)
}

export function datesInRange(from: string, to: string): string[] {
  if (from > to) return []
  const out: string[] = []
  for (let cursor = from; cursor <= to; cursor = addUtcDays(cursor, 1)) out.push(cursor)
  return out
}

export function pickupHourOptions(openHour: number, closeHour: number, notBefore?: number): number[] {
  const hours: number[] = []
  const start = Math.ceil(Math.max(openHour, notBefore ?? openHour))
  for (let h = start; h < closeHour; h += 1) hours.push(h)
  return hours
}

export function yToHour(y: number, hourHeight: number, openHour: number): number {
  const raw = openHour + y / hourHeight
  const snapped = Math.round(raw * 4) / 4
  return snapped
}

export function hourToY(hour: number, hourHeight: number, openHour: number): number {
  return (hour - openHour) * hourHeight
}
