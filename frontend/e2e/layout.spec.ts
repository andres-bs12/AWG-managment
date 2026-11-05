import { test, expect } from '@playwright/test'
import { open, choose, pet, next } from './helpers'

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

test('ordinary contact fields follow the spacing scale', async ({ page }) => {
  await open(page); await choose(page); await pet(page); await next(page).click()
  for (const id of ['buy-name', 'buy-email', 'buy-line1', 'buy-line2', 'buy-postal']) {
    const label = await page.locator(`label[for="${id}"]`).boundingBox()
    const input = await page.locator(`#${id}`).boundingBox()
    expect(input!.y - label!.y - label!.height).toBeGreaterThanOrEqual(6)
    expect(input!.y - label!.y - label!.height).toBeLessThanOrEqual(10)
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
