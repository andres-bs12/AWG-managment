package com.artwithgab.awg_tracking.model;

import com.artwithgab.awg_tracking.enums.CheckoutStatus;
import com.artwithgab.awg_tracking.enums.OrderSource;
import com.artwithgab.awg_tracking.enums.PaymentMethod;
import com.artwithgab.awg_tracking.enums.PaymentState;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Public code (AWG + 4 digits). Used by Track and in links. */
    @Column(nullable = false, unique = true)
    private String code;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<OrderItem> orderItems = new ArrayList<>();

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    /** Money received so far: 0 unpaid, the deposit amount (50 % by default), or the total. */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amountPaid = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentState paymentState = PaymentState.UNPAID;

    /** How the last payment arrived. Informational only: the app never charges. */
    @Enumerated(EnumType.STRING)
    private PaymentMethod paymentMethod;

    @Column(nullable = false)
    private boolean handedOver = false;

    @Column(nullable = false)
    private boolean formSubmitted = false;

    /** Long random secret for the customer form (write access). Never shown on public pages. */
    @Column(name = "form_token", nullable = false, unique = true)
    private String formToken;

    @JoinColumn(name = "customer_id", nullable = false)
    @ManyToOne(fetch = FetchType.LAZY)
    private Customer customer;

    /** Set when at least one item is delivered in Vienna. */
    @Embedded
    private Address deliveryAddress;

    @Column(nullable = false)
    private Instant createdAt;

    // ─── Web shop (null / default for stall sales) ──────────────────────────

    /** Null on rows created before the web shop existed; treat as STALL. */
    @Enumerated(EnumType.STRING)
    private OrderSource source = OrderSource.STALL;

    @Enumerated(EnumType.STRING)
    private CheckoutStatus checkoutStatus;

    @Column(unique = true)
    private String stripeSessionId;

    /** A PENDING web order is released after this instant. */
    private Instant checkoutExpiresAt;

    /** Vienna delivery fee charged online; included in total. */
    @Column(precision = 10, scale = 2)
    private BigDecimal deliveryFee;

    /** True while a web order waits for payment: it holds slots but is hidden from agenda lists. */
    /** Client-generated key of a staff sale, so a double tap or retry returns the same order. */
    @Column(unique = true, length = 64)
    private String idempotencyKey;

    /** When the order was marked handed over; the form link expires and personal data is deleted after it. */
    private Instant handedOverAt;

    /** Set once the customer's personal data and photos were deleted (data retention). */
    private Instant anonymizedAt;

    public boolean isPaymentReview() {
        return checkoutStatus == CheckoutStatus.REVIEW;
    }

    /** Web order not (yet) safely paid: still in checkout or its payment needs a manual check. Kept out of production lists. */
    public boolean isUnconfirmedWeb() {
        return isAwaitingPayment() || isPaymentReview();
    }

    public boolean isAwaitingPayment() {
        return source == OrderSource.WEB && checkoutStatus == CheckoutStatus.PENDING;
    }
}
