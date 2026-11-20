import type { PostCollectionWeekday, ShippingQuote, ShopItemInput } from '../domain/types.ts'
import type { Locale } from '../i18n/LocaleContext.tsx'
import { addUtcDays, utcWeekday } from './time.ts'

export const AUSTRIAN_POSTAL_REGEX = /^[1-9][0-9]{3}$/
export const TRACKING_NUMBER_REGEX = /^[A-Za-z0-9]{8,40}$/
export const TRACKING_BASE_URL = 'https://www.post.at/s/sendungsdetails?snr='

export type PostShippingConfig = {
  collectionDays: PostCollectionWeekday[]
  collectionsFrom: string | null
  transitMinDays: number
  transitMaxDays: number
  lastArrival: string
  /** Per-date staff overrides (`post_collection_day`): true adds a collection, false cancels one. Empty by default. */
  overrides: Record<string, boolean>
}

export const DEFAULT_POST_CONFIG: PostShippingConfig = {
  collectionDays: ['tuesday', 'friday'],
  collectionsFrom: '2026-11-30',
  transitMinDays: 2,
  transitMaxDays: 3,
  lastArrival: '2026-12-23',
  overrides: {},
}

const WEEKDAY_NUMBERS: Record<PostCollectionWeekday, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
}

const FIXED_HOLIDAYS = new Set([
  '01-01',
  '01-06',
  '05-01',
  '08-15',
  '10-26',
  '11-01',
  '12-08',
  '12-25',
  '12-26',
])

/** Gregorian Easter Sunday (Meeus/Jones/Butcher computus), matching backend AustrianHolidays.java. */
export function easterSunday(year: number): string {
  const goldenNumber = ((year % 19) + 19) % 19
  const century = Math.floor(year / 100)
  const yearInCentury = ((year % 100) + 100) % 100
  const leapCenturies = Math.floor(century / 4)
  const lunarCorrection = Math.floor((century - Math.floor((century + 8) / 25) + 1) / 3)
  const epact = (19 * goldenNumber + century - leapCenturies - lunarCorrection + 15) % 30
  const weekdayOffset = (32 + 2 * (century % 4) + 2 * Math.floor(yearInCentury / 4) - epact - (yearInCentury % 4) + 700) % 7
  const correction = Math.floor((goldenNumber + 11 * epact + 22 * weekdayOffset) / 451)
  const result = epact + weekdayOffset - 7 * correction + 114
  const month = Math.floor(result / 31)
  const day = (result % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function epochDays(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * True if `isoDate` (YYYY-MM-DD) is an Austrian public holiday:
 * 1 Jan, 6 Jan, Easter Monday (+1), 1 May, Ascension (+39), Whit Monday (+50),
 * Corpus Christi (+60), 15 Aug, 26 Oct, 1 Nov, 8 Dec, 25 Dec, 26 Dec.
 */
export function isAustrianHoliday(isoDate: string): boolean {
  const monthDay = isoDate.slice(5)
  if (FIXED_HOLIDAYS.has(monthDay)) return true
  const [year, month] = isoDate.split('-').map(Number)
  if (month < 3 || month > 6) return false
  const daysAfterEaster = epochDays(isoDate) - epochDays(easterSunday(year))
  return daysAfterEaster === 1 || daysAfterEaster === 39 || daysAfterEaster === 50 || daysAfterEaster === 60
}

/** Working day = Monday..Friday and not an Austrian public holiday. (24 Dec on a weekday is a working day.) */
export function isWorkingDay(isoDate: string): boolean {
  const day = utcWeekday(isoDate)
  return day >= 1 && day <= 5 && !isAustrianHoliday(isoDate)
}

export function addWorkingDays(isoDate: string, days: number): string {
  let current = isoDate
  let remaining = days
  while (remaining > 0) {
    current = addUtcDays(current, 1)
    if (isWorkingDay(current)) remaining -= 1
  }
  return current
}

function resolveConfig(options?: Partial<PostShippingConfig>): PostShippingConfig {
  const merged = { ...DEFAULT_POST_CONFIG, ...options, overrides: options?.overrides ?? DEFAULT_POST_CONFIG.overrides }
  if (!merged.collectionDays.length) throw new Error('Post collection days must be Monday to Friday')
  if (merged.transitMinDays < 1 || merged.transitMaxDays < merged.transitMinDays) {
    throw new Error('Invalid Post transit days')
  }
  return merged
}

/**
 * True when the Post collects on `isoDate` (mirrors backend `PostShipping.isCollectionOn`):
 * a working day on or after `collectionsFrom`; a per-date override wins; otherwise a configured
 * weekday, or the first working day after configured weekdays that were holidays
 * (Tue 8 Dec 2026 → Wed 9 Dec). Several shifted collections on one date are still one collection.
 */
export function isCollectionOn(isoDate: string, options?: Partial<PostShippingConfig>): boolean {
  const config = resolveConfig(options)
  if ((config.collectionsFrom && isoDate < config.collectionsFrom) || !isWorkingDay(isoDate)) return false
  const override = config.overrides[isoDate]
  if (override !== undefined) return override
  const allowedWeekdays = new Set(config.collectionDays.map(day => WEEKDAY_NUMBERS[day]))
  if (allowedWeekdays.has(utcWeekday(isoDate))) return true
  for (let prior = addUtcDays(isoDate, -1); !isWorkingDay(prior); prior = addUtcDays(prior, -1)) {
    if (allowedWeekdays.has(utcWeekday(prior))) return true
  }
  return false
}

/** First Post collection day strictly after `readyOn` (and not before `collectionsFrom`). */
export function nextCollectionAfter(readyOn: string, options?: Partial<PostShippingConfig>): string {
  const config = resolveConfig(options)
  let date = addUtcDays(readyOn, 1)
  if (config.collectionsFrom && date < config.collectionsFrom) date = config.collectionsFrom
  // A year of days without a collection means every weekday was cancelled by overrides.
  for (let guard = 0; !isCollectionOn(date, config); guard += 1) {
    if (guard > 366) throw new Error('No Post collection day within a year')
    date = addUtcDays(date, 1)
  }
  return date
}

export function arrivalFor(
  collectionDate: string,
  options?: Partial<PostShippingConfig>,
): { collectionDate: string; arrivalFrom: string; arrivalTo: string } {
  const config = resolveConfig(options)
  const arrivalFrom = addWorkingDays(collectionDate, config.transitMinDays)
  const arrivalTo = addWorkingDays(arrivalFrom, config.transitMaxDays - config.transitMinDays)
  return { collectionDate, arrivalFrom, arrivalTo }
}

/** Computes the Post shipping window for ornaments ready on `readyOn`, enforcing `arrivalTo <= lastArrival`. */
export function shippingWindowAfter(readyOn: string, options?: Partial<PostShippingConfig>): ShippingQuote {
  const config = resolveConfig(options)
  if (readyOn >= config.lastArrival) {
    return { available: false, collectionDate: null, arrivalFrom: null, arrivalTo: null }
  }
  const window = arrivalFor(nextCollectionAfter(readyOn, config), config)
  if (window.arrivalTo > config.lastArrival) {
    return { available: false, collectionDate: null, arrivalFrom: null, arrivalTo: null }
  }
  return { available: true, ...window }
}

export type PlannedPaintSlot = { date: string; startHour: number; endHour: number }

/**
 * Pure Post shipping planner mirroring `ShopService.planShipping` + `ShopService.plan`:
 * sorts custom ornaments longest duration first (1.25h with name, 1.0h without),
 * tests each candidate collection day in order, and picks the first one where all
 * ornaments fit on painting days strictly before the collection day (within 7 days before it,
 * and not before `today + leadDays`).
 */
export function planPostShipping(input: {
  today: string
  items: Pick<ShopItemInput, 'kind' | 'withName'>[]
  findSlot: (
    date: string,
    durationHours: number,
    extraBusy: { startHour: number; endHour: number }[],
  ) => { startHour: number; endHour: number } | null
  config?: Partial<PostShippingConfig>
  leadDays?: number
  maxDaysAhead?: number
}): { quote: ShippingQuote; slots: PlannedPaintSlot[] } {
  const config = resolveConfig(input.config)
  const leadDays = Math.max(1, input.leadDays ?? 1)
  const maxDaysAhead = input.maxDaysAhead ?? 60
  const lastCollection = addUtcDays(input.today, maxDaysAhead)
  const notBefore = addUtcDays(input.today, leadDays)
  const readyFloor = addUtcDays(input.today, leadDays - 1)
  const durations = input.items
    .filter(item => item.kind === 'custom')
    .map(item => (item.withName ? 1.25 : 1.0))
    .sort((a, b) => b - a)

  for (
    let candidate = shippingWindowAfter(readyFloor, config);
    candidate.available && candidate.collectionDate;
    candidate = shippingWindowAfter(candidate.collectionDate, config)
  ) {
    if (candidate.collectionDate > lastCollection) break
    const earliestPaint = addUtcDays(candidate.collectionDate, -7)
    const floor = earliestPaint > notBefore ? earliestPaint : notBefore
    const taken = new Map<string, { startHour: number; endHour: number }[]>()
    const slots: PlannedPaintSlot[] = []
    let allFit = true

    for (const duration of durations) {
      let placed: PlannedPaintSlot | null = null
      for (let date = addUtcDays(candidate.collectionDate, -1); date >= floor; date = addUtcDays(date, -1)) {
        const busy = taken.get(date) ?? []
        const slot = input.findSlot(date, duration, busy)
        if (slot) {
          placed = { date, startHour: slot.startHour, endHour: slot.endHour }
          taken.set(date, [...busy, slot])
          break
        }
      }
      if (!placed) {
        allFit = false
        break
      }
      slots.push(placed)
    }

    if (allFit) {
      return { quote: candidate, slots }
    }
  }

  return {
    quote: { available: false, collectionDate: null, arrivalFrom: null, arrivalTo: null },
    slots: [],
  }
}

export function postTrackingUrl(trackingNumber?: string | null): string | null {
  const clean = (trackingNumber ?? '').trim()
  return TRACKING_NUMBER_REGEX.test(clean) ? `${TRACKING_BASE_URL}${clean}` : null
}

function dateParts(isoDate: string, locale: Locale) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
  const tag = locale === 'de' ? 'de-AT' : 'en-GB'
  const weekday = new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' })
    .format(utc)
    .replace(/\.$/, '')
  const monthName = new Intl.DateTimeFormat(tag, { month: 'long', timeZone: 'UTC' }).format(utc)
  return { year, month, day, weekday, monthName }
}

/**
 * Step 2 & Review range with short weekdays:
 * DE: "Do, 3. – Fr, 4. Dezember" (cross-month: "Mo, 30. November – Mi, 2. Dezember")
 * EN: "Thu 3 – Fri 4 December" (cross-month: "Mon 30 November – Wed 2 December")
 */
export function formatArrivalWithWeekdays(from: string, to: string, locale: Locale): string {
  const a = dateParts(from, locale)
  const b = dateParts(to, locale)
  if (locale === 'de') {
    if (from === to) return `${a.weekday}, ${a.day}. ${b.monthName}`
    if (a.year === b.year && a.month === b.month) {
      return `${a.weekday}, ${a.day}. – ${b.weekday}, ${b.day}. ${b.monthName}`
    }
    return `${a.weekday}, ${a.day}. ${a.monthName} – ${b.weekday}, ${b.day}. ${b.monthName}`
  }
  if (from === to) return `${a.weekday} ${a.day} ${b.monthName}`
  if (a.year === b.year && a.month === b.month) {
    return `${a.weekday} ${a.day} – ${b.weekday} ${b.day} ${b.monthName}`
  }
  return `${a.weekday} ${a.day} ${a.monthName} – ${b.weekday} ${b.day} ${b.monthName}`
}

/**
 * Compact arrival range for Track, Thanks, and e-mails:
 * DE: "3.–4. Dezember" (or "3.–4. Dezember 2026" when `withYear` is true)
 * EN: "3–4 December" (or "3–4 December 2026" when `withYear` is true)
 */
export function formatArrivalRange(from: string, to: string, locale: Locale, withYear = false): string {
  const a = dateParts(from, locale)
  const b = dateParts(to, locale)
  const tail = withYear ? ` ${b.year}` : ''
  if (locale === 'de') {
    if (from === to) return `${a.day}. ${b.monthName}${tail}`
    if (a.year === b.year && a.month === b.month) {
      return `${a.day}.–${b.day}. ${b.monthName}${tail}`
    }
    const startYear = withYear && a.year !== b.year ? ` ${a.year}` : ''
    return `${a.day}. ${a.monthName}${startYear} – ${b.day}. ${b.monthName}${tail}`
  }
  if (from === to) return `${a.day} ${b.monthName}${tail}`
  if (a.year === b.year && a.month === b.month) {
    return `${a.day}–${b.day} ${b.monthName}${tail}`
  }
  const startYear = withYear && a.year !== b.year ? ` ${a.year}` : ''
  return `${a.day} ${a.monthName}${startYear} – ${b.day} ${b.monthName}${tail}`
}
