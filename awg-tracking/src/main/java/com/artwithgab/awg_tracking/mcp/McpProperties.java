package com.artwithgab.awg_tracking.mcp;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Remote MCP server for the owner's Claude connector (prototype, off by default).
 *
 * @param enabled             exposes /mcp, /oauth/** and the OAuth discovery documents
 * @param publicUrl           external origin as seen by claude.ai, e.g. https://artwithgab.com (no trailing slash)
 * @param allowedRedirectUris exact OAuth redirect URIs that may receive authorization codes
 * @param allowedEmails       staff accounts that may connect Claude (the owner); empty = nobody
 */
@ConfigurationProperties(prefix = "awg.mcp")
public record McpProperties(boolean enabled, String publicUrl, List<String> allowedRedirectUris, List<String> allowedEmails) {

    public McpProperties {
        publicUrl = publicUrl == null || publicUrl.isBlank() ? "http://localhost:8080" : publicUrl.replaceAll("/+$", "");
        allowedRedirectUris = allowedRedirectUris == null ? List.of()
                : allowedRedirectUris.stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
        allowedEmails = allowedEmails == null ? List.of()
                : allowedEmails.stream().map(e -> e.trim().toLowerCase(java.util.Locale.ROOT)).filter(e -> !e.isEmpty()).toList();
    }

    public boolean isAllowed(String email) {
        return email != null && allowedEmails.contains(email.trim().toLowerCase(java.util.Locale.ROOT));
    }

    /** The protected resource identifier (RFC 8707 / RFC 9728). */
    public String resource() {
        return publicUrl + "/mcp";
    }

    public String resourceMetadataUrl() {
        return publicUrl + "/.well-known/oauth-protected-resource/mcp";
    }
}
