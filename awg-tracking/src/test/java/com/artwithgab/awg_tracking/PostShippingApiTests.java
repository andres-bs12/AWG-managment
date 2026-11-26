package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.ProductionStatus;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.model.PaintingDay;
import com.artwithgab.awg_tracking.repository.InvoiceRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.repository.PaintingDayRepository;
import com.artwithgab.awg_tracking.service.RetentionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PostShippingApiTests extends ApiTestSupport {
    private static final Map<String, String> LINZ = Map.of("line1", "Hauptplatz 1", "postalCode", "4020", "city", "Linz");
    private static final String TRACKING_URL = "https://www.post.at/s/sendungsdetails?snr=AT12345678";

    @Autowired OrderRepository orders;
    @Autowired InvoiceRepository invoices;
    @Autowired PaintingDayRepository paintingDays;
    @Autowired RetentionService retention;
    @Autowired Clock clock;

    private Map<String, Object> finishedPost() {
        var item = finishedItem();
        item.put("deliveryKind", "post");
        item.put("address", LINZ);
        return item;
    }

    private Map<String, Object> customPost(String date, double start) {
        var item = customItem(false, date, start, start + 1, "post", null, null);
        item.put("address", LINZ);
        return item;
    }

    @Test
    void collectionOverridesAreStaffOnlyAndChangeTheResolvedCalendarAndWindow() throws Exception {
        String path = "/api/shipping/collection-days";
        mvc.perform(get(path).param("from", "2026-12-08").param("to", "2026-12-11"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put(path + "/2026-12-09").contentType(MediaType.APPLICATION_JSON).content("{\"open\":false}"))
                .andExpect(status().isUnauthorized());

        String auth = bearer(login());
        var days = get(path).header("Authorization", auth)
                .param("from", "2026-12-08").param("to", "2026-12-11");
        mvc.perform(days).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].date").value("2026-12-09"))
                .andExpect(jsonPath("$[0].open").value(true))
                .andExpect(jsonPath("$[1].date").value("2026-12-11"));
        mvc.perform(put(path + "/2026-12-09").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"open\":false}"))
                .andExpect(status().isNoContent());
        mvc.perform(put(path + "/2026-12-10").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"open\":true}"))
                .andExpect(status().isNoContent());
        mvc.perform(put(path + "/2026-12-08").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"open\":true}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put(path + "/2026-12-09").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(days).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].open").value(false))
                .andExpect(jsonPath("$[0].override").value(false))
                .andExpect(jsonPath("$[1].date").value("2026-12-10"))
                .andExpect(jsonPath("$[1].override").value(true))
                .andExpect(jsonPath("$[2].date").value("2026-12-11"));

        var window = post("/api/shipping/window").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).content("{\"readyOn\":\"2026-12-06\"}");
        mvc.perform(window).andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionDate").value("2026-12-10"));
        mvc.perform(put(path + "/2026-12-09").header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"open\":null}"))
                .andExpect(status().isNoContent());
        mvc.perform(window).andExpect(status().isOk())
                .andExpect(jsonPath("$.collectionDate").value("2026-12-09"))
                .andExpect(jsonPath("$.arrivalFrom").value("2026-12-11"))
                .andExpect(jsonPath("$.arrivalTo").value("2026-12-14"));
    }

    @Test
    void finishedPostRequiresACustomItemThatAlsoShipsByPost() throws Exception {
        String token = login();
        for (var result : List.of(sale(token, finishedPost()),
                sale(token, finishedPost(), customItem(false, TUE, 10.0, 11.0, "market", dayId(token, SAT), 14.0)))) {
            assertEquals(400, result.getResponse().getStatus());
            assertEquals("SHIPPING_NEEDS_CUSTOM", this.<String>read(result, "$.code"));
        }
        mvc.perform(get("/api/prices").header("Authorization", bearer(token)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.finishedWithCustom").value(true));
    }

    private OrderItem soldPostItem(String token, String date, double start) throws Exception {
        String orderId = saleOk(token, customPost(date, start));
        return orders.findById(UUID.fromString(orderId)).orElseThrow().postItems().getFirst();
    }

    @Test
    void makeRoomMovesPostBlockPastItsOriginalEndOnTheSameDay() throws Exception {
        String token = login();
        var item = soldPostItem(token, SAT, 12.0);
        var handoff = item.getHandoffDate();
        var from = item.getArrivalFrom();
        var to = item.getArrivalTo();
        String url = "/api/agenda/blocks/" + item.getId() + "/make-room";

        mvc.perform(post(url)).andExpect(status().isUnauthorized());
        mvc.perform(post(url).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.moved[0].itemId").value(item.getId().toString()))
                .andExpect(jsonPath("$.moved[0].from.date").value(SAT))
                .andExpect(jsonPath("$.moved[0].to.startHour").value(13.0))
                .andExpect(jsonPath("$.moved[0].to.endHour").value(14.0));
        assertThat(item.getPaintStart()).isEqualTo(LocalDateTime.parse(SAT + "T13:00"));
        assertThat(item.getHandoffDate()).isEqualTo(handoff);
        assertThat(item.getArrivalFrom()).isEqualTo(from);
        assertThat(item.getArrivalTo()).isEqualTo(to);
    }

    @Test
    void makeRoomPrefersALaterDayWhenTheCurrentDayHasNoRoom() throws Exception {
        String token = login();
        var item = soldPostItem(token, SAT, 18.0);
        mvc.perform(post("/api/agenda/blocks/{id}/make-room", item.getId()).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.moved[0].to.date").value(SUN))
                .andExpect(jsonPath("$.moved[0].to.startHour").value(12.0));
        assertThat(item.getPaintStart().toLocalDate()).isEqualTo(LocalDate.parse(SUN));
    }

    @Test
    void makeRoomFallsBackToAnEarlierDayIncludingToday() throws Exception {
        String token = login();
        var item = soldPostItem(token, "2026-11-30", 12.0);
        mvc.perform(post("/api/agenda/blocks/{id}/make-room", item.getId()).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.moved[0].to.date").value(TUE))
                .andExpect(jsonPath("$.moved[0].to.startHour").value(10.0));
        assertThat(item.getHandoffDate()).isEqualTo(LocalDate.parse("2026-12-01"));
    }

    @Test
    void makeRoomKeepsOriginalBlockAndPromiseWhenOnlyHandoffDayHasRoom() throws Exception {
        String token = login();
        var item = soldPostItem(token, WED, 11.0);
        saleOk(token, customItem(false, WED, 10.0, 11.0, "market", dayId(token, SAT), 14.0));
        for (LocalDate date = LocalDate.parse(TUE); date.isBefore(item.getHandoffDate()); date = date.plusDays(1)) {
            if (date.equals(LocalDate.parse(WED))) continue;
            var day = new PaintingDay();
            day.setDate(date);
            day.setOpen(false);
            paintingDays.save(day);
        }
        var handoff = item.getHandoffDate();
        var from = item.getArrivalFrom();
        var to = item.getArrivalTo();

        mvc.perform(post("/api/agenda/blocks/{id}/make-room", item.getId()).header("Authorization", bearer(token)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NO_SLOT_KEEPS_PROMISE"));
        assertThat(item.getPaintStart()).isEqualTo(LocalDateTime.parse(WED + "T11:00"));
        assertThat(item.getPaintEnd()).isEqualTo(LocalDateTime.parse(WED + "T12:00"));
        assertThat(item.getHandoffDate()).isEqualTo(handoff);
        assertThat(item.getArrivalFrom()).isEqualTo(from);
        assertThat(item.getArrivalTo()).isEqualTo(to);
    }

    @Test
    void dateMakeRoomKeepsPostCollectionAndArrivalRange() throws Exception {
        String token = login();
        var item = soldPostItem(token, WED, 10.0);
        var handoff = item.getHandoffDate();
        var from = item.getArrivalFrom();
        var to = item.getArrivalTo();

        mvc.perform(post("/api/agenda/make-room").header("Authorization", bearer(token))
                        .header("Idempotency-Key", "post-promise").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", WED, "minutes", 120))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.moved[0].itemId").value(item.getId().toString()));
        assertThat(item.getPaintStart().toLocalDate()).isAfter(LocalDate.parse(WED));
        assertThat(item.getPaintEnd().toLocalDate()).isBefore(handoff);
        assertThat(item.getHandoffDate()).isEqualTo(handoff);
        assertThat(item.getArrivalFrom()).isEqualTo(from);
        assertThat(item.getArrivalTo()).isEqualTo(to);
    }

    @Test
    void makeRoomRejectsASameDayPickupBlock() throws Exception {
        String token = login();
        String orderId = saleOk(token, customItem(false, SAT, 12.0, 13.0, "market", dayId(token, SAT), 14.0));
        var item = orders.findById(UUID.fromString(orderId)).orElseThrow().getOrderItems().getFirst();

        mvc.perform(post("/api/agenda/blocks/{id}/make-room", item.getId()).header("Authorization", bearer(token)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SESSION_NOT_MOVABLE"));
        assertThat(item.getPaintStart()).isEqualTo(LocalDateTime.parse(SAT + "T12:00"));
    }

    @Test
    void staffWindowRequiresAuthAndUsesTheSameCutoff() throws Exception {
        var request = post("/api/shipping/window").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("readyOn", "2026-12-17")));
        mvc.perform(request).andExpect(status().isUnauthorized());
        String token = login();
        mvc.perform(request.header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.collectionDate").value("2026-12-18"))
                .andExpect(jsonPath("$.arrivalFrom").value("2026-12-22"))
                .andExpect(jsonPath("$.arrivalTo").value("2026-12-23"));
        mvc.perform(post("/api/shipping/window").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("readyOn", "2026-12-18"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.available").value(false))
                .andExpect(jsonPath("$.collectionDate").doesNotExist());
    }

    @Test
    void mixedStaffSaleGroupsPostAtTheServerCollectionDateAndChargesOnce() throws Exception {
        String token = login();
        var custom = customItem(false, "2026-12-02", 10.0, 11.0, "post", dayId(token, SAT), 14.0);
        custom.put("address", LINZ);
        String id = saleOk(token, finishedItem(), finishedPost(), custom);
        var order = orders.findById(UUID.fromString(id)).orElseThrow();
        assertThat(order.getDeliveryAddress().getCity()).isEqualTo("Linz");
        assertThat(order.getDeliveryFee()).isEqualByComparingTo("5.00");
        assertThat(order.getTotal()).isEqualByComparingTo("125.00");
        assertThat(order.postItems()).hasSize(2).allSatisfy(item -> {
            assertThat(item.getHandoffDate()).isEqualTo(LocalDate.parse("2026-12-04"));
            assertThat(item.getArrivalTo()).isEqualTo(LocalDate.parse("2026-12-10"));
            assertThat(item.getPickUpTime()).isNull();
        });

        mvc.perform(get("/api/orders/" + id + "/bundle").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[1].delivery.address.postalCode").value("4020"))
                .andExpect(jsonPath("$.items[1].delivery.deliveryDate").value("2026-12-04"))
                .andExpect(jsonPath("$.items[1].delivery.arrivalFrom").value("2026-12-09"));
        mvc.perform(get("/api/agenda/days/2026-12-04").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.deliveries[?(@.orderId=='" + id + "')].methodLabel",
                        org.hamcrest.Matchers.contains("Post · Fri 4 Dec", "Post · Fri 4 Dec")));
        mvc.perform(withIp(get("/api/track/" + order.getCode())).header("X-Form-Token", order.getFormToken()))
                .andExpect(jsonPath("$.when.kind").value("post"))
                .andExpect(jsonPath("$.when.arrivalTo").value("2026-12-10"))
                .andExpect(jsonPath("$.items[1].deliveryKind").value("post"))
                .andExpect(jsonPath("$.delivery.address").doesNotExist());
    }

    @Test
    void staffNeedsAnAustrianAddressAndAnAvailableWindow() throws Exception {
        String token = login();
        var custom = customPost(WED, 10.0);
        custom.remove("address");
        var finished = finishedPost();
        finished.remove("address");
        var missing = sale(token, custom, finished);
        assertEquals(400, missing.getResponse().getStatus());
        assertEquals("address", this.<String>read(missing, "$.field"));

        custom.put("address", Map.of("line1", "Hauptplatz 1", "city", "Linz", "postalCode", "0020"));
        var invalid = sale(token, custom);
        assertEquals(400, invalid.getResponse().getStatus());
        assertEquals("POSTAL_INVALID", this.<String>read(invalid, "$.code"));

        var tooLate = sale(token, customItem(false, "2026-12-18", 12.0, 13.0, "post", null, null));
        assertEquals(400, tooLate.getResponse().getStatus());
        assertEquals("SHIPPING_UNAVAILABLE", this.<String>read(tooLate, "$.code"));
    }

    @Test
    void trackingIsValidatedStoredExposedClearedAndAnonymized() throws Exception {
        String token = login();
        String id = saleOk(token, finishedPost(), customPost(WED, 10.0));
        var order = orders.findById(UUID.fromString(id)).orElseThrow();
        assertThat(order.postItems()).allSatisfy(item -> assertThat(item.getHandoffDate()).isEqualTo(LocalDate.parse("2026-12-01")));

        order.postItems().getLast().setProductionStatus(ProductionStatus.FINISHED);

        mvc.perform(patch("/api/orders/" + id + "/handed-over").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("handedOver", true, "trackingNumber", "AT1234&invalid"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field").value("trackingNumber"));
        assertThat(order.isHandedOver()).isFalse();

        mvc.perform(patch("/api/orders/" + id + "/handed-over").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("handedOver", true,
                                "trackingNumber", "AT12345678", "itemIds", List.of(order.postItems().getFirst().getId())))))
                .andExpect(status().isNoContent());
        assertThat(order.isHandedOver()).isFalse();
        mvc.perform(withIp(get("/api/track/" + order.getCode())))
                .andExpect(jsonPath("$.status").value("ready"))
                .andExpect(jsonPath("$.items[0].handedOver").value(true));

        mvc.perform(put("/api/orders/" + id + "/handed-over").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("handedOver", true))))
                .andExpect(status().isNoContent());
        assertThat(order.isHandedOver()).isTrue();
        assertThat(invoices.findByOrderIdOrderByNumberAsc(order.getId())).singleElement()
                .satisfies(invoice -> assertThat(invoice.getBody()).contains("Übergeben: Ja", "Versand per Post: 5,00 EUR"));
        mvc.perform(get("/api/orders/" + id).header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.trackingNumber").value("AT12345678"))
                .andExpect(jsonPath("$.trackingUrl").value(TRACKING_URL));
        mvc.perform(withIp(get("/api/track/" + order.getCode())).header("X-Form-Token", order.getFormToken()))
                .andExpect(jsonPath("$.status").value("shipped"))
                .andExpect(jsonPath("$.trackingUrl").value(TRACKING_URL))
                .andExpect(jsonPath("$.delivery.address").doesNotExist());

        mvc.perform(patch("/api/orders/" + id + "/handed-over").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(json(Map.of("handedOver", true, "trackingNumber", " "))))
                .andExpect(status().isNoContent());
        assertThat(order.getTrackingNumber()).isNull();

        order.setTrackingNumber("AT12345678");
        order.setHandedOverAt(clock.instant().minus(Duration.ofDays(61)));
        retention.run();
        assertThat(order.getTrackingNumber()).isNull();
        assertThat(order.getDeliveryAddress()).isNull();
        mvc.perform(withIp(get("/api/track/" + order.getCode())))
                .andExpect(jsonPath("$.status").value("shipped"))
                .andExpect(jsonPath("$.trackingUrl").doesNotExist());
    }

    @Test
    void statsCountMarketPostAndLegacyViennaSeparately() throws Exception {
        String token = login();
        String legacy = legacyViennaOrder(token, 10.0, false);
        saleOk(token, finishedItem(), customPost(WED, 10.0));
        mvc.perform(get("/api/stats").header("Authorization", bearer(token)).param("from", TUE).param("to", TUE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.delivery.market").value(1))
                .andExpect(jsonPath("$.delivery.post").value(1))
                .andExpect(jsonPath("$.delivery.vienna").value(1));
        mvc.perform(get("/api/agenda/days/" + WED).header("Authorization", bearer(token)))
                .andExpect(jsonPath("$.deliveries[?(@.orderId=='" + legacy + "')].methodLabel",
                        org.hamcrest.Matchers.contains("Vienna · Wed 25 Nov")));
    }
}
