import { test, expect } from '@playwright/test'
import { axe } from './helpers'

// AWG0103: Vienna delivery, in the workshop (seed.ts).
const copy = {
  de: { instagram: 'Fragen? Schreib uns auf Instagram', change: 'Lieferadresse ändern' },
  en: { instagram: 'Questions? Message us on Instagram', change: 'Change delivery address' },
} as const

for (const locale of ['de', 'en'] as const) {
  test(`Track offers Instagram contact and no address change (${locale})`, async ({ page }) => {
    await page.addInitScript(lang => localStorage.setItem('awg-locale', lang), locale)
    await page.goto('/track/AWG0103')
    const card = page.locator('section[aria-live]')
    await expect(card.getByRole('heading', { level: 1 })).toBeVisible()
    await card.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)))

    const link = card.getByRole('link', { name: copy[locale].instagram, exact: true })
    await expect(link).toHaveAttribute('href', 'https://www.instagram.com/art_withgab_')
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    // The row stays inside the card's content and its label does not overflow.
    expect(await link.evaluate(node => {
      const own = node.getBoundingClientRect(), parent = node.parentElement!.getBoundingClientRect()
      return own.left >= parent.left && own.right <= parent.right && node.scrollWidth <= node.clientWidth
    })).toBe(true)
    // It follows the receipt and comes before the page actions.
    expect(await link.evaluate(node => {
      const receipt = node.parentElement!.querySelector('section')
      const back = node.parentElement!.querySelector('a[href="/"]')
      return !!receipt && !!back
        && !!(receipt.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)
        && !!(node.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING)
    })).toBe(true)

    await expect(page.getByRole('button', { name: copy[locale].change, exact: true })).toHaveCount(0)
    await expect(page.locator('#line1, #postal, #city')).toHaveCount(0)
    await axe(page)
  })
}
