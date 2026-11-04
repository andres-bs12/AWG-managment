package com.artwithgab.awg_tracking.config;

import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.MarketKind;
import com.artwithgab.awg_tracking.model.*;
import com.artwithgab.awg_tracking.repository.*;
import com.artwithgab.awg_tracking.service.HomeDayService;
import com.artwithgab.awg_tracking.support.CalendarRules;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Locale;

/**
 * Idempotent start-up data: schedule lock row, stock rows, staff accounts from configuration
 * (passwords from environment variables), optional demo market, and home painting days.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class Bootstrap implements ApplicationRunner {
    private final AwgProperties props;
    private final ScheduleLockRepository lockRepository;
    private final InventoryRepository inventoryRepository;
    private final StaffUserRepository staffUserRepository;
    private final MarketRepository marketRepository;
    private final HomeDayService homeDayService;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!lockRepository.existsById(ScheduleLock.ID)) {
            ScheduleLock lock = new ScheduleLock();
            lock.setId(ScheduleLock.ID);
            lockRepository.save(lock);
        }
        seedInventory();
        seedStaff();
        if (props.bootstrap().demoMarkets()) seedDemoMarket();
        homeDayService.sync();
    }

    private void seedInventory() {
        int qty = props.bootstrap().initialStock();
        for (CustomColor color : new CustomColor[]{CustomColor.RED, CustomColor.GREY}) {
            if (inventoryRepository.findByItemKindAndCustomColor(ItemKind.CUSTOM, color).isEmpty()) {
                Inventory row = new Inventory();
                row.setItemKind(ItemKind.CUSTOM);
                row.setCustomColor(color);
                row.setQuantity(qty);
                inventoryRepository.save(row);
            }
        }
        if (inventoryRepository.findFirstByItemKind(ItemKind.GENERIC).isEmpty()) {
            Inventory row = new Inventory();
            row.setItemKind(ItemKind.GENERIC);
            row.setQuantity(qty);
            inventoryRepository.save(row);
        }
    }

    private void seedStaff() {
        if (props.bootstrap().staff() == null) return;
        for (AwgProperties.StaffAccount account : props.bootstrap().staff()) {
            if (account.email() == null || account.email().isBlank()) continue;
            String email = account.email().trim().toLowerCase(Locale.ROOT);
            if (staffUserRepository.findByEmail(email).isPresent()) continue;
            if (account.password() == null || account.password().length() < 4) {
                log.warn("Staff account {} skipped: set its password through the environment", email);
                continue;
            }
            StaffUser user = new StaffUser();
            user.setName(account.name());
            user.setEmail(email);
            user.setPasswordHash(passwordEncoder.encode(account.password()));
            staffUserRepository.save(user);
            log.info("Created staff account {}", email);
        }
    }

    /** Rathausplatz 2026 like the frontend demo seed: Fri–Sun, 12:00–19:00. */
    private void seedDemoMarket() {
        if (marketRepository.findAll().stream().anyMatch(m -> m.getKind() == MarketKind.MARKET)) return;
        Market market = new Market();
        market.setKind(MarketKind.MARKET);
        market.setName("Rathausplatz");
        market.setStall(12);
        market.setTotalCost(new BigDecimal("2400.00"));
        market.setStartDate(LocalDate.of(2026, 11, 27));
        market.setFinishDate(LocalDate.of(2026, 12, 21));
        for (LocalDate d : CalendarRules.marketPickupDates(market.getStartDate(), market.getFinishDate())) {
            MarketDay day = new MarketDay();
            day.setMarket(market);
            day.setDate(d);
            day.setOpenTime(LocalTime.of(12, 0));
            day.setCloseTime(LocalTime.of(19, 0));
            market.getMarketDays().add(day);
        }
        marketRepository.save(market);
        log.info("Created demo market Rathausplatz");
    }
}
