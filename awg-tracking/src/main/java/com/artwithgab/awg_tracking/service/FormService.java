package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.form.*;
import com.artwithgab.awg_tracking.dto.order.OrderItemDto;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import com.artwithgab.awg_tracking.model.*;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.repository.StoredPhotoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

/** Customer form opened from the QR code (/form/{formToken}). */
@Service
@RequiredArgsConstructor
public class FormService {
    private final OrderRepository orderRepository;
    private final StoredPhotoRepository photoRepository;
    private final PhotoStorageService photoStorage;
    private final CalendarService calendarService;
    private final ViewMapper mapper;

    private Order find(String token) {
        if (token == null || token.length() < 20 || token.length() > 100) throw new ResourceNotFoundException("This form link is not valid.");
        return orderRepository.findByFormToken(token).orElseThrow(() -> new ResourceNotFoundException("This form link is not valid."));
    }

    @Transactional(readOnly = true)
    public CustomerFormViewDto getForm(String token) {
        Order order = find(token);
        CalendarIndex index = calendarService.snapshot();
        List<OrderItem> items = order.getOrderItems();
        if (items.isEmpty()) throw new ResourceNotFoundException("Form data missing");
        OrderItem main = items.stream().filter(i -> i.getItemKind() == ItemKind.CUSTOM).findFirst().orElse(items.getFirst());
        List<OrderItemDto> itemDtos = items.stream().map(i -> mapper.item(i, index)).toList();
        return new CustomerFormViewDto(
                items.stream().map(i -> mapper.when(i, index)).toList(),
                order.getTotal(),
                order.getPaymentState(),
                itemDtos,
                token,
                order.getCode(),
                items.stream().anyMatch(OrderItem::isWithName),
                order.isFormSubmitted(),
                mapper.customer(order.getCustomer()),
                mapper.item(main, index));
    }

    /**
     * Saves contact data, pet names, notes, back names and photos. New photos arrive as multipart parts
     * named {@code photo-{id}}; photos already stored are kept by id. Re-submitting is allowed until
     * painting starts.
     */
    @Transactional
    public SubmitFormResponse submit(String token, CustomerFormRequest payload, Map<String, MultipartFile> files) {
        Order order = find(token);
        if (order.getOrderItems().stream().anyMatch(i -> i.getItemKind() == ItemKind.CUSTOM && i.getProductionStatus() != ProductionStatus.NOT_STARTED)) {
            throw new ConflictException("Painting has already started. Contact us to change the details.");
        }
        Customer customer = order.getCustomer();
        customer.setName(payload.customerName().trim());
        customer.setPhone(payload.phone().trim());
        customer.setEmail(payload.email().trim());

        Map<UUID, ItemFormRequest> byItem = new HashMap<>();
        for (ItemFormRequest row : payload.items()) byItem.put(row.orderItemId(), row);

        for (OrderItem item : order.getOrderItems()) {
            ItemFormRequest row = byItem.get(item.getId());
            if (row == null) {
                if (item.getItemKind() == ItemKind.CUSTOM) throw new BadRequestException("Fill in every custom ornament.");
                continue;
            }
            item.setPetName(row.petName().trim());
            item.setNote(row.note() == null ? "" : row.note().trim());
            if (item.isWithName()) {
                String back = row.backName() == null ? "" : row.backName().trim().toUpperCase(Locale.ROOT);
                item.setNameInOrnament(back.length() > 6 ? back.substring(0, 6) : back);
            }
            if (item.getItemKind() == ItemKind.CUSTOM && row.photos().isEmpty()) {
                throw new BadRequestException("Add at least one photo for " + row.petName().trim() + ".");
            }
            replacePhotos(item, row, files);
        }
        order.setFormSubmitted(true);
        return new SubmitFormResponse(order.getCode());
    }

    private void replacePhotos(OrderItem item, ItemFormRequest row, Map<String, MultipartFile> files) {
        Set<UUID> current = new HashSet<>();
        item.getPhotos().forEach(p -> current.add(p.getPhotoId()));
        List<PhotoRef> next = new ArrayList<>();
        for (FormPhotoRef ref : row.photos()) {
            MultipartFile file = files.get("photo-" + ref.id());
            if (file != null) {
                StoredPhoto stored = photoStorage.store(file, item.getId(), ref.name());
                next.add(new PhotoRef(stored.getId(), stored.getOriginalName()));
                continue;
            }
            UUID existing = parse(ref.id());
            PhotoRef kept = existing == null ? null
                    : item.getPhotos().stream().filter(p -> p.getPhotoId().equals(existing)).findFirst().orElse(null);
            if (kept == null) throw new BadRequestException("A photo could not be uploaded. Add it again.");
            next.add(kept);
        }
        Set<UUID> keep = new HashSet<>();
        next.forEach(p -> keep.add(p.getPhotoId()));
        current.removeAll(keep);
        if (!current.isEmpty()) photoRepository.findByIdIn(current).forEach(photoStorage::delete);
        item.getPhotos().clear();
        item.getPhotos().addAll(next);
    }

    private static UUID parse(String id) {
        try {
            return UUID.fromString(id);
        } catch (RuntimeException e) {
            return null;
        }
    }

}
