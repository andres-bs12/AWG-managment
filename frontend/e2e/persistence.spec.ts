import { test, expect } from '@playwright/test'
import { open, choose, pet, next, mobile, review, photo } from './helpers'

test('back name retains value and changes the preview and price', async ({ page }) => {
  await open(page); await choose(page);  const yes = page.getByRole('radio', { name: /^(Ja|Yes),/ })
  await yes.check(); await page.locator('input[id^="back-"]').fill('LUNA')
  await expect(page.getByRole('radio', { name: /^(Hinten|Back)$/ })).toBeChecked()
  await expect(page.locator('[data-buy-total]:visible').first().locator('[aria-hidden="true"]')).toContainText('62,98')
  await page.getByRole('radio', { name: /^(Nein|No)$/ }).check(); await expect(page.locator('[data-buy-total]:visible').first().locator('[aria-hidden="true"]')).toContainText('49,99')
  await yes.check(); await expect(page.locator('input[id^="back-"]')).toHaveValue('LUNA')
})

test('reload restores text and asks for photos again', async ({ page }) => {
  await open(page); await choose(page); await pet(page); await next(page).click()
  await page.locator('#buy-name').fill('Alex Example'); await page.reload()
  await expect(page.locator('fieldset[id^="color-"]')).toBeVisible()
  await expect(page.getByText(/Fotos können nach dem Neuladen/)).toBeVisible()
  await page.locator('input[type=file]').setInputFiles(photo); await expect(page.locator('img[alt^="Foto 1"]')).toBeVisible(); await next(page).click()
  await expect(page.locator('#buy-name')).toHaveValue('Alex Example')
})


test('editing the design from review preserves contact and delivery', async ({ page }) => {
  await open(page); await choose(page); await pet(page); await review(page)
  await page.getByRole('button', { name: /ändern|change/i }).first().click()
  await expect(page.locator('fieldset[id^="color-"]')).toBeVisible()
  await expect(page.getByRole('radio', { name: /^(Rot|Red)$/ })).toBeChecked()
  await next(page).click()
  await expect(page.locator('#buy-terms')).toBeVisible()
  await expect(page.getByText('alex@example.com')).toBeVisible()
})
