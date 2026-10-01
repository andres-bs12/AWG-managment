package com.artwithgab.awg_tracking.dto.Order;

import com.artwithgab.awg_tracking.model.OrderItem;
import jakarta.annotation.Nullable;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record OrderRequest(

        @Valid
        @NotEmpty
        List<OrderItem> orderItemList,

        @Nullable
        String name,

        @Nullable
        String email,

        @Nullable
        String phone,

        @Nullable
        String deliveryAddress

) {
}
