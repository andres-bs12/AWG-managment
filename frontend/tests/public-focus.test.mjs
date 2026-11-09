import test from 'node:test'
import assert from 'node:assert/strict'
import { keepFormFocusVisible } from '../src/lib/publicFormFocus.ts'

// Model viewport geometry only; browser sticky layout and Tab order are covered in E2E.
function repair({ field, bar, preview, viewport, inActions = false, active = true }) {
  class Element {
    tabIndex = 0
    constructor(rect) { this.rect = { left: 16, right: 344, ...rect } }
    getBoundingClientRect() { return this.rect }
    contains(target) { return this === target || (this === actions && inActions) }
  }
  const target = new Element(field)
  const actions = bar && new Element(bar)
  const artwork = preview && new Element(preview)
  const form = { querySelector: selector => selector === '[data-public-preview]' ? artwork : actions }
  const scrolls = []
  const globals = {
    HTMLElement: Element,
    document: { activeElement: active ? target : null, scrollingElement: { scrollBy: value => scrolls.push(value) } },
    window: { innerHeight: 640, visualViewport: viewport },
    getComputedStyle: () => ({ getPropertyValue: () => '8', position: 'sticky' }),
    requestAnimationFrame: callback => callback(),
  }
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  try {
    for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value })
    keepFormFocusVisible({ target, currentTarget: form })
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
  return scrolls
}

test('scrolls the document until the entire focused field clears the sticky actions and focus gap', () => {
  assert.deepEqual(repair({ field: { top: 572, bottom: 620 }, bar: { top: 550, bottom: 640 } }), [{ top: 78, behavior: 'instant' }])
})

test('reveals a field below the sticky preview without treating a desktop side column as an obstruction', () => {
  assert.deepEqual(repair({ field: { top: 40, bottom: 88 }, preview: { top: 0, bottom: 180 } }), [{ top: -148, behavior: 'instant' }])
  assert.deepEqual(repair({ field: { top: 40, bottom: 88, left: 500, right: 700 }, preview: { top: 0, bottom: 180 } }), [])
})

test('repairs focus against the panned visual viewport when a keyboard reduces the reading area', () => {
  assert.deepEqual(repair({ field: { top: 402, bottom: 450 }, viewport: { offsetTop: 100, height: 320 }, bar: { top: 800, bottom: 880 } }), [{ top: 38, behavior: 'instant' }])
})

test('does not scroll an already visible action or a field that has lost focus', () => {
  assert.deepEqual(repair({ field: { top: 576, bottom: 624 }, bar: { top: 550, bottom: 640 }, inActions: true }), [])
  assert.deepEqual(repair({ field: { top: 572, bottom: 620 }, bar: { top: 550, bottom: 640 }, active: false }), [])
})
