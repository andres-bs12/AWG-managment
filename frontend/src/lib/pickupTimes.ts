import type { ShopPickupDay } from '../domain/types'

/** Arrival times every 30 minutes from opening until 30 minutes before closing (mirrors ShopService). */
export function pickupTimes(day: Pick<ShopPickupDay, 'openTime' | 'closeTime'>): string[] {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
  const out: string[] = []
  // The backend accepts only :00 and :30, so a stall opening at 10:15 starts at 10:30.
  for (let at = Math.ceil(minutes(day.openTime) / 30) * 30; at <= minutes(day.closeTime) - 30; at += 30) out.push(`${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`)
  return out
}
