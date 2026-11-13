import { test, expect } from '@playwright/test'
import { open } from './helpers'

test('radio groups respond to keyboard and show a visible focus indicator', async ({ page }) => {
  await open(page)
  const radio = page.getByRole('radio', { name: /^(Rot|Red)$/ })
  await radio.focus()
  await page.keyboard.press('Space')
  await expect(radio).toBeChecked()
  const focus = await radio.evaluate(node => {
    const own = getComputedStyle(node)
    const parent = getComputedStyle(node.parentElement!)
    return [own.outlineStyle, own.boxShadow, parent.outlineStyle, parent.boxShadow]
  })
  expect(focus.some(value => value !== 'none' && value !== '0px')).toBeTruthy()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('input[type=radio]:checked').first()).toBeChecked()
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab')
  await expect(page.locator(':focus')).toHaveCount(1)
})
