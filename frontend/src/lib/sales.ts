import type { OrderSummary, PaymentMethod, SalesFilters, SalesPage } from '../domain/types.ts'

/** Sales date filters follow the calendar in Vienna, including midnight and DST. */
export function viennaDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

export function salePaymentLabel(order: Pick<OrderSummary, 'checkoutStatus' | 'paymentState'> & Partial<Pick<OrderSummary, 'total' | 'amountPaid'>>, format?: (amount: number) => string): string {
  if (order.checkoutStatus === 'pending') return 'Checkout pending'
  if (order.checkoutStatus === 'review') return 'Payment review'
  // A deposit says what is still due, so staff know what to collect without opening the order.
  if (order.paymentState === 'deposit' && format && order.total != null && order.amountPaid != null) {
    const due = Math.max(0, Math.round((order.total - order.amountPaid) * 100) / 100)
    if (due > 0) return `Deposit · ${format(due)} due`
  }
  return { unpaid: 'Unpaid', deposit: 'Deposit paid', paid: 'Paid' }[order.paymentState]
}

/** Mock-only row facts the server reads from the order itself: the sale's market id and payment method. */
export type SalesRow = OrderSummary & { soldAtMarketId?: string | null; paymentMethod?: PaymentMethod | null }

const cents = (value: number) => Math.round(value * 100)

/** Mock pagination intentionally applies filters before paging, as the server does. */
export function filterSales(rows: SalesRow[], filters: SalesFilters): SalesPage {
  const page = Math.max(0, filters.page ?? 0)
  const size = Math.max(1, Math.min(50, filters.size ?? 20))
  const query = filters.query?.trim().toLowerCase() ?? ''
  const digits = query.replace(/\D/g, '')
  const filtered = rows.filter(order => {
    const state = order.checkoutStatus === 'pending' || order.checkoutStatus === 'review' ? order.checkoutStatus : order.paymentState
    if (filters.state && filters.state !== state) return false
    if (filters.source && filters.source !== (order.source ?? 'stall')) return false
    if (filters.market && filters.market !== order.soldAtMarketId) return false
    const date = viennaDate(order.createdAt)
    if ((filters.from && date < filters.from) || (filters.to && date > filters.to)) return false
    if (!query) return true
    if (query.length < 2) return false
    return order.code.toLowerCase().includes(query) || order.customerName.toLowerCase().includes(query)
      || (digits.length >= 3 && order.phone.replace(/\D/g, '').includes(digits))
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
  // Like the server: money received over every page; cancelled and unconfirmed web checkouts do not count.
  const received = { card: 0, cash: 0, other: 0, due: 0 }
  for (const order of filtered) {
    if (order.status === 'CANCELLED' || order.checkoutStatus === 'pending' || order.checkoutStatus === 'review') continue
    const paid = cents(order.amountPaid ?? 0)
    received[order.paymentMethod ?? 'other'] += paid
    received.due += Math.max(0, cents(order.total) - paid)
  }
  const orders = filtered.slice(page * size, (page + 1) * size).map(({ soldAtMarketId: _market, paymentMethod: _method, ...order }) => order)
  return { orders, page, size, totalElements: filtered.length, totalPages: Math.ceil(filtered.length / size),
    received: { card: received.card / 100, cash: received.cash / 100, other: received.other / 100, due: received.due / 100 } }
}
