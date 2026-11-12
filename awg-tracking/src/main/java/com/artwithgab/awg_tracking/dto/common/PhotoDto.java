package com.artwithgab.awg_tracking.dto.common;



/** Mirrors `Photo`. `dataUrl` is a URL the browser can load (served by GET /api/photos/{id}). */
public record PhotoDto(String id, String name, String dataUrl) {
}
