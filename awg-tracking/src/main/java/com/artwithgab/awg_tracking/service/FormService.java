package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.dto.form.*;
import com.artwithgab.awg_tracking.dto.order.OrderItemDto;
import com.artwithgab.awg_tracking.enums.DeliveryKind;
import com.artwithgab.awg_tracking.enums.ItemKind;
import com.artwithgab.awg_tracking.enums.ProductionStatus;
import com.artwithgab.awg_tracking.exception.BadRequestException;
import com.artwithgab.awg_tracking.exception.ConflictException;
import com.artwithgab.awg_tracking.exception.ResourceNotFoundException;
import com.artwithgab.awg_tracking.model.*;
import com.artwithgab.awg_tracking.repository.OrderRepository;
import com.artwithgab.awg_tracking.repository.StoredPhotoRepository;
import com.artwithgab.awg_tracking.support.AustrianPost;
import com.artwithgab.awg_tracking.support.ViennaAddress;
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
    private final org.springframework.context.ApplicationEventPublisher events;
    private final StoredPhotoRepository photoRepository;
    private final PhotoStorageService photoStorage;
    private final CalendarService calendarService;
    private final ViewMapper mapper;
    private final FormLinkPolicy formLinks;

    private Order find(String token) {
        if (token == null || token.length() < 20 || token.length() > 100) throw new ResourceNotFoundException("This form link is not valid.");
        Order order = orderRepository.findByFormToken(token).orElseThrow(() -> new ResourceNotFoundException("This form link is not valid."));
        if (order.isCancelled() || formLinks.isExpired(order)) {
            throw new ResourceNotFoundException("This form link has expired.").code("FORM_EXPIRED");
        }
        return order;
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
                publicCustomer(order.getCustomer()),
                mapper.item(main, index),
                needsAddress(order),
                mapper.address(order.getDeliveryAddress()),
                isEditable(order));
    }

    private com.artwithgab.awg_tracking.dto.common.CustomerDto publicCustomer(Customer c) {
        var dto = mapper.customer(c);
        return new com.artwithgab.awg_tracking.dto.common.CustomerDto(dto.id(), c.publicName(), dto.phone(), dto.email());
    }

    private static boolean needsAddress(Order order) {
        return order.getOrderItems().stream().anyMatch(i -> i.getDeliveryKind() != DeliveryKind.MARKET);
    }

    /** The customer may change the form until painting starts and the order is not handed over. */
    private static boolean isEditable(Order order) {
        return !order.isUnconfirmedWeb() && !order.isHandedOver() && order.getOrderItems().stream()
                .noneMatch(i -> i.getItemKind() == ItemKind.CUSTOM && i.getProductionStatus() != ProductionStatus.NOT_STARTED);
    }

    /**
     * Saves contact data, pet names, notes, back names and photos. New photos arrive as multipart parts
     * named {@code photo-{id}}; photos already stored are kept by id. Re-submitting is allowed until
     * painting starts.
     */
    @Transactional
    public SubmitFormResponse submit(String token, CustomerFormRequest payload, Map<String, MultipartFile> files) {
        Order order = find(token);
        if (order.isUnconfirmedWeb()) {
            throw new ConflictException("Payment must be confirmed before changing the order.").code("PAYMENT_PENDING");
        }
        if (!isEditable(order)) {
            throw new ConflictException("Painting has already started. Contact us to change the details.").code("FORM_LOCKED");
        }
        Customer customer = order.getCustomer();
        customer.setName(payload.customerName().trim());
        customer.setPhone(payload.phone().trim());
        customer.setEmail(payload.email().trim());
        java.util.List<String> addressBefore = addressKey(order.getDeliveryAddress());
        boolean post = !order.postItems().isEmpty();
        if (post) {
            if (payload.address() != null || order.getDeliveryAddress() == null) {
                AustrianPost.requireAddress(payload.address());
                order.setDeliveryAddress(OrderService.toAddress(payload.address()));
            }
        } else if (needsAddress(order)) {
            if (payload.address() == null || payload.address().line1() == null || payload.address().line1().isBlank()) {
                if (order.getDeliveryAddress() == null) {
                    throw new BadRequestException("Add the delivery address in Vienna.").code("VALIDATION").field("address");
                }
            } else {
                if (!ViennaAddress.isViennaPostal(payload.address().postalCode())) {
                    throw new BadRequestException("We only deliver inside Vienna (postal codes 1010–1230).")
                            .code("POSTAL_OUTSIDE_VIENNA").field("address.postalCode");
                }
                order.setDeliveryAddress(OrderService.toAddress(payload.address()));
            }
        }

        Map<UUID, ItemFormRequest> byItem = new HashMap<>();
        for (ItemFormRequest row : payload.items()) byItem.put(row.orderItemId(), row);

        for (OrderItem item : order.getOrderItems()) {
            ItemFormRequest row = byItem.get(item.getId());
            if (row == null) {
                if (item.getItemKind() == ItemKind.CUSTOM) throw new BadRequestException("Fill in every custom ornament.");
                continue;
            }
            item.setPetName(row.petName() == null ? "" : row.petName().trim());
            item.setNote(row.note() == null ? "" : row.note().trim());
            if (item.isWithName()) {
                String back = row.backName() == null ? "" : row.backName().trim().toUpperCase(Locale.ROOT);
                if (back.isEmpty() || back.codePointCount(0, back.length()) > 6) {
                    throw new BadRequestException("Use 1–6 letters for the painted name.").code("VALIDATION")
                            .field("items[" + payload.items().indexOf(row) + "].backName");
                }
                item.setNameInOrnament(back);
            }
            if (item.getItemKind() == ItemKind.CUSTOM && row.photos().isEmpty()) {
                throw new BadRequestException("Add at least one photo for each ornament.");
            }
            replacePhotos(item, row, files);
        }
        boolean first = !order.isFormSubmitted();
        order.setFormSubmitted(true);
        if (payload.locale() != null) order.setLocale(payload.locale());
        events.publishEvent(OrderNotification.from(order, first ? OrderNotification.Kind.FORM_COMPLETED : OrderNotification.Kind.FORM_SUBMITTED));
        // A later edit that moves the parcel also confirms the new address to the customer.
        if (!first && addressBefore != null && !addressBefore.equals(addressKey(order.getDeliveryAddress()))) {
            events.publishEvent(OrderNotification.from(order, OrderNotification.Kind.ADDRESS_CHANGED));
        }
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

    private static java.util.List<String> addressKey(com.artwithgab.awg_tracking.model.Address a) {
        if (a == null) return null;
        return java.util.stream.Stream.of(a.getLine1(), a.getLine2(), a.getPostalCode(), a.getCity()).map(v -> v == null ? "" : v.trim()).toList();
    }
}
