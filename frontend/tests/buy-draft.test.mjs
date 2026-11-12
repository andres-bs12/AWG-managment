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

test('legacy drafts preserve stored lettering and optional pet names without restoring a screen index', () => {
  saved = JSON.stringify({ items: [
    { uid: 'one', color: 'red', finish: 'shiny', withName: true, petName: 'Charlotte', backName: 'CHARLO', photosNeedReload: true },
    { uid: 'two', color: 'green', finish: 'matte', withName: true, petName: '', backName: 'MILO' },
  ], buyStep: 2 })
  const draft = loadBuyDraft()
  assert.equal(draft.items[0].petName, 'Charlotte')
  assert.equal(draft.items[0].backName, 'CHARLO')
  assert.equal(draft.items[0].photosNeedReload, true)
  assert.equal(draft.items[1].petName, '')
  assert.equal(draft.items[1].backName, 'MILO')
  assert.equal('buyStep' in draft, false)
  saveBuyDraft({ ...draft, buyStep: 3 })
  assert.equal('buyStep' in JSON.parse(saved), false)
})

test('saving an explicit empty name never restores previous lettering', () => {
  saved = JSON.stringify({ items: [{ uid: 'one', withName: true, petName: 'L', backName: 'L' }] })
  const draft = loadBuyDraft()
  draft.items[0].petName = ''; draft.items[0].backName = ''
  saveBuyDraft(draft)
  assert.equal(JSON.parse(saved).items[0].petName, '')
  assert.equal(JSON.parse(saved).items[0].backName, '')
  assert.equal(loadBuyDraft().items[0].petName, '')
})
