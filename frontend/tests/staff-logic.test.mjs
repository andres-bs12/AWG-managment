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
