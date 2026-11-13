/** Derive lettering from the pet name, using only Unicode letters. Never truncate silently. */
export function paintedName(value: string): string {
  return value.normalize('NFC').replace(/[^\p{L}]/gu, '')
}
export function paintedNameValid(value: string): boolean {
  const letters = [...paintedName(value).toUpperCase()]
  return letters.length > 0 && letters.length <= 6
}
/** Preserve existing lettering when loading legacy data or enabling the name option. */
export function reconcilePetName<T extends { petName: string; backName: string; withName: boolean }>(item: T): T {
  if (!item.withName) return item
  const petName = item.petName || item.backName
  return { ...item, petName, backName: item.backName || paintedName(petName) }
}

/** Explicit edits must allow an empty name; fallback is only for loading and enabling. */
export function patchPetName<T extends { petName: string; backName: string; withName: boolean }>(item: T, partial: Partial<T>): T {
  const next = { ...item, ...partial }
  if (next.withName && partial.petName !== undefined) return { ...next, backName: paintedName(partial.petName) }
  return partial.withName === true ? reconcilePetName(next) : next
}
