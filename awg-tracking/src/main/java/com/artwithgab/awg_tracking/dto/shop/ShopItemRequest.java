package com.artwithgab.awg_tracking.dto.shop;

import com.artwithgab.awg_tracking.dto.form.FormPhotoRef;
import com.artwithgab.awg_tracking.enums.CustomColor;
import com.artwithgab.awg_tracking.enums.CustomFinish;
import com.artwithgab.awg_tracking.enums.ItemKind;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** One ornament in a web order. Custom ornaments need a pet name and at least one photo. */
public record ShopItemRequest(
        @NotNull ItemKind kind,
        boolean withName,
        CustomColor color,
        CustomFinish finish,
        @Size(max = 60) String petName,
        @Size(max = 6) String backName,
        @Size(max = 1000) String note,
        @Size(max = 6) @Valid List<FormPhotoRef> photos
) {
}
