/** Shared phone rule for /buy and /form: digits with the usual separators, at least 6 and at most 15 digits. */
export const PHONE_MIN_DIGITS = 6
const PHONE_MAX_DIGITS = 15

export function phoneValid(value: string): boolean {
  const phone = value.trim()
  if (!/^\+?[\d\s()./-]+$/.test(phone)) return false
  const digits = phone.replace(/\D/g, '').length
  return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS
}
