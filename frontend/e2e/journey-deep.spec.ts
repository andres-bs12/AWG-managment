import { test, expect, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import type { ShopConfig, ShopDeliveryDate } from '../src/domain/types'
import { choose, delivery, mobile, next, open, photo } from './helpers'

type Locale = 'de' | 'en'
const dates: ShopDeliveryDate[] = ['2026-12-02', '2026-12-09', '2026-12-16'].map(date => ({ date, weekday: 'Wednesday' }))
const contact = { customerName: 'Alex Example', email: 'alex@example.com', phone: '123456789' }
const address = { line1: 'Hauptstraße 1', line2: 'Stiege 2, Tür 3', postalCode: '1010', city: 'Wien' }
const note = 'Keep the white whiskers'
const money = (amount: number, locale: Locale = 'de') => new Intl.NumberFormat(locale === 'de' ? 'de-AT' : 'en-IE', { style: 'currency', currency: 'EUR' }).format(amount)
const preview = (page: Page) => page.locator('form div[role="img"]')
// The first column is the persistent preview, above the options at mobile widths.
const price = (page: Page) => page.locator('form [data-buy-total]:visible').first().locator('span[aria-hidden="true"]')
const nameOption = (page: Page) => page.getByRole('checkbox', { name: /name (auf|on)/i })
const backButton = (page: Page) => page.locator('form').getByRole('button', { name: /^(Zurück|Back)$/ })

async function prepare(page: Page): Promise<ShopConfig> {
  await open(page)
  // Work through the API boundary so the mock config contains two genuinely
  // available colours/finishes; never rely on the demo stock distribution.
  await page.evaluate(async () => {
    const path = '/src/api/client.ts'
    const { api } = await import(path)
    for (const item of await api.inventory.list()) {
      if (item.kind === 'custom') await api.inventory.update(item.id, 5, item.quantity)
    }
  })
  await page.reload()
  await expect(page.locator('fieldset[id^="color-"]')).toBeVisible()
  await page.route('**/api/shop/delivery-dates', route => route.fulfill({ json: dates }))
  // The configured server is mock. Use the REAL multipart HTTP checkout and
  // availability adapters so page.route observes the actual wire contract.
  return page.evaluate(async () => {
    const clientPath = '/src/api/client.ts'
    const httpPath = '/src/api/http/services.ts'
    const { api } = await import(clientPath)
    const { httpApi } = await import(httpPath)
    api.shop.listDeliveryDates = httpApi.shop.listDeliveryDates
    api.shop.checkout = httpApi.shop.checkout
    return api.shop.getConfig()
  })
}

async function namedDesign(page: Page, color = /^(Rot|Red)$/, finish = /^(Glänzend|Shiny)$/, name = 'Luna') {
  await choose(page, color, finish)
  if (mobile(page)) await next(page).click()
  await nameOption(page).check()
  await page.locator('input[id^="back-"]').fill(name)
  await expect(page.locator('input[id^="back-"]')).toHaveValue(name)
  if (mobile(page)) await next(page).click()
  await page.locator('input[id^="pet-"]').fill(name)
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.getByRole('img', { name: new RegExp(`^(Foto|Photo) 1 (von|of) ${name}$`) })).toBeVisible()
}

async function addNote(page: Page) {
  await page.locator('summary').click()
  await page.locator('textarea[id^="note-"]').fill(note)
}

async function fillDelivery(page: Page) {
  await delivery(page)
  await expect(page.locator('input[name="delivery-date"]').first()).toBeChecked()
  await page.locator('#buy-line2').fill(address.line2)
}

async function expectContact(page: Page) {
  for (const [id, value] of Object.entries({
    'buy-name': contact.customerName, 'buy-email': contact.email, 'buy-phone': contact.phone,
    'buy-line1': address.line1, 'buy-line2': address.line2, 'buy-postal': address.postalCode,
  })) await expect(page.locator(`#${id}`)).toHaveValue(value)
  await expect(page.locator('input[name="delivery-date"]').first()).toBeChecked()
  await expect(page.locator('input[name="delivery-date"]').first()).toHaveAttribute('aria-label', 'Mittwoch, 2. Dezember 2026')
}

async function expectReview(page: Page, total: number, locale: Locale = 'de') {
  await expect(page.locator('#buy-heading')).toHaveText(locale === 'de' ? 'Prüfen & bezahlen' : 'Review & pay')
  await expect(page.locator('form button[type=submit]')).toHaveText(`${locale === 'de' ? 'Zahlungspflichtig bestellen' : 'Order and pay'} · ${money(total, locale)}`)
  for (const value of [contact.customerName, contact.email, contact.phone, address.line1, address.line2, address.postalCode, 'Luna']) {
    await expect(page.locator('form')).toContainText(value)
  }
}

for (const locale of ['de', 'en'] as const) {
  test(`one named ornament sends the exact multipart checkout and computed total (${locale})`, async ({ page }) => {
    const config = await prepare(page)
    await namedDesign(page)
    await addNote(page)
    if (locale === 'en') {
      // Exercise the visible language switch AFTER entering data, rather than
      // starting with an English localStorage value.
      await page.getByRole('button', { name: 'EN', exact: true }).click()
      await expect(page.locator('#buy-heading')).toHaveText('Your ornament')
      await expect(page.locator('input[id^="pet-"]')).toHaveValue('Luna')
      await expect(page.getByRole('img', { name: 'Photo 1 of Luna', exact: true })).toBeVisible()
    }
    await expect(preview(page)).toHaveAttribute('aria-label', locale === 'de' ? 'Rot, Glänzend, Name: Luna · Hinten' : 'Red, Shiny, name: Luna · Back')
    // Reference photos must stay in the thumbnail gallery, outside the SVG.
    await expect(preview(page).locator('image, img')).toHaveCount(0)
    await expect(preview(page).locator('svg')).toBeVisible()
    await expect(page.getByRole('button', { name: locale === 'de' ? 'Foto hinzufügen, 1 von 6' : 'Add photo, 1 of 6', exact: true })).toBeVisible()
    await fillDelivery(page)
    await next(page).click()
    const total = config.customPrice + config.nameExtra + config.deliveryFee
    await expectReview(page, total, locale)
    await page.locator('#buy-terms').check()

    const fixture = await readFile(photo)
    let captured: unknown
    let checkoutCount = 0
    await page.route('**/api/shop/checkout', async route => {
      checkoutCount++
      const request = route.request()
      expect(request.method()).toBe('POST')
      const contentType = request.headers()['content-type']
      expect(contentType).toMatch(/^multipart\/form-data; boundary=/)
      const buffer = request.postDataBuffer()
      expect(buffer).not.toBeNull()
      const form = await new Response(new Uint8Array(buffer!), { headers: { 'Content-Type': contentType } }).formData()
      const payload = form.get('payload')
      expect(payload).toBeInstanceOf(Blob)
      const parsed = JSON.parse(await (payload as Blob).text())
      // Only the generated photo id is variable. Assert the ENTIRE payload,
      // including no accidental UID, preview data URL or client-side price.
      expect(parsed).toEqual({
        ...contact, address, deliveryDate: dates[0].date, acceptTerms: true,
        items: [{ kind: 'custom', color: 'red', finish: 'shiny', withName: true,
          backName: 'Luna', petName: 'Luna', note, photos: [{ id: expect.stringMatching(/^pho-/), name: 'pet.png' }] }],
      })
      expect(parsed.items[0].photos).toHaveLength(1)
      const photoId = parsed.items[0].photos[0].id
      expect([...form.keys()].sort()).toEqual(['payload', `photo-${photoId}`].sort())
      const upload = form.get(`photo-${photoId}`) as File
      expect(upload.name).toBe('pet.png')
      expect(upload.type).toBe('image/png')
      expect(Buffer.from(await upload.arrayBuffer())).toEqual(fixture)
      captured = parsed
      await route.fulfill({ json: { orderCode: 'AWG-JOURNEY-DEEP', formToken: 'journey-test-token', checkoutUrl: `${new URL(request.url()).origin}/e2e-checkout` } })
    })
    await page.route('**/e2e-checkout', route => route.fulfill({ contentType: 'text/html', body: '<h1>Checkout handoff</h1>' }))
    await page.locator('form button[type=submit]').click()
    await expect(page).toHaveURL(/\/e2e-checkout$/)
    await expect(page.getByRole('heading', { name: 'Checkout handoff' })).toBeVisible()
    expect(captured).toBeDefined()
    expect(checkoutCount).toBe(1)
  })
}

test('two ornaments keep independent colour, finish, names, previews and totals after removal', async ({ page }) => {
  const config = await prepare(page)
  await namedDesign(page)
  const firstLabel = 'Rot, Glänzend, Name: Luna · Hinten'
  await expect(preview(page)).toHaveAttribute('aria-label', firstLabel)
  await page.locator('#buy-add').click()
  await namedDesign(page, /^(Grün|Green)$/, /^(Matt|Matte)$/, 'Max')
  const secondLabel = 'Grün, Matt, Name: Max · Hinten'
  await expect(preview(page)).toHaveAttribute('aria-label', secondLabel)
  const twoTotal = 2 * (config.customPrice + config.nameExtra) + config.deliveryFee
  await expect(price(page)).toHaveText(money(twoTotal))

  for (const [color, finish, name, label] of [
    ['Rot', 'Glänzend', 'Luna', firstLabel], ['Grün', 'Matt', 'Max', secondLabel],
  ] as const) {
    await page.getByRole('tab', { name, exact: true }).click()
    await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('radio', { name: color, exact: true })).toBeChecked()
    await expect(page.getByRole('radio', { name: finish, exact: true })).toBeChecked()
    await expect(preview(page)).toHaveAttribute('aria-label', label)
    if (mobile(page)) await next(page).click()
    await expect(page.locator('input[id^="back-"]')).toHaveValue(name)
    if (mobile(page)) await next(page).click()
    await expect(page.locator('input[id^="pet-"]')).toHaveValue(name)
    await expect(page.getByRole('img', { name: `Foto 1 von ${name}`, exact: true })).toBeVisible()
  }
  // Removal lives in the options card, visible in substep 0 on mobile.
  await page.getByRole('tab', { name: 'Max', exact: true }).click()
  await page.getByRole('button', { name: 'Diese Kugel entfernen', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Max', exact: true })).toHaveCount(0)
  await expect(preview(page)).toHaveAttribute('aria-label', firstLabel)
  const remainingTotal = config.customPrice + config.nameExtra + config.deliveryFee
  await expect(price(page)).toHaveText(money(remainingTotal))
  if (mobile(page)) { await next(page).click(); await next(page).click() }
  await expect(page.locator('input[id^="pet-"]')).toHaveValue('Luna')
  await expect(page.getByRole('img', { name: 'Foto 1 von Luna', exact: true })).toBeVisible()
  await fillDelivery(page)
  await next(page).click()
  await expect(page.locator('form div[role="img"]')).toHaveCount(1)
  await expect(page.locator('form button[type=submit]')).toHaveText(`Zahlungspflichtig bestellen · ${money(remainingTotal)}`)
})

test('name option adds exactly 12.99, turns to the scripted back and retains its value off/on', async ({ page }) => {
  const config = await prepare(page)
  expect(config.nameExtra).toBe(12.99)
  await choose(page)
  const base = config.customPrice + config.deliveryFee
  await expect(price(page)).toHaveText(money(base))
  if (mobile(page)) await next(page).click()
  await nameOption(page).check()
  await expect(price(page)).toHaveText(money(base + 12.99))
  await page.locator('input[id^="back-"]').fill('luna')
  await expect(page.locator('input[id^="back-"]')).toHaveValue('luna')
  await expect(preview(page)).toHaveAttribute('aria-label', 'Rot, Glänzend, Name: luna · Hinten')
  const back = page.getByRole('radio', { name: 'Hinten', exact: true })
  const front = page.getByRole('radio', { name: 'Vorne', exact: true })
  await expect(back).toBeChecked()
  await expect(preview(page).locator('svg text')).toHaveText('Luna')
  await expect(preview(page).locator('svg text')).toHaveCSS('opacity', '1')
  await front.click()
  await expect(front).toBeChecked()
  await expect(back).not.toBeChecked()
  await expect(preview(page).locator('svg text')).toHaveCSS('opacity', '0')
  await back.click()
  await expect(back).toBeChecked()
  await expect(preview(page).locator('svg text')).toHaveCSS('opacity', '1')
  await nameOption(page).uncheck()
  await expect(price(page)).toHaveText(money(base))
  await expect(preview(page)).toHaveAttribute('aria-label', 'Rot, Glänzend, Name: kein Name · Vorne')
  await expect(page.locator('input[id^="back-"]')).toHaveCount(0)
  await expect(back).toHaveCount(0)
  await nameOption(page).check()
  await expect(page.locator('input[id^="back-"]')).toHaveValue('luna')
  await expect(back).toBeChecked()
  await expect(price(page)).toHaveText(money(base + 12.99))
})

// Listen for the actual click in the document. Playwright actionability, scroll,
// hover preview and the driver round trip must not be counted as app latency.
// MutationObserver resolves on the DOM update; web-first assertions below then
// confirm the selected state and final displayed price without fixed sleeps.
async function measuredClick(page: Page, control: Locator, expectedLabel: string, expectedPrice: string, priceMustChange: boolean) {
  await control.evaluate((node, expected) => {
    const win = window as unknown as { journeyLatency?: Promise<number> }
    const image = document.querySelector('form div[role="img"]')!
    const total = [...document.querySelectorAll('form [data-buy-total]')].find(node => node.getClientRects().length)!
    const visiblePrice = total.querySelector('span[aria-hidden="true"]')!
    const exactPrice = total.querySelector('.visually-hidden')!
    const input = node instanceof HTMLInputElement ? node : node.querySelector('input')!
    const expectedChecked = input.type === 'radio' || !input.checked
    win.journeyLatency = new Promise<number>(resolve => {
      node.addEventListener('click', () => {
        const started = performance.now()
        const previousPrice = visiblePrice.textContent
        const observer = new MutationObserver(() => {
          if (input.checked === expectedChecked && image.getAttribute('aria-label') === expected.label && exactPrice.textContent === expected.price
            && (!expected.priceMustChange || visiblePrice.textContent !== previousPrice)) {
            observer.disconnect()
            resolve(performance.now() - started)
          }
        })
        observer.observe(document.querySelector('form')!, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'data-selected', 'checked'] })
      }, { once: true, capture: true })
    })
  }, { label: expectedLabel, price: expectedPrice, priceMustChange })
  await control.click()
  await expect(preview(page)).toHaveAttribute('aria-label', expectedLabel)
  await expect(price(page)).toHaveText(expectedPrice)
  return page.evaluate(() => (window as unknown as { journeyLatency: Promise<number> }).journeyLatency)
}

test('configuration reacts in under 100ms (median of five colour clicks and five price changes)', async ({ page }, testInfo) => {
  const config = await prepare(page)
  await choose(page)
  // Give the back a value so toggling the actual priced option changes its label.
  if (mobile(page)) await next(page).click()
  await nameOption(page).check()
  await page.locator('input[id^="back-"]').fill('LUNA')
  await nameOption(page).uncheck()
  if (mobile(page)) await backButton(page).click()
  await expect(price(page)).toHaveText(money(config.customPrice + config.deliveryFee))
  const colourSamples: number[] = []
  for (const color of ['Grün', 'Rot', 'Grün', 'Rot', 'Grün']) {
    // Colour has the same price in the product contract: assert it stays correct
    // rather than inventing a colour surcharge just to force a price mutation.
    colourSamples.push(await measuredClick(page, page.getByRole('radio', { name: color, exact: true }).locator('..'),
      `${color}, Glänzend, Name: kein Name · Vorne`, money(config.customPrice + config.deliveryFee), false))
    await expect(page.getByRole('radio', { name: color, exact: true })).toBeChecked()
  }
  if (mobile(page)) await next(page).click()
  const priceSamples: number[] = []
  for (const withName of [true, false, true, false, true]) {
    priceSamples.push(await measuredClick(page, nameOption(page),
      `Grün, Glänzend, Name: ${withName ? 'LUNA · Hinten' : 'kein Name · Vorne'}`,
      money(config.customPrice + config.deliveryFee + (withName ? config.nameExtra : 0)), true))
    await expect(nameOption(page)).toBeChecked({ checked: withName })
  }
  const median = (values: number[]) => [...values].sort((a, b) => a - b)[2]
  await testInfo.attach('configuration-latency.json', { contentType: 'application/json', body: JSON.stringify({ colourSamples, priceSamples, colourMedian: median(colourSamples), priceMedian: median(priceSamples) }) })
  expect(median(colourSamples), 'colour click → preview label and correct price').toBeLessThan(100)
  expect(median(priceSamples), 'name click → preview label and first visible price change').toBeLessThan(100)
})

test('browser back/forward and in-app Back preserve all answers across the three screens', async ({ page }) => {
  const config = await prepare(page)
  await namedDesign(page)
  await addNote(page)
  await fillDelivery(page)
  await next(page).click()
  await page.locator('#buy-terms').check()
  const total = config.customPrice + config.nameExtra + config.deliveryFee
  await expectReview(page, total)
  await page.goBack()
  await expect(page.locator('#buy-heading')).toHaveText('Lieferung')
  await expect(page).toHaveURL(/\/buy$/)
  await expectContact(page)
  await page.goBack()
  await expect(page.locator('#buy-heading')).toHaveText('Deine Kugel')
  await expect(preview(page)).toHaveAttribute('aria-label', 'Rot, Glänzend, Name: Luna · Hinten')
  // Browser history restores the design screen with its current mobile substep.
  await expect(page.locator('input[id^="pet-"]')).toHaveValue('Luna')
  await expect(page.getByRole('img', { name: 'Foto 1 von Luna', exact: true })).toBeVisible()
  if (!await page.locator('details').evaluate(node => node.hasAttribute('open'))) await page.locator('summary').click()
  await expect(page.locator('textarea[id^="note-"]')).toHaveValue(note)
  await page.goForward()
  await expect(page.locator('#buy-heading')).toHaveText('Lieferung')
  await expectContact(page)
  await page.goForward()
  await expectReview(page, total)
  await expect(page.locator('#buy-terms')).toBeChecked()

  await backButton(page).click()
  await expectContact(page)
  await backButton(page).click()
  if (mobile(page)) { await backButton(page).click(); await backButton(page).click() }
  await expect(page.getByRole('radio', { name: 'Rot', exact: true })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Glänzend', exact: true })).toBeChecked()
  if (mobile(page)) await next(page).click()
  await expect(nameOption(page)).toBeChecked()
  await expect(page.locator('input[id^="back-"]')).toHaveValue('Luna')
  if (mobile(page)) await next(page).click()
  await expect(page.locator('input[id^="pet-"]')).toHaveValue('Luna')
  await expect(page.getByRole('img', { name: 'Foto 1 von Luna', exact: true })).toBeVisible()
  if (!await page.locator('details').evaluate(node => node.hasAttribute('open'))) await page.locator('summary').click()
  await expect(page.locator('textarea[id^="note-"]')).toHaveValue(note)
  await next(page).click()
  await expectContact(page)
  await next(page).click()
  await expectReview(page, total)
  await expect(page.locator('#buy-terms')).toBeChecked()
})

test('reload from delivery restores every text field and explicitly asks to re-add photos', async ({ page }) => {
  await prepare(page)
  await namedDesign(page)
  await addNote(page)
  await fillDelivery(page)
  await expectContact(page)
  await page.reload()
  // Reload deliberately returns to design: file bytes cannot be persisted.
  await expect(page.locator('fieldset[id^="color-"]')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Rot', exact: true })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'Glänzend', exact: true })).toBeChecked()
  if (mobile(page)) await next(page).click()
  await expect(nameOption(page)).toBeChecked()
  await expect(page.locator('input[id^="back-"]')).toHaveValue('Luna')
  if (mobile(page)) await next(page).click()
  await expect(page.locator('input[id^="pet-"]')).toHaveValue('Luna')
  await expect(page.getByRole('status').filter({ hasText: 'Fotos können nach dem Neuladen nicht gespeichert werden. Bitte füge sie erneut hinzu.' })).toBeVisible()
  await expect(page.locator('input[type=file]')).toHaveValue('')
  await expect(page.getByRole('img', { name: 'Foto 1 von Luna', exact: true })).toHaveCount(0)
  await expect(preview(page).locator('image, img')).toHaveCount(0)
  await page.locator('summary').click()
  await expect(page.locator('textarea[id^="note-"]')).toHaveValue(note)
  // An explicit attempt to continue must not silently submit missing photos.
  await next(page).click()
  await expect(page.locator('[id^="photos-"][id$="-error"]')).toBeVisible()
  await expect(page.locator('#buy-date')).toHaveCount(0)
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.getByRole('img', { name: 'Foto 1 von Luna', exact: true })).toBeVisible()
  await expect(page.getByText('Fotos können nach dem Neuladen nicht gespeichert werden. Bitte füge sie erneut hinzu.', { exact: true })).toHaveCount(0)
  await next(page).click()
  await expectContact(page)
})

for (const locale of ['de', 'en'] as const) {
  test(`pending checkout limit is explained on review (${locale})`, async ({ page }) => {
    await prepare(page)
    await namedDesign(page)
    if (locale === 'en') await page.getByRole('button', { name: 'EN', exact: true }).click()
    await fillDelivery(page)
    await next(page).click()
    await page.locator('#buy-terms').check()
    await page.route('**/api/shop/checkout', route => route.fulfill({ status: 429, json: { status: 429, code: 'PENDING_CHECKOUT_LIMIT', message: 'Too many requests', field: null } }))
    await page.locator('form button[type=submit]').click()
    await expect(page.getByText(locale === 'de' ? /bereits zwei unbezahlte Bestellungen offen/ : /already have two unpaid orders open/)).toBeVisible()
  })
}
