package com.artwithgab.awg_tracking.model;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A single ornament inside an order.
 *
 * Each ornament has up to three separate moments, each in its own section:
 *   1. SALE     → where and on which day it was sold    (soldOnDay)
 *   2. PAINTING → when Gaby paints it                   (paintStart / paintEnd)   — CUSTOM only
 *   3. HANDOFF  → when the customer receives it         (handoffDate / pickUpTime)
 *
 * Example: sold on Sat 22/11 at the stall, painted on Tue 25/11 from 10:00 to 11:15,
 * picked up at the market on Fri 28/11 at 14:00.
 *
 * There is no TimeBlock entity: the painting block the frontend shows is derived from
 * paintStart/paintEnd (its id is this item's id).
 *
 * Conditional rules ("required if...") are validated in OrderService, not with annotations,
 * because they depend on itemKind and deliveryKind.
 */
@Entity
@Getter
@Setter
@NoArgsConstructor
public class OrderItem {

    // ─── Identity ─────────────────────────────────────────────────────────────

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Optimistic lock: concurrent writers get 409 CONFLICT instead of overwriting each other. */
    @jakarta.persistence.Version
    private long version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    /** Order of the item inside its order, so lists are stable. */
    private int position;

    // ─── Kind and production ─────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ItemKind itemKind;

    /** NOT_STARTED → IN_PROGRESS → FINISHED. A GENERIC item starts as FINISHED. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductionStatus productionStatus;

    /** Price charged for this ornament, computed by the server (never sent by the client). */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal cost;

    // ─── 1. Sale: where it was sold ──────────────────────────────────────────

    /** Market day on which the sale happened (for per-stall stats). Not the pickup day. */
    @JoinColumn(name = "sold_on_day_id")
    @ManyToOne(fetch = FetchType.LAZY)
    private MarketDay soldOnDay;

    // ─── 2. Painting: when Gaby paints it ────────────────────────────────────
    //
    //   - CUSTOM  → paintStart and paintEnd REQUIRED, and paintEnd > paintStart.
    //   - GENERIC → both null (nothing to paint).
    //   - Painting must end before the handoff (see OrderService / AgendaService).
    // LocalDateTime, not Instant: Vienna wall-clock time.

    private LocalDateTime paintStart;
    private LocalDateTime paintEnd;

    // ─── 3. Handoff: when the customer receives it ───────────────────────────
    //
    //   - MARKET   → handoffDate REQUIRED; pickUpTime required for CUSTOM (deadline to be ready).
    //                A finished ornament handed over on the spot may have no time.
    //   - DELIVERY → handoffDate REQUIRED (Wed/Fri), pickUpTime null.
    //   The delivery address lives on Order.

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DeliveryKind deliveryKind;

    @Column(nullable = false)
    private LocalDate handoffDate;

    private LocalTime pickUpTime;

    @Column(nullable = false)
    private boolean handedOver;

    // ─── Personalization (filled in by the customer via the form) ───────────

    /** Customer paid for the name on the ornament (+€12.99). No refund if it is removed. */
    private boolean withName;
    /** Text painted on the back (max 6 characters, upper case). */
    private String nameInOrnament;
    private String petName;

    @Enumerated(EnumType.STRING)
    private CustomColor customColor;

    @Enumerated(EnumType.STRING)
    private CustomFinish customFinish;

    /** Reference photos ({@link StoredPhoto}), in display order. */
    @ElementCollection
    @CollectionTable(name = "order_item_photos", joinColumns = @JoinColumn(name = "order_item_id"))
    @OrderColumn(name = "position")
    private List<PhotoRef> photos = new ArrayList<>();

    /** Note for the painter. */
    @Column(length = 1000)
    private String note;

    // ─── Inventory ───────────────────────────────────────────────────────────

    /** Stock this ornament was deducted from; used to restock it on a future return. */
    @JoinColumn(name = "inventory_id")
    @ManyToOne(fetch = FetchType.LAZY)
    private Inventory inventory;
}
