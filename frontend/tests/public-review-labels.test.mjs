import test from 'node:test'
import assert from 'node:assert/strict'
import { ornamentName, reviewTitle, receiptTitle } from '../src/lib/ornamentTitle.ts'
import { backNameInput, backNameTooLong } from '../src/lib/backNameInput.ts'
import { phoneValid } from '../src/lib/phone.ts'

const t = (key, vars = {}) => ({ ornamentN: `Kugel ${vars.n}`, formOrnamentsOne: 'Deine Kugel', itemNotPersonalised: 'Nicht personalisierte Kugel' })[key] ?? key

test('a single ornament is never "Kugel 1" and its name is written like /buy', () => {
  assert.equal(reviewTitle({ backName: 'LUNA', petName: '' }, 0, 1, t), 'Luna')
  assert.equal(reviewTitle({ backName: 'max', petName: 'max' }, 0, 1, t), 'Max')
  assert.equal(reviewTitle({ backName: '', petName: '' }, 0, 1, t), 'Deine Kugel')
  assert.equal(ornamentName({ backName: '', petName: ' Otto ' }), 'Otto')
})

test('several ornaments keep their number, with the name once', () => {
  assert.equal(reviewTitle({ backName: 'LUNA' }, 1, 2, t), 'Kugel 2 – Luna')
  assert.equal(reviewTitle({ backName: '' }, 0, 2, t), 'Kugel 1')
})

test('Track calls only ready-made ornaments "not personalised"', () => {
  assert.equal(receiptTitle({ kind: 'custom', backName: '', petName: '' }, 0, 1, t), 'Deine Kugel')
  assert.equal(receiptTitle({ kind: 'custom', backName: '', petName: '' }, 1, 2, t), 'Kugel 2')
  assert.equal(receiptTitle({ kind: 'finished', backName: '', petName: '' }, 1, 2, t), 'Nicht personalisierte Kugel')
  assert.equal(receiptTitle({ kind: 'custom', backName: 'LUNA', petName: '' }, 0, 2, t), 'Luna')
})

test('the back-name field keeps letters only and never cuts a long name off', () => {
  assert.equal(backNameInput('Lu-na 2'), 'Luna')
  assert.equal(backNameInput('Maximilian'), 'Maximilian')
  assert.equal(backNameTooLong('Maximilian'), true)
  assert.equal(backNameTooLong('Müller'), false)
})

test('a phone number needs at least 6 digits in /buy and /form', () => {
  assert.equal(phoneValid('12'), false)
  assert.equal(phoneValid('12345'), false)
  assert.equal(phoneValid('123456'), true)
  assert.equal(phoneValid('+43 660 1234567'), true)
  assert.equal(phoneValid('(0660) 123-456'), true)
  assert.equal(phoneValid('call me'), false)
  assert.equal(phoneValid('1234567890123456'), false)
})
