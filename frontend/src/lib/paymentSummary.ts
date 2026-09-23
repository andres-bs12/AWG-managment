import type { Order } from '../domain/types'

export function paymentSummary(order: Order) {
  const entries = order.paymentEntries ?? []
  const recorded = entries.length
    ? entries.reduce((sum, entry) => sum + entry.amount, order.paymentOpeningBalance ?? 0)
    : order.paymentState === 'paid' ? order.total
      : order.paymentState === 'deposit' ? order.total / 2 : 0
  const paid = Math.round(recorded * 100) / 100
  return { paid, remaining: Math.max(0, Math.round((order.total - paid) * 100) / 100) }
}
