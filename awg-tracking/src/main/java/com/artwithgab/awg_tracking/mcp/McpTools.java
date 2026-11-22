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
 * tools only act with {@code confirm=true} and otherwise return a preview. No payments,
 * cancellations or deletions are exposed.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "awg.mcp", name = "enabled", havingValue = "true")
public class McpTools {
    /** Capability tokens, photo payloads and bulky calendar copies never leave through the connector. */
    private static final Set<String> HIDDEN_FIELDS = Set.of("trackToken", "formToken", "photos", "photoUrl",
            "dataUrl", "hasUploadedPhoto", "markets", "marketDays", "itemIds", "customerId");

    private static final Set<String> AGENDA_HIDDEN_FIELDS = Set.of("email", "address", "addressLabel");
    private static final int MAX_SEASON_DAYS = 120;
    private static final Map<Character, String> STOCK_COLORS = Map.of('R', "red", 'W', "wine", 'G', "green", 'C', "beige");
    private static final Map<Character, String> STOCK_FINISHES = Map.of('S', "shiny", 'M', "matte");

    private final OrderService orderService;
    private final AgendaService agendaService;
    private final MarketService marketService;
    private final MarketStockService marketStockService;
    private final InventoryService inventoryService;
    private final JsonMapper json;
    private final Clock clock;
    private final ZoneId zone;

    public McpTools(OrderService orderService, AgendaService agendaService, MarketService marketService,
                    MarketStockService marketStockService, InventoryService inventoryService, JsonMapper json,
                    Clock clock, com.artwithgab.awg_tracking.config.AwgProperties props) {
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
                        "Full order by code (e.g. 'K7Q2ZX') or id: customer, items with colour, finish, name, production and handover, painting blocks and payments.",
                        schema(Map.of("code", str("Order code"), "id", str("Order UUID")), List.of()),
                        this::getOrder),
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
                        this::addMarketDay));
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
        return orderService.getOrderBundle(orderId);
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
        JsonNode day = json.valueToTree(agendaDay);
        // A day lists many customers; contact details and street addresses stay in get_order.
        prune(day, AGENDA_HIDDEN_FIELDS);
        out.put("day", day);
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
        SaveMarketRequest request = new SaveMarketRequest(marketId, market.name(), start, finish, market.totalCost(), market.stall(), days);
        List<String> warnings = precheck(request);
        warnings.addAll(0, notes);

        String summary = "Add " + CalendarRules.label(date) + " " + hours(open) + "–" + hours(close) + " to " + market.name()
                + " (stall " + market.stall() + ").";
        if (!isConfirmed(a)) return preview(summary, warnings);
        SaveMarketResponse saved = marketService.saveMarket(request);
        log.info("MCP add_market_day by staff user {}: market {} day {}", user.getId(), marketId, date);
        return done("Added. " + summary, saved);
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
        JsonNode tree = json.valueToTree(value);
        prune(tree, HIDDEN_FIELDS);
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
