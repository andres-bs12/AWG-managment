import { test, expect, type Locator, type Page } from '@playwright/test'
import { choose, chooseFirstDate, next, open, photo } from './helpers'

// Scroll-geometry checks are timing-sensitive: this file runs its tests in order even with
// fullyParallel, so sibling pages do not compete for the CPU while sticky bars settle.
test.describe.configure({ mode: 'default' })

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
    const shell = document.querySelector('[data-public-shell]')!
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
  const bar = page.locator('[data-sticky-actions]')
  await expect(bar).toHaveAttribute('data-relaxed-actions', /^(true|false)$/)
  // Reading room and keyboard/zoom determine relaxation; a short viewport alone does not.
  if (await bar.getAttribute('data-relaxed-actions') === 'true') {
    await expect(bar).toHaveCSS('position', 'static')
    await bar.scrollIntoViewIfNeeded()
  } else await expect(bar).toHaveCSS('position', 'sticky')
  await insideViewport(bar)
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
    await actions(page)
  }
}
async function fillContact(page: Page) {
  for (const [id, value] of Object.entries({ 'buy-name': 'Alex Example', 'buy-email': 'alex@example.com', 'buy-phone': '123456789', 'buy-line1': 'Street 1', 'buy-postal': '1010' })) {
    const field = page.locator(`#${id}`)
    if (await field.count()) await field.fill(value)
  }
}
const nameOption = (page: Page, withName = true) => page.getByRole('radio', { name: withName ? /^(Ja|Yes),/ : /^(Nein|No)$/ })
const back = (page: Page) => page.locator('form').getByRole('button', { name: /^(Zurück|Back)$/ })
const tile = (page: Page, name: string) => page.locator('[data-ornament] > button[aria-current], [data-ornament] > button[data-selected]').filter({ hasText: name })
const total = (page: Page) => page.locator('form [data-buy-total]:visible .visually-hidden')

async function namedDesign(page: Page, name = 'Luna') {
  await choose(page)
  await nameOption(page).check()
  await page.locator('input[id^="back-"]').fill(name)
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.getByRole('img', { name: new RegExp(`^(Foto|Photo) 1 (von|of) ${name}$`) })).toBeVisible()
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

  for (const pickup of [false, true]) test(`all three buy screens stay usable (${locale}, ${pickup ? 'pickup' : 'Vienna'})`, async ({ page }) => {
    await open(page, locale)
    await actions(page)
    await expect(page.locator('form nav ol > li')).toHaveCount(3)
    await choose(page)
    // Colour, finish, optional name and photos share one page on every viewport.
    await expect(page.locator('input[type=file]')).toHaveCount(1)
    await expect(page.locator('input[id^="pet-"]')).toHaveCount(0)
    await nameOption(page).check()
    const name = page.locator('input[id^="back-"]')
    await expect(name).toHaveAttribute('maxlength', '6')
    await name.fill('L')
    await name.press('Backspace')
    await expect(name).toHaveValue('')
    await next(page).click()
    await expect(name).toBeFocused()
    await expect(page.locator('[id^="back-"][id$="-error"]')).toBeVisible()
    await expect(page.locator('[id^="pet-"][id$="-error"]')).toHaveCount(0)
    await name.fill('Luna')
    await page.locator('input[type=file]').setInputFiles(photo)
    await expect(page.getByRole('img', { name: /^(Foto|Photo) 1 (von|of) Luna$/ })).toBeVisible()
    await next(page).click()
    await expect(page.locator('#buy-date')).toBeVisible()
    await expect(page.locator('#buy-name')).toBeVisible()
    await scrollCard(page)
    if (pickup) {
      await page.locator('input[name="delivery-kind"][value="market"]').check()
      await page.locator('input[name="pickup-day"]').first().check()
      await page.locator('input[name="pickup-time"]').first().check()
    } else await chooseFirstDate(page)
    await expect(page.locator('#buy-line1')).toHaveCount(pickup ? 0 : 1)
    await fillContact(page)
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeVisible()
    await scrollCard(page)
    // Browser history has one delivery/contact screen between design and review.
    await page.goBack()
    await expect(page.locator('#buy-name')).toHaveValue('Alex Example')
    await expect(page.locator('#buy-date')).toBeVisible()
    await page.goBack()
    await expect(page.locator('fieldset[id^="color-"]')).toBeVisible()
    await expect(name).toHaveValue('Luna')
    await page.goForward()
    await expect(page.locator('#buy-name')).toHaveValue('Alex Example')
    await page.goForward()
    await expect(page.locator('#buy-terms')).toBeVisible()
    await actions(page)
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('awg-buy-draft')!).items[0])).toMatchObject({ petName: 'Luna', backName: 'Luna' })
    await page.getByRole('button', { name: locale === 'de' ? 'Kontakt ändern' : 'Change contact', exact: true }).click()
    await expect(page.locator('#buy-name')).toBeFocused()
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeVisible()
    await page.getByRole('button', { name: locale === 'de' ? 'Lieferung ändern' : 'Change delivery', exact: true }).click()
    // Back abandons the direct return to review: design → delivery/contact → review.
    await back(page).click()
    await expect(page.locator('fieldset[id^="color-"]')).toBeVisible()
    await next(page).click()
    await expect(page.locator('#buy-date')).toBeVisible()
    await expect(page.locator('#buy-name')).toHaveValue('Alex Example')
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeVisible()
  })

  test(`QR details and review share the paid back name and keep actions reachable (${locale})`, async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-05T12:00:00Z'))
    await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
    await page.goto('/form/frm-wait')
    await expect(page.locator('#form-heading')).toBeVisible()
    await scrollCard(page)
    await expect(page.locator('input[id^="pet-"]')).toHaveCount(0)
    await expect(page.locator('input[id^="back-"]')).toHaveCount(1)
    await page.locator('input[id^="back-"]').fill('Luna')
    await page.locator('input[type=file]').setInputFiles(photo)
    await expect(page.getByRole('img', { name: /^(Foto|Photo) 1 (von|of) Luna$/ })).toBeVisible()
    await page.locator('#form-name').fill('Alex Example')
    await page.locator('#form-email').fill('alex@example.com')
    await page.locator('#form-phone').fill('123456789')
    await next(page).click()
    await expect(page.locator('[data-preview="static"]')).toBeVisible()
    await expect(page.locator('input[id^="pet-"]')).toHaveCount(0)
    await scrollCard(page)
  })

  test(`public route sweep has document scrolling and reachable footer (${locale})`, async ({ page }) => {
    await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
    for (const route of ['/buy/thanks', '/track', '/track/AWG0000', '/form/invalid', '/impressum', '/agb', '/datenschutz', '/waitlist/confirm', '/waitlist/unsubscribe']) {
      await page.goto(route)
      // A bare /track opens the code dialog first; the page card appears once it is dismissed.
      if (route === '/track') {
        await expect(page.getByRole('dialog')).toBeVisible()
        await page.getByRole('dialog').getByRole('textbox').press('Escape')
      }
      await expect(page.locator('main h1').first()).toBeVisible()
      await documentLayout(page)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await insideViewport(page.locator('footer a[href="/datenschutz"]'))
    }
  })
}

test('five ornaments keep named tiles, active preview, totals, removal and cross-item validation', async ({ page }) => {
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
    if (index) await page.locator('#buy-add').click()
    await namedDesign(page, name)
    if (index) await expect(tile(page, name)).toHaveAttribute('aria-current', 'true')
    else await expect(page.locator('[data-ornament]')).toHaveCount(0)
    await actions(page)
    await expect(total(page)).toHaveText(money((index + 1) * (config.customPrice + config.nameExtra) + config.deliveryFee))
  }
  await expect(page.locator('[data-ornament]')).toHaveCount(5)
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.locator('#buy-add')).toBeEnabled()
  await expect(page.locator('#buy-add')).toHaveAccessibleName('Add another ornament')
  for (const name of ['Luna', 'Milo', 'Otto', 'Nala', 'Pip']) {
    await tile(page, name).click()
    await expect(tile(page, name)).toHaveAttribute('aria-current', 'true')
    await expect(page.locator('[data-public-preview] [role="img"]')).toHaveAttribute('aria-label', new RegExp(name))
    await expect(page.locator('input[id^="back-"]')).toHaveValue(name)
    await documentLayout(page)
  }
  // Validate all ornaments from the final editor and focus the first incomplete one.
  await tile(page, 'Milo').click()
  await page.getByRole('button', { name: /Remove photo/ }).click()
  await tile(page, 'Pip').click()
  await next(page).click()
  await expect(tile(page, 'Milo')).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('button[id^="photos-"]')).toBeFocused()
  await page.locator('input[type=file]').setInputFiles(photo)
  await next(page).click()
  await chooseFirstDate(page)
  await fillContact(page)
  await next(page).click()
  await expect(page.locator('[data-preview="static"]')).toHaveCount(5)
  await scrollCard(page)
  await page.getByRole('button', { name: 'Change ornament Pip', exact: true }).click()
  await page.getByRole('button', { name: 'Remove Ornament 5 – Pip', exact: true }).click()
  await expect(page.locator('[data-ornament]')).toHaveCount(4)
  await expect(total(page)).toHaveText(money(4 * (config.customPrice + config.nameExtra) + config.deliveryFee))
  await actions(page)
})

test('an ornament without a paid name reaches review without a pet-name field', async ({ page }) => {
  await open(page, 'en')
  await choose(page)
  await nameOption(page).check()
  await page.locator('input[id^="back-"]').fill('Luna')
  await nameOption(page, false).check()
  await expect(page.locator('input[id^="back-"], input[id^="pet-"]')).toHaveCount(0)
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.getByRole('img', { name: /^Photo 1 of / })).toBeVisible()
  await next(page).click()
  await chooseFirstDate(page)
  await fillContact(page)
  await next(page).click()
  await expect(page.locator('#buy-terms')).toBeVisible()
  const item = await page.evaluate(() => JSON.parse(sessionStorage.getItem('awg-buy-draft')!).items[0])
  expect(item).toMatchObject({ withName: false, petName: '' })
  await scrollCard(page)
})

test('server field rejections reopen the shared delivery/contact screen and focus the field', async ({ page }) => {
  await open(page, 'en')
  await namedDesign(page)
  await next(page).click()
  await chooseFirstDate(page)
  await fillContact(page)
  await next(page).click()
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
    await expect(page.locator('#buy-name')).toHaveValue('Alex Example')
    if (field === 'deliveryDate') await chooseFirstDate(page)
    else await page.locator(id).fill('1010')
    await next(page).click()
    await expect(page.locator('#buy-terms')).toBeChecked()
  }
})

test('short landscape keeps actions reachable while radio focus preserves reading-room behavior', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await open(page, 'en')
  const bar = page.locator('[data-sticky-actions]')
  await expect(bar).toHaveAttribute('data-relaxed-actions', /^(true|false)$/)
  const position = await bar.evaluate(node => getComputedStyle(node).position)
  expect(['static', 'sticky']).toContain(position)
  await page.getByRole('radio', { name: 'Red', exact: true }).focus()
  await expect(bar).toHaveCSS('position', position)
  await choose(page)
  await nameOption(page).focus()
  await expect(bar).toHaveCSS('position', position)
  await nameOption(page).check()
  await expect(page.locator('input[id^="back-"]')).toBeVisible()
  await actions(page)
})
