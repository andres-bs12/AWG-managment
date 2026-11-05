type Problem = { code?: string; field?: string; message?: string }
type Locale = 'de' | 'en'

const messages: Record<string, [string, string]> = {
  PHOTO_INVALID: ['A photo could not be read. Please add it again (JPEG, PNG, WebP or HEIC).', 'Ein Foto konnte nicht gelesen werden. Bitte füge es erneut hinzu (JPEG, PNG, WebP oder HEIC).'],
  VALIDATION: ['Please check this value.', 'Bitte überprüfe diese Angabe.'],
  NOT_FOUND: ['This item could not be found.', 'Dieser Eintrag wurde nicht gefunden.'],
  ORDER_NOT_FOUND: ['Order not found. Check your code.', 'Bestellung nicht gefunden. Bitte überprüfe deinen Code.'],
  FORM_EXPIRED: ['This link has expired. Write to us if you need anything.', 'Dieser Link ist abgelaufen. Schreib uns, wenn du etwas brauchst.'],
  FORM_LOCKED: ['Painting has started or the order was handed over. Changes are no longer possible.', 'Die Bemalung hat begonnen oder die Bestellung wurde übergeben. Änderungen sind nicht mehr möglich.'],
  POSTAL_OUTSIDE_VIENNA: ['Please enter a Vienna postal code (1010–1230).', 'Bitte gib eine Wiener Postleitzahl (1010–1230) ein.'],
  DELIVERY_DAY_INVALID: ['Please choose an available delivery date.', 'Bitte wähle einen verfügbaren Liefertermin.'],
  DAY_FULL: ['This day is full. Please choose another date.', 'Dieser Tag ist ausgebucht. Bitte wähle einen anderen Termin.'],
  RATE_LIMITED: ['Too many requests. Please try again later.', 'Zu viele Anfragen. Bitte versuche es später erneut.'],
  STOCK_CHANGED: ['Stock changed. Please reload and review your selection.', 'Der Bestand hat sich geändert. Bitte lade die Seite neu und überprüfe deine Auswahl.'],
  OUT_OF_STOCK: ['This item is out of stock. Please choose another.', 'Dieser Artikel ist ausverkauft. Bitte wähle einen anderen.'],
  PAYMENT_PENDING: ['Payment is still pending. Please try again later.', 'Die Zahlung ist noch ausständig. Bitte versuche es später erneut.'],
  SHOP_CLOSED: ['The shop is currently closed.', 'Der Shop ist derzeit geschlossen.'],
  TOO_MANY_OPEN_CHECKOUTS: ['Too many checkouts are open. Please try again later.', 'Es sind zu viele Bestellungen offen. Bitte versuche es später erneut.'],
  PAYMENT_PROVIDER: ['Payment is temporarily unavailable. Please try again.', 'Die Zahlung ist vorübergehend nicht verfügbar. Bitte versuche es erneut.'],
  UNAUTHORIZED: ['Please sign in to continue.', 'Bitte melde dich an, um fortzufahren.'],
  FORBIDDEN: ['You do not have permission for this action.', 'Du hast keine Berechtigung für diese Aktion.'],
  CONFLICT: ['This has changed. Please reload and try again.', 'Diese Angaben haben sich geändert. Bitte lade die Seite neu und versuche es erneut.'],
  BAD_REQUEST: ['Please check your details and try again.', 'Bitte überprüfe deine Angaben und versuche es erneut.'],
}

export function apiError(error: unknown, locale: Locale, fallback: string): { text: string; field?: string } {
  const problem = error && typeof error === 'object' ? error as Problem : {}
  // Generic codes: the server's English message is more specific (e.g. "A photo is too large"), so prefer it in EN.
  const generic = !problem.code || ['BAD_REQUEST', 'VALIDATION', 'CONFLICT'].includes(problem.code)
  if (locale === 'en' && generic && problem.message) return { text: problem.message, field: problem.field }
  const translation = problem.code ? messages[problem.code] : undefined
  return { text: translation ? translation[locale === 'de' ? 1 : 0] : problem.message || fallback, field: problem.field }
}
