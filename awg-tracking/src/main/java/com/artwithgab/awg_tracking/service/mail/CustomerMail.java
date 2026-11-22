package com.artwithgab.awg_tracking.service.mail;

/** A rendered customer e-mail, published inside the order transaction and sent after commit. */
public record CustomerMail(String recipient, String subject, String text, String html) {
    public CustomerMail(String recipient, CustomerMailTemplates.Rendered rendered) {
        this(recipient, rendered.subject(), rendered.text(), rendered.html());
    }
}
