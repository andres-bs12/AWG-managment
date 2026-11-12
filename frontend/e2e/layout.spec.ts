import { test, expect } from '@playwright/test'
import { open, choose, pet, next, axe, expectActionClearance, expectDocumentScroll } from './helpers'

test('contact fields have labels, single-column spacing and aligned postcode and city', async ({ page }) => {
  await open(page); await choose(page); await pet(page); await next(page).click()
  for (const id of ['buy-name', 'buy-email', 'buy-phone', 'buy-line1', 'buy-line2', 'buy-postal']) {
    const input = page.locator(`#${id}`)
    const label = page.locator(`label[for="${id}"]`)
    await expect(label).toBeVisible()
    const box = await input.boundingBox(), labelBox = await label.boundingBox()
    expect(box && labelBox && box.y - (labelBox.y + labelBox.height)).toBeGreaterThanOrEqual(7)
  }
  const email = await page.locator('#buy-email').boundingBox(), phone = await page.locator('#buy-phone').boundingBox()
  expect(phone!.y).toBeGreaterThan(email!.y + email!.height)
  const postal = await page.locator('#buy-postal').boundingBox(), city = await page.locator('[class*="cityValue"]').boundingBox()
  expect(Math.abs(postal!.y - city!.y)).toBeLessThanOrEqual(1)
  await page.locator('#buy-postal').fill('9999'); await page.locator('#buy-postal').blur()
  const postalError = await page.locator('#buy-postal').boundingBox(), cityError = await page.locator('[class*="cityValue"]').boundingBox()
  expect(Math.abs(postalError!.y - cityError!.y)).toBeLessThanOrEqual(1)
})

test('visible controls have 44px touch targets', async ({ page }) => {
  await open(page); await choose(page); await pet(page); await next(page).click()
  const failures = await page.locator('button:visible, a:visible, summary:visible, label:has(> input[type=radio]):visible').evaluateAll(nodes => nodes.flatMap(node => {
    const box = node.getBoundingClientRect()
    return box.width < 44 || box.height < 44 ? [{ text: node.textContent?.trim(), width: box.width, height: box.height }] : []
  }))
  expect(failures).toEqual([])
})

test('document scrolling and sticky actions survive resize, short viewports and QR navigation', async ({ page }) => {
  await open(page); await choose(page); await pet(page); await next(page).click()
  await expectActionClearance(page)
  await page.setViewportSize({ width: 360, height: 640 })
  await expectActionClearance(page)
  // Scroll the document without an active field; never hide a focus failure by scrolling in a helper.
  await page.locator(':focus').evaluateAll(nodes => nodes.forEach(node => (node as HTMLElement).blur()))
  for (const fraction of [0, 0.3, 0.6, 1]) {
    const expected = await page.evaluate(value => {
      const scroller = document.scrollingElement!
      const top = Math.round(value * (scroller.scrollHeight - scroller.clientHeight))
      window.scrollTo(0, top)
      return top
    }, fraction)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(expected)
    await expectActionClearance(page)
    await axe(page)
  }
  await page.setViewportSize({ width: 360, height: 240 })
  await expectActionClearance(page, 'flow')
  await page.setViewportSize({ width: 768, height: 1024 })
  await expectActionClearance(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await expectActionClearance(page)
  await page.setViewportSize({ width: 360, height: 640 })
  await expectActionClearance(page)
  await page.locator('header a').first().click()
  await expect(page).toHaveURL('/')
  await expectDocumentScroll(page)
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--public-actions-height'))).toBe('')
  await page.goto('/form/frm-wait')
  await expect(page.locator('#form-heading')).toBeVisible()
  await expectActionClearance(page)
  await axe(page)
})

test('ordinary contact fields follow the spacing scale', async ({ page }) => {
  await open(page); await choose(page); await pet(page); await next(page).click()
  for (const id of ['buy-name', 'buy-email', 'buy-line1', 'buy-line2', 'buy-postal']) {
    const label = await page.locator(`label[for="${id}"]`).boundingBox()
    const input = await page.locator(`#${id}`).boundingBox()
    expect(input!.y - label!.y - label!.height).toBeGreaterThanOrEqual(6)
    expect(input!.y - label!.y - label!.height, id).toBeLessThanOrEqual(10)
  }
  const name = await page.locator('#buy-name').boundingBox()
  const emailLabel = await page.locator('label[for="buy-email"]').boundingBox()
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    const nameLabel = await page.locator('label[for="buy-name"]').boundingBox()
    expect(Math.abs(emailLabel!.y - nameLabel!.y)).toBeLessThanOrEqual(1)
    expect(emailLabel!.x).toBeGreaterThan(name!.x + name!.width)
  } else {
    expect(emailLabel!.y - name!.y - name!.height).toBeGreaterThanOrEqual(20)
    expect(emailLabel!.y - name!.y - name!.height).toBeLessThanOrEqual(28)
  }
})

test('Home fits the small document viewport with both actions above its safe bottom edge', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/')
  // Dismiss the opening curtain through its supported keyboard interaction.
  await page.keyboard.press('Escape')
  await expectDocumentScroll(page)
  // The approved hero keeps its proportions; on the shortest phones only the footer sits below the fold.
  const actions = page.locator('main a[href="/buy"], main button')
  await expect(actions).toHaveCount(2)
  for (const action of await actions.all()) {
    await expect(action).toBeInViewport({ ratio: 1 })
  }
})

for (const route of ['/buy', '/form/frm-wait']) {
  test(`Tab and Shift+Tab keep every focused field above the sticky bar (${route})`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await open(page)
    if (route === '/buy') { await choose(page); await pet(page); await next(page).click() }
    else { await page.goto(route); await expect(page.locator('#form-heading')).toBeVisible() }
    const fields = page.locator('form input:not([type="file"]):not([type="hidden"]):visible, form textarea:visible, form select:visible')
    const count = await fields.count()
    expect(count).toBeGreaterThan(0)
    await fields.first().focus()
    // Stop at form boundaries, avoiding the browser chrome's own keyboard focus.
    const last = page.locator('[data-sticky-actions] button').last()
    for (const [key, boundary] of [['Tab', last], ['Shift+Tab', fields.first()]] as const) {
      let reached = false
      for (let index = 0; index < 80; index++) {
        await expect(page.locator(':focus')).toBeInViewport({ ratio: 1 })
        await expectActionClearance(page)
        // Shift+Tab enters a radio group on its checked option, so any radio of the first group counts.
        if (await boundary.evaluate(node => {
          const active = document.activeElement
          if (active === node) return true
          return node instanceof HTMLInputElement && node.type === 'radio' && active instanceof HTMLInputElement && active.type === 'radio' && active.name === node.name
        })) { reached = true; break }
        await page.keyboard.press(key)
      }
      expect(reached).toBe(true)
    }
  })
}
