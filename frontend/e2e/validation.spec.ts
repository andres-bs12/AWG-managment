import { test, expect } from '@playwright/test'
import { open, choose, pet, next, mobile, chooseFirstDate, photo, review } from './helpers'

test('validation, focus and associated errors across steps', async ({ page }) => {
  await open(page); await next(page).click()
  await expect(page.locator('fieldset[id^="color-"]')).toBeFocused()
  await expect(page.locator('[id^="color-"][id$="-error"]')).toBeVisible()
  await choose(page)
  if (mobile(page)) { await next(page).click(); await next(page).click() }
  await next(page).click()
  await expect(page.locator('input[id^="pet-"]')).toBeFocused()
  await expect(page.locator('[id^="photos-"][id$="-error"]')).toBeVisible()
  await page.locator('input[id^="pet-"]').fill('Luna')
  await next(page).click(); await expect(page.locator('button[id^="photos-"]')).toBeFocused()
  await page.locator('input[type=file]').setInputFiles(photo); await expect(page.locator('img[alt*="Luna"]')).toBeVisible(); await next(page).click()
  await next(page).click(); await expect(page.locator('#buy-date')).toBeFocused()
  await expect(page.locator('#buy-date-error')).toBeVisible()
  await chooseFirstDate(page); await next(page).click(); await next(page).click()
  await expect(page.locator('#buy-name')).toBeFocused()
  for (const id of ['buy-name', 'buy-email', 'buy-phone', 'buy-line1', 'buy-postal']) await expect(page.locator(`#${id}-error`)).toBeVisible()
  await page.locator('#buy-email').fill('bad'); await page.locator('#buy-email').blur(); await expect(page.locator('#buy-email-error')).toBeVisible()
  await page.locator('#buy-postal').fill('9999'); await page.locator('#buy-postal').blur(); await expect(page.locator('#buy-postal-error')).toBeVisible()
})


test('contact errors are associated and reject short and non-Vienna postcodes', async ({ page }) => {
  await open(page); await choose(page); await pet(page); await next(page).click()
  await chooseFirstDate(page); await next(page).click(); await next(page).click()
  await expect(page.locator('#buy-name')).toBeFocused()
  for (const id of ['buy-name', 'buy-email', 'buy-phone', 'buy-line1', 'buy-postal']) {
    await expect(page.locator(`#${id}`)).toHaveAttribute('aria-describedby', new RegExp(`${id}-error`))
    await expect(page.locator(`#${id}-error`)).toBeVisible()
  }
  for (const value of ['9999', '101']) {
    await page.locator('#buy-postal').fill(value); await page.locator('#buy-postal').blur()
    await expect(page.locator('#buy-postal-error')).toBeVisible()
  }
})

test('photo upload rejects invalid and oversized files and limits the count', async ({ page }) => {
  await open(page); await choose(page)
  if (mobile(page)) { await next(page).click(); await next(page).click() }
  await page.locator('input[id^="pet-"]').fill('Luna')
  const upload = page.locator('input[type=file]')
  await upload.setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('alert').filter({ hasText: /Foto|photo/i })).toBeVisible()
  await upload.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
  await expect(page.getByRole('alert').filter({ hasText: /10 MB/ })).toBeVisible()
  await upload.setInputFiles(Array.from({ length: 7 }, () => photo))
  await expect(page.getByRole('alert').filter({ hasText: /6/ })).toBeVisible()
  await expect(page.locator('img[alt*="Luna"]')).toHaveCount(6)
})

test('sold-out choices cannot be selected and explain why', async ({ page }) => {
  await open(page)
  await page.evaluate(async () => {
    const path = '/src/api/client.ts'
    const { api } = await import(path)
    for (const item of await api.inventory.list()) {
      if (item.kind === 'custom' && item.color === 'beige') await api.inventory.update(item.id, 0, item.quantity)
    }
  })
  await page.reload()
  const soldOut = page.getByRole('radio', { name: /^Beige/, disabled: true })
  await expect(soldOut).toBeDisabled()
  await expect(soldOut.locator('..')).toContainText(/Ausverkauft|Sold out/i)
})

test('named design has one editable name and one required-name error', async ({ page }) => {
  await open(page, 'en'); await choose(page)
  if (mobile(page)) await next(page).click()
  await page.getByRole('checkbox', { name: /name on the back/i }).check()
  const name = page.locator('input[id^="back-"]')
  await expect(page.locator('input[id^="pet-"]')).toHaveCount(0)
  await name.fill('L'); await name.press('Backspace')
  await expect(name).toHaveValue('')
  await next(page).click()
  await expect(name).toBeFocused()
  await expect(page.locator('[id^="back-"][id$="-error"]')).toBeVisible()
  await expect(page.locator('[id^="pet-"][id$="-error"]')).toHaveCount(0)
  await name.fill('Luna')
  if (mobile(page)) await next(page).click()
  await expect(page.locator('[data-pet-name] strong')).toHaveText('Luna')
  await page.locator('[data-pet-name] button').click()
  await expect(name).toBeFocused()
})

for (const field of ['petName', 'backName']) test(`server ${field} rejection targets the single name card`, async ({ page }) => {
  await open(page, 'en'); await choose(page)
  if (mobile(page)) await next(page).click()
  await page.getByRole('checkbox', { name: /name on the back/i }).check()
  await page.locator('input[id^="back-"]').fill('Luna')
  if (mobile(page)) await next(page).click()
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.locator('img[alt*="Luna"]')).toBeVisible()
  await review(page); await page.locator('#buy-terms').check()
  await page.evaluate(async field => {
    const path = '/src/api/client.ts'; const { api } = await import(path)
    api.shop.checkout = async () => { throw { status: 400, code: 'VALIDATION', field: `items[0].${field}` } }
  }, field)
  await page.locator('form button[type=submit]').click()
  await expect(page.locator('input[id^="back-"]')).toBeFocused()
  await expect(page.locator('[id^="back-"][id$="-error"]')).toBeVisible()
  await expect(page.locator('input[id^="pet-"]')).toHaveCount(0)
})
