import test from 'node:test'
import assert from 'node:assert/strict'
import { viennaClock } from '../src/lib/viennaClock.ts'
import { layoutAgendaSlots } from '../src/lib/agendaLayout.ts'
import { parseEuroAmount } from '../src/lib/staffInput.ts'
import { itemCost } from '../src/lib/money.ts'

test('Vienna clock uses winter, summer and date rollover independently of device timezone', () => {
  assert.deepEqual(viennaClock(new Date('2026-11-06T09:10:00Z')), { date: '2026-11-06', hour: 10 + 10 / 60 })
  assert.deepEqual(viennaClock(new Date('2026-07-06T09:00:00Z')), { date: '2026-07-06', hour: 11 })
  assert.deepEqual(viennaClock(new Date('2026-11-06T23:00:00Z')), { date: '2026-11-07', hour: 0 })
  assert.equal(viennaClock(new Date('2026-10-25T00:30:00Z')).hour, 2.5)
  assert.equal(viennaClock(new Date('2026-10-25T01:30:00Z')).hour, 2.5)
})
const slot = (id, startHour, endHour) => ({ block: { id, startHour, endHour } })
test('agenda preserves every overlapping session, reuses lanes, and splits adjacent clusters', () => {
  const slots = [slot('a', 10, 12), slot('b', 11, 13), slot('c', 12, 14), slot('d', 14, 15)]
  const layout = layoutAgendaSlots(slots)
  assert.equal(layout.size, slots.length)
  assert.deepEqual(layout.get('a'), { lane: 0, lanes: 2 })
  assert.deepEqual(layout.get('b'), { lane: 1, lanes: 2 })
  assert.deepEqual(layout.get('c'), { lane: 0, lanes: 2 })
  assert.deepEqual(layout.get('d'), { lane: 0, lanes: 1 })
  for (const a of slots) for (const b of slots) if (a !== b && a.block.startHour < b.block.endHour && a.block.endHour > b.block.startHour) assert.notEqual(layout.get(a.block.id).lane, layout.get(b.block.id).lane)
})
test('nested agenda intervals and empty schedules retain honest geometry', () => {
  const layout = layoutAgendaSlots([slot('long', 10, 16), slot('short', 11, 12), slot('nested', 11.5, 12.5)])
  assert.equal(layout.size, 3)
  assert.deepEqual([...layout.values()].map(value => value.lanes), [3, 3, 3])
  assert.equal(layoutAgendaSlots([]).size, 0)
})
test('staff currency input accepts Austrian decimals and rejects malformed and negative values', () => {
  assert.equal(parseEuroAmount('1.250,00'), 1250)
  assert.equal(parseEuroAmount('12,50'), 12.5)
  assert.equal(parseEuroAmount('12.50'), 12.5)
  assert.equal(parseEuroAmount('1 250,00'), 1250)
  for (const value of ['', '-1', '12,2,2', 'abc', '12.555']) assert.ok(Number.isNaN(parseEuroAmount(value)))
})
test('server configuration determines custom, name and finished totals without client defaults', () => {
  const prices = { customPrice: 57, finishedPrice: 41, nameExtra: 14 }
  assert.equal(itemCost('custom', false, prices), 57)
  assert.equal(itemCost('custom', true, prices), 71)
  assert.equal(itemCost('finished', true, prices), 41)
  assert.equal(itemCost('custom', true, { ...prices, customPrice: 0.1, nameExtra: 0.2 }), 0.3)
})

test('narrower painting hours never hide older bookings outside the window', async () => {
  const { agendaBounds } = await import('../src/lib/agendaLayout.ts')
  assert.deepEqual(agendaBounds([slot('early', 8.25, 9.25), slot('late', 16, 17.5)], 10, 12), { start: 8, end: 17.5 })
  assert.deepEqual(agendaBounds([], 10.25, 12.25), { start: 10, end: 12.25 })
})

test('one cart retains different handoff dates and methods through a partial handover', async () => {
  const { groupDeliveryOrders, remainingDeliveries } = await import('../src/lib/staffDeliveries.ts')
  const luna = { orderId: 'cart', itemId: 'luna', deliveryKind: 'market', date: '2026-11-06', handedOver: true, productionStatus: 'finished' }
  const milo = { orderId: 'cart', itemId: 'milo', deliveryKind: 'vienna', date: '2026-12-02', handedOver: false, productionStatus: 'finished' }
  const grouped = groupDeliveryOrders([luna], [luna, milo])
  assert.equal(grouped.length, 1)
  assert.equal(grouped[0].handedOver, false)
  assert.deepEqual(grouped[0].members.map(item => [item.itemId, item.date, item.deliveryKind]), [['luna', '2026-11-06', 'market'], ['milo', '2026-12-02', 'vienna']])
  assert.equal(remainingDeliveries(grouped), 1)
  assert.equal(remainingDeliveries(grouped, true), 1)
  assert.equal(remainingDeliveries(grouped, true, new Set(['luna'])), 0)
  assert.equal(remainingDeliveries(grouped, true, new Set(['milo'])), 1)
  const complete = groupDeliveryOrders([luna], [luna, { ...milo, handedOver: true }])
  assert.equal(complete[0].handedOver, true)
  assert.equal(remainingDeliveries(complete), 0)
})

test('cart readiness covers all items before applying the production filter', async () => {
  const { groupDeliveryOrders } = await import('../src/lib/staffDeliveries.ts')
  const rows = [{ orderId: 'a', itemId: 'one', handedOver: false, productionStatus: 'finished' }, { orderId: 'a', itemId: 'two', handedOver: false, productionStatus: 'not_started' }, { orderId: 'b', itemId: 'three', handedOver: true, productionStatus: 'finished' }]
  const grouped = groupDeliveryOrders(rows)
  assert.equal(grouped.length, 2)
  assert.equal(grouped[0].productionStatus, 'in_progress')
  assert.equal(grouped[0].ready, 1)
  assert.equal(grouped[0].members.length, 2)
  assert.equal(grouped[1].itemId, 'three')
})
