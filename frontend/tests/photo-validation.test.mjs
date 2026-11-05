import test from 'node:test'
import assert from 'node:assert/strict'
import { photoType } from '../src/lib/photoValidation.ts'

test('recognizes supported photo signatures and rejects renamed text', () => {
  for (const bytes of [[255,216,255], [137,80,78,71], [...Buffer.from('RIFF1234WEBP')], [...Buffer.from('0000ftypheic')], [...Buffer.from('0000ftypheix')], [...Buffer.from('0000ftypmif1')]]) assert.ok(photoType(new Uint8Array(bytes)))
  assert.equal(photoType(new TextEncoder().encode('not a jpeg')), null)
  assert.equal(photoType(new TextEncoder().encode('RIFF1234NOPE')), null)
})
