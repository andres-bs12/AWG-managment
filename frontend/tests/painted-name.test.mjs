import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_BACK_NAME_MAX, paintedName, paintedNameValid } from '../src/lib/paintedName.ts'
import { backNameTooLong } from '../src/lib/backNameInput.ts'

test('painted names keep Unicode letters and never silently shorten long names', () => {
  assert.equal(paintedName('Lü-na 2'), 'Lüna')
  assert.equal(paintedName('Charlotte'), 'Charlotte')
  assert.equal(paintedNameValid('Charlotte'), false)
  assert.equal(paintedNameValid('Lüna'), true)
  assert.equal(paintedNameValid(''), false)
})
test('length is checked after uppercase expansion against the default limit of 5', () => {
  assert.equal(DEFAULT_BACK_NAME_MAX, 5)
  assert.equal(paintedNameValid('Bella'), true)
  assert.equal(paintedNameValid('Bellaa'), false)
  assert.equal(paintedNameValid('ßßa'), true)
  assert.equal(paintedNameValid('ßßß'), false)
})
test('the staff limit replaces the default', () => {
  assert.equal(paintedNameValid('ßßß', 6), true)
  assert.equal(paintedNameValid('Bella', 4), false)
  assert.equal(backNameTooLong('Bellaa', 6), false)
  assert.equal(backNameTooLong('Bellaa', 5), true)
  assert.equal(backNameTooLong('', 5), false)
})
test('a name saved under a higher limit stays valid only while unchanged', () => {
  assert.equal(paintedNameValid('Bellaa', 5, 'BELLAA'), true)
  assert.equal(backNameTooLong('bellaa', 5, 'BELLAA'), false)
  assert.equal(paintedNameValid('Bellab', 5, 'BELLAA'), false)
})
