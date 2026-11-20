package com.artwithgab.awg_tracking.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;

/** All app settings under the {@code awg.} prefix. Secrets come from environment variables. */
@ConfigurationProperties(prefix = "awg")
public record AwgProperties(
        String zone,
        Pricing pricing,
        Cors cors,
        Uploads uploads,
        Session session,
        Calendar calendar,
        Bootstrap bootstrap,
        Shop shop,
        Mail mail,
        Retention retention,
        Invoice invoice,
        Post post
) {
    public record Pricing(BigDecimal custom, BigDecimal finished, BigDecimal nameExtra, BigDecimal shipping) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record Uploads(String dir, long maxBytes) {
    }

    public record Session(Duration ttl) {
    }

    /** Home painting days are generated from today up to this many days ahead. */
    public record Calendar(int homeDaysAhead, int defaultMaxPaintings) {
    }

    /** Stock created on a fresh database: per custom color (bases ready to paint) and finished ornaments. */
    public record Bootstrap(List<StaffAccount> staff, int initialCustomStock, int initialFinishedStock, boolean demoMarkets,
                            boolean allowWeakPasswords) {
    }

    /**
     * Public web shop paid with Stripe Checkout.
     * publicBaseUrl is the frontend origin used for Stripe success/cancel redirects.
     */
    public record Shop(boolean enabled, String publicBaseUrl, String stripeSecretKey, String stripeWebhookSecret,
                       int leadDays, int maxDaysAhead,
                       java.time.LocalDate seasonEnd, int maxOpenCheckouts, java.time.LocalDate deliveriesFrom,
                       java.time.LocalTime deliveryWindowStart, java.time.LocalTime deliveryWindowEnd,
                       java.util.UUID primaryPickupMarketId) {
        public Shop {
            if (deliveryWindowStart == null) deliveryWindowStart = java.time.LocalTime.of(18, 0);
            if (deliveryWindowEnd == null) deliveryWindowEnd = java.time.LocalTime.of(20, 0);
            if (!deliveryWindowStart.isBefore(deliveryWindowEnd))
                throw new IllegalArgumentException("Delivery window start must be before its end");
        }
    }

    public record Post(List<DayOfWeek> collectionWeekdays, int transitMinDays, int transitMaxDays,
                       LocalDate lastArrival, boolean finishedWithCustom,
                       /* First possible Post collection day; null = no floor (independent of the shop's deliveries-from). */
                       LocalDate collectionFrom,
                       /* No Post/web-shipping ornament is painted before this day (owner: first market, 25 Nov 2026); null = no floor. */
                       LocalDate paintFrom) {
        public Post {
            collectionWeekdays = List.copyOf(collectionWeekdays);
            if (collectionWeekdays.isEmpty() || collectionWeekdays.stream().anyMatch(day -> day.getValue() > 5)
                    || collectionWeekdays.stream().distinct().count() != collectionWeekdays.size()) {
                throw new IllegalArgumentException("Configure distinct Post collection weekdays from Monday to Friday");
            }
            if (transitMinDays < 1 || transitMaxDays < transitMinDays) {
                throw new IllegalArgumentException("Invalid Post transit days");
            }
        }
    }

    /**
     * Data retention, counted from the handover: the customer form link stops working after
     * formLinkDays; photos and personal data are deleted after personalDataDays. Orders never handed
     * over are cleaned up staleOrderDays after creation. Unconfirmed waitlist sign-ups are deleted
     * after waitlistUnconfirmedDays.
     */
    public record Retention(int formLinkDays, int personalDataDays, int staleOrderDays, int waitlistUnconfirmedDays) {
        public Retention {
            if (formLinkDays <= 0) formLinkDays = 30;
            if (personalDataDays <= 0) personalDataDays = 60;
            if (staleOrderDays <= 0) staleOrderDays = 365;
            if (waitlistUnconfirmedDays <= 0) waitlistUnconfirmedDays = 7;
        }
    }

    /** E-mail notifications; nothing is sent while spring.mail.host is empty. */
    public record Mail(String from, String ownerEmail) {
    }

    /** Seller identity and tax treatment must be supplied by the owner. No tax status is assumed. */
    public record Invoice(String businessName, String address, String uid, String taxNote, String iban) {
        /** False while seller data is missing or still a "[placeholder]": no invoice may be issued then. */
        public boolean configured() {
            return java.util.stream.Stream.of(businessName, address, taxNote)
                    .allMatch(value -> value != null && !value.isBlank() && !value.contains("["))
                    && (uid == null || !uid.contains("["));
        }
    }

    public record StaffAccount(String name, String email, String password) {
    }
}
