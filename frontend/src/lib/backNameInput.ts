import { DEFAULT_BACK_NAME_MAX, paintedName, paintedNameValid } from './paintedName.ts'

/**
 * What the back-name field keeps while typing: letters only (the painter cannot letter digits or
 * symbols). Nothing is cut off: an extra letter stays visible and the field explains the limit.
 */
export function backNameInput(value: string): string {
  return paintedName(value)
}

/** True while the typed name has more letters than fit on the back (a saved, older name is allowed). */
export function backNameTooLong(value: string, max: number = DEFAULT_BACK_NAME_MAX, saved?: string | null): boolean {
  return paintedName(value).length > 0 && !paintedNameValid(value, max, saved)
}
