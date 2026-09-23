import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type Locale = 'en' | 'de'

type Dictionary = Record<string, string>

const messages: Record<Locale, Dictionary> = {
  en: {
    colorUnknown: 'Colour not recorded',
    reviewLead: 'Make sure everything is right before it goes to Gaby.',
    reviewOrnament: 'Your ornament', reviewDetails: 'Your details', reviewOrder: 'Pickup and payment',
    reviewFromStall: 'Set at the stall. Ask Gaby if something needs to change.',
    colour: 'Colour', noteLabel: 'Note for the painter', reviewItems: 'Ornaments',
    customOrnament: 'Custom ornament', finishedOrnament: 'Ready-made ornament',
    orderTotal: 'Order total', payment_paid: 'Paid', payment_deposit: 'Deposit received · balance due', payment_unpaid: 'Payment pending', colorRed: 'Red', colorGrey: 'Grey', edit: 'Edit', copyCode: 'Copy code', copiedCode: 'Code copied', copyFailed: 'Could not copy. Select the code to copy it.', saveCode: 'Keep this code to follow your ornament.',
    brand: 'ArtWithGab',
    buy: 'Buy',
    track: 'Track',
    buySoonTitle: 'Buying online comes later',
    buySoonBody:
      'Custom ornaments are sold at the stall. Ask Gaby in the market — or track an order you already placed.',
    backHome: 'Back to the stall',
    trackTitle: 'Find your ornament',
    trackLead: 'Enter the code from your receipt or the link we sent.',
    trackCode: 'Order code',
    trackSubmit: 'Track',
    trackNotFound: 'We could not find that code. Check the letters and try again.',
    preparing: 'In the workshop',
    ready: 'Ready to pick up',
    outForDelivery: 'Out for delivery',
    delivered: 'Handed over',
    pickupWhen: 'When',
    whenFrom: 'from {time}',
    whenAtUntil: 'we are at {market} until {time}',
    whenVienna: 'Home delivery in Vienna · Wed / Fri',
    whenTbd: 'We will confirm the handoff soon.',
    editAddress: 'Change delivery address',
    saveAddress: 'Save address',
    street: 'Street and number',
    extra: 'Apt / extra',
    city: 'City',
    postal: 'Postal code',
    formPhotos: 'Photos of your pet',
    formPhotosLead: 'Clear photos help Gaby paint. You can add more than one.',
    addPhoto: 'Add photo',
    takePhoto: 'Take photo',
    formNames: 'Names',
    yourName: 'Your name',
    petName: 'Pet name',
    formContact: 'How we reach you',
    phone: 'Phone',
    email: 'Email',
    formExtras: 'Last details',
    backName: 'Name on the ornament',
    backNameHint: 'Up to 6 characters. Already included in your order.',
    note: 'Note for the painter (optional)',
    continue: 'Continue',
    back: 'Back',
    review: 'Check and send',
    send: 'Send to the workshop',
    formThanks: 'Thank you — we have everything',
    goTrack: 'Track this order',
    required: 'This field is needed.',
    invalidEmail: 'Enter a valid email.',
    needPhoto: 'Add at least one photo.',
    progress: 'Step {n} of {total}',
    comingSoon: 'Coming soon',
    instagram: 'Instagram',
    footerNote: 'Handmade in Vienna with love by ArtWithGab',
    sleigh: 'Off to the workshop…',
    lang: 'Language',
    close: 'Close',
    cancel: 'Cancel',
    heroSubtitle: 'Christmas market edition 2026',
    sceneAlt: 'Christmas market stall with painted ornaments',
    countdownLabel: 'Until Christmas',
    unitDays: 'Days',
    unitHours: 'Hrs',
    unitMinutes: 'Min',
    unitSeconds: 'Sec',
    countdownSummary: '{days} days until Christmas',
    merryChristmas: 'Merry Christmas!',
    trackCta: 'Track my order',
    buyCta: 'Buy at the stall',
    trackOpen: 'Enter my code',
    trackAnother: 'Track another code',
    trackNeedCode: 'Type your order code first.',
    trackMissTitle: 'That code did not match',
    trackGreeting: 'Hi {name}, we have your ornament',
    stepPainting: 'In the workshop',
    stepReady: 'Ready',
    stepHandover: 'Handed over',
    stepDone: 'done',
    stepCurrent: 'current step',
    orderIncludes: 'This order includes',
    itemNotPersonalised: 'Not personalised ornament',
    artPainting: 'An ornament being painted with a brush',
    artReady: 'A finished pet ornament nestled in an open gift box',
    addressSaved: 'Address saved.',
  },
  de: {
    colorUnknown: 'Farbe nicht erfasst',
    reviewLead: 'Prüfe alles, bevor es an Gaby geht.',
    reviewOrnament: 'Deine Kugel', reviewDetails: 'Deine Daten', reviewOrder: 'Abholung und Zahlung',
    reviewFromStall: 'Am Stand festgelegt. Frag Gaby, wenn sich etwas ändern soll.',
    colour: 'Farbe', noteLabel: 'Notiz für die Malerin', reviewItems: 'Kugeln',
    customOrnament: 'Personalisierte Kugel', finishedOrnament: 'Fertige Kugel',
    orderTotal: 'Gesamtbetrag', payment_paid: 'Bezahlt', payment_deposit: 'Anzahlung erhalten · Restbetrag offen', payment_unpaid: 'Zahlung ausstehend', colorRed: 'Rot', colorGrey: 'Grau', edit: 'Bearbeiten', copyCode: 'Code kopieren', copiedCode: 'Code kopiert', copyFailed: 'Kopieren fehlgeschlagen. Bitte den Code auswählen und kopieren.', saveCode: 'Bewahre diesen Code auf, um dein Ornament zu verfolgen.',
    brand: 'ArtWithGab',
    buy: 'Kaufen',
    track: 'Verfolgen',
    buySoonTitle: 'Online kaufen kommt später',
    buySoonBody:
      'Personalisierte Kugeln gibt es am Stand. Frag Gaby am Markt — oder verfolge eine bestehende Bestellung.',
    backHome: 'Zurück zum Stand',
    trackTitle: 'Finde deine Kugel',
    trackLead: 'Gib den Code vom Beleg oder aus dem Link ein.',
    trackCode: 'Bestellcode',
    trackSubmit: 'Verfolgen',
    trackNotFound: 'Diesen Code finden wir nicht. Bitte nochmal prüfen.',
    preparing: 'In der Werkstatt',
    ready: 'Abholbereit',
    outForDelivery: 'In Zustellung',
    delivered: 'Übergeben',
    pickupWhen: 'Wann',
    whenFrom: 'ab {time}',
    whenAtUntil: 'wir sind bis {time} am {market}',
    whenVienna: 'Lieferung in Wien · Mi / Fr',
    whenTbd: 'Wir bestätigen die Übergabe bald.',
    editAddress: 'Lieferadresse ändern',
    saveAddress: 'Adresse speichern',
    street: 'Straße und Nummer',
    extra: 'Stiege / extra',
    city: 'Stadt',
    postal: 'PLZ',
    formPhotos: 'Fotos deines Tiers',
    formPhotosLead: 'Klare Fotos helfen beim Malen. Du kannst mehrere hinzufügen.',
    addPhoto: 'Foto hinzufügen',
    takePhoto: 'Foto aufnehmen',
    formNames: 'Namen',
    yourName: 'Dein Name',
    petName: 'Name des Tiers',
    formContact: 'Wie wir dich erreichen',
    phone: 'Telefon',
    email: 'E-Mail',
    formExtras: 'Letzte Details',
    backName: 'Name auf der Kugel',
    backNameHint: 'Max. 6 Zeichen. Schon in der Bestellung enthalten.',
    note: 'Notiz für die Malerin (optional)',
    continue: 'Weiter',
    back: 'Zurück',
    review: 'Prüfen und senden',
    send: 'An die Werkstatt senden',
    formThanks: 'Danke — wir haben alles',
    goTrack: 'Bestellung verfolgen',
    required: 'Dieses Feld wird gebraucht.',
    invalidEmail: 'Bitte eine gültige E-Mail eingeben.',
    needPhoto: 'Bitte mindestens ein Foto.',
    progress: 'Schritt {n} von {total}',
    comingSoon: 'Demnächst',
    instagram: 'Instagram',
    footerNote: 'Handgemacht in Wien mit Liebe von ArtWithGab',
    sleigh: 'Auf zur Werkstatt…',
    lang: 'Sprache',
    close: 'Schließen',
    cancel: 'Abbrechen',
    heroSubtitle: 'Christkindlmarkt-Edition 2026',
    sceneAlt: 'Christkindlmarkt-Stand mit bemalten Kugeln',
    countdownLabel: 'Bis Weihnachten',
    unitDays: 'Tage',
    unitHours: 'Std',
    unitMinutes: 'Min',
    unitSeconds: 'Sek',
    countdownSummary: '{days} Tage bis Weihnachten',
    merryChristmas: 'Frohe Weihnachten!',
    trackCta: 'Bestellung verfolgen',
    buyCta: 'Am Stand kaufen',
    trackOpen: 'Code eingeben',
    trackAnother: 'Anderen Code verfolgen',
    trackNeedCode: 'Bitte zuerst den Bestellcode eingeben.',
    trackMissTitle: 'Dieser Code passt nicht',
    trackGreeting: 'Hallo {name}, wir haben deine Kugel',
    stepPainting: 'In der Werkstatt',
    stepReady: 'Bereit',
    stepHandover: 'Übergeben',
    stepDone: 'erledigt',
    stepCurrent: 'aktueller Schritt',
    orderIncludes: 'Diese Bestellung enthält',
    itemNotPersonalised: 'Nicht personalisierte Kugel',
    artPainting: 'Eine Kugel wird mit einem Pinsel bemalt',
    artReady: 'Eine fertige Tierporträt-Kugel in einer offenen Geschenkbox',
    addressSaved: 'Adresse gespeichert.',
  },
}

type LocaleState = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleState | null>(null)

const KEY = 'awg-locale'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem(KEY)
    return stored === 'de' || stored === 'en' ? stored : 'en'
  })

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(KEY, next)
  }

  const value = useMemo<LocaleState>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => {
        let text = messages[locale][key] ?? messages.en[key] ?? key
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            text = text.replace(`{${k}}`, String(v))
          }
        }
        return text
      },
    }),
    [locale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleState {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used inside LocaleProvider')
  return ctx
}
