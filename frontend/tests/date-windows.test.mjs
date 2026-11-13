import test from 'node:test'
import assert from 'node:assert/strict'
import { upcomingWindows } from '../src/lib/dateWindows.ts'

test('a season inside 62 days is one request from today', () => {
  assert.deepEqual(upcomingWindows(['2026-11-27', '2026-12-21'], '2026-11-12'), [['2026-11-27', '2026-12-21']])
})

test('an old market day no longer stretches the range past the API limit', () => {
  assert.deepEqual(upcomingWindows(['2026-08-01', '2026-11-27', '2026-12-21'], '2026-11-12'), [['2026-11-12', '2026-12-21']])
})

test('long seasons are split into ranges of at most 62 days', () => {
  const windows = upcomingWindows(['2026-11-12', '2027-03-01'], '2026-11-12')
  assert.deepEqual(windows, [['2026-11-12', '2027-01-13'], ['2027-01-14', '2027-03-01']])
})

test('only past days means nothing to load', () => {
  assert.deepEqual(upcomingWindows(['2026-10-01'], '2026-11-12'), [])
  assert.deepEqual(upcomingWindows([], '2026-11-12'), [])
})
