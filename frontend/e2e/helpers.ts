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
  if (mobile(page)) { await next(page).click(); await next(page).click() }
  await page.locator('input[id^="pet-"]').fill(name)
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.locator('img[alt*="Luna"], img[alt*="Max"]')).toBeVisible()
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

