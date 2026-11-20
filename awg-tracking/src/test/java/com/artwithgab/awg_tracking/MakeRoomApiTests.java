package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.model.Market;
import com.artwithgab.awg_tracking.model.MarketDay;
import com.artwithgab.awg_tracking.model.OrderItem;
import com.artwithgab.awg_tracking.model.PaintingDay;
import com.artwithgab.awg_tracking.repository.MarketRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.repository.PaintingDayRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MakeRoomApiTests extends ApiTestSupport {
    private static final String THU = "2026-11-26";
    private static final String FRI = "2026-11-27";

    @Autowired OrderRepository orders;
    @Autowired PaintingDayRepository paintingDays;
    @Autowired MarketRepository markets;
    @Autowired EntityManager entityManager;

    @Test
    void movesTheFewestSessionsAndPrefersLatestHandoffThenSaleUsesTheFreedSlot() throws Exception {
        String token = login();
        paintingDay(TUE, true, 2);
        var earlier = pickup(token, TUE, 10, SAT);
        var later = pickup(token, TUE, 11, SUN);
        var handoff = later.getHandoffDate();
        var pickup = later.getPickUpTime();

        mvc.perform(makeRoom(token, "one-move", TUE, 60))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slot.date").value(TUE))
                .andExpect(jsonPath("$.slot.startHour").value(11.0))
                .andExpect(jsonPath("$.slot.endHour").value(12.0))
                .andExpect(jsonPath("$.moved.length()").value(1))
                .andExpect(jsonPath("$.moved[0].itemId").value(later.getId().toString()))
                .andExpect(jsonPath("$.moved[0].orderCode").value(later.getOrder().getCode()))
                .andExpect(jsonPath("$.moved[0].from.startHour").value(11.0))
                .andExpect(jsonPath("$.moved[0].to.date").value(WED));

        assertThat(earlier.getPaintStart()).isEqualTo(LocalDateTime.parse(TUE + "T10:00"));
        assertThat(later.getHandoffDate()).isEqualTo(handoff);
        assertThat(later.getPickUpTime()).isEqualTo(pickup);
        assertThat(later.getPaintEnd().toLocalDate()).isBefore(handoff);
        assertThat(pickup(token, TUE, 11, SAT).getPaintStart()).isEqualTo(LocalDateTime.parse(TUE + "T11:00"));
    }

    @Test
    void movesTwoSessionsToFreeOneContiguousSlot() throws Exception {
        String token = login();
        var first = pickup(token, WED, 10, SAT);
        var second = pickup(token, WED, 11, SUN);

        mvc.perform(makeRoom(token, "two-moves", WED, 120))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slot.startHour").value(10.0))
                .andExpect(jsonPath("$.slot.endHour").value(12.0))
                .andExpect(jsonPath("$.moved.length()").value(2));

        assertThat(first.getPaintStart().toLocalDate()).isEqualTo(LocalDate.parse(THU));
        assertThat(second.getPaintStart().toLocalDate()).isEqualTo(LocalDate.parse(THU));
        assertThat(first.getPaintStart()).isNotEqualTo(second.getPaintStart());
    }

    @Test
    void alreadyFreeReturnsTheSlotWithNoMoves() throws Exception {
        String token = login();
        mvc.perform(makeRoom(token, "room-exists", TUE, 75))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slot.date").value(TUE))
                .andExpect(jsonPath("$.slot.startHour").value(10.0))
                .andExpect(jsonPath("$.slot.endHour").value(11.25))
                .andExpect(jsonPath("$.moved").isEmpty());
    }

    @Test
    void allSameDayPickupsReturnTheSpecifiedReasonAndMessage() throws Exception {
        String token = login();
        paintingDay(SAT, true, 2);
        pickup(token, SAT, 12, SAT);
        pickup(token, SAT, 13, SAT);
        mvc.perform(makeRoom(token, "same-day-only", SAT, 60))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NO_MOVABLE_SESSION"))
                .andExpect(jsonPath("$.reason").value("SAME_DAY_ONLY"))
                .andExpect(jsonPath("$.message").value("All of today's sessions are for pickups today, so none can be moved."));
    }

    @Test
    void leavesBothSessionsInPlaceIfOnlyOneCanMove() throws Exception {
        String token = login();
        var first = pickup(token, WED, 10, FRI);
        var second = pickup(token, WED, 11, FRI);
        paintingDay(TUE, false, 0);
        paintingDay(THU, true, 1);
        mvc.perform(makeRoom(token, "no-target", WED, 120))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NO_MOVABLE_SESSION"))
                .andExpect(jsonPath("$.reason").value("NO_TARGET_SLOT"));
        assertThat(first.getPaintStart()).isEqualTo(LocalDateTime.parse(WED + "T10:00"));
        assertThat(second.getPaintStart()).isEqualTo(LocalDateTime.parse(WED + "T11:00"));
    }

    @Test
    void closedDateIsNotAPaintingDay() throws Exception {
        String token = login();
        paintingDay(TUE, false, 0);
        mvc.perform(makeRoom(token, "closed-date", TUE, 60))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NO_MOVABLE_SESSION"))
                .andExpect(jsonPath("$.reason").value("NOT_PAINTING_DAY"));
    }

    @Test
    void replayReturnsTheOriginalBodyAfterTheAgendaChanges() throws Exception {
        String token = login();
        paintingDay(TUE, true, 2);
        pickup(token, TUE, 10, SAT);
        pickup(token, TUE, 11, SUN);
        String original = mvc.perform(makeRoom(token, "replay-test", TUE, 60))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.moved.length()").value(1))
                .andReturn().getResponse().getContentAsString();
        pickup(token, TUE, 11, SAT);
        entityManager.flush();
        entityManager.clear();

        String replayed = mvc.perform(makeRoom(token, "replay-test", TUE, 60))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(replayed).isEqualTo(original);
    }

    @Test
    void reusingAKeyForAnotherRequestIsRejected() throws Exception {
        String token = login();
        pickup(token, TUE, 10, SAT);
        mvc.perform(makeRoom(token, "reused-key", TUE, 60)).andExpect(status().isOk());

        mvc.perform(makeRoom(token, "reused-key", TUE, 90))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_KEY_REUSED"));
    }

    @Test
    void legacyViennaBlockCanMoveBeforeItsDeliveryDay() throws Exception {
        String token = login();
        var item = pickup(token, TUE, 10, SAT);
        item.setDeliveryKind(DeliveryKind.DELIVERY);
        item.setHandoffDate(LocalDate.parse(FRI));
        item.setPickUpTime(null);

        mvc.perform(post("/api/agenda/blocks/{id}/make-room", item.getId()).header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slot").doesNotExist())
                .andExpect(jsonPath("$.moved[0].to.startHour").value(11.0));
        assertThat(item.getHandoffDate()).isEqualTo(LocalDate.parse(FRI));
        assertThat(item.getPickUpTime()).isNull();
    }

    @Test
    void explicitlySelectedStallUsesItsOwnHours() throws Exception {
        String token = login();
        Market market = new Market();
        market.setName("Second stall");
        MarketDay day = new MarketDay();
        day.setDate(LocalDate.parse(SAT));
        day.setOpenTime(LocalTime.of(9, 0));
        day.setCloseTime(LocalTime.of(11, 0));
        day.setMarket(market);
        market.getMarketDays().add(day);
        markets.saveAndFlush(market);

        mvc.perform(post("/api/agenda/make-room").header("Authorization", bearer(token))
                        .header("Idempotency-Key", "second-stall").contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("date", SAT, "minutes", 60, "marketDayId", day.getId()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slot.startHour").value(9.0));
        var item = customItem(false, SAT, 9.0, 10.0, "market", dayId(token, SUN), 14.0);
        item.put("marketId", market.getId().toString());
        saleOk(token, item);
    }

    @Test
    void plannerTriesAnotherGapIfTheFirstTargetBlocksASecondMove() throws Exception {
        String token = login();
        var shortBlock = pickup(token, WED, 10, 10.5, FRI);
        var longBlock = pickup(token, WED, 10.5, 12, FRI);
        pickup(token, THU, 11.5, 12.5, FRI);
        paintingDay(TUE, false, 0);
        paintingDay(THU, true, 3);

        mvc.perform(makeRoom(token, "alternate-gap", WED, 120))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.moved.length()").value(2));
        assertThat(shortBlock.getPaintStart()).isEqualTo(LocalDateTime.parse(THU + "T12:30"));
        assertThat(longBlock.getPaintStart()).isEqualTo(LocalDateTime.parse(THU + "T10:00"));
    }

    @Test
    void dateEndpointRequiresStaffAndAnIdempotencyKey() throws Exception {
        var body = json(Map.of("date", TUE, "minutes", 60));
        mvc.perform(post("/api/agenda/make-room").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/agenda/make-room").header("Authorization", bearer(login()))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field").value("Idempotency-Key"));
    }

    private MockHttpServletRequestBuilder makeRoom(String token, String key, String date, int minutes) {
        return post("/api/agenda/make-room").header("Authorization", bearer(token))
                .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("date", date, "minutes", minutes)));
    }

    private OrderItem pickup(String token, String date, double start, String handoff) throws Exception {
        return pickup(token, date, start, start + 1, handoff);
    }

    private OrderItem pickup(String token, String date, double start, double end, String handoff) throws Exception {
        String id = saleOk(token, customItem(false, date, start, end, "market", dayId(token, handoff), 14.5));
        return orders.findById(UUID.fromString(id)).orElseThrow().getOrderItems().getFirst();
    }

    private void paintingDay(String date, boolean open, int paintingHours) {
        PaintingDay day = new PaintingDay();
        day.setDate(LocalDate.parse(date));
        day.setOpen(open);
        if (open) {
            double start = SAT.equals(date) ? 12.0 : 10.0;
            day.setOpenHour(start);
            day.setCloseHour(start + paintingHours);
        }
        paintingDays.save(day);
    }
}
