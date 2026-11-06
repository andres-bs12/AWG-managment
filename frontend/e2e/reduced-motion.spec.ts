import { test, expect } from '@playwright/test'
test('reduced motion does not run transform animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00Z'))
  await page.goto('/buy')
  await expect(page.locator('fieldset[id^="color-"]')).toBeVisible()
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  const transforms = await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect instanceof KeyframeEffect && animation.effect.getKeyframes().some(frame => 'transform' in frame)).length)
  expect(transforms).toBe(0)
})
