/**
 * Plain-language facts for a delivery row, so a stall worker reads at a glance who it is for,
 * what it is, where it goes, what to collect and why it cannot be handed over yet.
 */
type Row = {
  kind?: 'custom' | 'finished'
  backName?: string
  customerName?: string
  productionStatus: 'not_started' | 'in_progress' | 'finished'
  handedOver: boolean
  waitingForCustomer?: boolean
  paymentState?: 'unpaid' | 'deposit' | 'paid'
  remaining?: number
}

/** The stall stores customers as "Walk-in" until the QR form arrives. */
export const WALK_IN = 'Walk-in'

export function customerLabel(name?: string): string {
  const clean = (name ?? '').trim()
  return !clean || clean === WALK_IN ? 'Name not given yet' : clean
}

/** What the ornament is: the painted name, or why there is none. */
export function ornamentLabel(row: Pick<Row, 'kind' | 'backName'>): string {
  if (row.kind === 'finished') return 'Not personalised'
  const name = (row.backName ?? '').trim()
  return name ? name : 'Personalised · no name'
}

const ORDINAL = ['th', 'st', 'nd', 'rd']
function ordinal(n: number): string {
  const v = n % 100
  return `${n}${ORDINAL[(v - 20) % 10] || ORDINAL[v] || ORDINAL[0]}`
}

/** Vienna postcodes are 1XX0, where XX is the district (1010 = 1st, 1230 = 23rd). */
export function viennaDistrict(postalCode?: string | null): string | null {
  const match = /^1(\d\d)0$/.exec((postalCode ?? '').trim())
  if (!match) return null
  const district = Number(match[1])
  return district >= 1 && district <= 23 ? `${ordinal(district)} district` : null
}

/** One line about money, saying who owes what. Null when nothing is due. */
export function paymentLine(row: Pick<Row, 'paymentState' | 'remaining'>, format: (n: number) => string): { text: string; due: boolean } | null {
  const due = row.remaining ?? 0
  if (due <= 0) return row.paymentState ? { text: 'Paid', due: false } : null
  return { text: `${row.paymentState === 'deposit' ? 'Deposit paid' : 'Not paid yet'} · collect ${format(due)} at handover`, due: true }
}

/** Why the Hand over button is disabled, or null when it can be used. */
export function handoverBlocker(row: Row): string | null {
  if (row.handedOver || row.productionStatus === 'finished') return null
  if (row.waitingForCustomer) return 'Waiting for the customer form or photos'
  return row.productionStatus === 'in_progress' ? 'Still being painted' : 'Not painted yet'
}

/** Short production state for the item line. */
export function productionLabel(row: Row): string {
  if (row.kind === 'finished') return 'Ready-made'
  if (row.productionStatus === 'finished') return 'Painted'
  if (row.waitingForCustomer) return 'Waiting for form or photos'
  return row.productionStatus === 'in_progress' ? 'Painting' : 'To paint'
}
