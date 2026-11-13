package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.model.ScheduleLock;
import com.artwithgab.awg_tracking.repository.MarketDayRepository;
import com.artwithgab.awg_tracking.repository.ScheduleLockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class CalendarService {
    private final MarketDayRepository marketDayRepository;
    private final ScheduleLockRepository scheduleLockRepository;
    private final Clock clock;

    public CalendarIndex snapshot() {
        return new CalendarIndex(marketDayRepository.findAllWithMarket(), LocalDateTime.now(clock));
    }

    /**
     * Serializes every booking of painting time (call inside a transaction, before reading the agenda).
     * Holds a row lock on the single ScheduleLock row until the transaction ends.
     */
    public void lockSchedule() {
        if (scheduleLockRepository.lockById(ScheduleLock.ID).isEmpty()) {
            throw new IllegalStateException("Schedule lock row missing");
        }
    }
}
