package com.artwithgab.awg_tracking;

import com.artwithgab.awg_tracking.exception.TooManyRequestsException;
import com.artwithgab.awg_tracking.model.WaitlistEntry;
import com.artwithgab.awg_tracking.repository.WaitlistRepository;
import com.artwithgab.awg_tracking.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.*;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WaitlistAbuseTests {
    @Mock WaitlistRepository repository;
    @Mock WaitlistQuota quota;
    @Mock Clock clock;
    @Mock OrderCodeGenerator generator;
    @Mock org.springframework.context.ApplicationEventPublisher events;
    @InjectMocks ShopService shop;

    @Test void exhaustedQuotaCannotCreateOrMailNewAddress() {
        when(repository.findByEmail("victim@example.com")).thenReturn(Optional.empty());
        doThrow(new TooManyRequestsException()).when(quota).acquire("client");
        assertThrows(TooManyRequestsException.class, () -> shop.joinWaitlist("VICTIM@example.com", "en", "client"));
        verify(repository, never()).saveAndFlush(any());
        verifyNoInteractions(events);
    }

    @Test void confirmedAndCoolingDownAddressesDoNotConsumeBudgetOrSendMail() {
        var entry = new WaitlistEntry();
        Instant now = Instant.parse("2026-11-12T12:00:00Z");
        entry.setLastSentAt(now);
        when(clock.instant()).thenReturn(now);
        when(repository.findByEmail("victim@example.com")).thenReturn(Optional.of(entry));
        shop.joinWaitlist("victim@example.com", "en", "client");
        entry.setConfirmedAt(now);
        shop.joinWaitlist("victim@example.com", "en", "client");
        verify(quota, times(2)).requireAvailable("client");
        verify(quota, never()).acquire(anyString());
        verifyNoInteractions(events);
    }

    @Test void exhaustedBudgetRejectsBeforeAddressLookupToAvoidMembershipOracle() {
        doThrow(new TooManyRequestsException()).when(quota).requireAvailable("blocked-client");
        assertThrows(TooManyRequestsException.class, () -> shop.joinWaitlist("any@example.com", "en", "blocked-client"));
        verifyNoInteractions(repository, events);
    }

    @Test void newSignupsAndResendsBothRequireBudgetBeforeMail() {
        Instant now = Instant.parse("2026-11-12T12:00:00Z");
        when(clock.instant()).thenReturn(now);
        when(generator.generateFormToken()).thenReturn("new-token");
        when(repository.findByEmail("new@example.com")).thenReturn(Optional.empty());
        shop.joinWaitlist("new@example.com", "en", "client");
        var sequence = inOrder(quota, repository, events);
        sequence.verify(quota).acquire("client");
        sequence.verify(repository).saveAndFlush(any());
        sequence.verify(events).publishEvent(new WaitlistConfirmation("new@example.com", "en", "new-token"));

        var entry = new WaitlistEntry();
        entry.setEmail("old@example.com");
        entry.setToken("old-token");
        entry.setLastSentAt(now.minusSeconds(3601));
        when(repository.findByEmail("old@example.com")).thenReturn(Optional.of(entry));
        doThrow(new TooManyRequestsException()).when(quota).acquire("blocked-client");
        assertThrows(TooManyRequestsException.class, () -> shop.joinWaitlist("old@example.com", "de", "blocked-client"));
        assertEquals(now.minusSeconds(3601), entry.getLastSentAt());
        verify(events, times(1)).publishEvent(any(Object.class));
    }
}
