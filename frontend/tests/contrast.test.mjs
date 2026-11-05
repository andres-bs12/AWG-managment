import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contrastRatio } from '../src/lib/contrast.mjs'

test('WCAG contrast uses linear sRGB, is symmetric and rejects uncomposited alpha', () => {
  assert.equal(contrastRatio('#000', '#fff'), 21)
  assert.equal(contrastRatio('#fff', '#ffffff'), 1)
  assert.equal(contrastRatio('#123456', '#fff'), contrastRatio('#fff', '#123456'))
  assert.equal(contrastRatio('rgb(0, 0, 0)', 'rgb(255 255 255)'), 21)
  assert.equal(contrastRatio('rgba(0,0,0,1)', '#fff'), 21)
  assert.equal(contrastRatio('rgba(21,32,51,0.56)', '#fff'), null)
  assert.equal(contrastRatio('transparent', '#fff'), null)
  assert.equal(contrastRatio('rgb(256,0,0)', '#fff'), null)
  assert.equal(contrastRatio('#5c6b80', '#f3f5f7').toFixed(2), '4.97')
})

test('sold-out text and muted text meet 4.5:1 using the actual tokens', () => {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
  const value = name => css.match(new RegExp(`${name}:\\s*(#[\\da-f]+);`, 'i'))[1]
  for (const [foreground, background] of [['--color-disabled-text', '--color-disabled-surface'], ['--color-text-muted', '--color-surface'], ['--color-text', '--color-selected-surface']]) {
    assert.ok(contrastRatio(value(foreground), value(background)) >= 4.5, `${foreground} / ${background}`)
  }
})

test('staff slot status labels retain 4.5:1 contrast on their status surfaces', () => {
  const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
  const value = name => css.match(new RegExp(`${name}:\\s*(#[\\da-f]+);`, 'i'))[1]
  for (const status of ['idle', 'painting', 'ready', 'done']) assert.ok(contrastRatio(value(`--staff-slot-${status}-ink`), value(`--staff-slot-${status}`)) >= 4.5, status)
})
