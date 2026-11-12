import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateStats, demoWebMetrics, fieldLabel, funnelRows, niceMax, percent, statsRange } from '../src/lib/stats.ts'

test('ranges are Vienna calendar days, both ends inclusive', () => {
  assert.deepEqual(statsRange('today', '2026-11-12'), { from: '2026-11-12', to: '2026-11-12' })
  assert.deepEqual(statsRange('week', '2026-11-12'), { from: '2026-11-06', to: '2026-11-12' })
  assert.deepEqual(statsRange('month', '2026-03-01'), { from: '2026-01-31', to: '2026-03-01' })
})

test('season starts at Nov 1 or an earlier stall day and stops at today or the season end', () => {
  assert.deepEqual(statsRange('season', '2026-11-12', { seasonEnd: '2026-12-24', stallDays: ['2026-11-20', '2026-12-01'] }), { from: '2026-11-01', to: '2026-11-12' })
  assert.deepEqual(statsRange('season', '2026-11-12', { seasonEnd: '2026-12-24', stallDays: ['2026-10-30', '2025-11-02'] }), { from: '2026-10-30', to: '2026-11-12' })
  assert.deepEqual(statsRange('season', '2027-01-10', { seasonEnd: '2026-12-24' }), { from: '2026-11-01', to: '2026-12-24' })
  // Before the season begins the range is just today, never an inverted range.
  assert.deepEqual(statsRange('season', '2026-10-01', { seasonEnd: '2026-12-24' }), { from: '2026-10-01', to: '2026-10-01' })
  assert.deepEqual(statsRange('season', '2026-11-12'), { from: '2026-11-01', to: '2026-11-12' })
})

test('helpers give clean axes, safe percentages and readable field names', () => {
  assert.equal(niceMax(0), 1)
  assert.equal(niceMax(7), 10)
  assert.equal(niceMax(180), 200)
  assert.equal(niceMax(212), 250)
  assert.equal(percent(1, 3), 33)
  assert.equal(percent(5, 0), 0)
  assert.equal(fieldLabel('postalCode'), 'Postcode')
  assert.equal(fieldLabel('someNewField'), 'Some new field')
  const rows = funnelRows([{ stage: 'opened', count: 200 }, { stage: 'delivery', count: 100 }, { stage: 'paid', count: 30 }])
  assert.deepEqual(rows.map(row => [row.stage, row.count, row.share]), [['opened', 200, 100], ['delivery', 100, 50], ['review', 0, 0], ['pay_click', 0, 0], ['paid', 30, 15]])
})

const item = (id, orderId, changes = {}) => ({ id, orderId, kind: 'custom', petName: '', withName: false, color: 'red', finish: 'shiny', backName: '', note: '', cost: 40, productionStatus: 'not_started', photos: [], formComplete: false, delivery: { kind: 'market' }, ...changes })
const order = (id, changes = {}) => ({ id, customerId: 'c', code: id, trackToken: '', formToken: '', paymentState: 'paid', paymentMethod: 'cash', total: 40, createdAt: '2026-11-10T10:00:00Z', itemIds: [], handedOver: false, source: 'stall', ...changes })

test('mock aggregation matches the backend: cancelled and unpaid web checkouts are excluded', () => {
  const orders = [
    order('a'),
    order('b', { source: 'web', total: 92.99, paymentState: 'paid', createdAt: '2026-11-11T09:00:00Z' }),
    order('c', { paymentState: 'deposit', total: 80, amountPaid: 30 }),
    order('d', { status: 'CANCELLED' }),
    order('e', { source: 'web', checkoutStatus: 'pending' }),
    order('f', { createdAt: '2026-11-20T10:00:00Z' }),
  ]
  const items = [
    item('1', 'a'), item('2', 'b', { withName: true, finish: 'matte', delivery: { kind: 'vienna' } }), item('3', 'b', { color: 'green' }),
    item('4', 'c', { kind: 'finished', color: undefined }), item('5', 'c'), item('6', 'd'), item('7', 'e'),
  ]
  const stats = aggregateStats({
    from: '2026-11-10', to: '2026-11-11', orders, items,
    metrics: [
      { date: '2026-11-10', event: 'home_view', count: 5 }, { date: '2026-11-11', event: 'buy_view', count: 3 },
      { date: '2026-11-11', event: 'buy_step', step: 'delivery', count: 2 }, { date: '2026-11-12', event: 'home_view', count: 99 },
      { date: '2026-11-11', event: 'buy_validation_error', step: 'delivery', field: 'postalCode', code: 'invalid', count: 2 },
    ],
    viennaDay: instant => instant.slice(0, 10),
    received: row => row.amountPaid ?? (row.paymentState === 'paid' ? row.total : 0),
  })
  assert.deepEqual(stats.sales, { orders: 3, ornaments: 5, custom: 4, finished: 1, withName: 1, revenue: 212.99, received: 162.99, outstanding: 50, averageOrder: 71, cancelled: 1, checkoutsInProgress: 1 })
  assert.deepEqual(stats.bySource, [{ source: 'stall', orders: 2, ornaments: 3, revenue: 120 }, { source: 'web', orders: 1, ornaments: 2, revenue: 92.99 }])
  assert.deepEqual(stats.daily.map(day => [day.date, day.orders, day.revenue, day.visits]), [['2026-11-10', 2, 120, 5], ['2026-11-11', 1, 92.99, 3]])
  assert.deepEqual(stats.colors, [{ color: 'red', finish: 'shiny', count: 2 }, { color: 'green', finish: 'shiny', count: 1 }, { color: 'red', finish: 'matte', count: 1 }])
  assert.deepEqual(stats.delivery, { market: 4, vienna: 1 })
  assert.equal(stats.web.homeViews, 5)
  assert.deepEqual(stats.web.funnel.slice(0, 2), [{ stage: 'opened', count: 3 }, { stage: 'delivery', count: 2 }])
  assert.deepEqual(stats.web.validationErrors, [{ step: 'delivery', field: 'postalCode', code: 'invalid', count: 2 }])
})

test('demo web traffic is stable, never in the future and only from Nov 1', () => {
  const rows = demoWebMetrics('2026-10-25', '2026-11-20', '2026-11-12')
  assert.deepEqual(rows, demoWebMetrics('2026-10-25', '2026-11-20', '2026-11-12'))
  const dates = rows.map(row => row.date).sort()
  assert.equal(dates[0], '2026-11-01')
  assert.equal(dates.at(-1), '2026-11-12')
  const opened = rows.filter(row => row.event === 'buy_view').reduce((sum, row) => sum + row.count, 0)
  const paying = rows.filter(row => row.event === 'buy_pay_click').reduce((sum, row) => sum + row.count, 0)
  assert.ok(paying > 0 && paying < opened)
  assert.equal(rows.filter(row => row.event === 'buy_paid').length, 0)
})
