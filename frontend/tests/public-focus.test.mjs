import test from 'node:test'
import assert from 'node:assert/strict'
import { keepFormFocusVisible } from '../src/lib/publicFormFocus.ts'

// Model viewport geometry only; browser sticky layout and Tab order are covered in E2E.
function repair({ field, preview, overlay, viewport, active = true }) {
  class Element {
    tabIndex = 0
    constructor(rect) { this.rect = { left: 16, right: 344, ...rect } }
    getBoundingClientRect() { return this.rect }
    contains(target) { return this === target }
    querySelector() { return this === artwork ? content : null }
  }
  const target = new Element(field)
  const artwork = preview && new Element(preview)
  const content = overlay && new Element(overlay)
  const form = { querySelector: selector => selector === '[data-public-sticky]' ? artwork : null }
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

test('scrolls the document until the entire focused field clears the viewport bottom and focus gap', () => {
  assert.deepEqual(repair({ field: { top: 590, bottom: 638 } }), [{ top: 6, behavior: 'instant' }])
})

test('reveals a field below the sticky preview without treating a desktop side column as an obstruction', () => {
  assert.deepEqual(repair({ field: { top: 40, bottom: 88 }, preview: { top: 0, bottom: 180 } }), [{ top: -148, behavior: 'instant' }])
  assert.deepEqual(repair({ field: { top: 40, bottom: 88, left: 500, right: 700 }, preview: { top: 0, bottom: 180 } }), [])
})

test('clears the editor overlay even though its sticky anchor occupies zero height', () => {
  assert.deepEqual(repair({ field: { top: 40, bottom: 88 }, preview: { top: 0, bottom: 0 }, overlay: { top: 0, bottom: 64 } }), [{ top: -32, behavior: 'instant' }])
})

test('repairs focus against the panned visual viewport when a keyboard reduces the reading area', () => {
  assert.deepEqual(repair({ field: { top: 402, bottom: 450 }, viewport: { offsetTop: 100, height: 320 } }), [{ top: 38, behavior: 'instant' }])
})

test('does not scroll a visible field or a field that has lost focus', () => {
  assert.deepEqual(repair({ field: { top: 524, bottom: 572 } }), [])
  assert.deepEqual(repair({ field: { top: 590, bottom: 638 }, active: false }), [])
})
