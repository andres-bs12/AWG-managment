import { test, expect } from '@playwright/test'
import { open, choose, pet, next, chooseFirstDate, axe } from './helpers'

test('screens and validation state meet axe and visual checks', async ({ page }, testInfo) => {
  await open(page); await axe(page)
  await expect(page).toHaveScreenshot('design.png', { fullPage: true })
  if (testInfo.project.name === 'mobile') expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await next(page).click(); await axe(page)
  await choose(page); await pet(page); await next(page).click(); await axe(page)
  await expect(page).toHaveScreenshot('delivery.png', { fullPage: true })
  await next(page).click(); await axe(page)
  await chooseFirstDate(page)
  await page.locator('#buy-name').fill('Alex Example'); await page.locator('#buy-email').fill('alex@example.com'); await page.locator('#buy-phone').fill('123456789'); await page.locator('#buy-line1').fill('Hauptstraße 1'); await page.locator('#buy-postal').fill('1010'); await next(page).click()
  await axe(page); await expect(page).toHaveScreenshot('review.png', { fullPage: true })
  await page.locator('form button[type=submit]').click(); await expect(page.locator('#buy-terms')).toBeFocused(); await axe(page)
})

