import { test, expect, type Page } from '@playwright/test'
import { open, choose, pet, next, chooseFirstDate, axe, expectActionClearance } from './helpers'

/** Full-page captures freeze the sticky action bar mid-page and leave its slot at the end empty, which
 *  reads as a gap that a real phone never shows. Put the bar back in its in-flow place for the picture. */
async function snap(page: Page, name: string) {
  const style = await page.addStyleTag({ content: '[data-public-page] [data-stuck] { position: static !important; }' })
  try { await expect(page).toHaveScreenshot(name, { fullPage: true }) } finally { await style.evaluate(node => node.remove()) }
}

test('screens and validation state meet axe and visual checks', async ({ page }, testInfo) => {
  await open(page); await axe(page)
  await expectActionClearance(page)
  await snap(page, 'design.png')
  if (testInfo.project.name === 'mobile') expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await next(page).click(); await axe(page)
  await choose(page); await pet(page); await next(page).click(); await axe(page)
  await snap(page, 'delivery.png')
  await next(page).click(); await axe(page)
  await expectActionClearance(page)
  await chooseFirstDate(page)
  await page.locator('#buy-name').fill('Alex Example'); await page.locator('#buy-email').fill('alex@example.com'); await page.locator('#buy-phone').fill('123456789'); await page.locator('#buy-line1').fill('Hauptstraße 1'); await page.locator('#buy-postal').fill('1010'); await next(page).click()
  await axe(page); await snap(page, 'review.png')
  await page.locator('form button[type=submit]').click(); await expect(page.locator('#buy-terms')).toBeFocused(); await axe(page)
})

