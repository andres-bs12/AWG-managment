import { test, expect } from '@playwright/test'
import { open, choose, pet, next, chooseFirstDate, axe, expectActionClearance } from './helpers'

test('public chrome keeps its own opaque reading surfaces over the scene', async ({ page }) => {
  await open(page)
  const footer = page.getByRole('contentinfo')
  const brand = page.getByRole('banner').getByRole('link', { name: 'ArtWithGab', exact: true })
  await expect(footer).toHaveCSS('background-color', 'rgb(242, 248, 255)')
  await expect(brand).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(brand).toHaveCSS('color', 'rgb(21, 32, 51)')
  await footer.scrollIntoViewIfNeeded()
  await axe(page)
  await brand.click()
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('contentinfo')).toHaveCSS('background-color', 'rgb(242, 248, 255)')
})

test('screens and validation state meet axe and visual checks', async ({ page }, testInfo) => {
  await open(page); await axe(page)
  await expectActionClearance(page)
  await expect(page).toHaveScreenshot('design.png', { fullPage: true })
  if (testInfo.project.name === 'mobile') expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await next(page).click(); await axe(page)
  await choose(page); await pet(page); await next(page).click(); await axe(page)
  await expect(page).toHaveScreenshot('delivery.png', { fullPage: true })
  await next(page).click(); await axe(page)
  await expectActionClearance(page)
  await chooseFirstDate(page)
  await next(page).click(); await axe(page)
  await expect(page).toHaveScreenshot('details.png', { fullPage: true })
  await page.locator('#buy-name').fill('Alex Example'); await page.locator('#buy-email').fill('alex@example.com'); await page.locator('#buy-phone').fill('123456789'); await page.locator('#buy-line1').fill('Hauptstraße 1'); await page.locator('#buy-postal').fill('1010'); await next(page).click()
  await axe(page); await expect(page).toHaveScreenshot('review.png', { fullPage: true })
  await page.locator('form button[type=submit]').click(); await expect(page.locator('#buy-terms')).toBeFocused(); await axe(page)
})

