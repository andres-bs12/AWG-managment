import type { OrderSummary, SalesFilters, SalesPage } from '../domain/types.ts'

/** Sales date filters follow the calendar in Vienna, including midnight and DST. */
export function viennaDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

export function salePaymentLabel(order: Pick<OrderSummary, 'checkoutStatus' | 'paymentState'>): string {
  if (order.checkoutStatus === 'pending') return 'Checkout pending'
  if (order.checkoutStatus === 'review') return 'Payment review'
  return { unpaid: 'Unpaid', deposit: 'Deposit paid', paid: 'Paid' }[order.paymentState]
}

/** Mock pagination intentionally applies filters before paging, as the server does. */
export function filterSales(rows: OrderSummary[], filters: SalesFilters): SalesPage {
  const page = Math.max(0, filters.page ?? 0)
  const size = Math.max(1, Math.min(50, filters.size ?? 20))
  const query = filters.query?.trim().toLowerCase() ?? ''
  const digits = query.replace(/\D/g, '')
  const filtered = rows.filter(order => {
    const state = order.checkoutStatus === 'pending' || order.checkoutStatus === 'review' ? order.checkoutStatus : order.paymentState
    if (filters.state && filters.state !== state) return false
    if (filters.source && filters.source !== (order.source ?? 'stall')) return false
    const date = viennaDate(order.createdAt)
    if ((filters.from && date < filters.from) || (filters.to && date > filters.to)) return false
    if (!query) return true
    if (query.length < 2) return false
    return order.code.toLowerCase().includes(query) || order.customerName.toLowerCase().includes(query)
      || (digits.length >= 3 && order.phone.replace(/\D/g, '').includes(digits))
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  return { orders: filtered.slice(page * size, (page + 1) * size), page, size, totalElements: filtered.length, totalPages: Math.ceil(filtered.length / size) }
}
