import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentSummary } from '../src/lib/paymentSummary.ts'

test('uses actual receipts for a partial payment rather than assuming half', () => {
  assert.deepEqual(paymentSummary({ total: 100, paymentState: 'deposit', paymentEntries: [{amount: 20}, {amount: 15}] }), {paid: 35, remaining: 65})
})
test('handles paid legacy orders without falsely reporting unpaid', () => {
  assert.deepEqual(paymentSummary({total:62.98,paymentState:'paid'}),{paid:62.98,remaining:0})
})
test('rounds currency without a floating point balance', () => {
  assert.deepEqual(paymentSummary({total:0.3,paymentState:'paid',paymentEntries:[{amount:0.1},{amount:0.2}]}),{paid:0.3,remaining:0})
})
test('keeps an older deposit when a new receipt is added', () => {
  assert.deepEqual(paymentSummary({total:100,paymentState:'deposit',paymentOpeningBalance:50,paymentEntries:[{amount:10}]}),{paid:60,remaining:40})
})
