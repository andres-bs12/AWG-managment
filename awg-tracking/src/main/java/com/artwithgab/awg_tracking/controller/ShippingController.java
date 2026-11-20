package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.dto.shop.PostCollectionDayDto;
import com.artwithgab.awg_tracking.dto.shop.ShippingWindowDto;
import com.artwithgab.awg_tracking.service.ShippingService;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/shipping")
@RequiredArgsConstructor
public class ShippingController {
    private final ShippingService shipping;

    public record WindowRequest(@NotNull LocalDate readyOn) {}
    public record CollectionDayRequest(@JsonProperty(required = true) Boolean open) {}

    @PostMapping("/window")
    public ShippingWindowDto window(@Valid @RequestBody WindowRequest request) {
        return shipping.window(request.readyOn());
    }

    @GetMapping("/collection-days")
    public List<PostCollectionDayDto> collectionDays(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return shipping.collectionDays(from, to);
    }

    @PutMapping("/collection-days/{date}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void setCollectionDay(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                 @RequestBody CollectionDayRequest request) {
        shipping.setCollectionDay(date, request.open());
    }
}
