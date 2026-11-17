import test from 'node:test'
import assert from 'node:assert/strict'
import { paintedName, paintedNameValid } from '../src/lib/paintedName.ts'

test('painted names keep Unicode letters and never silently shorten long names', () => {
  assert.equal(paintedName('Lü-na 2'), 'Lüna')
  assert.equal(paintedName('Charlotte'), 'Charlotte')
  assert.equal(paintedNameValid('Charlotte'), false)
  assert.equal(paintedNameValid('Lüna'), true)
  assert.equal(paintedNameValid(''), false)
})
test('length is checked after uppercase expansion', () => {
  assert.equal(paintedNameValid('Straße'), false)
  assert.equal(paintedNameValid('ßßß'), true)
  assert.equal(paintedNameValid('ßßßa'), false)
})
