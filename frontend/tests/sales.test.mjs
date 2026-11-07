import test from 'node:test'
import assert from 'node:assert/strict'
import { filterSales, salePaymentLabel, viennaDate } from '../src/lib/sales.ts'

const sale = (id, changes = {}) => ({ id, code: `AWG${id}`, customerName: 'Alex Example', phone: '+43 (660) 12-34/567', createdAt: '2026-11-24T10:00:00Z', paymentState: 'unpaid', checkoutStatus: null, total: 49.99, items: 1, nextHandoffDate: null, handedOver: false, ...changes })

test('sales filters apply before paging and produce newest-first stable pages', () => {
  const rows = Array.from({ length: 45 }, (_, i) => sale(String(i).padStart(2, '0'), { source: i % 2 ? 'web' : 'stall' }))
  const first = filterSales(rows, { source: 'stall' })
  const second = filterSales(rows, { source: 'stall', page: 1 })
  assert.equal(first.totalElements, 23)
  assert.equal(first.totalPages, 2)
  assert.equal(first.orders.length, 20)
  assert.equal(second.orders.length, 3)
  assert.equal(first.orders[0].id, '44')
  assert.ok(second.orders.every(row => !first.orders.some(firstRow => firstRow.id === row.id)))
})

test('payment filters keep checkout pending and review separate from unpaid', () => {
  const rows = [sale('unpaid'), sale('deposit', { paymentState: 'deposit' }), sale('paid', { paymentState: 'paid' }), sale('pending', { checkoutStatus: 'pending' }), sale('review', { checkoutStatus: 'review' })]
  for (const state of ['unpaid', 'deposit', 'paid', 'pending', 'review']) assert.deepEqual(filterSales(rows, { state }).orders.map(row => row.id), [state])
  assert.equal(salePaymentLabel(rows[3]), 'Checkout pending')
  assert.equal(salePaymentLabel(rows[4]), 'Payment review')
})

test('sales query matches code, case-insensitive names and normalized phone digits', () => {
  const rows = [sale('ABC123')]
  for (const query of ['awgabc', 'aLeX eX', '6601234', '(660) 12']) assert.equal(filterSales(rows, { query }).totalElements, 1)
  for (const query of ['66', 'A', '%_', 'Unknown']) assert.equal(filterSales(rows, { query }).totalElements, 0)
})

test('Vienna dates are inclusive through local midnight and DST, with legacy stall source', () => {
  assert.equal(viennaDate('2026-11-23T23:00:00Z'), '2026-11-24')
  assert.equal(viennaDate('2026-06-23T22:00:00Z'), '2026-06-24')
  const rows = [sale('before', { createdAt: '2026-11-23T22:59:59Z' }), sale('first', { createdAt: '2026-11-23T23:00:00Z' }), sale('last', { createdAt: '2026-11-24T22:59:59Z' }), sale('after', { createdAt: '2026-11-24T23:00:00Z' })]
  assert.deepEqual(filterSales(rows, { from: '2026-11-24', to: '2026-11-24', source: 'stall' }).orders.map(row => row.id), ['last', 'first'])
})
