import test from 'node:test'
import assert from 'node:assert/strict'
import { buyMetricForHttp } from '../src/lib/buyMetrics.ts'

test('details metrics retain their own step and optional field', () => {
  assert.deepEqual(buyMetricForHttp({ event: 'buy_step', step: 'details' }), { event: 'buy_step', step: 'details' })
  assert.deepEqual(buyMetricForHttp({ event: 'buy_validation_error', step: 'details', field: 'postalCode', code: 'invalid' }), { event: 'buy_validation_error', step: 'details', field: 'postalCode', code: 'invalid' })
  assert.deepEqual(buyMetricForHttp({ event: 'buy_step', step: 'review' }), { event: 'buy_step', step: 'review' })
})
