import type { PaintingDay } from '../../domain/types'
import { formatHour } from '../../lib/time'

/** One painting block is ~60 minutes, so daily capacity follows directly from the painting hours (10–13 → 3, 10–12 → 2). */
export function maxPaintingsFromHours(openHour: number, closeHour: number): number {
  if (!Number.isFinite(openHour) || !Number.isFinite(closeHour) || closeHour <= openHour) return 0
  return Math.max(0, Math.floor((closeHour - openHour) + 1e-6))
}

export function paintingCapacitySummary(day: Pick<PaintingDay, 'open' | 'openHour' | 'closeHour' | 'booked'>): string {
  if (!day.open) return day.booked > 0 ? `Closed · ${day.booked} booked` : 'Closed'
  const max = maxPaintingsFromHours(day.openHour, day.closeHour)
  return `${formatHour(day.openHour)}–${formatHour(day.closeHour)} · ${day.booked} of ${max} booked`
}

export const agendaCapacitySummary: typeof paintingCapacitySummary = day => {
  const limit = day.open ? maxPaintingsFromHours(day.openHour, day.closeHour) : 0
  return `${day.booked} booked · room for ${limit}`
}
