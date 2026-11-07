import type { ShopCheckoutInput } from '../src/domain/types'
import { test, expect, type Page } from '@playwright/test'
import { axe, choose, expectActionClearance, mobile, next, open, pet } from './helpers'

const copy = {
  de: { market: 'Abholung am Markt', vienna: 'Lieferung in Wien', time: 'Bitte wähle, wann du kommst.', edit: 'Lieferung ändern', pickup: 'Abholung' },
  en: { market: 'Pick up at the market', vienna: 'Delivery in Vienna', time: 'Please choose when you will come.', edit: 'Change delivery', pickup: 'Pickup' },
} as const

/** Record the checkout input the page hands to the API (photos reduced to a count). */
async function recordCheckout(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/api/client.ts'; const { api } = await import(path)
    const original = api.shop.checkout
    api.shop.checkout = async (input: ShopCheckoutInput) => {
      // The redirect to the thanks page reloads the document, so keep the record in sessionStorage.
      sessionStorage.setItem('e2e-checkout', JSON.stringify({ ...input, items: input.items.map(item => ({ ...item, photos: item.photos.length })) }))
      return original(input)
    }
  })
}

async function choosePickup(page: Page, locale: 'de' | 'en') {
  const market = page.getByRole('radio', { name: new RegExp(`^${copy[locale].market}`) })
  await market.locator('..').click()
  await expect(market).toBeChecked()
  const day = page.locator('input[name="pickup-day"]').first()
  await expect(day).toBeVisible()
  await day.locator('..').click()
  await expect(day).toBeChecked()
  return day.getAttribute('value')
}

for (const locale of ['de', 'en'] as const) {
  test(`market pickup sends no address, no fee and the arrival time (${locale})`, async ({ page }) => {
    await open(page, locale); await recordCheckout(page)
    await choose(page); await pet(page); await next(page).click()
    const date = await choosePickup(page, locale)
    const time = page.getByRole('radio', { name: '15:30', exact: true })
    await time.locator('..').click()
    await expect(time).toBeChecked()
    await expect(page.locator('[data-selected-date]')).toHaveAttribute('data-selected', 'true')
    await expect(page.locator('[data-selected-date] > span')).toContainText('15:30')
    await next(page).click()
    // Pickup needs contact details only.
    await expect(page.locator('#buy-line1, #buy-postal')).toHaveCount(0)
    await page.locator('#buy-name').fill('Alex Example')
    await page.locator('#buy-email').fill('alex@example.com')
    await page.locator('#buy-phone').fill('123456789')
    await axe(page)
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: copy[locale].market })).toBeVisible()
    await expect(page.getByRole('button', { name: copy[locale].edit, exact: true })).toBeVisible()
    await axe(page)
    await page.locator('#buy-terms').check()
    await page.locator('form button[type=submit]').click()
    await expect(page).toHaveURL(/\/buy\/thanks\?code=/)
    const sent = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e-checkout') ?? 'null'))
    expect(sent).toEqual({
      customerName: 'Alex Example', email: 'alex@example.com', phone: '123456789',
      deliveryKind: 'market', pickupTime: '15:30', deliveryDate: date, acceptTerms: true,
      items: [{ kind: 'custom', withName: false, color: 'red', finish: 'shiny', petName: 'Luna', photos: 1 }],
    })
    await expect(page.locator('main')).toContainText(`${copy[locale].pickup} · Rathausplatz`)
  })

  test(`pickup asks for the arrival time before continuing (${locale})`, async ({ page }) => {
    await open(page, locale)
    await choose(page); await pet(page); await next(page).click()
    await choosePickup(page, locale)
    await next(page).click()
    await expect(page.locator('#buy-time-error')).toHaveText(copy[locale].time)
    await expect(page.locator('#buy-time')).toBeFocused()
    // Switching back to Vienna clears the pickup choice; address entry belongs to details.
    await page.getByRole('radio', { name: new RegExp(`^${copy[locale].vienna}`) }).locator('..').click()
    await expect(page.locator('#buy-time')).toHaveCount(0)
    await expect(page.locator('#buy-line1')).toHaveCount(0)
    await expect(page.locator('[class*="dateCard"][aria-pressed]')).toHaveCount(1)
  })
}

test('the mobile action bar spans the card and merges with its end', async ({ page }) => {
  test.skip(!mobile(page), 'The bar docks below 1024px only.')
  await open(page); await choose(page); await pet(page); await next(page).click()
  const bar = page.locator('[data-sticky-actions]')
  await page.evaluate(() => window.scrollTo(0, 0))
  await expectActionClearance(page)
  await page.evaluate(() => document.querySelector('[data-public-page]')!.scrollIntoView({ block: 'end' }))
  await expect.poll(() => bar.evaluate(node => {
    const box = node.getBoundingClientRect()
    const card = node.closest('[data-public-page]')!.getBoundingClientRect()
    return [box.left, box.right, box.bottom].map(Math.round).join(',') === [card.left, card.right, card.bottom].map(Math.round).join(',')
  })).toBe(true)
  await expectActionClearance(page)
  await axe(page)
})
