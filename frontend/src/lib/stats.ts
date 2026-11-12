import type { Order, OrderItem, Stats, StatsFunnelStage } from '../domain/types.ts'

export type StatsPeriod = 'today' | 'week' | 'month' | 'season'

/** The backend accepts at most 400 days between `from` and `to`. */
export const MAX_STATS_DAYS = 400

function addDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/**
 * Vienna date range for a period, both ends inclusive. Season runs from the earlier of Nov 1 and
 * the first stall day of the season year to the configured season end, never past today.
 */
export function statsRange(period: StatsPeriod, today: string, season: { seasonEnd?: string; stallDays?: string[] } = {}): { from: string; to: string } {
  if (period === 'today') return { from: today, to: today }
  if (period === 'week') return { from: addDays(today, -6), to: today }
  if (period === 'month') return { from: addDays(today, -29), to: today }
  const seasonEnd = season.seasonEnd && /^\d{4}-\d{2}-\d{2}$/.test(season.seasonEnd) ? season.seasonEnd : `${today.slice(0, 4)}-12-24`
  const year = seasonEnd.slice(0, 4)
  const firstStall = (season.stallDays ?? []).filter(date => date.startsWith(year) && date <= seasonEnd).sort()[0]
  const start = firstStall && firstStall < `${year}-11-01` ? firstStall : `${year}-11-01`
  const to = seasonEnd < today ? seasonEnd : today
  let from = start < to ? start : to
  if (daysBetween(from, to) > MAX_STATS_DAYS) from = addDays(to, -MAX_STATS_DAYS)
  return { from, to }
}

/** Whole-number share in percent; 0 when there is nothing to divide. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0
}

/** A clean axis maximum (1, 2, 2.5 or 5 × 10^n) at or above the largest value. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  for (const step of [1, 2, 2.5, 5, 10]) if (step * power >= value) return step * power
  return 10 * power
}

export const funnelLabels: Record<StatsFunnelStage, string> = {
  opened: 'Opened the shop',
  delivery: 'Reached delivery',
  review: 'Reached review',
  pay_click: 'Clicked pay',
  paid: 'Paid',
}

export function funnelRows(funnel: Stats['web']['funnel']): { stage: StatsFunnelStage; label: string; count: number; share: number }[] {
  const opened = funnel.find(row => row.stage === 'opened')?.count ?? 0
  return (Object.keys(funnelLabels) as StatsFunnelStage[]).map(stage => {
    const count = funnel.find(row => row.stage === stage)?.count ?? 0
    return { stage, label: funnelLabels[stage], count, share: percent(count, opened) }
  })
}

const fieldLabels: Record<string, string> = {
  customerName: 'Name', name: 'Name', email: 'E-mail', phone: 'Phone',
  line1: 'Street and number', line2: 'Address line 2', postalCode: 'Postcode', city: 'City',
  deliveryDate: 'Delivery date', pickupDay: 'Pickup day', pickupTime: 'Pickup time', deliveryKind: 'Delivery choice',
  acceptTerms: 'Terms', terms: 'Terms', color: 'Colour', finish: 'Finish', backName: 'Name on the back',
  photos: 'Photos', photo: 'Photos', note: 'Note',
}

/** Human labels for form field ids recorded by the shop; unknown ids become sentence case. */
export function fieldLabel(field: string): string {
  if (fieldLabels[field]) return fieldLabels[field]
  const words = field.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim().toLowerCase()
  return words ? words[0].toUpperCase() + words.slice(1) : 'Unknown field'
}

const stepLabels: Record<string, string> = { design: 'Design', delivery: 'Delivery', details: 'Details', review: 'Review' }
export function stepLabel(step: string): string { return stepLabels[step] ?? '' }

export function errorCodeLabel(code: string): string {
  return code === 'required' ? 'Missing' : code === 'invalid' ? 'Not valid' : ''
}

const colorLabels: Record<string, string> = { red: 'Red', green: 'Green', beige: 'Beige', grey: 'Grey', white: 'White' }
const finishLabels: Record<string, string> = { shiny: 'Shiny', matte: 'Matte' }
export function colorLabel(color: string): string { return colorLabels[color] ?? fieldLabel(color) }
export function finishLabel(finish: string): string { return finishLabels[finish] ?? fieldLabel(finish) }

/** One anonymous metric row: a count of events on one Vienna day, as the backend stores them. */
export type MetricRow = { date: string; event: string; step?: string; field?: string; code?: string; value?: string; count: number }

const VIEW_EVENTS = new Set(['home_view', 'buy_view', 'track_view', 'form_view'])
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Same aggregation as the backend StatsService, for the mock API. `viennaDay` maps an order's
 * creation instant to its Vienna calendar date; `received` gives the amount paid so far.
 */
export function aggregateStats(input: {
  from: string; to: string
  orders: Order[]; items: OrderItem[]; metrics: MetricRow[]
  viennaDay: (instant: string) => string
  received: (order: Order) => number
}): Stats {
  const { from, to } = input
  const created = input.orders.filter(order => { const day = input.viennaDay(order.createdAt); return day >= from && day <= to })
  const unconfirmed = (order: Order) => order.source === 'web' && (order.checkoutStatus === 'pending' || order.checkoutStatus === 'review' || Boolean(order.paymentReview))
  const active = created.filter(order => order.status !== 'CANCELLED')
  const sold = active.filter(order => !unconfirmed(order))
  const itemsOf = (order: Order) => input.items.filter(item => item.orderId === order.id)
  const items = sold.flatMap(itemsOf)
  const revenue = round2(sold.reduce((sum, order) => sum + order.total, 0))
  const received = round2(sold.reduce((sum, order) => sum + input.received(order), 0))

  const bySource = (['stall', 'web'] as const).map(source => {
    const rows = sold.filter(order => (order.source ?? 'stall') === source)
    return { source, orders: rows.length, ornaments: rows.reduce((sum, order) => sum + itemsOf(order).length, 0), revenue: round2(rows.reduce((sum, order) => sum + order.total, 0)) }
  })

  const metrics = input.metrics.filter(row => row.date >= from && row.date <= to)
  const daily: Stats['daily'] = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const onDay = sold.filter(order => input.viennaDay(order.createdAt) === day)
    daily.push({
      date: day, orders: onDay.length, ornaments: onDay.reduce((sum, order) => sum + itemsOf(order).length, 0),
      revenue: round2(onDay.reduce((sum, order) => sum + order.total, 0)),
      visits: metrics.filter(row => row.date === day && VIEW_EVENTS.has(row.event)).reduce((sum, row) => sum + row.count, 0),
    })
  }

  const colorCounts = new Map<string, number>()
  for (const item of items) {
    if (item.kind !== 'custom' || !item.color) continue
    const key = `${item.color}|${item.finish ?? 'shiny'}`
    colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1)
  }
  const colors = [...colorCounts].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ color: key.split('|')[0], finish: key.split('|')[1], count })).sort((a, b) => b.count - a.count)

  const total = (event: string, test: (row: MetricRow) => boolean = () => true) => metrics.filter(row => row.event === event && test(row)).reduce((sum, row) => sum + row.count, 0)
  const errors = new Map<string, number>()
  for (const row of metrics) if (row.event === 'buy_validation_error') {
    const key = `${row.step ?? ''}|${row.field ?? ''}|${row.code ?? ''}`
    errors.set(key, (errors.get(key) ?? 0) + row.count)
  }

  return {
    from, to,
    sales: {
      orders: sold.length, ornaments: items.length,
      custom: items.filter(item => item.kind === 'custom').length, finished: items.filter(item => item.kind === 'finished').length,
      withName: items.filter(item => item.withName).length,
      revenue, received, outstanding: round2(Math.max(0, revenue - received)),
      averageOrder: sold.length ? round2(revenue / sold.length) : 0,
      cancelled: created.length - active.length, checkoutsInProgress: active.length - sold.length,
    },
    bySource, daily, colors,
    delivery: { market: items.filter(item => item.delivery.kind !== 'vienna').length, vienna: items.filter(item => item.delivery.kind === 'vienna').length },
    web: {
      homeViews: total('home_view'), buyViews: total('buy_view'), trackViews: total('track_view'), formViews: total('form_view'),
      funnel: [
        { stage: 'opened', count: total('buy_view', row => !row.step && !row.field) },
        { stage: 'delivery', count: total('buy_step', row => row.step === 'delivery') },
        { stage: 'review', count: total('buy_step', row => row.step === 'review') },
        { stage: 'pay_click', count: total('buy_pay_click') },
        { stage: 'paid', count: total('buy_paid') },
      ],
      validationErrors: [...errors].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => { const [step, field, code] = key.split('|'); return { step, field, code, count } }).sort((a, b) => b.count - a.count).slice(0, 10),
      nameOn: total('buy_choice', row => row.field === 'name' && row.value === 'on'),
      nameOff: total('buy_choice', row => row.field === 'name' && row.value === 'off'),
    },
  }
}

/** Deterministic 0..1 noise per day and channel, so demo numbers stay stable between reloads. */
function noise(day: string, salt: number): number {
  let hash = 2166136261 ^ salt
  for (const char of day) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return ((hash >>> 0) % 1000) / 1000
}

/**
 * Plausible anonymous web traffic for the mock API, from Nov 1 of `today`'s year up to today.
 * The real backend only counts recorded events; this exists so the demo page is not empty.
 * `buy_paid` is left out: the mock derives it from the paid web orders it actually stores.
 */
export function demoWebMetrics(from: string, to: string, today: string): MetricRow[] {
  const rows: MetricRow[] = []
  const start = `${today.slice(0, 4)}-11-01`
  const last = to < today ? to : today
  for (let day = from > start ? from : start; day <= last; day = addDays(day, 1)) {
    const weekend = [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay())
    const lift = weekend ? 1.35 : 1
    const home = Math.round((38 + noise(day, 1) * 40) * lift)
    const buy = Math.round(home * (0.36 + noise(day, 2) * 0.12))
    const delivery = Math.round(buy * (0.55 + noise(day, 3) * 0.1))
    const review = Math.round(delivery * (0.62 + noise(day, 4) * 0.1))
    const pay = Math.round(review * (0.7 + noise(day, 5) * 0.1))
    rows.push(
      { date: day, event: 'home_view', count: home },
      { date: day, event: 'buy_view', count: buy },
      { date: day, event: 'track_view', count: Math.round(4 + noise(day, 7) * 10) },
      { date: day, event: 'form_view', count: Math.round(1 + noise(day, 8) * 5) },
      { date: day, event: 'buy_step', step: 'delivery', count: delivery },
      { date: day, event: 'buy_step', step: 'review', count: review },
      { date: day, event: 'buy_pay_click', count: pay },
      { date: day, event: 'buy_validation_error', step: 'delivery', field: 'postalCode', code: 'invalid', count: Math.round(noise(day, 9) * 4) },
      { date: day, event: 'buy_validation_error', step: 'delivery', field: 'email', code: 'invalid', count: Math.round(noise(day, 10) * 3) },
      { date: day, event: 'buy_validation_error', step: 'delivery', field: 'phone', code: 'required', count: Math.round(noise(day, 11) * 2) },
      { date: day, event: 'buy_choice', field: 'name', value: 'on', count: Math.round(buy * 0.4) },
      { date: day, event: 'buy_choice', field: 'name', value: 'off', count: Math.round(buy * 0.25) },
    )
  }
  return rows.filter(row => row.count > 0)
}
