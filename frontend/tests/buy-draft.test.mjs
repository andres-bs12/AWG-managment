import test from 'node:test'
import assert from 'node:assert/strict'
import { loadBuyDraft, saveBuyDraft } from '../src/lib/buyDraft.ts'

let saved = ''
globalThis.sessionStorage = { getItem: () => saved || null, setItem: (_key, value) => { saved = value } }

test('old colour or a missing finish requires a new selection', () => {
  saved = JSON.stringify({ items: [ { uid: 'one', color: 'grey', finish: 'shiny' }, { uid: 'two', color: 'red' } ] })
  const draft = loadBuyDraft()
  assert.deepEqual(draft.items.map(({ color, finish }) => [color, finish]), [['', ''], ['', '']])
})

test('draft retains a valid variant without persisting photos or acceptance', () => {
  saved = JSON.stringify({ items: [{ uid: 'one', color: 'green', finish: 'matte', photos: [{ id: 'p' }] }], acceptTerms: true })
  const draft = loadBuyDraft()
  assert.equal(draft.items[0].finish, 'matte')
  assert.equal(draft.items[0].photosNeedReload, true)
  assert.equal(draft.acceptTerms, false)
  assert.equal(saveBuyDraft(draft), true)
  assert.deepEqual(JSON.parse(saved).items[0].photos, [])
})
