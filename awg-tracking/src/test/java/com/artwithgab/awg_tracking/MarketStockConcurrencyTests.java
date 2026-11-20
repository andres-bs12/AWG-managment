package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.exception.ApiException;
import com.artwithgab.awg_tracking.repository.CustomerRepository;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.service.MarketStockService;
import org.hibernate.Hibernate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/** Independent committed transactions and connections, rather than mocked race outcomes. */
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class MarketStockConcurrencyTests extends ApiTestSupport {
    @Autowired TransactionTemplate tx;
    @Autowired MarketStockService stockService;
    @Autowired OrderRepository orders;
    @Autowired CustomerRepository customers;

    private String seed() {
        return tx.execute(status -> readyMarketPiece());
    }

    private <T> List<T> race(Callable<T> action) throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(action);
            var second = pool.submit(action);
            return List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
        }
    }

    private void cleanup(String id) {
        tx.executeWithoutResult(status -> {
            for (var sale : orders.findAll()) {
                if (sale.getOrderItems().stream().noneMatch(i -> id.equals(i.getMarketOrnamentId()))) continue;
                var customer = sale.getCustomer();
                orders.delete(sale);
                orders.flush();
                if (!orders.existsByCustomerId(customer.getId())) customers.delete(customer);
            }
            marketStock.deleteById(id);
        });
    }

    @Test void conditionalSaleRejectsAConcurrentSellerEvenAfterBothReadReady() throws Exception {
        String id = seed();
        var bothRead = new CyclicBarrier(2);
        try {
            var results = race(() -> {
                try {
                    return tx.execute(status -> {
                        // Keep a stale painted entity in each persistence context deliberately.
                        assertThat(marketStock.findById(id).orElseThrow().getStatus()).isEqualTo("painted");
                        try { bothRead.await(5, TimeUnit.SECONDS); }
                        catch (Exception e) { throw new IllegalStateException(e); }
                        stockService.sell(id);
                        return "sold";
                    });
                } catch (ApiException conflict) { return conflict.getCode(); }
            });
            assertThat(results).containsExactlyInAnyOrder("sold", "MARKET_STOCK_SOLD");
            var sold = marketStock.summary(id).orElseThrow();
            assertThat(sold.getStatus()).isEqualTo("sold");
            assertThat(sold.getRevision()).isEqualTo(1);
            assertThat(sold.getSoldAt()).isEqualTo(java.time.Instant.parse("2026-11-24T08:00:00Z"));
        } finally { cleanup(id); }
    }

    @Test void rejectedMultiItemSaleRollsBackTheEarlierPieceCustomerAndOrder() throws Exception {
        String id = seed();
        String token = login();
        long ordersBefore = orders.count();
        long customersBefore = customers.count();
        try {
            var response = sale(token,
                    Map.of("kind", "finished", "withName", false, "deliveryKind", "market", "marketOrnamentId", id),
                    Map.of("kind", "finished", "withName", false, "deliveryKind", "market", "marketOrnamentId", "XX99"));
            assertThat(response.getResponse().getStatus()).isEqualTo(404);
            var piece = marketStock.summary(id).orElseThrow();
            assertThat(piece.getStatus()).isEqualTo("painted");
            assertThat(piece.getSoldAt()).isNull();
            assertThat(piece.getRevision()).isZero();
            assertThat(orders.count()).isEqualTo(ordersBefore);
            assertThat(customers.count()).isEqualTo(customersBefore);
        } finally { cleanup(id); }
    }

    @Test void concurrentFullSalesCreateOneOrderAndOneConflict() throws Exception {
        String id = seed();
        String token = login();
        var start = new CyclicBarrier(2);
        Map<String, Object> item = Map.of("kind", "finished", "withName", false,
                "deliveryKind", "market", "marketOrnamentId", id);
        try {
            var results = race(() -> {
                start.await(5, TimeUnit.SECONDS);
                var response = sale(token, item);
                int http = response.getResponse().getStatus();
                if (http == 409) assertThat((String) read(response, "$.code")).isEqualTo("MARKET_STOCK_SOLD");
                return http;
            });
            assertThat(results).containsExactlyInAnyOrder(201, 409);
            long linkedItems = tx.execute(status -> orders.findAll().stream()
                    .flatMap(o -> o.getOrderItems().stream()).filter(i -> id.equals(i.getMarketOrnamentId())).count());
            assertThat(linkedItems).isEqualTo(1L);
        } finally { cleanup(id); }
    }

    @Test void readingOrderItemMarketOrnamentIdDoesNotInitializeOrnamentProxy() throws Exception {
        String id = seed();
        String token = login();
        try {
            String orderId = saleOk(token, Map.of("kind", "finished", "withName", false,
                    "deliveryKind", "market", "marketOrnamentId", id));
            tx.executeWithoutResult(status -> {
                var item = orders.findById(UUID.fromString(orderId)).orElseThrow().getOrderItems().getFirst();
                assertThat(Hibernate.isInitialized(item.getMarketOrnament())).isFalse();
                assertThat(item.getMarketOrnamentId()).isEqualTo(id);
                assertThat(Hibernate.isInitialized(item.getMarketOrnament())).isFalse();
            });
        } finally { cleanup(id); }
    }
}
