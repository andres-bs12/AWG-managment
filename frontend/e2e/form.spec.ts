import { readFile } from 'node:fs/promises'
import type { OrderItem } from '../src/domain/types'
import { test, expect, type Locator, type Page } from '@playwright/test'
import { axe, photo } from './helpers'

// Real seed token: seed.ts ord-wait / orn-wait. Every browser context starts isolated.
const token = 'frm-wait'
const next = (page: Page) => page.locator('form button[type="submit"]')

async function openForm(page: Page, locale: 'de' | 'en' = 'de', formToken = token) {
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00Z'))
  await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
  await page.goto(`/form/${formToken}`)
  await expect(page.locator('#form-heading')).toBeVisible()
}
async function fillForm(page: Page) {
  await page.locator('input[id^="pet-"]').fill('Luna')
  await page.locator('input[id^="back-"]').fill('Luna')
  await page.locator('input[type="file"]').setInputFiles(photo)
  await expect(page.getByRole('img', { name: /(?:Foto|Photo) 1 (?:von|of) Luna/ })).toBeVisible()
  await page.locator('#form-name').fill('Alex Example')
  await page.locator('#form-email').fill('alex@example.com')
  await page.locator('#form-phone').fill('+43 660 1234567')
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => {
    const scroller = document.querySelector('main')?.parentElement
    return document.documentElement.scrollWidth <= innerWidth && (!scroller || scroller.scrollWidth <= scroller.clientWidth)
  })).toBe(true)
}
async function expectFocus(page: Page) {
  const control = page.locator(':focus')
  await expect(control).toBeVisible()
  await expect(control).toBeInViewport({ ratio: 1 })
  await expect.poll(() => control.evaluate(node => {
    const css = getComputedStyle(node)
    const rect = node.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    return { ring: css.boxShadow !== 'none' || (css.outlineStyle !== 'none' && parseFloat(css.outlineWidth) > 0), uncovered: !!hit && (node === hit || node.contains(hit) || !!node.closest('label')?.contains(hit)) }
  })).toEqual({ ring: true, uncovered: true })
}
async function tabTo(page: Page, target: Locator) {
  for (let count = 0; count < 45; count++) {
    if (await target.evaluate(node => node === document.activeElement)) { await expectFocus(page); return }
    await page.keyboard.press('Tab'); await expectFocus(page)
  }
  throw new Error('Could not reach the form control by keyboard')
}

for (const locale of ['de', 'en'] as const) {
  test(`mock QR happy path, exact saved details and axe on every screen (${locale})`, async ({ page }) => {
    await openForm(page, locale)
    await axe(page); await noOverflow(page)
    const before = await page.evaluate(async formToken => {
      const path = '/src/api/client.ts'; const { api } = await import(path)
      return api.forms.getForm(formToken)
    }, token)
    await fillForm(page)
    await page.getByText(locale === 'de' ? 'Notiz für Gaby (optional)' : 'Note for Gaby (optional)', { exact: true }).click()
    await page.locator('textarea').fill('Please keep the white patch.')
    await next(page).click()
    await expect(page.locator('#form-heading')).toHaveText(locale === 'de' ? 'Prüfen & absenden' : 'Review & send')
    await expect(page.locator('[data-preview="static"]')).toHaveCount(1)
    await expect(page.locator('[data-preview] image')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Stripe|bezahlen|pay/i })).toHaveCount(0)
    await axe(page); await noOverflow(page)
    await page.getByRole('button', { name: locale === 'de' ? 'Kugel Luna ändern' : 'Change ornament Luna', exact: true }).click()
    await expect(page.locator('input[id^="pet-"]')).toBeFocused()
    await expect(page.locator('input[id^="back-"]')).toHaveValue('Luna')
    await expect(page.locator('textarea')).toHaveValue('Please keep the white patch.')
    await next(page).click(); await next(page).click()
    await expect(page.getByRole('heading', { level: 1, name: locale === 'de' ? 'Angaben gespeichert' : 'Details saved' })).toBeVisible()
    await expect(page.locator('a[href="/track/AWG0000"]')).toBeVisible()
    await axe(page); await noOverflow(page)
    const after = await page.evaluate(async formToken => {
      const path = '/src/api/client.ts'; const { api } = await import(path)
      return { view: await api.forms.getForm(formToken), draft: sessionStorage.getItem(`awg-form-draft:${formToken}`) }
    }, token)
    expect(after.draft).toBeNull()
    expect(after.view.customer).toMatchObject({ name: 'Alex Example', email: 'alex@example.com', phone: '+43 660 1234567' })
    expect(after.view.item).toMatchObject({ id: before.item.id, petName: 'Luna', backName: 'LUNA', withName: before.item.withName, note: 'Please keep the white patch.', formComplete: true })
    expect(after.view.item.photos).toHaveLength(1)
    expect([after.view.item.color, after.view.item.finish, after.view.total, after.view.paymentState, after.view.handoffs]).toEqual([before.item.color, before.item.finish, before.total, before.paymentState, before.handoffs])
  })

  test(`validation summary links to associated errors and preserves input (${locale})`, async ({ page }) => {
    await openForm(page, locale)
    for (const id of ['form-name', 'form-email', 'form-phone']) await page.locator(`#${id}`).fill('')
    await next(page).click()
    await expect(page.locator('input[id^="pet-"]')).toBeFocused()
    await expect(page.getByRole('alert')).toContainText(locale === 'de' ? 'Bitte prüfe die markierten Felder.' : 'Please check the highlighted fields.')
    await expect(page.getByRole('alert').getByRole('link')).toHaveCount(6)
    await axe(page); await noOverflow(page)
    await page.getByRole('alert').getByRole('link').filter({ hasText: /E-Mail|E-mail|Email/ }).click()
    await expect(page.locator('#form-email')).toBeFocused()
    await expect(page.locator('#form-email')).toHaveAttribute('aria-describedby', /form-email-error/)
    await page.locator('#form-email').fill('incorrect'); await page.locator('#form-email').blur()
    await expect(page.locator('#form-email-error')).toBeVisible()
    await expect(page.locator('#form-email')).toHaveValue('incorrect')
    await fillForm(page); await next(page).click()
    await expect(page.locator('#form-heading')).toHaveText(locale === 'de' ? 'Prüfen & absenden' : 'Review & send')
  })
}

test('reload restores text, omits local bytes, and requests photos again', async ({ page }) => {
  await openForm(page); await fillForm(page)
  await next(page).click(); await page.reload()
  await expect(page.locator('#form-heading')).toHaveText('Deine Kugel(n)')
  await expect(page.locator('input[id^="pet-"]')).toHaveValue('Luna')
  await expect(page.locator('input[id^="back-"]')).toHaveValue('Luna')
  await expect(page.locator('#form-email')).toHaveValue('alex@example.com')
  await expect(page.getByRole('status').filter({ hasText: /Fotos können nach dem Neuladen/ })).toBeVisible()
  expect(await page.evaluate(formToken => sessionStorage.getItem(`awg-form-draft:${formToken}`)?.includes('data:image'), token)).toBe(false)
  await next(page).click(); await expect(page.locator('button[id^="photos-"]')).toBeFocused()
  await axe(page); await noOverflow(page)
  await page.locator('input[type=file]').setInputFiles(photo)
  await expect(page.getByRole('status').filter({ hasText: /Fotos können nach dem Neuladen/ })).toHaveCount(0)
})

test('expired mock link follows the real 30-day policy, invalid and locked states remain distinct', async ({ page }) => {
  await openForm(page)
  await page.evaluate(async () => {
    const path = '/src/api/client.ts'; const { api } = await import(path)
    await api.orders.setItemStatus('ord-wait', 'orn-wait', 'finished')
    await api.orders.setHandedOver('ord-wait', true)
  })
  await page.clock.setFixedTime(new Date('2026-12-06T12:00:00Z'))
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Dieser Link ist abgelaufen' })).toBeVisible()
  await expect(page.locator('form')).toHaveCount(0)
  await axe(page); await noOverflow(page)
  await page.goto('/form/not-a-valid-token')
  await expect(page.getByRole('heading', { level: 1, name: 'Dieser Link ist nicht gültig' })).toBeVisible()
  await axe(page); await noOverflow(page)
  // Another seeded order has already started painting and has not been handed over.
  await page.goto('/form/frm-abs100')
  await expect(page.getByRole('heading', { level: 1, name: 'Angaben können nicht mehr geändert werden' })).toBeVisible()
  await expect(page.locator('a[href="/track/AWG0100"]')).toBeVisible()
  await axe(page); await noOverflow(page)
})

test('Vienna address uses the common grid, validates postcode and preserves stored photos', async ({ page }) => {
  await openForm(page, 'de', 'frm-abs103')
  await expect(page.locator('#form-line1')).toHaveAttribute('autocomplete', 'address-line1')
  await expect(page.locator('#form-city')).toHaveText('Wien')
  await page.locator('#form-postal').fill('9999'); await next(page).click()
  await expect(page.locator('#form-postal')).toBeFocused()
  await expect(page.getByRole('alert').getByRole('link', { name: /Postleitzahl/ })).toBeVisible()
  await expect(page.locator('#form-postal')).toHaveAttribute('aria-describedby', /form-postal-error/)
  await page.locator('#form-postal').fill('1010')
  const firstPhoto = await page.locator('img').first().getAttribute('src')
  await page.reload()
  await expect(page.locator('#form-heading')).toBeVisible()
  await expect(page.locator('img').first()).toHaveAttribute('src', firstPhoto!)
  await expect(page.locator('#form-postal')).toHaveValue('1010')
  await next(page).click(); await axe(page); await noOverflow(page)
})

test('completes the QR form by keyboard with visible, unobscured focus', async ({ page }) => {
  test.slow()
  await openForm(page)
  const pet = page.locator('input[id^="pet-"]')
  await tabTo(page, pet); await page.keyboard.type('Luna')
  await tabTo(page, page.locator('input[id^="back-"]')); await page.keyboard.type('Luna')
  const add = page.getByRole('button', { name: 'Foto hinzufügen, 0 von 6', exact: true })
  await tabTo(page, add)
  const chooser = page.waitForEvent('filechooser'); await page.keyboard.press('Enter'); await (await chooser).setFiles(photo)
  await expect(page.getByRole('img', { name: 'Foto 1 von Luna' })).toBeVisible()
  for (const [id, value] of [['form-name', 'Alex Example'], ['form-email', 'alex@example.com'], ['form-phone', '+43 660 1234567']]) {
    const input = page.locator(`#${id}`); await tabTo(page, input); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type(value)
  }
  await tabTo(page, next(page)); await page.keyboard.press('Enter')
  await expect(page.locator('#form-heading')).toHaveText('Prüfen & absenden')
  await axe(page); await noOverflow(page)
  await tabTo(page, next(page)); await page.keyboard.press('Space')
  await expect(page.getByRole('heading', { level: 1, name: 'Angaben gespeichert' })).toBeVisible()
  await axe(page)
})

test('upload failures retain successful files and the six-photo limit', async ({ page }) => {
  await openForm(page)
  await page.locator('input[id^="pet-"]').fill('Luna')
  const upload = page.locator('input[type=file]')
  await upload.setInputFiles([{ name: 'pet.png', mimeType: 'image/png', buffer: await readFile(photo) }, { name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') }])
  await expect(page.locator('img[alt="Foto 1 von Luna"]')).toBeVisible()
  await expect(page.locator('[id$="-file-error"]')).toBeVisible()
  await expect(page.locator('button[id^="photos-"]')).toHaveAttribute('aria-describedby', /file-error/)
  await upload.setInputFiles(Array.from({ length: 6 }, () => photo))
  await expect(page.locator('img[alt*="von Luna"]')).toHaveCount(6)
  await expect(page.locator('button[id^="photos-"]')).toHaveCount(0)
  await expect(page.locator('[id^="photos-"][id$="-count"]')).toBeFocused()
  await axe(page); await noOverflow(page)
})

test('two ornaments keep fixed variants, independent details and the bought name option', async ({ page }) => {
  await openForm(page)
  const prepared = await page.evaluate(async () => {
    const path = '/src/api/client.ts'; const { api } = await import(path)
    const reference = (await api.forms.getForm('frm-abs103')).item.photos
    const choices = [{ kind: 'custom' as const, withName: true }, { kind: 'custom' as const, withName: false }]
    const dates = await api.shop.listDeliveryDates(choices)
    const result = await api.shop.checkout({ customerName: 'Alex Example', email: 'alex@example.com', phone: '+43 660 1234567', address: { line1: 'Street 1', postalCode: '1010', city: 'Wien' }, deliveryDate: dates[0].date, acceptTerms: true,
      items: [{ ...choices[0], color: 'red', finish: 'shiny', petName: 'Luna', backName: 'Luna', photos: reference }, { ...choices[1], color: 'green', finish: 'matte', petName: 'Otto', photos: reference }],
    })
    return { token: result.formToken, view: await api.forms.getForm(result.formToken) }
  })
  await page.goto(`/form/${prepared.token}`)
  await expect(page.locator('#form-heading')).toBeVisible()
  await expect(page.locator('[data-preview="live"]')).toHaveCount(2)
  await expect(page.locator('input[id^="back-"]')).toHaveCount(1)
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0)
  await expect(page.locator('input[value="red"], input[value="green"], input[value="shiny"], input[value="matte"]')).toHaveCount(0)
  const first = prepared.view.items![0], second = prepared.view.items![1]
  await page.locator(`#pet-${first.id}`).fill('Milo')
  await expect(page.locator(`#pet-${second.id}`)).toHaveValue('Otto')
  await page.locator(`#back-${first.id}`).fill('milo')
  await expect(page.locator(`#back-${first.id}`)).toHaveValue('milo')
  await expect(page.locator('[data-preview="live"]').first().locator('text')).toHaveText('Milo')
  await axe(page); await noOverflow(page)
  await next(page).click()
  await expect(page.locator('[data-preview="static"]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Kugel Otto ändern', exact: true }).click()
  await expect(page.locator(`#pet-${second.id}`)).toBeFocused()
  await next(page).click(); await next(page).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Angaben gespeichert' })).toBeVisible()
  const saved = await page.evaluate(async formToken => {
    const path = '/src/api/client.ts'; const { api } = await import(path)
    return api.forms.getForm(formToken)
  }, prepared.token)
  expect(saved.items?.map((item: OrderItem) => [item.petName, item.backName, item.color, item.finish, item.withName])).toEqual([['Milo', 'MILO', 'red', 'shiny', true], ['Otto', '', 'green', 'matte', false]])
  expect(saved.total).toBe(prepared.view.total)
})

test('server field rejection returns to the exact control; expiry during submit shows the expired state', async ({ page }) => {
  await openForm(page); await fillForm(page); await next(page).click()
  await page.route('**/api/forms/*', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'VALIDATION', field: 'items[0].note', message: 'Please check the note.' }) }))
  await page.evaluate(async () => {
    const clientPath = '/src/api/client.ts', httpPath = '/src/api/http/services.ts'
    const { api } = await import(clientPath); const { httpApi } = await import(httpPath)
    api.forms.submitForm = httpApi.forms.submitForm
  })
  await next(page).click()
  await expect(page.locator('textarea')).toBeFocused()
  await expect(page.locator('textarea')).toHaveAttribute('aria-describedby', /note-.*-error/)
  await expect(page.locator('textarea')).toBeVisible()
  await expect(page.locator('input[id^="pet-"]')).toHaveValue('Luna')
  await axe(page)
  await page.locator('textarea').fill('Keep the white patch.')
  await next(page).click()
  await page.unroute('**/api/forms/*')
  await page.route('**/api/forms/*', route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'FORM_EXPIRED', message: 'Form expired.' }) }))
  await next(page).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dieser Link ist abgelaufen' })).toBeVisible()
  await expect(page.locator('form')).toHaveCount(0)
  await axe(page); await noOverflow(page)
})
