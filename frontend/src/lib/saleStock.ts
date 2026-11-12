/**
 * Stock arithmetic for the staff New sale draft. Pure functions: the page passes the
 * server inventory and the ornaments already in the draft, so every hint and default
 * reflects what is really left for the next ornament.
 */

export type StockRow = { kind: string; color?: string | null; finish?: string | null; quantity: number }
export type DraftUse = { id: string; kind: string; color?: string | null; finish?: string | null }

export const OFFERED_COLORS = ['red', 'green', 'beige'] as const
export const OFFERED_FINISHES = ['shiny', 'matte'] as const

function sameCombo(row: { kind: string; color?: string | null; finish?: string | null }, kind: string, color?: string | null, finish?: string | null) {
  if (row.kind !== kind) return false
  if (kind === 'finished') return true
  return row.color === color && (row.finish ?? 'shiny') === (finish ?? 'shiny')
}

/**
 * Units of one combination still free for an ornament, after the other draft ornaments
 * take theirs. `exceptId` is the ornament asking (its own pick does not count against it).
 */
export function remainingStock(inventory: StockRow[], draft: DraftUse[], kind: string, color?: string | null, finish?: string | null, exceptId?: string): number {
  const quantity = inventory.filter(row => sameCombo(row, kind, color, finish)).reduce((sum, row) => sum + row.quantity, 0)
  const used = draft.filter(item => item.id !== exceptId && sameCombo(item, kind, color, finish)).length
  return Math.max(0, quantity - used)
}

/** Free units of a colour across all offered finishes. */
export function remainingColor(inventory: StockRow[], draft: DraftUse[], color: string, exceptId?: string): number {
  return OFFERED_FINISHES.reduce((sum, finish) => sum + remainingStock(inventory, draft, 'custom', color, finish, exceptId), 0)
}

/** The first in-stock custom combination in the offered order (colour first, then finish), or null when sold out. */
export function firstAvailableCustom(inventory: StockRow[], draft: DraftUse[], exceptId?: string): { color: (typeof OFFERED_COLORS)[number]; finish: (typeof OFFERED_FINISHES)[number] } | null {
  for (const color of OFFERED_COLORS) {
    for (const finish of OFFERED_FINISHES) {
      if (remainingStock(inventory, draft, 'custom', color, finish, exceptId) > 0) return { color, finish }
    }
  }
  return null
}

/** Keeps a chosen finish when the colour still has it; otherwise the first finish left for that colour. */
export function finishForColor(inventory: StockRow[], draft: DraftUse[], color: string, current: string | null | undefined, exceptId?: string): string | null {
  if (remainingStock(inventory, draft, 'custom', color, current, exceptId) > 0) return current ?? 'shiny'
  return OFFERED_FINISHES.find(finish => remainingStock(inventory, draft, 'custom', color, finish, exceptId) > 0) ?? null
}

export function stockLabel(quantity: number): string {
  return quantity <= 0 ? 'Sold out' : quantity === 1 ? 'Last one' : `${quantity} left`
}
