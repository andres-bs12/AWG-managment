package com.artwithgab.awg_tracking.service;

/** Only the document number crosses the async boundary; delivery reloads the archived snapshot. */
public record InvoiceIssued(long number) { }
