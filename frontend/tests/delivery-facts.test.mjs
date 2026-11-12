import test from 'node:test'
import assert from 'node:assert/strict'
import { customerLabel, ornamentLabel, viennaDistrict, paymentLine, handoverBlocker, productionLabel } from '../src/lib/deliveryFacts.ts'

const eur = n => `€${n.toFixed(2)}`

test('walk-in customers read as not given yet', () => {
  assert.equal(customerLabel('Walk-in'), 'Name not given yet')
  assert.equal(customerLabel(''), 'Name not given yet')
  assert.equal(customerLabel('Anna'), 'Anna')
})

test('ornament label shows the name, or why there is none', () => {
  assert.equal(ornamentLabel({ kind: 'custom', backName: 'LUNA' }), 'LUNA')
  assert.equal(ornamentLabel({ kind: 'custom' }), 'Personalised · no name')
  assert.equal(ornamentLabel({ kind: 'finished' }), 'Not personalised')
})

test('vienna district comes from the postcode', () => {
  assert.equal(viennaDistrict('1010'), '1st district')
  assert.equal(viennaDistrict('1020'), '2nd district')
  assert.equal(viennaDistrict('1030'), '3rd district')
  assert.equal(viennaDistrict('1110'), '11th district')
  assert.equal(viennaDistrict('1120'), '12th district')
  assert.equal(viennaDistrict('1210'), '21st district')
  assert.equal(viennaDistrict('1230'), '23rd district')
  assert.equal(viennaDistrict('1240'), null)
  assert.equal(viennaDistrict('2340'), null)
  assert.equal(viennaDistrict(null), null)
})

test('payment line says who owes what', () => {
  assert.deepEqual(paymentLine({ paymentState: 'unpaid', remaining: 49.99 }, eur), { text: 'Collect €49.99 · not paid yet', due: true })
  assert.deepEqual(paymentLine({ paymentState: 'deposit', remaining: 25 }, eur), { text: 'Collect €25.00 · deposit paid', due: true })
  assert.deepEqual(paymentLine({ paymentState: 'paid', remaining: 0 }, eur), { text: 'Paid', due: false })
})

test('handover blocker explains a disabled button', () => {
  const base = { kind: 'custom', handedOver: false }
  assert.equal(handoverBlocker({ ...base, productionStatus: 'finished' }), null)
  assert.equal(handoverBlocker({ ...base, productionStatus: 'not_started', waitingForCustomer: true }), 'Waiting for the customer form or photos')
  assert.equal(handoverBlocker({ ...base, productionStatus: 'in_progress' }), 'Still being painted')
  assert.equal(handoverBlocker({ ...base, productionStatus: 'not_started' }), 'Not painted yet')
  assert.equal(handoverBlocker({ ...base, productionStatus: 'not_started', handedOver: true }), null)
  assert.equal(productionLabel({ kind: 'finished', productionStatus: 'finished', handedOver: false }), 'Ready-made')
})
