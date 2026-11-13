import { paintedName } from './paintedName.ts'

export const BACK_NAME_MAX = 6

/**
 * What the back-name field keeps while typing: letters only (the painter cannot letter digits or
 * symbols). Nothing is cut off: a seventh letter stays visible and the field explains the limit.
 */
export function backNameInput(value: string): string {
  return paintedName(value)
}

/** True while the typed name has more letters than fit on the back. */
export function backNameTooLong(value: string): boolean {
  return [...paintedName(value)].length > BACK_NAME_MAX
}
