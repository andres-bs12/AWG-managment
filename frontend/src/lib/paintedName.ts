/** Derive lettering from the pet name, using only Unicode letters. Never truncate silently. */
export function paintedName(value: string): string {
  return value.normalize('NFC').replace(/[^\p{L}]/gu, '')
}
export function paintedNameValid(value: string): boolean {
  const letters = [...paintedName(value).toUpperCase()]
  return letters.length > 0 && letters.length <= 6
}
