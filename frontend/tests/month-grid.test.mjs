import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dayStatus,
  daysInMonth,
  firstSelectableDay,
  isSelectable,
  loadWindow,
  monthGrid,
  monthOf,
  monthTitle,
  shiftMonth,
  spokenDate,
} from '../src/lib/monthGrid.ts'

test('month grids start on Monday and always fill whole weeks', () => {
  // 1 November 2026 is a Sunday, so six padding cells come before it.
  const november = monthGrid('2026-11')
  assert.equal(november.length % 7, 0)
  assert.deepEqual(november.slice(0, 6), [null, null, null, null, null, null])
  assert.equal(november[6], '2026-11-01')
  assert.equal(november[21], '2026-11-16')
  assert.equal(november.filter(Boolean).length, 30)
  // February 2026 starts on a Sunday too, and 28 days fill exactly four weeks.
  assert.deepEqual(monthGrid('2026-02').filter(Boolean).length, 28)
  // 1 June 2026 is a Monday: no leading padding.
  assert.equal(monthGrid('2026-06')[0], '2026-06-01')
})

test('month arithmetic crosses years and handles leap years', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(shiftMonth('2027-01', -1), '2026-12')
  assert.equal(daysInMonth('2028-02'), 29)
  assert.equal(daysInMonth('2026-02'), 28)
  assert.equal(monthOf('2026-11-16'), '2026-11')
  assert.equal(monthTitle('2026-11'), 'November 2026')
  assert.equal(spokenDate('2026-11-16').includes('Monday'), true)
})

test('selectable days run from today to the season end', () => {
  assert.equal(isSelectable('2026-11-11', '2026-11-12', '2026-12-24'), false)
  assert.equal(isSelectable('2026-11-12', '2026-11-12', '2026-12-24'), true)
  assert.equal(isSelectable('2026-12-25', '2026-11-12', '2026-12-24'), false)
  assert.equal(isSelectable('2027-03-01', '2026-11-12', null), true)
})

test('load window is clamped to today and the season end', () => {
  assert.deepEqual(loadWindow('2026-11', '2026-11-12', '2026-12-24'), { from: '2026-11-12', to: '2026-11-30' })
  assert.deepEqual(loadWindow('2026-12', '2026-11-12', '2026-12-24'), { from: '2026-12-01', to: '2026-12-24' })
  assert.equal(loadWindow('2026-10', '2026-11-12', '2026-12-24'), null)
  assert.equal(loadWindow('2027-01', '2026-11-12', '2026-12-24'), null)
})

test('first selectable day skips days before today', () => {
  assert.equal(firstSelectableDay('2026-11', '2026-11-12', '2026-12-24'), '2026-11-12')
  assert.equal(firstSelectableDay('2026-12', '2026-11-12', '2026-12-24'), '2026-12-01')
})

test('day status shows closed, full and booked/max', () => {
  const base = { date: '2026-11-16', openHour: 10, closeHour: 13 }
  assert.deepEqual(dayStatus({ ...base, open: false, maxPaintings: 2, booked: 0 }).short, 'Closed')
  assert.deepEqual(dayStatus({ ...base, open: true, maxPaintings: 2, booked: 2 }).short, 'Full')
  assert.deepEqual(dayStatus({ ...base, open: true, maxPaintings: 2, booked: 1 }).short, '1/2')
  assert.equal(dayStatus({ ...base, open: true, maxPaintings: 2, booked: 1 }).tone, 'open')
  assert.equal(dayStatus(undefined), null)
})
