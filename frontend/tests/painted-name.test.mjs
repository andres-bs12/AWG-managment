import test from 'node:test'
import assert from 'node:assert/strict'
import { paintedName, paintedNameValid, reconcilePetName, patchPetName } from '../src/lib/paintedName.ts'

test('painted names keep Unicode letters and never silently shorten long names', () => {
  assert.equal(paintedName('Lü-na 2'), 'Lüna')
  assert.equal(paintedName('Charlotte'), 'Charlotte')
  assert.equal(paintedNameValid('Charlotte'), false)
  assert.equal(paintedNameValid('Lüna'), true)
  assert.equal(paintedNameValid(''), false)
})
test('legacy names preserve existing lettering, with a pet-name fallback', () => {
  assert.deepEqual(reconcilePetName({ petName: 'Luna', backName: 'MILO', withName: true }), { petName: 'Luna', backName: 'MILO', withName: true })
  assert.equal(reconcilePetName({ petName: '', backName: 'MILO', withName: true }).petName, 'MILO')
  assert.equal(reconcilePetName({ petName: 'Charlotte', backName: 'CHARLO', withName: true }).backName, 'CHARLO')
  assert.equal(reconcilePetName({ petName: 'Luna', backName: '', withName: false }).petName, 'Luna')
})

test('legacy full pet names keep valid shorter lettering', () => {
  const item = reconcilePetName({ petName: 'Luna Belle', backName: 'LUNA', withName: true })
  assert.equal(item.petName, 'Luna Belle')
  assert.equal(item.backName, 'LUNA')
  assert.equal(paintedNameValid(item.backName), true)
})
test('length is checked after uppercase expansion', () => {
  assert.equal(paintedNameValid('Straße'), false)
  assert.equal(paintedNameValid('ßßß'), true)
  assert.equal(paintedNameValid('ßßßa'), false)
})

test('explicit edits can clear the last letter without reviving stale lettering', () => {
  const item = { petName: 'L', backName: 'L', withName: true }
  assert.deepEqual(patchPetName(item, { petName: '' }), { petName: '', backName: '', withName: true })
  assert.equal(patchPetName(item, { petName: 'Milo' }).backName, 'Milo')
})
test('enabling the option may recover lettering; unrelated edits do not restore an empty name', () => {
  assert.equal(patchPetName({ petName: '', backName: 'LUNA', withName: false }, { withName: true }).petName, 'LUNA')
  assert.equal(patchPetName({ petName: '', backName: 'LUNA', withName: true }, {}).petName, '')
})
