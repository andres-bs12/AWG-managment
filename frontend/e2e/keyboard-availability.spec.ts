import { test, expect, type Locator, type Page } from '@playwright/test'
import type { ShopDeliveryDate } from '../src/domain/types'
import { choose, delivery, mobile, next, open, pet, photo, review } from './helpers'

// Check the actual focused control, including clipping and sticky overlays. Do
// not scroll it into view here: that would conceal a broken keyboard tab order.
async function expectVisibleFocus(page: Page) {
  const focused = page.locator(':focus')
  await expect(focused).toHaveCount(1)
  await expect(focused).toBeVisible()
  await expect(focused).toBeInViewport({ ratio: 1 })
  await expect.poll(() => focused.evaluate(node => {
    const style = getComputedStyle(node)
    const ring = (style.outlineStyle !== 'none' && style.outlineStyle !== 'hidden' && parseFloat(style.outlineWidth) > 0)
      || style.boxShadow !== 'none'
    const rect = node.getBoundingClientRect()
    let visible = node !== document.body && rect.width > 1 && rect.height > 1
    for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
      const css = getComputedStyle(ancestor)
      visible &&= !ancestor.hasAttribute('hidden') && ancestor.getAttribute('aria-hidden') !== 'true'
        && css.display !== 'none' && css.visibility === 'visible' && Number(css.opacity) > 0
        && css.clip === 'auto' && css.clipPath === 'none'
    }
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    const label = node.closest('label')
    const uncovered = !!hit && (node === hit || node.contains(hit) || !!label?.contains(hit))
    return { ring, visible, uncovered }
  })).toEqual({ ring: true, visible: true, uncovered: true })
}

async function tab(page: Page, backwards = false) {
  await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab')
  await expectVisibleFocus(page)
}

async function tabTo(page: Page, target: Locator, backwards = false) {
  for (let count = 0; count < 40; count++) {
    if (await target.evaluate(node => node === document.activeElement)) {
      await expectVisibleFocus(page)
      return
    }
    await tab(page, backwards)
  }
  throw new Error(`Keyboard could not reach ${await target.evaluate(node => node.outerHTML)}`)
}

async function typeInto(page: Page, target: Locator, text: string) {
  await tabTo(page, target)
  await page.keyboard.type(text)
  await expect(target).toHaveValue(text)
}

// Seed through the public API boundary, then fetch config again. No production
// test hook or direct mock-store dependency is needed for deterministic stock.
async function stock(page: Page, soldOutRedMatte = false) {
  await page.evaluate(async soldOut => {
    const path = '/src/api/client.ts'
    const { api } = await import(path)
    const inventory = await api.inventory.list()
    for (const row of inventory) {
      if (row.kind !== 'custom') continue
      const quantity = row.color === 'beige' || (soldOut && row.color === 'red' && row.finish === 'matte') ? 0 : 3
      await api.inventory.update(row.id, quantity, row.quantity)
    }
  }, soldOutRedMatte)
  await page.reload()
  await expect(page.locator('fieldset[id^="color-"]')).toBeVisible()
}

async function continueByKeyboard(page: Page, key: 'Enter' | 'Space') {
  await tabTo(page, next(page))
  await page.keyboard.press(key)
}

test.describe('desktop keyboard checkout', () => {
  test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false })

  test('completes design and delivery using only the keyboard, with visible focus after every Tab', async ({ page }) => {
    // The trace completes this long journey after the default 30s budget under
    // parallel load. Allow 90s here; every per-control assertion keeps its timeout.
    test.slow()
    await open(page)
    await stock(page)
    const red = page.getByRole('radio', { name: 'Rot', exact: true })
    const green = page.getByRole('radio', { name: 'Grün', exact: true })
    await tabTo(page, red)
    await page.keyboard.press('Space')
    await expect(red).toBeChecked()
    await page.keyboard.press('ArrowRight')
    await expect(green).toBeChecked()
    await expect(green).toBeFocused()
    await expectVisibleFocus(page)
    await page.keyboard.press('ArrowLeft')
    await expect(red).toBeChecked()

    const help = page.getByRole('button', { name: 'Oberflächen erklären' })
    await tabTo(page, help)
    await page.keyboard.press('Space')
    await expect(help).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator(`[id="${await help.getAttribute('aria-controls')}"]`)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(help).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator(`[id="${await help.getAttribute('aria-controls')}"]`)).toBeHidden()
    const shiny = page.getByRole('radio', { name: 'Glänzend', exact: true })
    const matte = page.getByRole('radio', { name: 'Matt', exact: true })
    await tabTo(page, shiny)
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowRight')
    await expect(matte).toBeChecked()
    await expectVisibleFocus(page)
    await page.keyboard.press('ArrowLeft')
    await expect(shiny).toBeChecked()

    const nameOption = page.getByRole('radio', { name: /^Ja,/ })
    await tabTo(page, page.getByRole('radio', { name: 'Nein', exact: true }))
    await page.keyboard.press('ArrowRight')
    await expect(nameOption).toBeChecked()
    const backName = page.locator('input[id^="back-"]')
    await typeInto(page, backName, 'LUNA')
    // Reverse navigation must retain both value and focus indication.
    await tab(page, true)
    await expect(nameOption).toBeFocused()
    await tab(page)
    await expect(backName).toBeFocused()
    await expect(backName).toHaveValue('LUNA')
    await typeInto(page, page.locator('input[id^="pet-"]'), 'Luna')
    await tabTo(page, page.getByRole('button', { name: 'Foto hinzufügen, 0 von 6', exact: true }))
    const chooser = page.waitForEvent('filechooser')
    await page.keyboard.press('Enter')
    // Playwright supplies the file to the native chooser opened with Enter;
    // it does not click the tile or focus the hidden file input.
    await (await chooser).setFiles(photo)
    await expect(page.getByRole('img', { name: 'Foto 1 von Luna', exact: true })).toBeVisible()
    await tabTo(page, page.locator('summary'))
    await page.keyboard.press('Space')
    await expect(page.locator('details')).toHaveAttribute('open', '')
    await typeInto(page, page.locator('textarea[id^="note-"]'), 'Keep the white whiskers')
    await continueByKeyboard(page, 'Enter')
    await expect(page.locator('#buy-heading')).toHaveText('Lieferung')
    await expect(page.locator('#buy-heading')).toBeFocused()

    const days = page.locator('input[name="delivery-date"]')
    await expect(days.nth(1)).toBeAttached()
    await tabTo(page, days.first())
    await page.keyboard.press('ArrowRight')
    await expect(days.nth(1)).toBeChecked()
    await expect(days.nth(1)).toBeFocused()
    await expectVisibleFocus(page)
    await page.keyboard.press('Enter')
    await expect(days.nth(1)).toBeChecked()
    await expect(days.nth(1)).toBeFocused()
    await expect(page.locator('#buy-date-error')).toHaveCount(0)
    for (const [id, value] of Object.entries({
      'buy-name': 'Alex Example', 'buy-email': 'alex@example.com', 'buy-phone': '+43 123456789',
      'buy-line1': 'Hauptstraße 1', 'buy-line2': 'Stiege 2, Tür 3', 'buy-postal': '1010',
    })) await typeInto(page, page.locator(`#${id}`), value)
    await continueByKeyboard(page, 'Space')
    await expect(page.locator('#buy-heading')).toHaveText('Prüfen & bezahlen')
    await expect(page.locator('#buy-heading')).toBeFocused()
    await tabTo(page, page.locator('#buy-terms'))
    await page.keyboard.press('Space')
    await expect(page.locator('#buy-terms')).toBeChecked()
    const pay = page.getByRole('button', { name: /^Zahlungspflichtig bestellen/ })
    await tabTo(page, pay)
    await expect(pay).toBeEnabled()
    await expect(page.locator('main')).toContainText('62,98')
    await expect(page).toHaveURL(/\/buy$/)
  })
})

test('Tab and Shift+Tab exclude hidden substeps, collapsed notes and the native file input', async ({ page }) => {
  // Long keyboard walk: every Tab checks focus geometry, so it needs more than 30s on a loaded machine.
  test.slow()
  await open(page)
  await tabTo(page, page.getByRole('radio', { name: 'Rot', exact: true }))
  await page.keyboard.press('Space')
  await tabTo(page, page.getByRole('radio', { name: 'Glänzend', exact: true }))
  await page.keyboard.press('Space')
  const option = page.getByRole('radio', { name: /^Ja,/ })
  const hiddenBack = page.locator('input[id^="back-"]')
  await expect(hiddenBack).toHaveCount(0)
  if (mobile(page)) {
    await expect(option).toBeHidden()
    await expect(page.locator('input[id^="pet-"]')).toBeHidden()
    await continueByKeyboard(page, 'Enter')
    await expect(page.locator('#buy-heading')).toBeFocused()
    await expect(page.locator('fieldset[id^="color-"]')).toBeHidden()
  }
  await tabTo(page, page.getByRole('radio', { name: 'Nein', exact: true }))
  await page.keyboard.press('ArrowRight')
  await typeInto(page, hiddenBack, 'LUNA')
  await tab(page, true)
  await expect(option).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(hiddenBack).toHaveCount(0)
  if (mobile(page)) {
    await continueByKeyboard(page, 'Space')
    await expect(page.locator('#buy-heading')).toBeFocused()
    await expect(option).toBeHidden()
  }
  await tabTo(page, page.locator('input[id^="pet-"]'))
  await tab(page)
  await expect(page.getByRole('button', { name: 'Foto hinzufügen, 0 von 6', exact: true })).toBeFocused()
  await tab(page)
  await expect(page.locator('summary')).toBeFocused()
  await expect(page.locator('textarea[id^="note-"]')).toBeHidden()
  await tab(page)
  // With a single ornament, adding another is offered after its details.
  await expect(page.locator('#buy-add')).toBeFocused()
  await tab(page)
  if (mobile(page)) {
    await expect(page.getByRole('button', { name: /^(Zurück|Back)$/ })).toBeFocused()
    await tab(page)
  }
  await expect(next(page)).toBeFocused()
  if (mobile(page)) await tab(page, true)
  await tab(page, true)
  await tab(page, true)
  await expect(page.locator('summary')).toBeFocused()
  await page.keyboard.press('Space')
  await tab(page)
  await expect(page.locator('textarea[id^="note-"]')).toBeFocused()
  await tab(page, true)
  await page.keyboard.press('Space')
  await tab(page)
  await expect(page.locator('#buy-add')).toBeFocused()
  await tab(page)
  if (mobile(page)) await tab(page)
  await expect(next(page)).toBeFocused()
  // Check every footer link explicitly in both directions. In particular,
  // Impressum must be fully inside the scroll viewport, including at 360px.
  const footerLinks = await page.locator('footer a').all()
  for (const link of footerLinks) await tabTo(page, link)
  for (const link of [...footerLinks].reverse()) await tabTo(page, link, true)
  await tabTo(page, page.locator('summary'), true)
})

const dates: ShopDeliveryDate[] = ['2026-12-02', '2026-12-09', '2026-12-16'].map(date => ({ date, weekday: 'Wednesday' }))
const datesEndpoint = '**/api/shop/delivery-dates'

// Reuse the real HTTP adapter for availability and checkout while all other
// services remain in mock mode, matching the success spec's API-boundary setup.
async function useHttpAvailability(page: Page) {
  await page.evaluate(async () => {
    const clientPath = '/src/api/client.ts'
    const httpPath = '/src/api/http/services.ts'
    const { api } = await import(clientPath)
    const { httpApi } = await import(httpPath)
    api.shop.listDeliveryDates = httpApi.shop.listDeliveryDates
    api.shop.checkout = httpApi.shop.checkout
  })
}

for (const locale of ['de', 'en'] as const) {
  test(`unavailable date before payment reopens the calendar and keeps every other answer (${locale})`, async ({ page }) => {
    await open(page, locale)
    let unavailable = false
    let rechecks = 0
    let checkouts = 0
    await page.route(datesEndpoint, async route => {
      expect(route.request().method()).toBe('POST')
      expect(route.request().postDataJSON()).toEqual({ items: [{ kind: 'custom', withName: expect.any(Boolean) }] })
      if (unavailable) {
        expect(route.request().postDataJSON()).toEqual({ items: [{ kind: 'custom', withName: true }] })
        rechecks++
      }
      await route.fulfill({ json: unavailable ? dates.slice(1) : dates })
    })
    await page.route('**/api/shop/checkout', async route => {
      checkouts++
      // A failed checkout keeps the page available for inspecting its data.
      await route.fulfill({ status: 503, json: { code: 'PAYMENT_PROVIDER', message: 'Try again.' } })
    })
    await useHttpAvailability(page)
    await choose(page)
    if (mobile(page)) await next(page).click()
    await page.getByRole('radio', { name: /^(Ja|Yes),/ }).check()
    await page.locator('input[id^="back-"]').fill('LUNA')
    if (mobile(page)) await next(page).click()
    await page.locator('input[id^="pet-"]').fill('Luna')
    await page.locator('input[type=file]').setInputFiles(photo)
    await expect(page.getByRole('img', { name: /^(Foto|Photo) 1 (von|of) Luna$/ })).toBeVisible()
    await page.locator('summary').click()
    await page.locator('textarea[id^="note-"]').fill('Keep the white whiskers')
    await delivery(page)
    await page.locator('#buy-line2').fill('Stiege 2, Tür 3')
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeVisible()
    await page.locator('#buy-terms').check()
    const before = await page.evaluate(() => JSON.parse(sessionStorage.getItem('awg-buy-draft')!))
    expect(before.deliveryDate).toBe('2026-12-02')
    unavailable = true
    await page.locator('form button[type=submit]').click()
    await expect.poll(() => rechecks).toBe(1)
    const message = locale === 'de'
      ? 'Dieser Liefertag ist nicht mehr verfügbar. Bitte wähle einen anderen.'
      : 'This delivery day is no longer available. Please choose another.'
    await expect(page.locator('#buy-date-error')).toHaveText(message)
    await expect(page.locator('#buy-date')).toBeFocused()
    await expect(page.locator('#buy-date')).toHaveAttribute('aria-describedby', 'buy-date-error')
    await expect(page.locator('input[name="delivery-date"]')).toHaveCount(2)
    await expect(page.getByRole('radio', { name: /^(Mittwoch|Wednesday),? 2[. ]/ })).toHaveCount(0)
    await expect(page.locator('input[name="delivery-date"]:checked')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('awg-buy-draft')!))).toEqual({ ...before, deliveryDate: '' })
    for (const [id, value] of Object.entries({ 'buy-name': 'Alex Example', 'buy-email': 'alex@example.com', 'buy-phone': '123456789', 'buy-line1': 'Hauptstraße 1', 'buy-line2': 'Stiege 2, Tür 3', 'buy-postal': '1010' })) {
      await expect(page.locator(`#${id}`)).toHaveValue(value)
    }
    expect(checkouts).toBe(0)
    const replacement = page.locator('input[name="delivery-date"]').first()
    await tabTo(page, replacement)
    await page.keyboard.press('Enter')
    await expect(replacement).toBeChecked()
    await expect(page.locator('#buy-date-error')).toHaveCount(0)
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeChecked()
    await expect(page.locator('form')).toContainText('Luna')
    await expect(page.locator('form')).toContainText('LUNA')
    // Inspect the in-memory photo and note by reopening their exact editor.
    await page.getByRole('button', { name: locale === 'de' ? 'Kugel Luna ändern' : 'Change ornament Luna', exact: true }).click()
    if (mobile(page)) { await next(page).click(); await next(page).click() }
    await expect(page.locator('input[id^="pet-"]')).toHaveValue('Luna')
    await expect(page.getByRole('img', { name: /^(Foto|Photo) 1 (von|of) Luna$/ })).toBeVisible()
    await page.locator('summary').click()
    await expect(page.locator('textarea[id^="note-"]')).toHaveValue('Keep the white whiskers')
    await next(page).click()
    await page.locator('form button[type=submit]').click()
    await expect.poll(() => checkouts).toBe(1)
    await expect(page.locator('form button[type=submit]')).toBeEnabled()
    await expect(page.getByRole('alert')).toContainText(locale === 'de' ? 'vorübergehend' : 'temporarily')
  })

  test(`sold-out colour and finish are announced and skipped by keyboard (${locale})`, async ({ page }) => {
    await open(page, locale)
    await stock(page, true)
    const unavailable = page.getByRole('radio', { name: /^Beige/ })
    const red = page.getByRole('radio', { name: /^(Rot|Red)$/ })
    const green = page.getByRole('radio', { name: /^(Grün|Green)$/ })
    await expect(unavailable).toBeDisabled()
    await expect(unavailable).toHaveAccessibleName(/(Ausverkauft|Sold out)/)
    await expect(unavailable.locator('..')).toContainText(/Ausverkauft|Sold out/)
    await tabTo(page, red)
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowRight')
    await expect(green).toBeChecked()
    await expectVisibleFocus(page)
    await page.keyboard.press('ArrowRight')
    await expect(red).toBeFocused()
    await expect(red).toBeChecked()
    await expect(unavailable).not.toBeChecked()
    const shiny = page.getByRole('radio', { name: /^(Glänzend|Shiny)$/ })
    const matte = page.getByRole('radio', { name: /^(Matt|Matte)/ })
    await expect(matte).toBeDisabled()
    await expect(matte).toHaveAccessibleName(/Ausverkauft|Sold out/)
    await expect(matte.locator('..')).toContainText(/Ausverkauft|Sold out/)
    await tabTo(page, shiny)
    await page.keyboard.press('Space')
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Space']) {
      await page.keyboard.press(key)
      await expect(shiny).toBeChecked()
      await expect(shiny).toBeFocused()
      await expect(matte).not.toBeChecked()
      await expectVisibleFocus(page)
    }
    await tab(page)
    await expect(matte).not.toBeFocused()
    await tab(page, true)
    await expect(shiny).toBeFocused()
  })
}

test('failed availability recheck keeps review editable and retryable without creating checkout', async ({ page }) => {
  await open(page)
  await choose(page)
  await pet(page)
  await review(page)
  await page.locator('#buy-terms').check()
  const saved = await page.evaluate(() => sessionStorage.getItem('awg-buy-draft'))
  let checkouts = 0
  await page.route(datesEndpoint, route => route.abort('failed'))
  await page.route('**/api/shop/checkout', async route => { checkouts++; await route.fulfill({ status: 503 }) })
  await useHttpAvailability(page)
  await page.locator('form button[type=submit]').click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.locator('#buy-terms')).toBeChecked()
  await expect(page.locator('form button[type=submit]')).toBeEnabled()
  expect(await page.evaluate(() => sessionStorage.getItem('awg-buy-draft'))).toBe(saved)
  expect(checkouts).toBe(0)
})
