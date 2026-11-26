package com.artwithgab.awg_tracking.service;

import com.artwithgab.awg_tracking.enums.OrnamentSize;

/** Customer-facing size labels shared by e-mails and invoices: "Groß 10 cm" / "Big 10 cm". */
public final class OrnamentSizeLabels {
    private OrnamentSizeLabels() {
    }

    public static String label(OrnamentSize size, boolean en) {
        String word = switch (size) {
            case BIG -> en ? "Big" : "Groß";
            case MEDIUM -> en ? "Medium" : "Mittel";
        };
        return word + " " + size.centimetres() + " cm";
    }
}
