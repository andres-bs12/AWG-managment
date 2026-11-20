import { addUtcDays, datesInRange, formatDateLabel, utcWeekday } from './time'

/** Sun=0 … Sat=6 */
const MON = 1
const TUE = 2
const WED = 3
const THU = 4
const FRI = 5
const SAT = 6
const SUN = 0

export function isMarketPickupWeekday(date: string): boolean {
  const weekday = utcWeekday(date)
  return date === '2026-11-25' || date === '2026-11-26' || weekday === FRI || weekday === SAT || weekday === SUN
}

/** Market dates in the inclusive season, including the 2026 opening-week exception. */
export function marketPickupDates(start: string, finish: string): string[] {
  if (!start || !finish || finish < start) return []
  return datesInRange(start, finish).filter(isMarketPickupWeekday)
}

/** Home paint: Mon/Tue/Thu = 3 hours, Wed/Fri = 2. Null on Sat/Sun. */
export function homePaintHours(date: string): { openHour: number; closeHour: number } | null {
  const weekday = utcWeekday(date)
  if (weekday === MON || weekday === TUE || weekday === THU) return { openHour: 10, closeHour: 13 }
  if (weekday === WED || weekday === FRI) return { openHour: 10, closeHour: 12 }
  return null
}

export function stallHours(): { openHour: number; closeHour: number } {
  return { openHour: 12, closeHour: 19 }
}

/**
 * First day paint may start for this handoff:
 * Wednesday → Monday, Friday → Thursday, weekend market → Monday.
 */
export function paintWindowStart(handoffDate: string): string {
  const weekday = utcWeekday(handoffDate)
  if (weekday === WED) return addUtcDays(handoffDate, -2)
  if (weekday === FRI) return addUtcDays(handoffDate, -1)
  if (weekday === SAT) return addUtcDays(handoffDate, -5)
  if (weekday === SUN) return addUtcDays(handoffDate, -6)
  return addUtcDays(handoffDate, -((weekday + 6) % 7))
}

export function paintDatesToTry(handoffDate: string, notBeforeDate?: string): string[] {
  const start = paintWindowStart(handoffDate)
  const from = notBeforeDate && notBeforeDate > start ? notBeforeDate : start
  return datesInRange(from, handoffDate)
}

export function paintWindowHint(handoffDate: string): string {
  const weekday = utcWeekday(handoffDate)
  const from = formatDateLabel(paintWindowStart(handoffDate))
  if (weekday === WED) return `Wednesday handoff: paint can fill from Monday (${from}).`
  if (weekday === FRI) return `Friday handoff: paint can fill from Thursday (${from}).`
  return `This market: paint can fill from Monday (${from}).`
}
