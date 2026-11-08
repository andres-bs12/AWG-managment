import { test, expect } from '@playwright/test'
import { open, choose, mobile, next, pet, review, axe } from './helpers'

test('chips and side segments use the exact token geometry', async ({ page }) => {
  await open(page)
  await choose(page)
  const read = () => page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    const token = (name: string) => parseFloat(root.getPropertyValue(name))
    const geometry = (selector: string, inset: string) => [...document.querySelectorAll<HTMLElement>(selector)].map(node => {
      const style = getComputedStyle(node)
      return { blockStart: parseFloat(style.paddingTop), blockEnd: parseFloat(style.paddingBottom), innerGap: parseFloat(style.columnGap), height: node.getBoundingClientRect().height, left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight), border: parseFloat(style.borderLeftWidth), expectedLeft: token(inset), expectedRight: token('--space-4'), expectedGap: token('--space-2') }
    })
    return { size: token('--size-control'), gap: root.getPropertyValue('--space-3').trim(), chips: geometry('[class*="chipRow"] > label', '--space-3'), gaps: [...document.querySelectorAll('[class*="chipRow"]')].map(node => getComputedStyle(node).gap), shadows: [...document.querySelectorAll('[data-selected="true"] > [class*="swatch"]')].map(node => getComputedStyle(node).boxShadow) }
  })
  const values = await read()
  expect(values.size).toBe(48)
  for (const item of values.chips) {
    expect(item.height).toBe(48)
    expect(item.blockStart).toBe(0)
    expect(item.blockEnd).toBe(0)
    expect(item.left).toBe(item.expectedLeft - item.border)
    expect(item.right).toBe(item.expectedRight - item.border)
  }
  expect(new Set(values.chips.map(item => item.height)).size).toBe(1)
  for (const chip of values.chips) expect(chip.innerGap).toBe(chip.expectedGap)
  for (const gap of values.gaps) expect(gap).toBe(values.gap)
  for (const shadow of values.shadows) expect(shadow).toBe('none')
  if (mobile(page)) await next(page).click()
  await page.getByRole('radio', { name: /^(Ja|Yes),/ }).check()
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

test('overview edit buttons keep the side choice per ornament', async ({ page }) => {
  await open(page); await choose(page)
  if (mobile(page)) await next(page).click()
  await page.getByRole('radio', { name: /^Ja,/ }).check()
  await page.getByRole('radio', { name: 'Vorne', exact: true }).locator('..').click()
  await page.getByRole('button', { name: 'Weitere Kugel hinzufügen', exact: true }).click()
  await expect(page.locator('#ornament-editor-heading')).toBeFocused()
  const first = page.getByRole('button', { name: 'Kugel 1 bearbeiten', exact: true })
  await first.focus(); await first.press('Enter')
  // The ornament being edited has no Edit button of its own; the heading names it.
  await expect(first).toHaveCount(0)
  await expect(page.locator('#ornament-editor-heading')).toHaveText(/^Kugel 1 von 2/)
  await expect(page.getByRole('radio', { name: 'Vorne', exact: true })).toBeChecked()
  await expect(page.getByRole('tab')).toHaveCount(0)
  await expect(page.getByRole('tabpanel')).toHaveCount(0)
})

for (const locale of ['de', 'en'] as const) {
  test(`help disclosures and unchosen preview are truthful (${locale})`, async ({ page }) => {
    await open(page, locale)
    await expect(page.locator('[data-public-preview] [role="img"]')).not.toHaveAttribute('aria-label', /Matte|Matt,/)
    const finish = page.getByRole('button', { name: locale === 'de' ? 'Oberflächen erklären' : 'Explain finishes' })
    await finish.click(); await expect(finish).toHaveAttribute('aria-expanded', 'true')
    await finish.press('Escape'); await expect(finish).toHaveAttribute('aria-expanded', 'false'); await expect(finish).toBeFocused()
    await choose(page); await pet(page); await next(page).click()
    const help = page.getByRole('button', { name: locale === 'de' ? 'Lieferung in Wien erklären' : 'Explain Vienna delivery' })
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
    await expect(page.locator('[data-selected-date] > span')).toHaveText(locale === 'de' ? 'Mi, 23. Dez · 18–20 Uhr' : 'Wed, 23 Dec · 6–8 pm')
    // One shortcut only: the earliest date, above the full calendar.
    await expect(page.locator('[class*="dateCard"][aria-pressed]')).toHaveCount(1)
    await expect(page.locator('[class*="dateCard"][aria-pressed="true"]')).toHaveCount(0)
    await page.locator('[class*="dateCard"][aria-pressed]').click()
    await expect(page.locator('[class*="dateCard"][aria-pressed="true"]')).toHaveCount(1)
    await expect(page.locator('[data-selected-date] > span')).toHaveText(locale === 'de' ? 'Mi, 2. Dez · 18–20 Uhr' : 'Wed, 2 Dec · 6–8 pm')
    await expect(date).not.toBeChecked()
  })

  test(`review uses precise edit actions and static artwork (${locale})`, async ({ page }) => {
    await open(page, locale); await choose(page)
    if (mobile(page)) await next(page).click()
    await page.getByRole('radio', { name: /^(Ja|Yes),/ }).check()
    await page.locator('input[id^="back-"]').fill('LUNA')
    // pet() starts at the first substep; return there without losing the name.
    if (mobile(page)) await page.getByRole('button', { name: locale === 'de' ? 'Zurück' : 'Back', exact: true }).click()
    await pet(page); await review(page)
    // One "Ändern" per card, next to its title; its accessible name says what it opens.
    for (const name of locale === 'de' ? ['Kugel Luna ändern', 'Lieferung ändern', 'Kontakt ändern'] : ['Change ornament Luna', 'Change delivery', 'Change contact']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
    await expect(page.locator('section[class*="card"] button')).toHaveCount(3)
    await expect(page.getByRole('button', { name: /^(Ändern|Change)$/ })).toHaveCount(0)
    await expect(page.locator('[data-preview="static"] input, [data-preview="static"] fieldset')).toHaveCount(0)
    const columns = await page.locator('section > dl[class*="rows"] > div').evaluateAll(rows => rows.map(row => {
      const [label, value] = [...row.children].map(child => child.getBoundingClientRect())
      return { label: label.left, value: value.left }
    }))
    expect(columns.length).toBeGreaterThan(5)
    for (const row of columns) expect(row).toEqual(columns[0])
    await expect(page.getByText(locale === 'de' ? 'Nach der Zahlung male ich deine Kugeln rechtzeitig zu deinem Liefertag.' : 'Once your payment is confirmed, I paint your ornaments in time for your chosen delivery day.')).toBeVisible()
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
