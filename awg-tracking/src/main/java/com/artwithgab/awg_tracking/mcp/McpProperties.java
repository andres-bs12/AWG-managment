package com.artwithgab.awg_tracking.mcp;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Remote MCP server for the owner's Claude connector (prototype, off by default).
 *
 * @param enabled             exposes /mcp, /oauth/** and the OAuth discovery documents
 * @param publicUrl           external origin as seen by claude.ai, e.g. https://artwithgab.com (no trailing slash)
 * @param allowedRedirectUris exact OAuth redirect URIs that may receive authorization codes
 */
@ConfigurationProperties(prefix = "awg.mcp")
public record McpProperties(boolean enabled, String publicUrl, List<String> allowedRedirectUris) {

    public McpProperties {
        publicUrl = publicUrl == null || publicUrl.isBlank() ? "http://localhost:8080" : publicUrl.replaceAll("/+$", "");
        allowedRedirectUris = allowedRedirectUris == null ? List.of()
                : allowedRedirectUris.stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    /** The protected resource identifier (RFC 8707 / RFC 9728). */
    public String resource() {
        return publicUrl + "/mcp";
    }

    public String resourceMetadataUrl() {
        return publicUrl + "/.well-known/oauth-protected-resource/mcp";
    }
}
