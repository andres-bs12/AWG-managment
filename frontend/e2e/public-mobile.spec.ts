import { test, expect, type Locator, type Page } from '@playwright/test'
import { choose, chooseFirstDate, next, open, photo } from './helpers'

/** Check actual geometry, including overflow ancestors; visibility alone misses clipped buttons. */
async function insideViewport(target: Locator) {
  await expect(target).toBeVisible()
  await expect.poll(() => target.evaluate(node => {
    const box = node.getBoundingClientRect()
    if (box.top < 0 || box.left < 0 || box.bottom > innerHeight || box.right > innerWidth) return false
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const css = getComputedStyle(parent), bounds = parent.getBoundingClientRect()
      if (/(hidden|clip|auto|scroll)/.test(css.overflowX) && (box.left < bounds.left || box.right > bounds.right)) return false
      if (/(hidden|clip|auto|scroll)/.test(css.overflowY) && (box.top < bounds.top || box.bottom > bounds.bottom)) return false
    }
    return true
  })).toBe(true)
}
async function documentLayout(page: Page) {
  expect(await page.evaluate(() => {
    const shell = document.querySelector('[data-public-scroll]')!
    return document.scrollingElement === document.documentElement
      && document.documentElement.scrollWidth <= innerWidth
      && !/(auto|scroll|hidden)/.test(getComputedStyle(shell).overflowY)
  })).toBe(true)
  const clipped = await page.locator('main button, main a, main input:not([type=file]), main select, main textarea').evaluateAll(nodes => nodes.flatMap(node => {
    if (!node.getClientRects().length) return []
    const box = node.getBoundingClientRect()
    for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      const css = getComputedStyle(parent), bounds = parent.getBoundingClientRect()
      if ((/(hidden|clip)/.test(css.overflowX) && (box.left < bounds.left || box.right > bounds.right))
        || (/(hidden|clip)/.test(css.overflowY) && (box.top < bounds.top || box.bottom > bounds.bottom))) return [node.id || node.textContent?.trim()]
    }
    return []
  }))
  expect(clipped).toEqual([])
}
async function actions(page: Page) {
  if ((page.viewportSize()?.height ?? 900) <= 640) {
    await expect(page.locator('[data-sticky-actions]')).toHaveCSS('position', 'static')
    await page.locator('[data-sticky-actions]').scrollIntoViewIfNeeded()
  }
  await insideViewport(page.locator('[data-sticky-actions]'))
  await insideViewport(page.locator('form button[type=submit]'))
  await documentLayout(page)
}
async function scrollCard(page: Page) {
  // Geometry must hold during ordinary finger scrolling, with no focused control to repair it.
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  for (const fraction of [0, 0.35, 0.7, 1]) {
    await page.evaluate(fraction => {
      const card = document.querySelector('[data-public-page]')!
      window.scrollTo(0, Math.max(0, card.getBoundingClientRect().top + scrollY + card.clientHeight * fraction - innerHeight))
    }, fraction)
    if ((page.viewportSize()?.height ?? 900) <= 640) await documentLayout(page)
    else await actions(page)
  }
  await actions(page)
}
async function fillContact(page: Page) {
  for (const [id, value] of Object.entries({ 'buy-name': 'Alex Example', 'buy-email': 'alex@example.com', 'buy-phone': '123456789', 'buy-line1': 'Street 1', 'buy-postal': '1010' })) {
    const field = page.locator(`#${id}`)
    if (await field.count()) await field.fill(value)
  }
}

for (const locale of ['de', 'en'] as const) {
  test(`Home shows both complete CTAs before scrolling (${locale})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
    await page.goto('/')
    const curtain = page.locator('[class*="curtain"]')
    if (await curtain.count()) await page.keyboard.press('Escape')
    await expect(curtain).toHaveCount(0)
    await insideViewport(page.getByRole('button', { name: locale === 'de' ? /Bestellung verfolgen/ : /Track my order/ }))
    await insideViewport(page.locator('a[href="/buy"]'))
    await documentLayout(page)
  })

  for (const pickup of [false, true]) test(`all four buy screens stay usable (${locale}, ${pickup ? 'pickup' : 'Vienna'})`, async ({ page }) => {
    await open(page, locale)
    await actions(page)
    await choose(page)
    await next(page).click()
    await actions(page)
    await page.locator('input[type=checkbox]').check()
    await page.locator('input[id^="back-"]').fill('Charlotte')
    await next(page).click()
    await expect(page.locator('[id^="back-"][id$="-error"]')).toContainText('1–6')
    await expect(page.locator('input[id^="back-"]')).toHaveValue('Charlotte')
    await page.locator('input[id^="back-"]').fill('L')
    await page.locator('input[id^="back-"]').press('Backspace')
    await expect(page.locator('input[id^="back-"]')).toHaveValue('')
    await next(page).click()
    await expect(page.locator('input[id^="back-"]')).toBeFocused()
    await expect(page.locator('[id^="back-"][id$="-error"]')).toBeVisible()
    await expect(page.locator('[id^="pet-"][id$="-error"]')).toHaveCount(0)
    await page.locator('input[id^="back-"]').fill('Straße')
    await next(page).click()
    await expect(page.locator('[id^="back-"][id$="-error"]')).toContainText('1–6')
    await page.locator('input[id^="back-"]').fill('Luna')
    await next(page).click()
    // One bound name; the later pet step never asks the customer to enter it again.
    await expect(page.locator('input[id^="pet-"]')).toHaveCount(0)
    await expect(page.locator('[data-pet-name] strong')).toHaveText('Luna')
    await page.locator('[data-pet-name] button').click()
    await expect(page.locator('input[id^="back-"]')).toBeFocused()
    await expect(page.locator('input[id^="back-"]')).toHaveValue('Luna')
    await next(page).click()
    await page.locator('input[type=file]').setInputFiles(photo)
    await expect(page.locator('img[alt*="Luna"]')).toBeVisible()
    await next(page).click()
    await expect(page.locator('#buy-heading')).toHaveText(locale === 'de' ? 'Lieferung' : 'Delivery')
    await expect(page.locator('#buy-name')).toHaveCount(0)
    await scrollCard(page)
    if (pickup) {
      await page.locator('input[name="delivery-kind"][value="market"]').check()
      await page.locator('input[name="pickup-day"]').first().check()
      await page.locator('input[name="pickup-time"]').first().check()
    } else await chooseFirstDate(page)
    await next(page).click()
    await expect(page.locator('#buy-heading')).toHaveText(locale === 'de' ? 'Deine Daten' : 'Your details')
    await actions(page)
    await expect(page.locator('#buy-line1')).toHaveCount(pickup ? 0 : 1)
    await fillContact(page)
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeVisible()
    await scrollCard(page)
    await page.goBack()
    await expect(page.locator('#buy-name')).toHaveValue('Alex Example')
    await page.goBack()
    await expect(page.locator('#buy-date')).toBeVisible()
    await page.goForward(); await page.goForward()
    await expect(page.locator('#buy-terms')).toBeVisible()
    await actions(page)
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('awg-buy-draft')!).items[0])).toMatchObject({ petName: 'Luna', backName: 'Luna' })
    await page.getByRole('button', { name: locale === 'de' ? 'Kontakt ändern' : 'Change contact', exact: true }).click()
    await expect(page.locator('#buy-name')).toBeFocused()
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeVisible()
    await page.getByRole('button', { name: locale === 'de' ? 'Lieferung ändern' : 'Change delivery', exact: true }).click()
    await page.getByRole('button', { name: locale === 'de' ? 'Zurück' : 'Back', exact: true }).click()
    await next(page).click()
    await expect(page.locator('#buy-heading')).toHaveText(locale === 'de' ? 'Lieferung' : 'Delivery')
    await next(page).click()
    await expect(page.locator('#buy-heading')).toHaveText(locale === 'de' ? 'Deine Daten' : 'Your details')
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeVisible()
  })

  test(`QR details and review share the name and keep actions reachable (${locale})`, async ({ page }) => {
    await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
    await page.goto('/form/frm-wait')
    await expect(page.locator('#form-heading')).toBeVisible()
    await scrollCard(page)
    await expect(page.locator('input[id^="back-"]')).toHaveCount(0)
    await page.locator('input[id^="pet-"]').fill('Luna')
    await page.locator('input[type=file]').setInputFiles(photo)
    await expect(page.locator('img[alt*="Luna"]')).toBeVisible()
    await page.locator('#form-name').fill('Alex Example')
    await page.locator('#form-email').fill('alex@example.com')
    await page.locator('#form-phone').fill('123456789')
    await next(page).click()
    await expect(page.locator('[data-preview="static"]')).toBeVisible()
    await scrollCard(page)
  })

  test(`public route sweep has document scrolling and reachable footer (${locale})`, async ({ page }) => {
    await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
    for (const route of ['/buy/thanks', '/track', '/track/AWG0000', '/form/invalid', '/impressum', '/agb', '/datenschutz', '/waitlist/confirm', '/waitlist/unsubscribe']) {
      await page.goto(route)
      await expect(page.locator('main h1').first()).toBeVisible()
      if (route === '/track') {
        await expect(page.getByRole('dialog')).toBeVisible()
        await page.getByRole('dialog').press('Escape')
      }
      await documentLayout(page)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await insideViewport(page.locator('footer a[href="/datenschutz"]'))
    }
  })
}

test('five ornaments keep named tabs, active preview, totals, removal and cross-item validation', async ({ page }) => {
  await open(page, 'en')
  // Provide five of each variant independently of demo stock distribution.
  await page.evaluate(async () => {
    const path = '/src/api/client.ts'; const { api } = await import(path)
    for (const row of await api.inventory.list()) if (row.kind === 'custom') await api.inventory.update(row.id, 5, row.quantity)
  })
  await page.reload()
  const config = await page.evaluate(async () => { const path = '/src/api/client.ts'; const { api } = await import(path); return api.shop.getConfig() })
  const money = (value: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(value)
  for (const [index, name] of ['Luna', 'Milo', 'Otto', 'Nala', 'Pip'].entries()) {
    if (name !== 'Luna') await page.locator('#buy-add').click()
    await choose(page)
    await next(page).click()
    await page.locator('input[type=checkbox]').check()
    await page.locator('input[id^="back-"]').fill(name)
    await next(page).click()
    await page.locator('input[type=file]').setInputFiles(photo)
    await expect(page.getByRole('img', { name: `Photo 1 of ${name}`, exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: new RegExp(name) })).toHaveAttribute('aria-selected', 'true')
    await actions(page)
    if (index > 0) await expect(page.locator('[class*="itemFooter"]')).toContainText(money(config.customPrice + config.nameExtra))
    await expect(page.locator('[data-buy-total]:visible .visually-hidden')).toHaveText(money((index + 1) * (config.customPrice + config.nameExtra) + config.deliveryFee))
  }
  await expect(page.locator('#buy-add')).toBeEnabled()
  await expect(page.locator('#buy-add')).toHaveText('+Add another ornament')
  for (const name of ['Luna', 'Milo', 'Otto', 'Nala', 'Pip']) {
    await page.getByRole('tab', { name: new RegExp(name) }).click()
    await expect(page.locator('[data-preview="live"] [role="img"]')).toHaveAttribute('aria-label', new RegExp(name))
    await documentLayout(page)
  }
  // Make another ornament incomplete, then submit from the final ornament.
  await page.getByRole('tab', { name: /Milo/ }).click()
  await next(page).click(); await next(page).click()
  await page.getByRole('button', { name: /Remove photo/ }).click()
  await page.getByRole('tab', { name: /Pip/ }).click()
  await next(page).click(); await next(page).click(); await next(page).click()
  await expect(page.getByRole('tab', { name: /Milo/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('button[id^="photos-"]')).toBeFocused()
  await page.locator('input[type=file]').setInputFiles(photo)
  await next(page).click()
  await chooseFirstDate(page); await next(page).click(); await fillContact(page); await next(page).click()
  await expect(page.locator('[data-preview="static"]')).toHaveCount(5)
  await scrollCard(page)
  await page.getByRole('button', { name: /Change ornament Pip/ }).click()
  await page.getByRole('button', { name: 'Remove this ornament', exact: true }).click()
  await expect(page.getByRole('tab')).toHaveCount(4)
  await expect(page.locator('[data-buy-total]:visible .visually-hidden')).toHaveText(money(4 * (config.customPrice + config.nameExtra) + config.deliveryFee))
  await actions(page)
})

test('server field rejections reopen details and delivery instead of the wrong screen', async ({ page }) => {
  await open(page, 'en'); await choose(page)
  await next(page).click(); await next(page).click()
  await page.locator('input[id^="pet-"]').fill('Luna')
  await page.locator('input[type=file]').setInputFiles(photo)
  await next(page).click(); await chooseFirstDate(page); await next(page).click()
  await fillContact(page); await next(page).click()
  await page.locator('#buy-terms').check()
  for (const field of ['address.postalCode', 'deliveryDate']) {
    await page.evaluate(async field => {
      const path = '/src/api/client.ts'; const { api } = await import(path)
      api.shop.checkout = async () => { throw { status: 400, code: 'VALIDATION', field } }
    }, field)
    await page.locator('form button[type=submit]').click()
    const id = field === 'deliveryDate' ? '#buy-date' : '#buy-postal'
    await expect(page.locator(id)).toBeFocused()
    await expect(page.locator(`${id}-error`)).toBeVisible()
    if (field === 'deliveryDate') { await chooseFirstDate(page); await next(page).click() }
    else { await page.locator(id).fill('1010') }
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeChecked()
  }
})

test('short landscape keeps actions in flow with radio and checkbox focus', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await open(page, 'en')
  const bar = page.locator('[data-sticky-actions]')
  await expect(bar).toHaveCSS('position', 'static')
  await page.getByRole('radio', { name: 'Red', exact: true }).focus()
  await expect(bar).toHaveCSS('position', 'static')
  await choose(page); await next(page).click()
  const option = page.getByRole('checkbox', { name: /name on the back/i })
  await option.focus()
  await expect(bar).toHaveCSS('position', 'static')
  await actions(page)
})
