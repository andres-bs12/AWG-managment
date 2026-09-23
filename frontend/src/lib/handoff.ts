import type { MarketDay, OrderItem, TimeBlock } from '../domain/types'
import { formatDayMonth, formatHour, weekdayShort } from './time'

type Delivery = OrderItem['delivery']

export function handoffDate(delivery: Delivery, days: MarketDay[]): string | null {
  const id = delivery.marketDayId
  if (!id) return null
  return days.find((day) => day.id === id)?.date ?? null
}

/** Short staff label: when this ornament is handed off (not the paint slot). */
export function handoffLabel(item: Pick<OrderItem, 'delivery'>, days: MarketDay[]): string {
  const date = handoffDate(item.delivery, days)
  if (item.delivery.kind === 'vienna') {
    return date ? `Vienna ${weekdayShort(date)}` : 'Vienna Wed/Fri'
  }
  const hour = item.delivery.pickupHour != null ? ` · ${formatHour(item.delivery.pickupHour)}` : ''
  if (!date) return `Market${hour}`
  return `Market ${formatDayMonth(date)}${hour}`
}

export function paintSlotLabel(block: TimeBlock, days: MarketDay[]): string {
  const day = days.find((row) => row.id === block.marketDayId)
  const hours = `${formatHour(block.startHour)}–${formatHour(block.endHour)}`
  if (!day) return `Paint ${hours}`
  return `Paint ${weekdayShort(day.date)} ${formatDayMonth(day.date)} · ${hours}`
}

export function agendaSlotPath(block: TimeBlock, days: MarketDay[]): string {
  const day = days.find((row) => row.id === block.marketDayId)
  const query = new URLSearchParams()
  if (day?.date) query.set('date', day.date)
  query.set('block', block.id)
  return `/staff/agenda?${query.toString()}`
}
