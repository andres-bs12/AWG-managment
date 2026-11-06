type Section = { heading: string; paragraphs?: string[]; list?: string[] }
type LegalDocument = { notice: string; language: string; sections: Section[] }
export type LegalPageTitle = 'impressum' | 'terms' | 'privacy'

// German is the binding version; English is provided as a translation.
export const legal: Record<'de' | 'en', Record<LegalPageTitle, LegalDocument>> = {
  de: {
    impressum: {
      notice: 'Entwurf – wird noch rechtlich geprüft',
      language: 'Die deutsche Fassung ist verbindlich; die englische Fassung dient als Übersetzung.',
      sections: [
        { heading: 'Angaben gemäß § 5 ECG und § 25 MedienG', list: ['[Vollständiger Name / Firmenname]', '[Anschrift]', 'E-Mail: [E-Mail]', 'Telefon: [Telefon]', 'UID-Nummer: [UID-Nummer falls vorhanden]', 'Gewerbe / GISA-Zahl: [GISA-Zahl / Gewerbe]', 'Zuständige Aufsichtsbehörde: [Aufsichtsbehörde]', 'Mitgliedschaft bei der Wirtschaftskammer: [Mitgliedschaft / Fachgruppe falls vorhanden]'] },
        { heading: 'Über ArtWithGab', paragraphs: ['Gaby bemalt Weihnachtsornamente in Wien von Hand. ArtWithGab verkauft sie 2026 auf Wiener Weihnachtsmärkten und im Online-Shop.'], list: ['Medieninhaber:in: [Medieninhaber:in]', 'Unternehmensgegenstand: [Unternehmensgegenstand]', 'Grundlegende Richtung der Website: [Grundlegende Richtung]'] },
      ],
    },
    terms: {
      notice: 'Entwurf – wird noch rechtlich geprüft',
      language: 'Die deutsche Fassung ist verbindlich; die englische Fassung dient als Übersetzung.',
      sections: [
        { heading: 'Anbieter und Angebot', paragraphs: ['Anbieter ist [Vollständiger Name / Firmenname], [Anschrift], [E-Mail]. Im Online-Shop verkaufen wir individuell handbemalte Tierornamente. Farben sind je nach Verfügbarkeit wählbar.'] },
        { heading: 'Preise und Bestellung', paragraphs: ['Ein personalisiertes Ornament kostet 49,99 €. Ein Name auf der Rückseite kostet zusätzlich 12,99 €. Die Lieferung kostet derzeit 0 €.', 'Du gibst bei der Bestellung Kontakt- und Lieferdaten sowie Fotos deines Tieres an. Die Zahlung erfolgt per Karte über Stripe Checkout. Deine Bestellung ist bestätigt, sobald Stripe die Zahlung bestätigt hat. Mit deinem Bestellcode kannst du den Status online verfolgen.'] },
        { heading: 'Lieferung und Marktstand', paragraphs: ['Der Online-Shop liefert nur innerhalb Wiens (Postleitzahlen 1010–1230), an verfügbaren Mittwochen und Freitagen. Der letzte Liefertag der Saison ist der 24. Dezember 2026.', 'Am Marktstand wird eine Bar- oder Kartenzahlung vom Team manuell bestätigt; Anzahlungen sind möglich. Für Fotos und Angaben zum Ornament erhältst du einen Link zum Kundenformular.'] },
        { heading: 'Stornierung und Rücktritt', paragraphs: ['Wenn du eine Online-Bestellung stornieren möchtest, schreibe an [E-Mail]. Vor Beginn der Bemalung versuchen wir, Stornierungswünsche zu berücksichtigen. Eine Zusage ist damit nicht verbunden. Vereinbarte Rückerstattungen erfolgen über das ursprüngliche Zahlungsmittel.', 'Für Waren, die nach Kundenspezifikationen angefertigt werden oder eindeutig auf persönliche Bedürfnisse zugeschnitten sind, besteht grundsätzlich kein gesetzliches Rücktrittsrecht (§ 18 Abs. 1 Z 3 FAGG). Dies betrifft die individuell gestalteten Ornamente.'] },
      ],
    },
    privacy: {
      notice: 'Entwurf – wird noch rechtlich geprüft',
      language: 'Die deutsche Fassung ist verbindlich; die englische Fassung dient als Übersetzung.',
      sections: [
        { heading: 'Verantwortliche Stelle', paragraphs: ['[Vollständiger Name / Firmenname], [Anschrift], [E-Mail], [Telefon].'] },
        { heading: 'Welche Daten und wofür?', paragraphs: ['Für Bestellungen verarbeiten wir Name, E-Mail-Adresse, Telefonnummer, Lieferadresse, Tierfotos und Bestelldaten. Wir verwenden sie zur Bearbeitung, Bemalung, Lieferung und Nachverfolgung deiner Bestellung sowie zur Kommunikation über Änderungen. Wenn E-Mail eingerichtet ist, erhalten Kund:in und Inhaber:in bei Bestelländerungen eine Nachricht. Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).', 'Für Buchhaltung und gesetzliche Aufbewahrung verarbeiten wir erforderliche Bestelldaten aufgrund rechtlicher Verpflichtungen (Art. 6 Abs. 1 lit. c DSGVO).', 'Nach Saisonende kannst du dich mit deiner E-Mail-Adresse für die Warteliste anmelden. Dafür verwenden wir deine Daten nur mit deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Du kannst sie jederzeit für die Zukunft über [E-Mail] widerrufen.'] },
        { heading: 'Zahlung und Dienstleister', paragraphs: ['Für Kartenzahlungen nutzen wir Stripe Checkout (Stripe Payments Europe, Ltd., Irland). Dabei kann eine Übermittlung an Stripe, Inc. in den USA erfolgen; sie stützt sich auf das EU-US Data Privacy Framework bzw. Standardvertragsklauseln. Weitere eingesetzte Dienstleister sind [E-Mail-Anbieter] für E-Mails und [Hosting-Anbieter] für das Hosting. Sie erhalten Daten, soweit dies für ihre jeweilige Leistung erforderlich ist.'] },
        { heading: 'Speicherdauer', paragraphs: ['Bestelldaten werden entsprechend den österreichischen steuerrechtlichen Aufbewahrungspflichten sieben Jahre aufbewahrt. Tierfotos und Lieferadresse sollen nach der Saison bis zum 31. Jänner 2027 gelöscht werden, sofern sie nicht länger benötigt werden.'] },
        { heading: 'Browser-Speicher', paragraphs: ['Die App verwendet keine Tracking- oder Marketing-Cookies. Sie nutzt technisch notwendigen Browser-Speicher für die Spracheinstellung, den Formularentwurf und die Staff-Sitzung.'] },
        { heading: 'Deine Rechte', paragraphs: ['Du hast nach Maßgabe der DSGVO das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Eine Einwilligung kannst du jederzeit für die Zukunft widerrufen. Wende dich dazu an [E-Mail].', 'Du kannst dich bei der österreichischen Datenschutzbehörde beschweren: Barichgasse 40–42, 1030 Wien.'] },
      ],
    },
  },
  en: {
    impressum: {
      notice: 'Draft – pending legal review',
      language: 'The German version is binding; this English version is a translation.',
      sections: [
        { heading: 'Information under § 5 ECG and § 25 MedienG', list: ['[Full name / business name]', '[Address]', 'Email: [Email]', 'Phone: [Phone]', 'VAT ID: [VAT ID if applicable]', 'Trade / GISA number: [GISA number / trade]', 'Supervisory authority: [Supervisory authority]', 'Chamber of Commerce membership: [Membership / trade group if applicable]'] },
        { heading: 'About ArtWithGab', paragraphs: ['Gaby hand-paints Christmas ornaments in Vienna. ArtWithGab sells them at Vienna Christmas markets in 2026 and through the online shop.'], list: ['Media owner: [Media owner]', 'Business activity: [Business activity]', 'Purpose of this website: [Website purpose]'] },
      ],
    },
    terms: {
      notice: 'Draft – pending legal review',
      language: 'The German version is binding; this English version is a translation.',
      sections: [
        { heading: 'Seller and products', paragraphs: ['The seller is [Full name / business name], [Address], [Email]. Our online shop sells individually hand-painted pet ornaments. Colors are subject to availability.'] },
        { heading: 'Prices and orders', paragraphs: ['A personalized ornament costs €49.99. A name on the back costs an additional €12.99. Delivery currently costs €0.', 'When ordering, you provide contact and delivery details and photos of your pet. Payment is by card through Stripe Checkout. Your order is confirmed once Stripe confirms payment. You can track its status online with your order code.'] },
        { heading: 'Delivery and market stall', paragraphs: ['The online shop delivers only within Vienna (postal codes 1010–1230), on available Wednesdays and Fridays. The last delivery day of the season is 24 December 2026.', 'At the market stall, staff manually confirm cash or card payments; deposits are possible. You receive a link to the customer form for photos and ornament details.'] },
        { heading: 'Cancellation and withdrawal', paragraphs: ['To cancel an online order, write to [Email]. Before painting begins, we try to accommodate cancellation requests, but cannot promise to do so. Agreed refunds are made through the original payment method.', 'Goods made to customer specifications or clearly personalized are generally excluded from the statutory right of withdrawal (§ 18(1)(3) FAGG). This applies to individually designed ornaments.'] },
      ],
    },
    privacy: {
      notice: 'Draft – pending legal review',
      language: 'The German version is binding; this English version is a translation.',
      sections: [
        { heading: 'Controller', paragraphs: ['[Full name / business name], [Address], [Email], [Phone].'] },
        { heading: 'What we use and why', paragraphs: ['For orders, we process your name, email address, phone number, delivery address, pet photos and order details. We use them to handle, paint, deliver and track your order and communicate changes. When email is configured, the customer and owner receive messages about order changes. The legal basis is performance of a contract (Art. 6(1)(b) GDPR).', 'We process necessary order data for accounting and statutory retention to comply with legal obligations (Art. 6(1)(c) GDPR).', 'After the season, you can join the waitlist with your email address. We use your data for this only with your consent (Art. 6(1)(a) GDPR). You can withdraw consent at any time for the future by contacting [Email].'] },
        { heading: 'Payments and service providers', paragraphs: ['We use Stripe Checkout for card payments (Stripe Payments Europe, Ltd., Ireland). Data may be transferred to Stripe, Inc. in the USA on the basis of the EU-US Data Privacy Framework or standard contractual clauses. Other service providers are [Email provider] for email and [Hosting provider] for hosting. They receive data as needed to provide their respective services.'] },
        { heading: 'Retention', paragraphs: ['Order data is retained for seven years in accordance with Austrian tax retention obligations. Pet photos and delivery addresses are intended to be deleted after the season by 31 January 2027, unless needed longer.'] },
        { heading: 'Browser storage', paragraphs: ['The app does not use tracking or marketing cookies. It uses technically necessary browser storage for the language setting, form draft and staff session.'] },
        { heading: 'Your rights', paragraphs: ['Subject to the GDPR, you have the right to access, rectify, erase, restrict processing, data portability and object to processing. You may withdraw consent at any time for the future. Contact [Email] to exercise your rights.', 'You may lodge a complaint with the Austrian Data Protection Authority (Datenschutzbehörde), Barichgasse 40–42, 1030 Vienna.'] },
      ],
    },
  },
}
