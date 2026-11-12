import type { AgendaDelivery, ProductionStatus } from '../domain/types.ts'

export type DatedDelivery = AgendaDelivery & { date: string; marketHours?: string; count?: number; ready?: number; members?: DatedDelivery[] }

/** Filters choose carts. Each chosen cart keeps every item, including its other handoff dates. */
export function groupDeliveryOrders(matched: DatedDelivery[], all: DatedDelivery[] = matched): DatedDelivery[] {
  const orders = new Map<string, DatedDelivery>()
  for (const row of matched) if (!orders.has(row.orderId)) orders.set(row.orderId, row)
  return [...orders.values()].map(first => {
    const unique = new Map(all.filter(row => row.orderId === first.orderId).map(row => [row.itemId, row]))
    const items = [...unique.values()]
    if (items.length === 1) return first
    const ready = items.filter(item => item.productionStatus === 'finished').length
    const productionStatus: ProductionStatus = ready === items.length ? 'finished' : items.some(item => item.productionStatus !== 'not_started') ? 'in_progress' : 'not_started'
    return { ...first, handedOver: items.every(item => item.handedOver), productionStatus, count: items.length, ready, members: items, color: undefined, finish: undefined, backName: undefined }
  })
}

export function remainingDeliveries(orders: DatedDelivery[], viennaOnly = false, activeIds?: Set<string>): number {
  return orders.reduce((total, order) => total + (order.members ?? [order]).filter(item => !item.handedOver && (!activeIds || activeIds.has(item.itemId)) && (!viennaOnly || item.deliveryKind === 'vienna')).length, 0)
}
