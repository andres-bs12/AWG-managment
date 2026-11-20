package com.artwithgab.awg_tracking.controller;

import com.artwithgab.awg_tracking.service.MarketStockService;
import com.artwithgab.awg_tracking.service.MarketStockService.Ornament;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/market-stock")
@RequiredArgsConstructor
public class MarketStockController {
    private final MarketStockService stock;

    public record StatusUpdate(@NotNull @Pattern(regexp = "unpainted|painted|sold") String status,
                               @NotNull @Min(0) Integer revision) {}
    public record Photo(String url) {}

    @GetMapping
    public List<Ornament> list() {
        return stock.list();
    }

    @PatchMapping("/{id}")
    public Ornament changeStatus(@PathVariable String id, @Valid @RequestBody StatusUpdate update) {
        return stock.changeStatus(id, update.status(), update.revision());
    }

    @GetMapping("/{id}/photo")
    public ResponseEntity<Photo> photo(@PathVariable String id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Photo(stock.photo(id)));
    }

    @PutMapping(value = "/{id}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Ornament savePhoto(@PathVariable String id, @RequestParam MultipartFile photo, @RequestParam int revision) {
        return stock.savePhoto(id, photo, revision);
    }
}
