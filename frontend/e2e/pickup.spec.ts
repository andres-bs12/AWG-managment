import { test, expect, type Locator, type Page } from '@playwright/test'
import { axe, choose, expectActionClearance, mobile, next, open, pet } from './helpers'

const copy = {
  de: { market: 'Abholung am Markt', post: 'Versand per Post', time: 'Wähle, wann du kommst.', edit: 'Lieferung ändern', pickup: 'Abholung', unavailable: 'Vor Weihnachten ist kein Postversand mehr möglich.' },
  en: { market: 'Pick up at the market', post: 'Shipping by post', time: 'Please choose when you will come.', edit: 'Change delivery', pickup: 'Pickup', unavailable: 'Post can no longer arrive before Christmas.' },
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

const mapName = {
  de: /^Rathausplatz.* auf Google Maps öffnen$/,
  en: /^Open Rathausplatz.* in Google Maps$/,
} as const

/** Link to Google Maps for the market name: new tab, no opener, 44px target, pin icon hidden from AT. */
async function expectMapLink(link: Locator) {
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Rathausplatz, Wien')}`)
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  await expect(link.locator('svg')).toHaveAttribute('aria-hidden', 'true')
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
}

async function choosePickup(page: Page, locale: 'de' | 'en') {
  const market = page.getByRole('radio', { name: new RegExp(`^${copy[locale].market}`) })
  await market.locator('..').click()
  await expect(market).toBeChecked()
  const day = page.locator('input[name="pickup-day"]').first()
  await expect(day).toBeVisible()
  // The lead sentence is gone; the market name is a Google Maps link.
  await expect(page.getByText(locale === 'de' ? 'Wähle einen Markttag und wann du vorbeikommst' : 'Choose a market day and when you will come by')).toHaveCount(0)
  await expectMapLink(page.getByRole('heading', { level: 3 }).getByRole('link', { name: mapName[locale] }))
  await expect(page.getByText('Christkindlmarkt Spittelberg', { exact: false })).toHaveCount(0)
  await day.locator('..').click()
  await expect(day).toBeChecked()
  return day.getAttribute('value')
}

for (const locale of ['de', 'en'] as const) {
  test(`market pickup sends no address, no fee and the arrival time (${locale})`, async ({ page }) => {
    await open(page, locale); await recordCheckout(page)
    await choose(page); await pet(page); await next(page).click()
    const marketDayId = await choosePickup(page, locale)
    expect(marketDayId).toBe('md-04')
    const time = page.getByRole('radio', { name: '15:30', exact: true })
    await time.locator('..').click()
    await expect(time).toBeChecked()
    await expect(page.locator('[data-selected-date]')).toHaveAttribute('data-selected', 'true')
    await expect(page.locator('[data-selected-date] > span')).toContainText('15:30')
    // Pickup needs contact details only.
    await expect(page.locator('#buy-line1, #buy-postal, #buy-city')).toHaveCount(0)
    await page.locator('#buy-name').fill('Alex Example')
    await page.locator('#buy-email').fill('alex@example.com')
    await page.locator('#buy-phone').fill('123456789')
    await axe(page)
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: copy[locale].market })).toBeVisible()
    await expect(page.getByRole('button', { name: copy[locale].edit, exact: true })).toBeVisible()
    await expectMapLink(page.getByRole('link', { name: mapName[locale] }))
    await axe(page)
    await page.locator('#buy-terms').check()
    await page.locator('form button[type=submit]').click()
    await expect(page).toHaveURL(/\/buy\/thanks\?code=/)
    const sent = await page.evaluate(() => JSON.parse(sessionStorage.getItem('e2e-checkout') ?? 'null'))
    expect(sent).toEqual({
      customerName: 'Alex Example', email: 'alex@example.com', phone: '123456789',
      deliveryKind: 'market', marketDayId, pickupTime: '15:30', deliveryDate: '2026-12-04', acceptTerms: true, locale,
      items: [{ kind: 'custom', withName: false, size: 'big', color: 'red', finish: 'shiny', petName: '', photos: 1 }],
    })
    // The handoff step shows what on one line and where/when on the next.
    const handoff = page.locator('main li').filter({ hasText: copy[locale].pickup })
    await expectMapLink(handoff.getByRole('link', { name: locale === 'de' ? 'Rathausplatz auf Google Maps öffnen' : 'Open Rathausplatz in Google Maps' }))
    // Title and detail are separate blocks (the title never runs into the date).
    const [title, detail] = await handoff.locator('strong, span:not([aria-hidden])').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top))
    expect(detail).toBeGreaterThan(title)
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
    // Switching back to Post clears the pickup choice and brings the address and arrival range back.
    await page.getByRole('radio', { name: new RegExp(`^${copy[locale].post}`) }).locator('..').click()
    await expect(page.locator('#buy-time')).toHaveCount(0)
    await expect(page.locator('#buy-line1')).toBeVisible()
    await expect(page.locator('#buy-city')).toBeVisible()
    await expect(page.locator('[data-selected-date]')).toHaveAttribute('data-selected', 'true')
  })

  test(`when Post can no longer arrive before Christmas, the card is disabled and market pickup stays selectable (${locale})`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-12-20T12:00:00Z'))
    await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
    await page.goto('/buy')
    await expect(page.locator('fieldset[id^="color-"]')).toBeVisible()
    await choose(page); await pet(page); await next(page).click()
    const postRadio = page.locator('input[name="delivery-kind"][value="post"]')
    const marketRadio = page.locator('input[name="delivery-kind"][value="market"]')
    await expect(postRadio).toBeDisabled()
    await expect(postRadio.locator('..')).toContainText(copy[locale].unavailable)
    await expect(marketRadio).toBeEnabled()
    await expect(marketRadio).toBeChecked()
    await axe(page)
  })
}

test('the mobile action bar stays in flow at the card end and spans it', async ({ page }) => {
  test.skip(!mobile(page), 'The full-width docked row is the phone and tablet layout.')
  await open(page); await choose(page); await pet(page); await next(page).click()
  const geometry = () => page.evaluate(() => {
    const card = document.querySelector('[data-public-page]')!.getBoundingClientRect()
    const actions = document.querySelector<HTMLElement>('[data-public-actions]')!
    const box = actions.getBoundingClientRect()
    const css = getComputedStyle(actions)
    return { position: css.position, cardLeft: card.left, cardRight: card.right, cardBottom: card.bottom, left: box.left, right: box.right, bottom: box.bottom, shadow: css.boxShadow, radius: [css.borderTopLeftRadius, css.borderBottomLeftRadius] }
  })
  await page.locator(':focus').evaluateAll(nodes => nodes.forEach(node => (node as HTMLElement).blur()))
  for (const top of [0, Number.MAX_SAFE_INTEGER]) {
    await page.evaluate(value => window.scrollTo(0, value), top)
    const box = await geometry()
    // Wherever the page is scrolled, the bar never floats: it is the card's bottom row.
    expect(box.position).toBe('static')
    expect([box.left, box.right, box.bottom]).toEqual([box.cardLeft, box.cardRight, box.cardBottom])
    expect(box.shadow).toBe('none')
    expect(box.radius[0]).toBe('0px')
    expect(box.radius[1]).not.toBe('0px')
  }
  await expectActionClearance(page)
  await axe(page)
})
