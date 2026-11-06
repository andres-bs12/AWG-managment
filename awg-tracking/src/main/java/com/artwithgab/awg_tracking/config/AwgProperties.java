package com.artwithgab.awg_tracking.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;
import java.time.Duration;
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
        Retention retention
) {
    public record Pricing(BigDecimal custom, BigDecimal finished, BigDecimal nameExtra) {
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
     * Public web shop (Vienna delivery only, paid with Stripe Checkout).
     * publicBaseUrl is the frontend origin used for Stripe success/cancel redirects.
     */
    public record Shop(boolean enabled, String publicBaseUrl, String stripeSecretKey, String stripeWebhookSecret,
                       BigDecimal deliveryFee, int leadDays, int maxDaysAhead,
                       java.time.LocalDate seasonEnd, int maxOpenCheckouts, java.time.LocalDate deliveriesFrom) {
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

    public record StaffAccount(String name, String email, String password) {
    }
}
