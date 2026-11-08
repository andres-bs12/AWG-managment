import test from 'node:test'
import assert from 'node:assert/strict'
import { DELIVERY_WINDOW_END_HOUR, DELIVERY_WINDOW_START_HOUR, deliveryDatePhrase, deliveryWindowLabel, icsHour } from '../src/lib/deliveryWindow.ts'

test('the delivery window is 18:00 to 20:00', () => {
  assert.equal(DELIVERY_WINDOW_START_HOUR, 18)
  assert.equal(DELIVERY_WINDOW_END_HOUR, 20)
  assert.equal(icsHour(DELIVERY_WINDOW_START_HOUR), '180000')
  assert.equal(icsHour(DELIVERY_WINDOW_END_HOUR), '200000')
})

test('the window label is localized', () => {
  assert.equal(deliveryWindowLabel('de'), '18–20 Uhr')
  assert.equal(deliveryWindowLabel('en'), '6–8 pm')
})

test('a chosen day becomes one phrase with weekday and window', () => {
  assert.equal(deliveryDatePhrase('2026-12-02', 'de'), 'Mittwoch, 2. Dezember 2026 · 18–20 Uhr')
  assert.equal(deliveryDatePhrase('2026-12-04', 'en'), 'Friday, 4 December 2026 · 6–8 pm')
})
