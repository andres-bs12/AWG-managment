/** Letters allowed on the back until the server says otherwise (PricingService.DEFAULT_BACK_NAME_MAX). */
export const DEFAULT_BACK_NAME_MAX = 5
/** Highest limit staff may choose on the Stock screen (PricingService.BACK_NAME_MAX_LIMIT). */
export const BACK_NAME_MAX_LIMIT = 20

/** Derive lettering from the pet name, using only Unicode letters. Never truncate silently. */
export function paintedName(value: string): string {
  return value.normalize('NFC').replace(/[^\p{L}]/gu, '')
}

/** Letters as the painter sees them: upper case, so "ß" counts as two. */
export function paintedLetterCount(value: string): number {
  return [...paintedName(value).toUpperCase()].length
}

/**
 * True when the name fits on the back. `saved` is the name already stored on the order: re-sending it
 * unchanged stays valid even if staff lowered the limit afterwards (same rule as the server).
 */
export function paintedNameValid(value: string, max: number = DEFAULT_BACK_NAME_MAX, saved?: string | null): boolean {
  const letters = paintedLetterCount(value)
  if (letters > 0 && saved && paintedName(value).toUpperCase() === saved.toUpperCase()) return true
  return letters > 0 && letters <= max
}
