import { test, expect } from '@playwright/test'
import { open, choose, pet, next, mobile, review, photo } from './helpers'

for (const locale of ['de', 'en']) test(`checkout captures complete ${locale.toUpperCase()} payload`, async ({ page }) => {
  await open(page, locale)
  // Observe the mock service boundary; mock mode does not create a network request.
  await page.evaluate(async () => {
    const path = '/src/api/client.ts'
    const { api } = await import(path)
    api.shop.checkout = async (input: unknown) => { (window as unknown as { checkout: unknown }).checkout = input; return new Promise<never>(() => {}) }
  })
  await choose(page)
  await page.getByRole('radio', { name: /^(Ja|Yes),/ }).check()
  await page.locator('input[id^="back-"]').fill('LUNA')
  // A paid back name is also the pet's name: there is no second name field.
  await expect(page.locator('input[id^="pet-"]')).toHaveCount(0)
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.locator('img[alt*="Luna"]')).toBeVisible()
  await review(page)
  await page.locator('#buy-terms').check()
  await page.locator('form button[type=submit]').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { checkout?: unknown }).checkout)).toMatchObject({
    customerName: 'Alex Example', email: 'alex@example.com', phone: '123456789', address: { line1: 'Hauptstraße 1', postalCode: '1010', city: 'Wien' }, acceptTerms: true,
    items: [{ color: 'red', finish: 'shiny', withName: true, backName: 'LUNA', petName: 'Luna', photos: [expect.anything()] }], deliveryDate: expect.stringMatching(/^2026-/),
  })
})

test('two ornaments retain independent choices', async ({ page }) => {
  await open(page); await choose(page); await pet(page)
  await page.locator('#buy-add').click()
  await choose(page, /^(Rot|Red)$/, /^(Matt|Matte)$/)
  await pet(page, 'Max')
  await page.getByRole('button', { name: 'Kugel 1 bearbeiten', exact: true }).click()
  await expect(page.getByRole('radio', { name: /^(Rot|Red)$/ })).toBeChecked()
  await expect(page.getByRole('radio', { name: /^(Glänzend|Shiny)$/ })).toBeChecked()
  await page.getByRole('button', { name: 'Kugel 2 bearbeiten', exact: true }).click()
  await expect(page.getByRole('radio', { name: /^(Matt|Matte)$/ })).toBeChecked()
  await next(page).click()
  await expect(page.locator('#buy-date')).toBeVisible()
})

