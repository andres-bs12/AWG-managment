import test from 'node:test'
import assert from 'node:assert/strict'
import { restoreFormDraft, serializeFormDraft } from '../src/lib/formDraft.ts'

const photo = { id: 'saved', name: 'server.jpg', dataUrl: '/api/photos/saved' }
const source = { customerName: 'Alex', email: 'a@example.com', phone: '123', address: { line1: 'Street 1', postalCode: '1010', city: 'Wien' }, items: [{ orderItemId: 'one', petName: 'Luna', backName: 'Luna', note: '', photos: [photo], photosNeedReload: false }] }

test('form draft retains server photos and marks local files for re-entry without storing image bytes', () => {
  const raw = serializeFormDraft({ ...source, items: [{ ...source.items[0], photos: [photo, { id: 'local', name: 'local.jpg', dataUrl: 'data:image/jpeg;base64,secret' }] }] })
  assert.equal(raw.includes('secret'), false)
  const draft = restoreFormDraft(raw, source)
  assert.deepEqual(draft.items[0].photos, [photo])
  assert.equal(draft.items[0].photosNeedReload, true)
})

test('a draft cannot restore photos removed from the server or cross item identities', () => {
  const raw = serializeFormDraft(source)
  assert.deepEqual(restoreFormDraft(raw, { ...source, items: [{ ...source.items[0], photos: [] }] }).items[0].photos, [])
  assert.deepEqual(restoreFormDraft(raw, { ...source, items: [{ ...source.items[0], orderItemId: 'two' }] }).items[0].orderItemId, 'two')
})

test('malformed storage falls back safely, preserving the current server view', () => {
  for (const raw of ['{', '{}', JSON.stringify({ ...source, address: null }), JSON.stringify({ ...source, items: [{ ...source.items[0], petName: null }] })]) {
    assert.deepEqual(restoreFormDraft(raw, source), source)
  }
})
