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
    api.shop.checkout = async (input: Parameters<typeof original>[0]) => {
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
    // The handoff step shows what on one line and where/when on the next.
    await expect(page.locator('main li').filter({ hasText: copy[locale].pickup })).toContainText('Rathausplatz')
  })

  test(`pickup asks for the arrival time before continuing (${locale})`, async ({ page }) => {
    await open(page, locale)
    await choose(page); await pet(page); await next(page).click()
    await choosePickup(page, locale)
    await page.locator('#buy-name').fill('Alex Example')
    await page.locator('#buy-email').fill('alex@example.com')
    await page.locator('#buy-phone').fill('123456789')
    await next(page).click()
    await expect(page.locator('#buy-time-error')).toHaveText(copy[locale].time)
    await expect(page.locator('#buy-time')).toBeFocused()
    // Switching back to Vienna clears the pickup choice and brings the address back.
    await page.getByRole('radio', { name: new RegExp(`^${copy[locale].vienna}`) }).locator('..').click()
    await expect(page.locator('#buy-time')).toHaveCount(0)
    await expect(page.locator('#buy-line1')).toBeVisible()
    await expect(page.locator('[class*="dateCard"][aria-pressed]')).toHaveCount(1)
  })
}

test('the mobile action bar spans the card and merges with its end', async ({ page }) => {
  test.skip(!mobile(page), 'The bar sticks below 1024px only.')
  await open(page); await choose(page); await pet(page); await next(page).click()
  const bar = page.locator('[data-sticky-actions]')
  const geometry = () => page.evaluate(() => {
    const card = document.querySelector('[data-public-page]')!.getBoundingClientRect()
    const actions = document.querySelector<HTMLElement>('[data-sticky-actions]')!
    const box = actions.getBoundingClientRect()
    const css = getComputedStyle(actions)
    return { stuck: actions.dataset.stuck === 'true', cardLeft: card.left, cardRight: card.right, cardBottom: card.bottom, left: box.left, right: box.right, bottom: box.bottom, top: box.top, shadow: css.boxShadow, radius: [css.borderTopLeftRadius, css.borderBottomLeftRadius] }
  })
  await page.locator(':focus').evaluateAll(nodes => nodes.forEach(node => (node as HTMLElement).blur()))
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(async () => (await geometry()).stuck).toBe(false)
  let box = await geometry()
  expect([box.left, box.right]).toEqual([box.cardLeft, box.cardRight])
  expect(box.bottom).toBe(page.viewportSize()!.height)
  expect(box.radius[1]).toBe('0px')
  await expectActionClearance(page)
  await page.evaluate(() => window.scrollTo(0, document.scrollingElement!.scrollHeight))
  await expect(bar).toHaveAttribute('data-stuck', 'true')
  box = await geometry()
  expect([box.left, box.right, box.bottom]).toEqual([box.cardLeft, box.cardRight, box.cardBottom])
  expect(box.shadow).toBe('none')
  expect(box.radius[0]).toBe('0px')
  expect(box.radius[1]).not.toBe('0px')
  await expectActionClearance(page)
  await axe(page)
})
