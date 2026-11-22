package com.artwithgab.awg_tracking.service.mail;

import org.springframework.web.util.HtmlUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Customer e-mails approved by the owner on 2026-11-22: one HTML template per event, in the style of the public site
 * (sky header, warm surface, green button) with a plain-text alternative. Layout uses tables and inline styles because
 * Gmail and Outlook ignore modern CSS. Every value from the order is escaped here; callers pass raw text.
 */
public final class CustomerMailTemplates {
    public static final String INSTAGRAM_HANDLE = "@art_withgab_";
    public static final String INSTAGRAM_URL = "https://www.instagram.com/art_withgab_";

    private static final String SKY_TOP = "#1f7fd0";
    private static final String SKY_LOW = "#84cdee";
    private static final String PAGE = "#eef4f8";
    private static final String SURFACE = "#fffdf9";
    private static final String RAISED = "#ffffff";
    private static final String INK = "#152033";
    private static final String MUTED = "#5c6b80";
    private static final String BORDER = "#e3e7e4";
    private static final String GREEN = "#1f7a4d";
    private static final String CART = "#eef4f8";
    private static final String CART_INK = "#243352";
    private static final String DISPLAY = "'Baloo 2','Trebuchet MS','Avenir Next Rounded',Arial,sans-serif";
    private static final String BODY = "'Source Sans 3','Segoe UI',Helvetica,Arial,sans-serif";

    private CustomerMailTemplates() {}

    public record Rendered(String subject, String text, String html) {}

    /**
     * One line of the order: title ("Personalisierte Kugel"), detail ("Rot · Glänzend"), the item price and
     * the ornament colour key ("red", "green", ...) that picks the hosted ornament image, or null for none.
     */
    public record Line(String title, String detail, BigDecimal price, String color) {
        public Line(String title, String detail, BigDecimal price) { this(title, detail, price, null); }
    }

    /** Pickup at a market stall (or a legacy Vienna delivery when {@code mapsUrl} is null). */
    public record Pickup(String when, String place, String mapsUrl) {}

    public record Post(String arrival, String trackingNumber, String trackingUrl, String address) {}

    /** Everything a template may show. Optional parts are null. */
    public record View(boolean en, String code, String firstName, List<Line> lines, BigDecimal shippingFee,
                       BigDecimal total, BigDecimal paid, Pickup pickup, Post post, String paymentMethod,
                       String today, String trackUrl, String contactEmail, String siteUrl) {
        BigDecimal balance() { return total.subtract(paid).max(BigDecimal.ZERO); }
    }

    // ─── Templates ──────────────────────────────────────────────────────────

    public static Rendered confirmed(View v) {
        boolean en = v.en();
        String name = v.firstName();
        String subject = en ? "Your order " + v.code() + " is confirmed" : "Deine Bestellung " + v.code() + " ist bestätigt";
        String pre = v.post() != null
                ? (en ? "Estimated delivery " : "Zustellung voraussichtlich ") + v.post().arrival()
                : v.pickup() != null ? (en ? "Pickup " : "Abholung ") + v.pickup().when() + balanceTeaser(v) : balanceTeaser(v).replaceFirst("^ · ", "");
        Mail m = new Mail(en);
        m.title(name.isEmpty() ? (en ? "Thank you!" : "Danke!") : (en ? "Thank you, " : "Danke, ") + name + "!");
        m.text(en ? "Gaby paints your ornament from your photos. Here is everything at a glance."
                : "Gaby malt deine Kugel nach deinen Fotos. Hier ist alles auf einen Blick.");
        m.lines(v);
        deliveryFacts(m, v, true);
        m.money(v, v.pickup() != null && v.balance().signum() > 0 ? (en ? "at pickup" : "bei Abholung") : null);
        confirmation(m, v);
        m.button(en ? "View order" : "Bestellung ansehen", v.trackUrl());
        m.sign();
        return m.render(subject, pre, v);
    }

    public static Rendered payment(View v) {
        boolean en = v.en();
        String amount = money(v.paid(), en);
        String subject = (en ? "Payment received · " : "Zahlung erhalten · ") + v.code();
        String pre = amount + (en ? " received" : " erhalten") + (v.balance().signum() == 0
                ? (en ? " · nothing left to pay" : " · nichts mehr offen")
                : (en ? " · balance " : " · offen ") + money(v.balance(), en));
        Mail m = new Mail(en);
        m.title(en ? "Payment received" : "Zahlung erhalten");
        m.text(en ? "We have received " + amount + method(v) + " for your order so far."
                : "Für deine Bestellung haben wir bisher " + amount + method(v) + " erhalten.");
        m.money(v, v.balance().signum() > 0 && v.pickup() != null ? (en ? "at pickup" : "bei Abholung") : null);
        confirmation(m, v);
        m.button(en ? "View order" : "Bestellung ansehen", v.trackUrl());
        return m.render(subject, pre, v);
    }

    public static Rendered ready(View v) {
        boolean en = v.en();
        Pickup p = v.pickup();
        String subject = (en ? "Your ornament is ready" : "Deine Kugel ist fertig") + (p == null ? " · " + v.code()
                : (en ? " · pickup " : " · Abholung ") + p.when());
        String pre = (p == null ? v.code() : p.place() + " · " + p.when()) + balanceTeaser(v);
        Mail m = new Mail(en);
        m.title(en ? "Your ornament is ready!" : "Deine Kugel ist fertig!");
        if (p != null) {
            m.text(p.mapsUrl() == null ? (en ? "We will bring it to you as planned." : "Wir bringen sie dir wie vereinbart.")
                    : (en ? "You can pick it up at the stall." : "Du kannst sie am Stand abholen."));
            m.card(fact(en ? "When" : "Wann", p.when(), null) + fact(en ? "Where" : "Wo", p.place(), null));
        }
        m.money(v, v.balance().signum() > 0 ? (en ? "cash or card" : "bar oder mit Karte") : null);
        if (p != null && p.mapsUrl() != null) m.buttons(en ? "Directions in Google Maps" : "Route in Google Maps", p.mapsUrl(),
                en ? "View order" : "Bestellung ansehen", v.trackUrl());
        else m.button(en ? "View order" : "Bestellung ansehen", v.trackUrl());
        return m.render(subject, pre, v);
    }

    public static Rendered shipped(View v) {
        boolean en = v.en();
        Post p = v.post();
        String subject = (en ? "Your order is on its way · " : "Deine Bestellung ist unterwegs · ") + v.code();
        String pre = (en ? "Estimated delivery " : "Zustellung voraussichtlich ") + p.arrival();
        Mail m = new Mail(en);
        m.title(en ? "Your ornament is on its way" : "Deine Kugel ist unterwegs");
        m.text(en ? "We handed your parcel to Austrian Post." : "Wir haben dein Paket der Österreichischen Post übergeben.");
        m.card(fact(en ? "Estimated delivery" : "Zustellung voraussichtlich", p.arrival(), null)
                + (p.trackingNumber() == null ? "" : fact(en ? "Tracking number" : "Sendungsnummer", p.trackingNumber(), null))
                + (p.address() == null ? "" : fact(en ? "Delivery address" : "Lieferadresse", p.address(), null)));
        if (p.trackingUrl() != null) m.buttons(en ? "Track parcel" : "Sendung verfolgen", p.trackingUrl(), en ? "View order" : "Bestellung ansehen", v.trackUrl());
        else m.button(en ? "View order" : "Bestellung ansehen", v.trackUrl());
        return m.render(subject, pre, v);
    }

    public static Rendered thanks(View v) {
        boolean en = v.en();
        String name = v.firstName();
        String subject = en ? "Thank you for your visit" + (name.isEmpty() ? "" : ", " + name)
                : "Danke für deinen Besuch" + (name.isEmpty() ? "" : ", " + name);
        String pre = (en ? "Your ornament is with you · " : "Deine Kugel ist bei dir · ") + money(v.paid(), en) + (en ? " paid" : " bezahlt");
        Mail m = new Mail(en);
        m.title(en ? "Enjoy your ornament!" : "Viel Freude mit deiner Kugel!");
        m.text(en ? "Once it hangs on the tree, show us on Instagram at " + INSTAGRAM_HANDLE + "."
                : "Wenn sie am Baum hängt, zeig sie uns gern auf Instagram unter " + INSTAGRAM_HANDLE + ".");
        m.lines(v);
        m.money(v, null);
        confirmation(m, v);
        m.sign();
        return m.render(subject, pre, v);
    }

    public static Rendered address(View v) {
        boolean en = v.en();
        Post p = v.post();
        String address = p == null ? "" : p.address();
        String subject = (en ? "New delivery address saved · " : "Neue Lieferadresse gespeichert · ") + v.code();
        Mail m = new Mail(en);
        m.title(en ? "New delivery address saved" : "Neue Lieferadresse gespeichert");
        m.card(fact(en ? "We will send your ornament to" : "Wir schicken deine Kugel an", address, null)
                + (p == null || p.arrival() == null ? "" : fact(en ? "Estimated delivery" : "Zustellung voraussichtlich", p.arrival(), null)));
        m.text(en ? "Something wrong? Just reply to this e-mail." : "Stimmt etwas nicht? Antworte einfach auf diese E-Mail.");
        m.button(en ? "View order" : "Bestellung ansehen", v.trackUrl());
        return m.render(subject, address.replace("\n", ", "), v);
    }

    public static Rendered cancelled(View v) {
        boolean en = v.en();
        String subject = en ? "Your order " + v.code() + " was cancelled" : "Deine Bestellung " + v.code() + " wurde storniert";
        String pre = (en ? "Paid so far " : "Bisher bezahlt ") + money(v.paid(), en);
        Mail m = new Mail(en);
        m.title(en ? "Order cancelled" : "Bestellung storniert");
        m.text(en ? "We cancelled your order " + v.code() + "." : "Wir haben deine Bestellung " + v.code() + " storniert.");
        m.lines(v);
        m.cart(row(en ? "Paid so far" : "Bisher bezahlt", money(v.paid(), en), false, false));
        if (v.paid().signum() > 0) m.muted(en ? "We will contact you about the refund." : "Wegen der Rückzahlung melden wir uns direkt bei dir.");
        return m.render(subject, pre, v);
    }

    public static Rendered waitlist(boolean en, String confirmUrl, String leaveUrl, String contactEmail, String siteUrl) {
        String subject = en ? "Please confirm your e-mail address" : "Bitte bestätige deine E-Mail-Adresse";
        String pre = en ? "One click and we will tell you when orders open again."
                : "Ein Klick, dann sagen wir dir Bescheid, sobald Bestellungen wieder möglich sind.";
        Mail m = new Mail(en);
        m.title(en ? "Almost there" : "Fast geschafft");
        m.text(en ? "You asked to hear when you can order a hand-painted ornament of your pet again. Please confirm your address."
                : "Du möchtest erfahren, sobald du wieder eine handbemalte Kugel mit deinem Haustier bestellen kannst. Bitte bestätige dafür deine Adresse.");
        m.button(en ? "Confirm e-mail" : "E-Mail bestätigen", confirmUrl);
        m.mutedLink(en ? "Not you? Ignore this e-mail. We delete unconfirmed addresses after seven days."
                        : "Warst du das nicht? Dann ignoriere diese E-Mail. Unbestätigte Adressen löschen wir nach sieben Tagen.",
                en ? "Unsubscribe" : "Abmelden", leaveUrl);
        return m.render(subject, pre, contactEmail, siteUrl);
    }

    // ─── Shared blocks ──────────────────────────────────────────────────────

    private static void deliveryFacts(Mail m, View v, boolean withCode) {
        boolean en = v.en();
        String facts = "";
        if (v.pickup() != null) {
            Pickup p = v.pickup();
            String link = p.mapsUrl() == null ? null : (en ? "Open in Google Maps" : "In Google Maps öffnen");
            facts += fact(p.mapsUrl() == null ? (en ? "Delivery in Vienna" : "Lieferung in Wien") : (en ? "Pickup at the stall" : "Abholung am Stand"),
                    p.when(), p.place(), link, p.mapsUrl());
        }
        if (v.post() != null) {
            Post p = v.post();
            facts += fact(en ? "Shipping by Austrian Post" : "Versand mit der Österreichischen Post",
                    (en ? "Estimated delivery " : "Zustellung voraussichtlich ") + p.arrival(), p.address(), null, null);
        }
        if (withCode) facts += fact(en ? "Order code" : "Bestellcode", v.code(), null);
        m.card(facts);
    }

    private static void confirmation(Mail m, View v) {
        if (v.paid().signum() > 0) {
            m.muted((v.en() ? "Payment confirmation of " : "Zahlungsbestätigung vom ") + v.today() + " · " + (v.en() ? "Order " : "Bestellung ") + v.code());
        }
    }

    private static String balanceTeaser(View v) {
        if (v.balance().signum() == 0) return v.paid().signum() > 0 ? (v.en() ? " · paid" : " · bezahlt") : "";
        return (v.en() ? " · balance " : " · offen ") + money(v.balance(), v.en());
    }

    private static String method(View v) {
        if (v.paymentMethod() == null) return "";
        return switch (v.paymentMethod()) {
            case "CASH" -> v.en() ? " in cash" : " in bar";
            case "CARD" -> v.en() ? " by card" : " mit Karte";
            case "STRIPE" -> v.en() ? " online" : " online";
            default -> "";
        };
    }

    public static String money(BigDecimal value, boolean en) {
        NumberFormat format = NumberFormat.getNumberInstance(en ? Locale.UK : Locale.GERMANY);
        format.setMinimumFractionDigits(2);
        format.setMaximumFractionDigits(2);
        String amount = format.format((value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP));
        return en ? "€" + amount : amount + " €";
    }

    private static String esc(String value) { return value == null ? "" : HtmlUtils.htmlEscape(value, "UTF-8"); }

    private static String fact(String label, String value, String extra) { return fact(label, value, extra, null, null); }

    private static String fact(String label, String value, String extra, String linkLabel, String linkUrl) {
        StringBuilder b = new StringBuilder("<tr><td style=\"padding:6px 0;\">")
                .append("<div style=\"font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:").append(MUTED).append(";\">").append(esc(label)).append("</div>")
                .append("<div style=\"font-size:17px;font-weight:700;color:").append(INK).append(";\">").append(esc(value).replace("\n", "<br>")).append("</div>");
        if (extra != null && !extra.isBlank()) b.append("<div style=\"color:").append(INK).append(";\">").append(esc(extra).replace("\n", "<br>")).append("</div>");
        if (linkUrl != null) b.append("<div><a href=\"").append(esc(linkUrl)).append("\" style=\"color:").append(GREEN).append(";font-weight:600;\">").append(esc(linkLabel)).append("</a></div>");
        return b.append("</td></tr>").toString();
    }

    private static String row(String label, String value, boolean total, boolean due) {
        String top = total ? "border-top:1px solid " + BORDER + ";padding-top:10px;" : "";
        String labelColor = total ? INK : MUTED;
        String valueStyle = due ? "color:" + CART_INK + ";font-weight:700;" : total ? "font-weight:700;" : "";
        return "<tr><td style=\"padding:4px 0;" + top + "color:" + labelColor + ";" + (total ? "font-weight:700;" : "") + "\">" + esc(label)
                + "</td><td align=\"right\" style=\"padding:4px 0;" + top + "white-space:nowrap;" + valueStyle + "\">" + esc(value) + "</td></tr>";
    }

    /** Collects blocks in order and writes both the HTML and the plain-text version. */
    private static final class Mail {
        private final boolean en;
        private final StringBuilder html = new StringBuilder();
        private final List<String> text = new ArrayList<>();

        Mail(boolean en) { this.en = en; }

        void title(String value) {
            html.append("<tr><td style=\"padding:4px 0 14px;font-family:").append(DISPLAY).append(";font-size:28px;line-height:1.15;font-weight:700;color:")
                    .append(INK).append(";\">").append(esc(value)).append("</td></tr>");
            text.add(value);
        }

        void text(String value) {
            html.append("<tr><td style=\"padding:0 0 16px;color:").append(INK).append(";\">").append(esc(value)).append("</td></tr>");
            text.add(value);
        }

        void muted(String value) {
            html.append("<tr><td style=\"padding:0 0 16px;font-size:14px;color:").append(MUTED).append(";\">").append(esc(value)).append("</td></tr>");
            text.add(value);
        }

        void mutedLink(String value, String linkLabel, String url) {
            html.append("<tr><td style=\"padding:0 0 16px;font-size:14px;color:").append(MUTED).append(";\">").append(esc(value))
                    .append(" <a href=\"").append(esc(url)).append("\" style=\"color:").append(GREEN).append(";font-weight:600;\">").append(esc(linkLabel)).append("</a></td></tr>");
            text.add(value + "\n" + linkLabel + ": " + url);
        }

        /** Base URL of the hosted e-mail artwork (frontend/public/mail), or null when the site URL is not absolute. */
        static String assets(String siteUrl) {
            if (siteUrl == null || !siteUrl.matches("https?://.+")) return null;
            return esc(siteUrl.replaceAll("/+$", "")) + "/mail/";
        }

        void card(String rows) { block(RAISED, "1px solid " + BORDER, rows); textFromRows(rows); }

        void cart(String rows) { block(CART, "0", rows); textFromRows(rows); }

        private void block(String background, String border, String rows) {
            if (rows.isEmpty()) return;
            html.append("<tr><td style=\"padding:0 0 16px;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:")
                    .append(background).append(";border:").append(border).append(";border-radius:12px;\"><tr><td style=\"padding:12px 16px;\">")
                    .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">").append(rows)
                    .append("</table></td></tr></table></td></tr>");
        }

        /** Plain text mirrors the HTML rows: label, value and extra lines, without markup. */
        private void textFromRows(String rows) {
            String plain = rows.replaceAll("<a href=\"([^\"]*)\"[^>]*>([^<]*)</a>", "$2: $1")
                    .replaceAll("<br>", "\n").replaceAll("</td><td[^>]*>", ": ").replaceAll("</div><div[^>]*>", "\n")
                    .replaceAll("</tr>", "\n").replaceAll("<[^>]+>", "");
            text.add(HtmlUtils.htmlUnescape(plain).strip());
        }

        void lines(View v) {
            StringBuilder rows = new StringBuilder();
            String art = assets(v.siteUrl());
            for (Line line : v.lines()) {
                boolean pic = art != null && line.color() != null && line.color().matches("[a-z]+");
                rows.append("<tr><td style=\"padding:6px 0;\">");
                // The picture sits in a nested table so every row of the card keeps two columns.
                if (pic) {
                    rows.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\"><tr><td valign=\"middle\" style=\"padding-right:12px;\"><img src=\"")
                            .append(art).append("ornament-").append(line.color())
                            .append(".png\" width=\"40\" height=\"48\" alt=\"\" style=\"display:block;border:0;width:40px;height:48px;\"></td><td valign=\"middle\">");
                }
                rows.append("<div style=\"font-weight:700;color:").append(INK).append(";\">").append(esc(line.title())).append("</div>")
                        .append("<div style=\"font-size:14px;color:").append(MUTED).append(";\">").append(esc(line.detail())).append("</div>")
                        .append(pic ? "</td></tr></table>" : "").append("</td>")
                        .append("<td align=\"right\" valign=\"top\" style=\"padding:6px 0;white-space:nowrap;font-weight:600;\">").append(esc(CustomerMailTemplates.money(line.price(), en))).append("</td></tr>");
            }
            if (v.shippingFee() != null && v.shippingFee().signum() > 0) rows.append(row(en ? "Shipping by post" : "Versand per Post", CustomerMailTemplates.money(v.shippingFee(), en), false, false));
            card(rows.toString());
        }

        void money(View v, String dueNote) {
            String due = (en ? "Balance" : "Offen") + (dueNote == null ? "" : " · " + dueNote);
            cart(row(en ? "Total" : "Gesamt", CustomerMailTemplates.money(v.total(), en), false, false)
                    + row(en ? "Paid" : "Bezahlt", CustomerMailTemplates.money(v.paid(), en), false, false)
                    + row(due, CustomerMailTemplates.money(v.balance(), en), true, true));
        }

        void button(String label, String url) { buttons(label, url, null, null); }

        void buttons(String label, String url, String secondLabel, String secondUrl) {
            html.append("<tr><td style=\"padding:4px 0 18px;\">").append(pill(label, url, true));
            if (secondUrl != null) html.append(" ").append(pill(secondLabel, secondUrl, false));
            html.append("</td></tr>");
            text.add(label + ": " + url + (secondUrl == null ? "" : "\n" + secondLabel + ": " + secondUrl));
        }

        private static String pill(String label, String url, boolean primary) {
            String colors = primary ? "background:" + GREEN + ";color:#ffffff;border:2px solid " + GREEN + ";"
                    : "background:#ffffff;color:" + GREEN + ";border:2px solid " + GREEN + ";";
            return "<a href=\"" + esc(url) + "\" style=\"display:inline-block;margin:0 6px 8px 0;padding:11px 22px;border-radius:999px;"
                    + colors + "font-weight:700;font-size:16px;text-decoration:none;font-family:" + BODY + ";\">" + esc(label) + "</a>";
        }

        void sign() {
            String value = en ? "Warm regards, Gaby" : "Liebe Grüße, Gaby";
            html.append("<tr><td style=\"padding:0 0 8px;font-family:").append(DISPLAY).append(";font-size:18px;font-weight:600;color:")
                    .append(INK).append(";\">").append(esc(value)).append("</td></tr>");
            text.add(value);
        }

        /** Sky header with the brand ornament and the snowy peaks of the website, as hosted PNGs (Gmail strips inline SVG). */
        private static String header(String site) {
            String art = assets(site);
            String sky = "bgcolor=\"" + SKY_TOP + "\" style=\"background:" + SKY_TOP + ";background-image:linear-gradient(180deg," + SKY_TOP + "," + SKY_LOW + ");";
            String brand = "<a href=\"" + esc(site) + "\" style=\"color:#ffffff;text-decoration:none;font-family:" + DISPLAY + ";font-size:24px;font-weight:700;\">";
            if (art == null) {
                return "<tr><td " + sky + "padding:22px 28px 30px;\">" + brand + "&#10052;&nbsp;ArtWithGab</a></td></tr>";
            }
            // One cell carries the whole gradient, so the sky has no seam between the name and the peaks.
            return "<tr><td " + sky + "padding:20px 0 0;\">"
                    + "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 28px;\"><tr>"
                    + "<td valign=\"middle\" style=\"padding-right:10px;\"><img src=\"" + art + "brand.png\" width=\"30\" height=\"36\" alt=\"\" style=\"display:block;border:0;width:30px;height:36px;\"></td>"
                    + "<td valign=\"middle\">" + brand + "ArtWithGab</a></td></tr></table>"
                    + "<img src=\"" + art + "peaks.png\" width=\"600\" height=\"40\" alt=\"\""
                    + " style=\"display:block;border:0;width:100%;max-width:600px;height:40px;margin-top:6px;\"></td></tr>";
        }

        private static String icon(String site, String name) {
            String art = assets(site);
            return art == null ? "" : "<img src=\"" + art + name + ".png\" width=\"18\" height=\"18\" alt=\"\""
                    + " style=\"display:inline-block;border:0;width:18px;height:18px;vertical-align:-3px;margin-right:6px;\">";
        }

        Rendered render(String subject, String preheader, View v) { return render(subject, preheader, v.contactEmail(), v.siteUrl()); }

        Rendered render(String subject, String preheader, String contactEmail, String siteUrl) {
            String lang = en ? "en" : "de";
            String site = siteUrl == null ? "" : siteUrl.replaceAll("/+$", "");
            String contactQ = en ? "Questions? Write to us:" : "Fragen? Schreib uns:";
            String legal = en ? "ArtWithGab · Hand-painted Christmas ornaments from Vienna" : "ArtWithGab · Handbemalte Weihnachtskugeln aus Wien";
            String imprint = en ? "Legal notice" : "Impressum";
            String privacy = en ? "Privacy" : "Datenschutz";
            String out = "<!doctype html><html lang=\"" + lang + "\"><head><meta charset=\"utf-8\">"
                    + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"color-scheme\" content=\"light\">"
                    + "<meta name=\"supported-color-schemes\" content=\"light\"><title>" + esc(subject) + "</title></head>"
                    + "<body style=\"margin:0;padding:0;background:" + PAGE + ";\">"
                    + "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">" + esc(preheader) + "</div>"
                    + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:" + PAGE + ";\"><tr><td align=\"center\" style=\"padding:24px 12px;\">"
                    + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;background:" + SURFACE + ";border-radius:16px;overflow:hidden;\">"
                    + header(site)
                    + "<tr><td style=\"padding:16px 28px 8px;font-family:" + BODY + ";font-size:16px;line-height:1.55;color:" + INK + ";\">"
                    + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"font-family:" + BODY + ";font-size:16px;line-height:1.55;color:" + INK + ";\">"
                    + html + "</table></td></tr>"
                    + "<tr><td style=\"padding:18px 28px 22px;background:" + RAISED + ";border-top:1px solid " + BORDER + ";font-family:" + BODY + ";font-size:15px;color:" + INK + ";\">"
                    + "<div style=\"color:" + MUTED + ";font-size:14px;padding-bottom:6px;\">" + esc(contactQ) + "</div>"
                    + "<div style=\"font-weight:600;padding-bottom:10px;\"><a href=\"" + INSTAGRAM_URL + "\" style=\"color:" + GREEN + ";text-decoration:none;white-space:nowrap;\">"
                    + icon(site, "instagram") + "Instagram " + INSTAGRAM_HANDLE + "</a>"
                    + "&nbsp;&nbsp;·&nbsp;&nbsp;<a href=\"mailto:" + esc(contactEmail) + "\" style=\"color:" + GREEN + ";text-decoration:none;white-space:nowrap;\">"
                    + icon(site, "email") + esc(contactEmail) + "</a></div>"
                    + "<div style=\"color:" + MUTED + ";font-size:12px;\">" + esc(legal) + " · <a href=\"" + esc(site) + "/impressum\" style=\"color:" + MUTED + ";\">" + imprint
                    + "</a> · <a href=\"" + esc(site) + "/datenschutz\" style=\"color:" + MUTED + ";\">" + privacy + "</a></div>"
                    + "</td></tr></table></td></tr></table></body></html>";
            String plain = String.join("\n\n", text) + "\n\n---\n" + contactQ + "\nInstagram " + INSTAGRAM_HANDLE + " · " + contactEmail
                    + "\n" + legal + "\n" + site + "/impressum";
            return new Rendered(subject, plain, out);
        }
    }
}
