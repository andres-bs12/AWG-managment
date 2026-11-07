import { test, expect } from '@playwright/test'
import { open, choose, mobile, next, pet, review, axe, chooseFirstDate } from './helpers'

test('chips, tabs and side segments use the exact token geometry', async ({ page }) => {
  await open(page)
  await choose(page)
  const read = () => page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const token = (name: string) => parseFloat(root.getPropertyValue(name))
    const geometry = (selector: string, inset: string) => [...document.querySelectorAll<HTMLElement>(selector)].map(node => {
      const style = getComputedStyle(node)
      return { blockStart: parseFloat(style.paddingTop), blockEnd: parseFloat(style.paddingBottom), innerGap: parseFloat(style.columnGap), height: node.getBoundingClientRect().height, left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight), border: parseFloat(style.borderLeftWidth), expectedLeft: token(inset), expectedRight: token('--space-4'), expectedGap: token('--space-2') }
    })
    return { size: token('--size-control'), gap: root.getPropertyValue('--space-3').trim(), chips: geometry('[class*="chipRow"] > label', '--space-3'), tabs: geometry('[role="tab"]', '--space-4'), gaps: [...document.querySelectorAll('[class*="chipRow"], [role="tablist"]')].map(node => getComputedStyle(node).gap), shadows: [...document.querySelectorAll('[data-selected="true"] > [class*="swatch"]')].map(node => getComputedStyle(node).boxShadow) }
  })
  const values = await read()
  expect(values.size).toBe(48)
  for (const item of [...values.chips, ...values.tabs]) {
    expect(item.height).toBe(48)
    expect(item.blockStart).toBe(0)
    expect(item.blockEnd).toBe(0)
    expect(item.left).toBe(item.expectedLeft - item.border)
    expect(item.right).toBe(item.expectedRight - item.border)
  }
  expect(new Set(values.chips.map(item => item.height)).size).toBe(1)
  for (const chip of values.chips) expect(chip.innerGap).toBe(chip.expectedGap)
  for (const gap of values.gaps) expect(gap).toBe(values.gap)
  expect(await page.locator('[class*="itemToolbar"]').evaluate(node => getComputedStyle(node).gap)).toBe('16px')
  for (const shadow of values.shadows) expect(shadow).toBe('none')
  if (mobile(page)) await next(page).click()
  await page.getByRole('checkbox', { name: /name (auf|on)/i }).check()
  const segments = page.getByRole('group', { name: /Seite der Kugel|Ornament side/ })
  const measured = await segments.evaluate(node => {
    const root = getComputedStyle(document.documentElement)
    const token = (name: string) => parseFloat(root.getPropertyValue(name))
    const style = getComputedStyle(node)
    return { padding: parseFloat(style.paddingLeft), gap: parseFloat(style.columnGap), space: token('--space-1'), options: [...node.querySelectorAll('label')].map(label => { const s = getComputedStyle(label); return { left: parseFloat(s.paddingLeft), right: parseFloat(s.paddingRight), border: parseFloat(s.borderLeftWidth), height: label.getBoundingClientRect().height } }), inset: token('--space-4'), touch: token('--touch') }
  })
  expect(measured.padding).toBe(measured.space)
  expect(measured.gap).toBe(measured.space)
  for (const option of measured.options) {
    expect(option.left).toBe(measured.inset - option.border)
    expect(option.right).toBe(measured.inset - option.border)
    expect(option.height).toBe(measured.touch)
  }
})

test('tabs activate manually and keep the side choice per ornament', async ({ page }) => {
  await open(page); await choose(page)
  if (mobile(page)) await next(page).click()
  await page.getByRole('checkbox', { name: /name (auf|on)/i }).check()
  await page.getByRole('radio', { name: 'Vorne', exact: true }).locator('..').click()
  await page.getByRole('button', { name: 'Weitere Kugel hinzufügen', exact: true }).click()
  const first = page.getByRole('tab', { name: 'Kugel 1', exact: true })
  const second = page.getByRole('tab', { name: 'Kugel 2', exact: true })
  await expect(second).toBeFocused()
  await second.press('ArrowLeft')
  await expect(first).toBeFocused()
  await expect(second).toHaveAttribute('aria-selected', 'true')
  await first.press('Enter')
  await expect(first).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('radio', { name: 'Vorne', exact: true })).toBeChecked()
  await expect(page.getByRole('tabpanel')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Weitere Kugel hinzufügen' })).not.toHaveAttribute('role', 'tab')
})

for (const locale of ['de', 'en'] as const) {
  test(`help disclosures and unchosen preview are truthful (${locale})`, async ({ page }) => {
    await open(page, locale)
    await expect(page.locator('form [role="img"]')).not.toHaveAttribute('aria-label', /Matte|Matt,/)
    const finish = page.getByRole('button', { name: locale === 'de' ? 'Oberflächen erklären' : 'Explain finishes' })
    const geometry = await finish.evaluate(button => {
      const target = button.getBoundingClientRect()
      const icon = button.querySelector('svg')!.getBoundingClientRect()
      return { width: target.width, height: target.height, iconWidth: icon.width, iconHeight: icon.height, text: button.textContent?.trim() }
    })
    // DOMRect can differ by ~0.000008px after the preview entrance transform.
    expect(geometry.width).toBeCloseTo(44, 3)
    expect(geometry.height).toBeCloseTo(44, 3)
    expect(geometry.iconWidth).toBeCloseTo(24, 3)
    expect(geometry.iconHeight).toBeCloseTo(24, 3)
    expect(geometry.text).toBe('')
    await finish.click(); await expect(finish).toHaveAttribute('aria-expanded', 'true')
    await finish.press('Escape'); await expect(finish).toHaveAttribute('aria-expanded', 'false'); await expect(finish).toBeFocused()
    await choose(page); await pet(page); await next(page).click()
    await chooseFirstDate(page); await next(page).click()
    const help = page.getByRole('button', { name: locale === 'de' ? 'Lieferung in Wien erklären' : 'Explain Vienna delivery' })
    await expect(help.locator('svg')).toBeVisible()
    await help.click()
    await expect(page.getByText(locale === 'de' ? 'Wir liefern derzeit nur innerhalb Wiens.' : 'We currently only deliver within Vienna.', { exact: true })).toBeVisible()
    await page.locator('#buy-name').focus(); await page.keyboard.press('Escape')
    await expect(help).toBeFocused(); await expect(help).toHaveAttribute('aria-expanded', 'false')
    await axe(page)
  })

  test(`calendar choice outside shortcuts has one persistent summary (${locale})`, async ({ page }) => {
    await open(page, locale)
    await page.evaluate(async () => {
      const path = '/src/api/client.ts'; const { api } = await import(path)
      api.shop.listDeliveryDates = async () => ['02', '09', '16', '23'].map(day => ({ date: `2026-12-${day}`, weekday: 'Wednesday' }))
    })
    await choose(page); await pet(page); await next(page).click()
    const date = page.getByRole('radio', { name: locale === 'de' ? 'Mittwoch, 23. Dezember 2026' : 'Wednesday 23 December 2026', exact: true })
    await date.locator('..').click()
    await expect(page.locator('[data-selected-date]')).toHaveAttribute('data-selected', 'true')
    await expect(page.locator('[data-selected-date] > span')).toHaveText(locale === 'de' ? 'Mi, 23. Dez · abends' : 'Wed, 23 Dec · evening')
    // One shortcut only: the earliest date, above the full calendar.
    await expect(page.locator('[class*="dateCard"][aria-pressed]')).toHaveCount(1)
    await expect(page.locator('[class*="dateCard"][aria-pressed="true"]')).toHaveCount(0)
    await page.locator('[class*="dateCard"][aria-pressed]').click()
    await expect(page.locator('[class*="dateCard"][aria-pressed="true"]')).toHaveCount(1)
    await expect(page.locator('[data-selected-date] > span')).toHaveText(locale === 'de' ? 'Mi, 2. Dez · abends' : 'Wed, 2 Dec · evening')
    await expect(date).not.toBeChecked()
  })

  test(`review uses precise edit actions and static artwork (${locale})`, async ({ page }) => {
    await open(page, locale); await choose(page)
    if (mobile(page)) await next(page).click()
    await page.getByRole('checkbox', { name: /name (auf|on)/i }).check()
    await page.locator('input[id^="back-"]').fill('LUNA')
    // pet() starts at the first substep; return there without losing the name.
    if (mobile(page)) await page.getByRole('tab').click()
    await pet(page); await review(page)
    // One "Ändern" per card, next to its title; its accessible name says what it opens.
    for (const name of locale === 'de' ? ['Kugel Luna ändern', 'Lieferung ändern', 'Kontakt ändern'] : ['Change ornament Luna', 'Change delivery', 'Change contact']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
    await expect(page.locator('section[class*="card"] button')).toHaveCount(3)
    await expect(page.getByRole('button', { name: /^(Ändern|Change)$/ })).toHaveCount(0)
    await expect(page.locator('[data-preview="static"] input, [data-preview="static"] fieldset')).toHaveCount(0)
    // Reference photos occupy the details column, directly below the finish, beside the ornament.
    const product = page.locator('[data-review-product]').first()
    await expect(product.locator(':scope > div:nth-child(2) img')).toHaveCount(1)
    await expect(product.locator(':scope > div:nth-child(2) > p')).toHaveText(locale === 'de' ? 'Glänzend' : 'Shiny')
    const columns = await page.locator('section > dl[class*="rows"] > div').evaluateAll(rows => rows.map(row => {
      const [label, value] = [...row.children].map(child => child.getBoundingClientRect())
      return { label: label.left, value: value.left }
    }))
    expect(columns.length).toBeGreaterThan(5)
    for (const row of columns) expect(row).toEqual(columns[0])
    await expect(page.getByText(locale === 'de' ? 'Nach bestätigter Zahlung malt Gaby deine Kugel für den gewählten Liefertag.' : 'Once payment is confirmed, Gaby paints your ornament for your chosen delivery day.')).toBeVisible()
    await axe(page)
  })
}

test('the dev guide uses isolated synthetic fixtures and never reads live data', async ({ page }) => {
  const apiRequests: string[] = []
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url()) })
  await page.goto('/dev/design')
  await expect(page.getByRole('heading', { level: 1, name: /^(Public design system|Öffentliches Designsystem)$/ })).toBeVisible()
  await expect(page.getByText('--color-selected', { exact: true })).toBeVisible()
  await expect(page.getByText('--space-10', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Weitere Kugel hinzufügen|Add another ornament/, exact: true }).click()
  await expect(page.getByRole('tab')).toHaveCount(2)
  expect(apiRequests).toEqual([])
})
