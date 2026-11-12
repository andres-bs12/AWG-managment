import test from 'node:test'
import assert from 'node:assert/strict'
import { pickupTimes } from '../src/lib/pickupTimes.ts'

test('pickup times run every 30 minutes until 30 minutes before closing', () => {
  assert.deepEqual(pickupTimes({ openTime: '12:00', closeTime: '14:00' }), ['12:00', '12:30', '13:00', '13:30'])
})

test('an opening off the half hour starts at the next half hour the backend accepts', () => {
  assert.deepEqual(pickupTimes({ openTime: '10:15', closeTime: '11:45' }), ['10:30', '11:00'])
})
