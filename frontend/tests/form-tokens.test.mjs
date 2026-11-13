import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { rememberFormToken, readFormToken, forgetFormToken, clearFormTokens, pruneFormTokens } from '../src/api/formTokens.ts'

const now = Date.parse('2026-11-05T12:00:00Z')
const lifetime = 45 * 24 * 60 * 60 * 1000
const key = 'awg-form-token:AWGABC123'

beforeEach(() => {
  const entries = new Map()
  globalThis.localStorage = {
    get length() { return entries.size }, key: index => [...entries.keys()][index] ?? null,
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key),
  }
})

test('submitted customer token has a timestamp, matches only its code, and does not refresh on read', () => {
  rememberFormToken(' awgabc123 ', 'customer-token', true, now)
  assert.deepEqual(JSON.parse(localStorage.getItem(key)), { token: 'customer-token', savedAt: now })
  assert.equal(readFormToken('awgabc123', now + lifetime - 1), 'customer-token')
  assert.equal(readFormToken('AWGOTHER1', now), null)
  assert.equal(JSON.parse(localStorage.getItem(key)).savedAt, now)
  assert.equal(readFormToken('AWGABC123', now + lifetime), null)
  assert.equal(localStorage.getItem(key), null)
})

test('staff handoff and active staff sessions cannot leave a persisted customer token', () => {
  rememberFormToken('AWGABC123', 'previous-token', true, now)
  rememberFormToken('AWGABC123', 'handoff-token', false, now)
  assert.equal(localStorage.getItem(key), null)
  localStorage.setItem('awg-staff-token', 'staff-session')
  rememberFormToken('AWGABC123', 'customer-token', true, now)
  assert.equal(localStorage.getItem(key), null)
})

test('startup pruning drops legacy, malformed, expired and future entries without guessing their age', () => {
  const invalid = ['', 'legacy-raw-token', '{', '{}', 'null', JSON.stringify({ token: '', savedAt: now }), JSON.stringify({ token: 1, savedAt: now }), JSON.stringify({ token: 'old', savedAt: now - lifetime }), JSON.stringify({ token: 'future', savedAt: now + 1 })]
  invalid.forEach((raw, index) => localStorage.setItem(`awg-form-token:bad${index}`, raw))
  rememberFormToken('AWGABC123', 'valid', true, now)
  localStorage.setItem('awg-locale', 'de')
  pruneFormTokens(now)
  assert.equal(localStorage.length, 2)
  assert.equal(readFormToken('AWGABC123', now), 'valid')
  assert.equal(localStorage.getItem('awg-locale'), 'de')
})

test('logout clears every form token while cancellation removes only its own code', () => {
  rememberFormToken('AWGABC123', 'first', true, now)
  rememberFormToken('AWGSECOND', 'second', true, now)
  localStorage.setItem('awg-form-token:LEGACY', 'legacy-token')
  localStorage.setItem('awg-form-token:lower-case-legacy', 'legacy-token')
  localStorage.setItem('awg-locale', 'en')
  forgetFormToken(' awgabc123 ')
  assert.equal(localStorage.getItem(key), null)
  assert.equal(readFormToken('AWGSECOND', now), 'second')
  clearFormTokens()
  assert.equal(localStorage.length, 1)
  assert.equal(localStorage.getItem('awg-locale'), 'en')
})

test('blocked browser storage never prevents form submission, tracking or logout', () => {
  globalThis.localStorage = new Proxy({}, { get() { throw new Error('Storage blocked') } })
  assert.doesNotThrow(() => rememberFormToken('AWGABC123', 'token', true, now))
  assert.equal(readFormToken('AWGABC123', now), null)
  assert.doesNotThrow(() => pruneFormTokens(now))
  assert.doesNotThrow(clearFormTokens)
  assert.doesNotThrow(() => forgetFormToken('AWGABC123'))
})
