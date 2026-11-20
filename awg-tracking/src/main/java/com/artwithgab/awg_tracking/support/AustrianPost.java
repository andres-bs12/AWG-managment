package com.artwithgab.awg_tracking.support;

import com.artwithgab.awg_tracking.dto.common.AddressDto;
import com.artwithgab.awg_tracking.exception.BadRequestException;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.regex.Pattern;

public final class AustrianPost {
    private static final Pattern POSTCODE = Pattern.compile("[1-9][0-9]{3}");
    private static final Pattern TRACKING_NUMBER = Pattern.compile("[A-Za-z0-9]{8,40}");
    private static final String TRACKING_BASE_URL = "https://www.post.at/s/sendungsdetails?snr=";

    private AustrianPost() {}

    public static void requireAddress(AddressDto address) {
        if (address == null || address.line1() == null || address.line1().isBlank()
                || address.city() == null || address.city().isBlank()) {
            throw new BadRequestException("Add the shipping address.").code("VALIDATION").field("address");
        }
        if (address.postalCode() == null || !POSTCODE.matcher(address.postalCode()).matches()) {
            throw new BadRequestException("Enter a four-digit Austrian postcode.").code("POSTAL_INVALID").field("address.postalCode");
        }
    }

    public static String trackingNumber(String number) {
        if (number == null || number.isBlank()) return null;
        if (!TRACKING_NUMBER.matcher(number).matches()) {
            throw new BadRequestException("Enter a parcel number with 8–40 letters or digits.")
                    .code("VALIDATION").field("trackingNumber");
        }
        return number;
    }

    public static String trackingUrl(String number) {
        return number != null && TRACKING_NUMBER.matcher(number).matches() ? TRACKING_BASE_URL + number : null;
    }

    public static String arrivalRange(LocalDate from, LocalDate to, boolean english) {
        Locale locale = english ? Locale.UK : Locale.GERMAN;
        String day = english ? "d" : "d.";
        String fullDate = day + " MMMM uuuu";
        String end = DateTimeFormatter.ofPattern(fullDate, locale).format(to);
        if (from.equals(to)) return end;
        if (from.getYear() == to.getYear() && from.getMonth() == to.getMonth()) {
            return DateTimeFormatter.ofPattern(day, locale).format(from) + "–" + end;
        }
        String beginning = from.getYear() == to.getYear() ? day + " MMMM" : fullDate;
        return DateTimeFormatter.ofPattern(beginning, locale).format(from) + " – " + end;
    }
}
