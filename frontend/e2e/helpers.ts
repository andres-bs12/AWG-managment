import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { join } from 'node:path'

export const photo = join(import.meta.dirname, 'fixtures/pet.png')
export const next = (page: Page) => page.locator('form').getByRole('button', { name: /^(Weiter|Continue)$/ })
export const mobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024

export async function open(page: Page, locale = 'de') {
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00Z'))
  await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
  await page.goto('/buy')
  await expect(page.locator('fieldset[id^="color-"]')).toBeVisible()
}
export async function choose(page: Page, color = /^(Rot|Red)$/, finish = /^(Glänzend|Shiny)$/) {
  for (const name of [color, finish]) {
    const radio = page.getByRole('radio', { name })
    await radio.locator('..').click()
    await expect(radio).toBeChecked()
  }
}
export async function chooseFirstDate(page: Page) {
  const radio = page.locator('input[name="delivery-date"]').first()
  await radio.locator('..').click()
  await expect(radio).toBeChecked()
}
export async function pet(page: Page, name = 'Luna') {
  // There is no pet-name field: a name is only asked for when it is painted on the back.
  void name
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.locator('img[alt^="Foto 1"], img[alt^="Photo 1"]')).toBeVisible()
}
export async function delivery(page: Page) {
  await next(page).click()
  await expect(page.locator('#buy-date')).toBeVisible()
  await chooseFirstDate(page)
  await page.locator('#buy-name').fill('Alex Example')
  await page.locator('#buy-email').fill('alex@example.com')
  await page.locator('#buy-phone').fill('123456789')
  await page.locator('#buy-line1').fill('Hauptstraße 1')
  await page.locator('#buy-postal').fill('1010')
}
export async function review(page: Page) { await delivery(page); await next(page).click(); await expect(page.locator('#buy-terms')).toBeVisible() }
export async function axe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(results.violations).toEqual([])
}

export async function expectDocumentScroll(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('[data-public-shell]')!
    const scroller = document.scrollingElement!
    const style = getComputedStyle(shell)
    return scroller === document.documentElement && style.overflowY === 'visible'
      && shell.scrollTop === 0 && scroller.scrollWidth <= scroller.clientWidth
      && shell.scrollWidth <= shell.clientWidth
  })).toBe(true)
}

export async function expectActionClearance(page: Page, mode = mobile(page) ? 'sticky' : 'flow') {
  await expectDocumentScroll(page)
  await expect.poll(() => page.locator('[data-sticky-actions]').evaluate((bar, expected) => {
    const actions = bar.getBoundingClientRect()
    const viewport = window.visualViewport
    const top = viewport?.offsetTop ?? 0
    const bottom = top + (viewport?.height ?? innerHeight)
    const active = document.activeElement
    const rect = active?.getBoundingClientRect()
    const visibleFocus = !active || active === document.body || !rect || (
      rect.top >= top && rect.bottom <= bottom
      && (bar.contains(active) || rect.right <= actions.left || rect.left >= actions.right
        || rect.bottom <= actions.top || rect.top >= actions.bottom))
    if (expected === 'flow') return getComputedStyle(bar).position === 'static' && visibleFocus
    // Sticky stays in flow even at the card end; only its corners/shadow change there.
    const inside = actions.left >= 0 && actions.right <= innerWidth && actions.bottom <= bottom + 0.5
    return getComputedStyle(bar).position === 'sticky' && inside && visibleFocus
  }, mode)).toBe(true)
}
