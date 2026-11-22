package com.artwithgab.awg_tracking.mcp;

import com.artwithgab.awg_tracking.dto.market.MarketDayDto;
import com.artwithgab.awg_tracking.dto.market.MarketDto;
import com.artwithgab.awg_tracking.dto.market.SaveMarketDayRequest;
import com.artwithgab.awg_tracking.dto.market.SaveMarketRequest;
import com.artwithgab.awg_tracking.dto.market.SaveMarketResponse;
import com.artwithgab.awg_tracking.dto.order.OrderDto;
import com.artwithgab.awg_tracking.exception.ApiException;
import com.artwithgab.awg_tracking.model.StaffUser;
import com.artwithgab.awg_tracking.service.AgendaService;
import com.artwithgab.awg_tracking.service.InventoryService;
import com.artwithgab.awg_tracking.service.MarketService;
import com.artwithgab.awg_tracking.service.MarketStockService;
import com.artwithgab.awg_tracking.service.OrderService;
import com.artwithgab.awg_tracking.support.CalendarRules;
import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.server.McpStatelessServerFeatures.SyncToolSpecification;
import io.modelcontextprotocol.spec.McpSchema;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

/**
 * The MCP tools. Each one calls an existing service, exactly as the staff REST controllers do, so
 * business rules and error messages stay in one place. Read tools are side-effect free; write
 * tools only act with {@code confirm=true} and otherwise return a preview. The only payment the
 * connector records is a finished stock piece sold and paid in full at an open stall (New sale,
 * then collect-and-hand-over). No cancellations, refunds or payment edits; the only deletion is a
 * market day, which the service refuses while the day has orders, sales, pickups or painting.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "awg.mcp", name = "enabled", havingValue = "true")
public class McpTools {
    /** Capability tokens, photo payloads and bulky calendar copies never leave through the connector. */
    private static final Set<String> HIDDEN_FIELDS = Set.of("trackToken", "formToken", "photos", "photoUrl",
            "dataUrl", "hasUploadedPhoto", "markets", "marketDays", "itemIds", "customerId");

    /** Contact data only leaves through get_customer_contact, one order at a time. */
    private static final Set<String> CONTACT_FIELDS = Set.of("phone", "email", "address", "addressLabel");
    private static final int MAX_SEASON_DAYS = 120;
    private static final Map<Character, String> STOCK_COLORS = Map.of('R', "red", 'W', "wine", 'G', "green", 'C', "beige");
    private static final Map<Character, String> STOCK_FINISHES = Map.of('S', "shiny", 'M', "matte");

    private final OrderService orderService;
    private final AgendaService agendaService;
    private final MarketService marketService;
    private final MarketStockService marketStockService;
    private final InventoryService inventoryService;
    private final JsonMapper json;
    private final com.artwithgab.awg_tracking.service.CalendarService calendarService;
    private final com.artwithgab.awg_tracking.service.PaintingDayService paintingDayService;
    private final com.artwithgab.awg_tracking.service.PricingService pricingService;
    private final org.springframework.transaction.support.TransactionTemplate transactions;
    private final Clock clock;
    private final ZoneId zone;

    public McpTools(OrderService orderService, AgendaService agendaService, MarketService marketService,
                    MarketStockService marketStockService, InventoryService inventoryService, JsonMapper json,
                    com.artwithgab.awg_tracking.service.CalendarService calendarService,
                    com.artwithgab.awg_tracking.service.PaintingDayService paintingDayService,
                    com.artwithgab.awg_tracking.service.PricingService pricingService,
                    org.springframework.transaction.support.TransactionTemplate transactions,
                    Clock clock, com.artwithgab.awg_tracking.config.AwgProperties props) {
        this.calendarService = calendarService;
        this.paintingDayService = paintingDayService;
        this.pricingService = pricingService;
        this.transactions = transactions;
        this.orderService = orderService;
        this.agendaService = agendaService;
        this.marketService = marketService;
        this.marketStockService = marketStockService;
        this.inventoryService = inventoryService;
        this.json = json;
        this.clock = clock;
        this.zone = ZoneId.of(props.zone() == null ? "Europe/Vienna" : props.zone());
    }

    public List<SyncToolSpecification> specifications() {
        return List.of(
                read("search_orders", "Search orders",
                        "Find orders by order code, customer name or phone digits (at least 2 characters). Returns up to the latest matches with payment state and next pickup date.",
                        schema(Map.of("query", str("Code, name or phone, e.g. 'Müller' or 'K7Q2'")), List.of("query")),
                        a -> orderService.search(requiredString(a, "query"))),
                read("get_order", "Get order",
                        "Full order by code (e.g. 'K7Q2ZX') or id: customer name and phone (customerPhone), items with colour, finish, name, production and handover, painting blocks and payments.",
                        schema(Map.of("code", str("Order code"), "id", str("Order UUID")), List.of()),
                        this::getOrder),
                contact("get_customer_contact", "Customer contact",
                        "Phone, e-mail and shipping address of the customer of ONE order (by code). Use when the owner asks how to e-mail or ship to that customer; get_order also returns the phone, other tools never return contact data.",
                        schema(Map.of("code", str("Order code")), List.of("code"))),
                read("get_agenda_day", "Agenda of a day",
                        "Painting sessions and pickups/shipments for one day, plus which market is open and where Gaby paints. Defaults to today (Europe/Vienna).",
                        schema(Map.of("date", str("YYYY-MM-DD; omit for today")), List.of()),
                        a -> withDate(a, agendaService.getDay(optionalDate(a, "date")))),
                read("list_market_stock", "Numbered market stock",
                        "Ready-made ornaments sold at the stall, one row per numbered piece (e.g. WM03 = wine matte #3), with status unpainted/painted/sold. Filter by colour (red, wine, green, beige), finish (shiny, matte) or status. Includes counts.",
                        schema(Map.of("color", str("red, wine, green or beige"), "finish", str("shiny or matte"),
                                "status", str("unpainted, painted or sold")), List.of()),
                        this::marketStock),
                read("list_inventory", "Base inventory",
                        "Unpainted bases for custom orders per colour and finish, and the unnumbered finished-ornament counter.",
                        schema(Map.of(), List.of()),
                        a -> inventoryService.list()),
                read("list_markets", "Markets and days",
                        "All markets with stall number, season dates, cost and their opening days and hours.",
                        schema(Map.of(), List.of()),
                        a -> markets()),
                read("list_recent_orders", "Recent orders",
                        "Orders created between two dates (Europe/Vienna), newest first, up to 50: code, customer name, source (stall or web), payment state, total, items and next handoff date. Use it for 'new orders since yesterday' or 'sales this week'.",
                        schema(Map.of("from", str("YYYY-MM-DD, first day included; omit for yesterday"),
                                "to", str("YYYY-MM-DD, last day included; omit for today"),
                                "source", str("stall or web; omit for both")), List.of()),
                        this::recentOrders),
                read("list_needs_attention", "Needs attention",
                        "Web orders waiting for Stripe confirmation or flagged for payment review.",
                        schema(Map.of(), List.of()),
                        a -> orderService.needingAttention()),
                write("create_market", "Create market",
                        "Creates a new market season with its opening days. Days must be Friday, Saturday or Sunday inside the season (opening-week exceptions allowed by the app). "
                                + "Without confirm=true it only returns a preview; call again with confirm=true after the owner agrees.",
                        schema(Map.of(
                                "name", str("Market name"),
                                "startDate", str("Season start YYYY-MM-DD"),
                                "finishDate", str("Season end YYYY-MM-DD"),
                                "stall", Map.of("type", "integer", "minimum", 1, "description", "Stall number"),
                                "totalCost", Map.of("type", "number", "minimum", 0, "description", "Season cost in EUR (0 if unknown)"),
                                "days", Map.of("type", "array", "description", "Opening days", "items", dayItemSchema()),
                                "confirm", confirmSchema()), List.of("name", "startDate", "finishDate", "stall", "days")),
                        this::createMarket),
                write("add_market_day", "Add market day",
                        "Adds one opening day to an existing market (use list_markets for the id). If the date is outside the season, the season is extended to include it. "
                                + "Without confirm=true it only returns a preview; call again with confirm=true after the owner agrees.",
                        schema(Map.of(
                                "marketId", str("Market UUID from list_markets"),
                                "date", str("YYYY-MM-DD (Friday, Saturday or Sunday)"),
                                "openHour", Map.of("type", "number", "description", "Opening hour, e.g. 11 or 10.5"),
                                "closeHour", Map.of("type", "number", "description", "Closing hour, e.g. 20"),
                                "confirm", confirmSchema()), List.of("marketId", "date", "openHour", "closeHour")),
                        this::addMarketDay),
                write("set_painting_hours", "Set painting hours",
                        "Sets the hours Gaby paints on one day (the gear in the Agenda), or closes/opens the day for painting. The daily maximum is recalculated from the hours. Existing bookings are never moved: the preview lists any that would fall outside the new hours. "
                                + "Without confirm=true it only returns a preview; call again with confirm=true after the owner agrees.",
                        schema(Map.of(
                                "date", str("YYYY-MM-DD; omit for today"),
                                "openHour", Map.of("type", "number", "description", "Start, e.g. 10 or 10.25 (15-minute steps)"),
                                "closeHour", Map.of("type", "number", "description", "End, e.g. 13"),
                                "open", Map.of("type", "boolean", "description", "false closes the day for painting, true opens it"),
                                "confirm", confirmSchema()), List.of()),
                        this::setPaintingHours),
                write("record_stock_sale", "Record stock sale",
                        "Records that a numbered ready-made ornament (e.g. WM03) was sold today at a market stall that is open today, paid in full by cash or card and taken away now — the same as New sale → finished → Paid → handed over. "
                                + "Without confirm=true it only returns a preview with the price; call again with confirm=true after the owner agrees.",
                        schema(Map.of(
                                "ornamentId", str("Numbered piece, e.g. WM03"),
                                "marketId", str("Market UUID from list_markets; it must be open today"),
                                "paymentMethod", str("cash or card"),
                                "confirm", confirmSchema()), List.of("ornamentId", "marketId", "paymentMethod")),
                        this::recordStockSale),
                destructive("delete_market_day", "Delete market day",
                        "Removes one opening day from a stall market (use list_markets for the id). The app refuses when that day has orders, sales, pickups or painting, so only empty days can go. "
                                + "Without confirm=true it only returns a preview; call again with confirm=true after the owner agrees.",
                        schema(Map.of(
                                "marketId", str("Market UUID from list_markets"),
                                "date", str("YYYY-MM-DD of the day to remove"),
                                "confirm", confirmSchema()), List.of("marketId", "date")),
                        this::deleteMarketDay));
    }

    // ---- read tools ----------------------------------------------------------------------

    private Object getOrder(Map<String, Object> a) {
        String code = optionalString(a, "code");
        String id = optionalString(a, "id");
        UUID orderId;
        if (id != null) {
            orderId = uuid(id, "id");
        } else if (code != null) {
            OrderDto order = orderService.getOrderByCode(code);
            orderId = UUID.fromString(order.id());
        } else {
            throw new ToolInputException("Give an order code or id.");
        }
        var bundle = orderService.getOrderBundle(orderId);
        // One order at a time, so staff can call the customer. E-mail and address stay in get_customer_contact.
        @SuppressWarnings("unchecked")
        Map<String, Object> out = json.convertValue(bundle, LinkedHashMap.class);
        String phone = bundle.customer() == null ? null : bundle.customer().phone();
        if (phone != null && !phone.isBlank()) {
            out.put("customerPhone", phone);
            log.info("MCP get_order with phone by staff user {} for order {}", currentStaff().getId(), orderId);
        }
        return out;
    }

    private Object marketStock(Map<String, Object> a) {
        String color = lower(optionalString(a, "color"));
        String finish = lower(optionalString(a, "finish"));
        String status = lower(optionalString(a, "status"));
        if (color != null && !STOCK_COLORS.containsValue(color)) throw new ToolInputException("Colour must be red, wine, green or beige.");
        if (finish != null && !STOCK_FINISHES.containsValue(finish)) throw new ToolInputException("Finish must be shiny or matte.");
        List<Map<String, Object>> rows = new ArrayList<>();
        Map<String, Integer> counts = new LinkedHashMap<>(Map.of("unpainted", 0, "painted", 0, "sold", 0));
        for (MarketStockService.Ornament o : marketStockService.list()) {
            String c = o.id().isEmpty() ? null : STOCK_COLORS.get(o.id().charAt(0));
            String f = o.id().length() < 2 ? null : STOCK_FINISHES.get(o.id().charAt(1));
            if (color != null && !color.equals(c)) continue;
            if (finish != null && !finish.equals(f)) continue;
            counts.merge(o.status(), 1, Integer::sum);
            if (status != null && !status.equals(o.status())) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", o.id());
            row.put("color", c);
            row.put("finish", f);
            row.put("status", o.status());
            if (o.soldAt() != null) row.put("soldAt", o.soldAt().toString());
            if (o.orderCode() != null) row.put("orderCode", o.orderCode());
            rows.add(row);
        }
        rows.sort(Comparator.comparing(r -> (String) r.get("id")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("counts", counts);
        out.put("availableToSell", counts.get("painted"));
        out.put("pieces", rows);
        return out;
    }

    private Object markets() {
        List<MarketDayDto> days = marketService.listMarketDays(null);
        List<Map<String, Object>> out = new ArrayList<>();
        for (MarketDto m : marketService.listMarkets()) {
            Map<String, Object> row = json.convertValue(m, LinkedHashMap.class);
            row.put("days", days.stream().filter(d -> m.id().equals(d.marketId()))
                    .map(d -> Map.of("id", d.id(), "date", d.date(), "openHour", d.openHour(), "closeHour", d.closeHour()))
                    .toList());
            out.add(row);
        }
        return out;
    }

    private Object withDate(Map<String, Object> a, Object agendaDay) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", optionalDate(a, "date").toString());
        out.put("day", agendaDay);
        return out;
    }

    // ---- write tools ---------------------------------------------------------------------

    private McpSchema.CallToolResult createMarket(Map<String, Object> a, StaffUser user) {
        String name = requiredString(a, "name");
        LocalDate start = requiredDate(a, "startDate");
        LocalDate finish = requiredDate(a, "finishDate");
        int stall = requiredInt(a, "stall");
        BigDecimal cost = a.get("totalCost") instanceof Number n ? new BigDecimal(n.toString()) : BigDecimal.ZERO;
        if (!(a.get("days") instanceof List<?> rawDays) || rawDays.isEmpty()) throw new ToolInputException("Give at least one opening day.");
        List<SaveMarketDayRequest> days = new ArrayList<>();
        for (Object raw : rawDays) {
            if (!(raw instanceof Map<?, ?> d)) throw new ToolInputException("Each day needs date, openHour and closeHour.");
            @SuppressWarnings("unchecked") Map<String, Object> day = (Map<String, Object>) d;
            days.add(new SaveMarketDayRequest(requiredDate(day, "date"), requiredNumber(day, "openHour"), requiredNumber(day, "closeHour")));
        }
        SaveMarketRequest request = new SaveMarketRequest(null, name, start, finish, cost, stall, days);
        List<String> warnings = precheck(request);

        String summary = "Create market \"" + name + "\", stall " + stall + ", season " + start + " to " + finish
                + ", cost EUR " + cost.toPlainString() + ", days: " + describeDays(days) + ".";
        if (!isConfirmed(a)) return preview(summary, warnings);
        SaveMarketResponse saved = marketService.saveMarket(request);
        log.info("MCP create_market by staff user {}: market {}", user.getId(), saved.market().id());
        return done("Created. " + summary, saved);
    }

    private McpSchema.CallToolResult addMarketDay(Map<String, Object> a, StaffUser user) {
        UUID marketId = uuid(requiredString(a, "marketId"), "marketId");
        LocalDate date = requiredDate(a, "date");
        double open = requiredNumber(a, "openHour");
        double close = requiredNumber(a, "closeHour");
        AddDayPlan plan = planAddDay(marketId, date, open, close);
        List<String> warnings = precheck(plan.request());
        warnings.addAll(0, plan.notes());
        String summary = "Add " + CalendarRules.label(date) + " " + hours(open) + "–" + hours(close) + " to " + plan.market().name()
                + " (stall " + plan.market().stall() + ").";
        if (!isConfirmed(a)) return preview(summary, warnings);
        // Re-read and save under the schedule lock, so a concurrent edit is never overwritten by a stale day list.
        SaveMarketResponse saved = transactions.execute(status -> {
            calendarService.lockSchedule();
            return marketService.saveMarket(planAddDay(marketId, date, open, close).request());
        });
        log.info("MCP add_market_day by staff user {}: market {} day {}", user.getId(), marketId, date);
        return done("Added. " + summary, saved);
    }

    private McpSchema.CallToolResult deleteMarketDay(Map<String, Object> a, StaffUser user) {
        UUID marketId = uuid(requiredString(a, "marketId"), "marketId");
        LocalDate date = requiredDate(a, "date");
        MarketDto market = marketService.listMarkets().stream().filter(m -> m.id().equals(marketId.toString())).findFirst()
                .orElseThrow(() -> new ToolInputException("Market not found. Use list_markets for the id."));
        if (market.startDate() == null || market.finishDate() == null) {
            throw new ToolInputException("Only days of stall markets can be deleted here; home painting days are managed in the app.");
        }
        List<MarketDayDto> days = marketService.listMarketDays(marketId);
        MarketDayDto day = days.stream().filter(d -> LocalDate.parse(d.date()).equals(date)).findFirst()
                .orElseThrow(() -> new ToolInputException(market.name() + " does not open on " + CalendarRules.label(date) + "."));

        String summary = "Delete " + CalendarRules.label(date) + " " + hours(day.openHour()) + "–" + hours(day.closeHour())
                + " from " + market.name() + " (stall " + market.stall() + ").";
        List<String> warnings = new ArrayList<>();
        warnings.add("The app refuses if that day has orders, sales, pickups or painting; nothing is lost in that case.");
        if (days.size() == 1) warnings.add("It is the market's only day: the market stays, with no opening days.");
        if (date.isBefore(LocalDate.now(clock.withZone(zone)))) warnings.add("The day is in the past.");
        if (!isConfirmed(a)) return preview(summary, warnings);

        // Re-resolve the day under the schedule lock, so a concurrent edit cannot change what is deleted.
        transactions.executeWithoutResult(status -> {
            calendarService.lockSchedule();
            MarketDayDto current = marketService.listMarketDays(marketId).stream()
                    .filter(d -> LocalDate.parse(d.date()).equals(date)).findFirst()
                    .orElseThrow(() -> new ToolInputException(market.name() + " does not open on " + CalendarRules.label(date) + "."));
            marketService.deleteMarketDay(UUID.fromString(current.id()));
        });
        log.info("MCP delete_market_day by staff user {}: market {} day {}", user.getId(), marketId, date);
        return McpSchema.CallToolResult.builder().addTextContent("Deleted. " + summary).build();
    }

    private Object recentOrders(Map<String, Object> a) {
        LocalDate today = LocalDate.now(clock.withZone(zone));
        String fromText = optionalString(a, "from");
        String toText = optionalString(a, "to");
        LocalDate from = fromText == null ? today.minusDays(1) : parseDate(fromText, "from");
        LocalDate to = toText == null ? today : parseDate(toText, "to");
        if (from.plusDays(400).isBefore(to)) throw new ToolInputException("Choose a range of at most 400 days.");
        var page = orderService.listSales(null, lower(optionalString(a, "source")), from, to, 0, 50, null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", from.toString());
        out.put("to", to.toString());
        out.put("total", page.totalElements());
        out.put("shown", page.orders().size());
        out.put("orders", page.orders());
        return out;
    }

    private McpSchema.CallToolResult setPaintingHours(Map<String, Object> a, StaffUser user) {
        LocalDate date = optionalDate(a, "date");
        Double open = a.get("openHour") == null ? null : requiredNumber(a, "openHour");
        Double close = a.get("closeHour") == null ? null : requiredNumber(a, "closeHour");
        Object rawOpen = a.get("open");
        if (rawOpen != null && !(rawOpen instanceof Boolean)) throw new ToolInputException("open must be true or false.");
        Boolean openDay = (Boolean) rawOpen;
        if ((open == null) != (close == null)) throw new ToolInputException("Give both openHour and closeHour.");
        if (open == null && openDay == null) throw new ToolInputException("Give the new hours, or open=false to close the day.");
        if (Boolean.FALSE.equals(openDay) && open != null) throw new ToolInputException("Either close the day (open=false) or give new hours, not both.");
        if (open != null && (!quarterHour(open) || !quarterHour(close) || open >= close)) {
            throw new ToolInputException("Use hours from 00:00 to 23:45 in 15-minute steps, with the end after the start (e.g. 10 to 13.5).");
        }
        LocalDate today = LocalDate.now(clock.withZone(zone));
        if (date.isBefore(today)) throw new ToolInputException("That day is in the past.");
        if (date.isAfter(today.plusYears(1))) throw new ToolInputException("Choose a day within the next year.");

        var current = paintingDayService.list(date, date).getFirst();
        List<String> warnings = new ArrayList<>();
        if (open != null) {
            for (var slot : agendaService.getDay(date).slots()) {
                var block = slot.block();
                if (block != null && (block.startHour() < open || block.endHour() > close)) {
                    warnings.add("Order " + (slot.order() == null ? "?" : slot.order().code()) + " is booked " + hours(block.startHour())
                            + "–" + hours(block.endHour()) + ", outside the new hours; it stays booked (move it in the Agenda if needed).");
                }
            }
        }
        if (Boolean.FALSE.equals(openDay) && current.booked() > 0) {
            warnings.add(current.booked() + " painting session(s) are already booked that day; they stay booked.");
        }
        String was = (current.open() ? "open " + hours(current.openHour()) + "–" + hours(current.closeHour()) : "closed")
                + ", max " + current.maxPaintings() + ", " + current.booked() + " booked";
        String becomes = Boolean.FALSE.equals(openDay) ? "closed for painting"
                : (open != null ? hours(open) + "–" + hours(close) : "open with its usual hours");
        String summary = "Painting on " + CalendarRules.label(date) + ": now " + was + " → " + becomes + ".";
        if (!isConfirmed(a)) return preview(summary, warnings);

        var input = new com.artwithgab.awg_tracking.dto.agenda.UpdatePaintingDayRequest();
        if (openDay != null) input.setOpen(openDay);
        else if (open != null) input.setOpen(true);
        if (open != null) {
            input.setOpenHour(open);
            input.setCloseHour(close);
        }
        var saved = paintingDayService.update(date, input);
        log.info("MCP set_painting_hours by staff user {}: {}", user.getId(), date);
        return done("Saved. Painting on " + CalendarRules.label(date) + ": "
                + (saved.open() ? hours(saved.openHour()) + "–" + hours(saved.closeHour()) + ", max " + saved.maxPaintings() : "closed") + ".", saved);
    }

    private static boolean quarterHour(double hour) {
        return Double.isFinite(hour) && hour >= 0 && hour < 24 && hour * 4 == Math.rint(hour * 4);
    }

    private McpSchema.CallToolResult recordStockSale(Map<String, Object> a, StaffUser user) {
        String ornamentId = requiredString(a, "ornamentId").toUpperCase(Locale.ROOT);
        UUID marketId = uuid(requiredString(a, "marketId"), "marketId");
        String method = lower(requiredString(a, "paymentMethod"));
        if (!method.equals("cash") && !method.equals("card")) throw new ToolInputException("paymentMethod must be cash or card.");
        var piece = marketStockService.list().stream().filter(o -> o.id().equals(ornamentId)).findFirst()
                .orElseThrow(() -> new ToolInputException("There is no piece " + ornamentId + ". Use list_market_stock."));
        if (!"painted".equals(piece.status())) {
            throw new ToolInputException(ornamentId + " is " + piece.status() + ("sold".equals(piece.status()) && piece.orderCode() != null
                    ? " (order " + piece.orderCode() + ")" : "") + ", so it cannot be sold now.");
        }
        LocalDate today = LocalDate.now(clock.withZone(zone));
        MarketDto market = marketService.listMarkets().stream().filter(m -> m.id().equals(marketId.toString())).findFirst()
                .orElseThrow(() -> new ToolInputException("Market not found. Use list_markets for the id."));
        MarketDayDto day = marketService.listMarketDays(marketId).stream().filter(d -> LocalDate.parse(d.date()).equals(today)).findFirst()
                .orElseThrow(() -> new ToolInputException(market.name() + " is not open today, so the sale cannot be recorded there."));
        if (market.startDate() == null) throw new ToolInputException("Sales are recorded at a market stall, not at home.");

        String c = STOCK_COLORS.getOrDefault(ornamentId.charAt(0), "?");
        String f = ornamentId.length() > 1 ? STOCK_FINISHES.getOrDefault(ornamentId.charAt(1), "?") : "?";
        String summary = "Sell " + ornamentId + " (" + c + ", " + f + ") at " + market.name() + " today, paid in full by "
                + method + ", handed over now.";
        if (!isConfirmed(a)) {
            return preview(summary + " Price: EUR " + pricingService.current().finishedPrice().toPlainString() + ".",
                    List.of("This records a payment; it can only be undone in the staff app (cancel the order)."));
        }

        UUID dayId = UUID.fromString(day.id());
        var item = new com.artwithgab.awg_tracking.dto.order.CreateSaleItemRequest(
                com.artwithgab.awg_tracking.enums.ItemKind.GENERIC, false, null, null, null, null, null,
                com.artwithgab.awg_tracking.enums.DeliveryKind.MARKET, marketId, dayId, null, null, ornamentId);
        var request = new com.artwithgab.awg_tracking.dto.order.CreateSaleRequest(null, null, null, null, List.of(item), dayId);
        // All or nothing: never a sale without its payment, or a payment without the handover.
        OrderDto sold = transactions.execute(status -> {
            // No idempotency key: a retry finds the piece already sold (the service refuses MARKET_STOCK_SOLD),
            // and a fixed key would wrongly return a cancelled earlier sale of the same piece.
            OrderDto created = orderService.createSale(request, null).order();
            // Collect-and-hand-over in one call: paid in full at the server price, one owner notification.
            orderService.setHandedOver(UUID.fromString(created.id()), true, null, null,
                    "cash".equals(method) ? com.artwithgab.awg_tracking.enums.PaymentMethod.CASH : com.artwithgab.awg_tracking.enums.PaymentMethod.CARD);
            return orderService.getOrder(UUID.fromString(created.id()));
        });
        log.info("MCP record_stock_sale by staff user {}: {} order {}", user.getId(), ornamentId, sold.id());
        return done("Sold. " + ornamentId + " · order " + sold.code() + " · EUR " + sold.total().toPlainString() + " paid by " + method + ".", sold);
    }

    private record AddDayPlan(MarketDto market, SaveMarketRequest request, List<String> notes) {}

    /** The market's current days plus the new one, widening the season to include it. */
    private AddDayPlan planAddDay(UUID marketId, LocalDate date, double open, double close) {
        MarketDto market = marketService.listMarkets().stream().filter(m -> m.id().equals(marketId.toString())).findFirst()
                .orElseThrow(() -> new ToolInputException("Market not found. Use list_markets for the id."));
        if (market.startDate() == null || market.finishDate() == null) throw new ToolInputException("Only stall markets can get extra days.");

        List<SaveMarketDayRequest> days = new ArrayList<>();
        for (MarketDayDto d : marketService.listMarketDays(marketId)) {
            LocalDate existing = LocalDate.parse(d.date());
            if (existing.equals(date)) throw new ToolInputException(market.name() + " already opens on " + CalendarRules.label(date) + ".");
            days.add(new SaveMarketDayRequest(existing, d.openHour(), d.closeHour()));
        }
        days.add(new SaveMarketDayRequest(date, open, close));
        days.sort(Comparator.comparing(SaveMarketDayRequest::date));

        LocalDate start = LocalDate.parse(market.startDate());
        LocalDate finish = LocalDate.parse(market.finishDate());
        List<String> notes = new ArrayList<>();
        if (date.isBefore(start)) {
            notes.add("The season start moves from " + start + " to " + date + ".");
            start = date;
        }
        if (date.isAfter(finish)) {
            notes.add("The season end moves from " + finish + " to " + date + ".");
            finish = date;
        }
        return new AddDayPlan(market, new SaveMarketRequest(marketId, market.name(), start, finish, market.totalCost(), market.stall(), days), notes);
    }

    /**
     * Cheap checks for the preview so the owner hears about obvious mistakes before confirming.
     * The service re-checks everything (including booked orders) when the write runs.
     */
    private List<String> precheck(SaveMarketRequest r) {
        List<String> problems = new ArrayList<>();
        if (r.finishDate().isBefore(r.startDate())) problems.add("Season end must be on or after the start.");
        if (r.startDate().plusDays(MAX_SEASON_DAYS).isBefore(r.finishDate())) {
            // Also keeps the day-by-day checks below bounded.
            throw new ToolInputException("A season can last at most " + MAX_SEASON_DAYS + " days.");
        }
        if (r.stall() == null || r.stall() < 1) problems.add("Stall number must be 1 or more.");
        if (r.totalCost() != null && r.totalCost().signum() < 0) problems.add("Season cost must be zero or more.");
        Set<LocalDate> allowed = new HashSet<>(CalendarRules.marketPickupDates(r.startDate(), r.finishDate()));
        Set<LocalDate> seen = new HashSet<>();
        for (SaveMarketDayRequest d : r.days()) {
            String label = CalendarRules.label(d.date());
            if (!seen.add(d.date())) problems.add(label + " is listed twice.");
            if (!allowed.contains(d.date())) problems.add(label + " is not a Friday, Saturday or Sunday in this season; the app will probably reject it.");
            if (!(d.closeHour() > d.openHour()) || d.openHour() < 0 || d.closeHour() >= 24) problems.add(label + ": close must be after open.");
        }
        if (r.days().stream().anyMatch(d -> d.date().isBefore(LocalDate.now(clock.withZone(zone))))) {
            problems.add("At least one day is in the past.");
        }
        return problems;
    }

    // ---- tool plumbing -------------------------------------------------------------------

    private SyncToolSpecification contact(String name, String title, String description, Map<String, Object> inputSchema) {
        McpSchema.Tool tool = McpSchema.Tool.builder().name(name).title(title).description(description)
                .inputSchema(inputSchema)
                .annotations(new McpSchema.ToolAnnotations(title, true, false, true, false, null))
                .build();
        return new SyncToolSpecification(tool, (ctx, req) -> run(name, () -> {
            Map<String, Object> a = args(req);
            OrderDto order = orderService.getOrderByCode(requiredString(a, "code"));
            var bundle = orderService.getOrderBundle(UUID.fromString(order.id()));
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("orderCode", order.code());
            out.put("customer", bundle.customer());
            out.put("shippingAddresses", bundle.items().stream()
                    .map(i -> i.delivery() == null ? null : i.delivery().address())
                    .filter(java.util.Objects::nonNull).distinct().toList());
            log.info("MCP get_customer_contact by staff user {} for order {}", currentStaff().getId(), order.id());
            return McpSchema.CallToolResult.builder().addTextContent(toJson(out, false)).build();
        }));
    }

    private SyncToolSpecification read(String name, String title, String description, Map<String, Object> inputSchema,
                                       Function<Map<String, Object>, Object> handler) {
        McpSchema.Tool tool = McpSchema.Tool.builder().name(name).title(title).description(description)
                .inputSchema(inputSchema)
                .annotations(new McpSchema.ToolAnnotations(title, true, false, true, false, null))
                .build();
        return new SyncToolSpecification(tool, (ctx, req) -> run(name, () -> {
            Object result = handler.apply(args(req));
            return McpSchema.CallToolResult.builder().addTextContent(toJson(result)).build();
        }));
    }

    @FunctionalInterface
    private interface WriteHandler {
        McpSchema.CallToolResult apply(Map<String, Object> args, StaffUser user);
    }

    private SyncToolSpecification destructive(String name, String title, String description, Map<String, Object> inputSchema,
                                              WriteHandler handler) {
        McpSchema.Tool tool = McpSchema.Tool.builder().name(name).title(title).description(description)
                .inputSchema(inputSchema)
                .annotations(new McpSchema.ToolAnnotations(title, false, true, true, false, null))
                .build();
        return new SyncToolSpecification(tool, (ctx, req) -> run(name, () -> handler.apply(args(req), currentStaff())));
    }

    private SyncToolSpecification write(String name, String title, String description, Map<String, Object> inputSchema,
                                        WriteHandler handler) {
        McpSchema.Tool tool = McpSchema.Tool.builder().name(name).title(title).description(description)
                .inputSchema(inputSchema)
                .annotations(new McpSchema.ToolAnnotations(title, false, false, false, false, null))
                .build();
        return new SyncToolSpecification(tool, (ctx, req) -> run(name, () -> handler.apply(args(req), currentStaff())));
    }

    /** Business and input errors go back to the model as tool errors; anything else is logged and hidden. */
    private McpSchema.CallToolResult run(String name, java.util.function.Supplier<McpSchema.CallToolResult> body) {
        try {
            return body.get();
        } catch (ApiException | ToolInputException e) {
            return error(e.getMessage());
        } catch (RuntimeException e) {
            log.warn("MCP tool {} failed: {}", name, e.getClass().getSimpleName());
            return error("Something went wrong in the AWG server. Try again or use the staff app.");
        }
    }

    private static StaffUser currentStaff() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof StaffUser user)) {
            // The security chain already requires a staff token; this guards against misconfiguration.
            throw new ToolInputException("Sign in again.");
        }
        return user;
    }

    private McpSchema.CallToolResult preview(String summary, List<String> warnings) {
        StringBuilder text = new StringBuilder("PREVIEW — nothing was saved.\n").append(summary);
        if (!warnings.isEmpty()) text.append("\nCheck before confirming:\n- ").append(String.join("\n- ", warnings));
        text.append("\nAsk the owner to confirm, then call this tool again with the same arguments and confirm=true.");
        return McpSchema.CallToolResult.builder().addTextContent(text.toString()).build();
    }

    private McpSchema.CallToolResult done(String summary, Object saved) {
        return McpSchema.CallToolResult.builder().addTextContent(summary).addTextContent(toJson(saved)).build();
    }

    private static McpSchema.CallToolResult error(String message) {
        return McpSchema.CallToolResult.builder().addTextContent(message).isError(true).build();
    }

    private String toJson(Object value) {
        return toJson(value, true);
    }

    private String toJson(Object value, boolean hideContact) {
        JsonNode tree = json.valueToTree(value);
        prune(tree, HIDDEN_FIELDS);
        if (hideContact) prune(tree, CONTACT_FIELDS);
        return json.writeValueAsString(tree);
    }

    private static void prune(JsonNode node, Set<String> hidden) {
        if (node instanceof ObjectNode object) {
            object.remove(hidden);
            object.forEach(child -> prune(child, hidden));
        } else if (node != null && node.isArray()) {
            node.forEach(child -> prune(child, hidden));
        }
    }

    private static Map<String, Object> args(McpSchema.CallToolRequest req) {
        return req.arguments() == null ? Map.of() : req.arguments();
    }

    private static boolean isConfirmed(Map<String, Object> a) {
        return Boolean.TRUE.equals(a.get("confirm"));
    }

    private static String describeDays(List<SaveMarketDayRequest> days) {
        return String.join(", ", days.stream()
                .sorted(Comparator.comparing(SaveMarketDayRequest::date))
                .map(d -> CalendarRules.label(d.date()) + " " + hours(d.openHour()) + "–" + hours(d.closeHour())).toList());
    }

    private static String hours(double h) {
        int minutes = (int) Math.round(h * 60);
        return String.format(Locale.ROOT, "%02d:%02d", minutes / 60, minutes % 60);
    }

    // ---- argument parsing ----------------------------------------------------------------

    private static String optionalString(Map<String, Object> a, String key) {
        Object v = a.get(key);
        if (v == null) return null;
        String s = v.toString().trim();
        if (s.length() > 200) throw new ToolInputException(key + " is too long.");
        return s.isEmpty() ? null : s;
    }

    private static String requiredString(Map<String, Object> a, String key) {
        String s = optionalString(a, key);
        if (s == null) throw new ToolInputException(key + " is required.");
        return s;
    }

    private static String lower(String s) {
        return s == null ? null : s.toLowerCase(Locale.ROOT);
    }

    private LocalDate optionalDate(Map<String, Object> a, String key) {
        String s = optionalString(a, key);
        return s == null ? LocalDate.now(clock.withZone(zone)) : parseDate(s, key);
    }

    private static LocalDate requiredDate(Map<String, Object> a, String key) {
        return parseDate(requiredString(a, key), key);
    }

    private static LocalDate parseDate(String s, String key) {
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            throw new ToolInputException(key + " must be a date like 2026-12-06.");
        }
    }

    private static double requiredNumber(Map<String, Object> a, String key) {
        if (a.get(key) instanceof Number n && Double.isFinite(n.doubleValue())) return n.doubleValue();
        throw new ToolInputException(key + " must be a number.");
    }

    private static int requiredInt(Map<String, Object> a, String key) {
        double d = requiredNumber(a, key);
        if (d != Math.rint(d)) throw new ToolInputException(key + " must be a whole number.");
        return (int) d;
    }

    private static UUID uuid(String s, String key) {
        try {
            return UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            throw new ToolInputException(key + " is not a valid id.");
        }
    }

    // ---- JSON schema helpers -------------------------------------------------------------

    private static Map<String, Object> schema(Map<String, Object> properties, List<String> required) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("type", "object");
        s.put("properties", properties);
        s.put("required", required);
        s.put("additionalProperties", false);
        return s;
    }

    private static Map<String, Object> str(String description) {
        return Map.of("type", "string", "description", description);
    }

    private static Map<String, Object> confirmSchema() {
        return Map.of("type", "boolean", "description", "true only after the owner approved the preview");
    }

    private static Map<String, Object> dayItemSchema() {
        return schema(Map.of(
                "date", str("YYYY-MM-DD"),
                "openHour", Map.of("type", "number"),
                "closeHour", Map.of("type", "number")), List.of("date", "openHour", "closeHour"));
    }

    /** Bad tool arguments; the message is shown to the model. */
    static class ToolInputException extends RuntimeException {
        ToolInputException(String message) {
            super(message);
        }
    }
}
