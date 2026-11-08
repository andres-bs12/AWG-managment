import type { Locale } from '../i18n/LocaleContext'

/**
 * Vienna home delivery runs in a fixed evening window (owner decision 2026-11-08):
 * Wednesdays and Fridays, 18:00–20:00 Europe/Vienna.
 * Hard-coded until the backend exposes the window in the shop config.
 */
export const DELIVERY_WINDOW_START_HOUR = 18
export const DELIVERY_WINDOW_END_HOUR = 20

/** '18–20 Uhr' / '6–8 pm'. */
export function deliveryWindowLabel(locale: Locale): string {
  return locale === 'de' ? '18–20 Uhr' : '6–8 pm'
}

/** Clock part for an ICS time value: 18 → '180000'. */
export function icsHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}0000`
}

/**
 * One phrase for a chosen delivery day:
 * 'Mittwoch, 2. Dezember 2026 · 18–20 Uhr' / 'Wednesday 2 December 2026 · 6–8 pm'.
 */
export function deliveryDatePhrase(isoDate: string, locale: Locale): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const format = new Intl.DateTimeFormat(locale === 'de' ? 'de-AT' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return `${format.format(new Date(Date.UTC(y, m - 1, d)))} · ${deliveryWindowLabel(locale)}`
}
