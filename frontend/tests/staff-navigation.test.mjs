import test from 'node:test'
import assert from 'node:assert/strict'
import { staffHubTarget, rememberStaffHub } from '../src/lib/staffNav.ts'
const values = new Map()
globalThis.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }

test('returns to the selected agenda day and item', () => {
  const from = '/staff/agenda?date=2026-12-02&block=blk-104&view=list'
  assert.equal(staffHubTarget(from).to, from)
})
test('remembers delivery filters when opening a detail directly', () => {
  const path = '/staff/deliveries?day=2026-12-02&mode=route'
  rememberStaffHub(path)
  assert.equal(staffHubTarget().to, path)
})
test('does not accept unrelated or external destinations', () => {
  assert.equal(staffHubTarget('https://example.com/staff/agenda').to, '/staff/agenda')
  assert.equal(staffHubTarget('/staff/agenda-unrelated').to, '/staff/agenda')
})
