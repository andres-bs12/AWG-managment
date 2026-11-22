package com.artwithgab.awg_tracking.mcp;

import com.artwithgab.awg_tracking.model.StaffSession;
import com.artwithgab.awg_tracking.model.StaffUser;
import com.artwithgab.awg_tracking.exception.UnauthorizedException;
import com.artwithgab.awg_tracking.security.AuthService;
import com.artwithgab.awg_tracking.security.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.HtmlUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Minimal OAuth 2.1 authorization server for the claude.ai custom connector:
 * discovery (RFC 9728 + RFC 8414), open dynamic client registration (RFC 7591) limited to an
 * allow-list of redirect URIs, authorization code + PKCE S256 with a staff e-mail/password page,
 * and a token endpoint for public clients.
 * <p>
 * The access token is an opaque staff session with audience {@code mcp}, created only when the code
 * is redeemed. It reuses the session table, expiry, sliding renewal and logout, but it opens /mcp
 * only: the staff API ({@code /api/**}) rejects it.
 * Because redirect URIs are allow-listed and PKCE binds each code to the client that started the
 * flow, client registration is stateless (the issued client_id is not stored).
 */
@Slf4j
@RestController
@ConditionalOnProperty(prefix = "awg.mcp", name = "enabled", havingValue = "true")
public class McpOAuthController {
    private final McpProperties mcp;
    private final AuthService authService;
    private final RateLimiter rateLimiter;
    private final AuthorizationCodeStore codes;
    private final Clock clock;

    public McpOAuthController(McpProperties mcp, AuthService authService, RateLimiter rateLimiter,
                              AuthorizationCodeStore codes, Clock clock) {
        this.mcp = mcp;
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.codes = codes;
        this.clock = clock;
    }

    // ---- discovery -----------------------------------------------------------------------

    @GetMapping({"/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"})
    public Map<String, Object> protectedResource() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("resource", mcp.resource());
        body.put("authorization_servers", List.of(mcp.publicUrl()));
        body.put("bearer_methods_supported", List.of("header"));
        body.put("resource_name", "ArtWithGab staff");
        return body;
    }

    @GetMapping("/.well-known/oauth-authorization-server")
    public Map<String, Object> authorizationServer() {
        String base = mcp.publicUrl();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("issuer", base);
        body.put("authorization_endpoint", base + "/oauth/authorize");
        body.put("token_endpoint", base + "/oauth/token");
        body.put("registration_endpoint", base + "/oauth/register");
        body.put("response_types_supported", List.of("code"));
        body.put("grant_types_supported", List.of("authorization_code"));
        body.put("code_challenge_methods_supported", List.of("S256"));
        body.put("token_endpoint_auth_methods_supported", List.of("none"));
        return body;
    }

    // ---- dynamic client registration -----------------------------------------------------

    @PostMapping(value = "/oauth/register", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> register(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        rateLimiter.check("mcp-register", request.getRemoteAddr(), 10);
        if (!(body.get("redirect_uris") instanceof List<?> uris) || uris.isEmpty() || uris.size() > 5) {
            return oauthError(HttpStatus.BAD_REQUEST, "invalid_redirect_uri", "redirect_uris is required");
        }
        for (Object uri : uris) {
            if (!(uri instanceof String s) || !mcp.allowedRedirectUris().contains(s)) {
                return oauthError(HttpStatus.BAD_REQUEST, "invalid_redirect_uri", "This redirect URI is not allowed");
            }
        }
        Map<String, Object> client = new LinkedHashMap<>();
        client.put("client_id", "awg-mcp-" + AuthorizationCodeStore.randomToken().substring(0, 22));
        client.put("client_id_issued_at", clock.instant().getEpochSecond());
        client.put("redirect_uris", uris);
        client.put("token_endpoint_auth_method", "none");
        client.put("grant_types", List.of("authorization_code"));
        client.put("response_types", List.of("code"));
        if (body.get("client_name") instanceof String name && name.length() <= 100) client.put("client_name", name);
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(CacheControl.noStore()).body(client);
    }

    // ---- authorization endpoint ----------------------------------------------------------

    @GetMapping(value = "/oauth/authorize", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> authorizePage(@RequestParam Map<String, String> params) {
        String problem = invalidAuthorizeRequest(params);
        if (problem != null) return page(HttpStatus.BAD_REQUEST, errorPage(problem));
        return page(HttpStatus.OK, loginPage(params, null));
    }

    @PostMapping(value = "/oauth/authorize", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE, produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> authorize(@RequestParam Map<String, String> params, HttpServletRequest request) {
        String problem = invalidAuthorizeRequest(params);
        if (problem != null) return page(HttpStatus.BAD_REQUEST, errorPage(problem));
        // The form only posts to itself: refuse cross-site posts (login CSRF, burning the staff login limit).
        if (isCrossSite(request)) return page(HttpStatus.FORBIDDEN, errorPage("Open the sign-in page from Claude again."));

        String email = params.getOrDefault("email", "").trim();
        String password = params.getOrDefault("password", "");
        if (email.isEmpty() || password.isEmpty() || email.length() > 254) {
            return page(HttpStatus.UNAUTHORIZED, loginPage(params, "Wrong e-mail or password."));
        }
        // Same limits as the staff login (AuthController), sharing its buckets so the two forms add up.
        rateLimiter.check("login", request.getRemoteAddr(), 10);
        String account = email.toLowerCase(Locale.ROOT);
        String failureBucket = "login-failed|" + account;
        rateLimiter.requireBelow(failureBucket, request.getRemoteAddr(), 20);
        StaffUser user;
        try {
            user = authService.verifyCredentials(email, password);
        } catch (UnauthorizedException e) {
            rateLimiter.record(failureBucket, request.getRemoteAddr());
            if (rateLimiter.record("login-failed-account", account) == 200) {
                log.warn("Staff account failed-login warning threshold reached (200/minute).");
            }
            return page(HttpStatus.UNAUTHORIZED, loginPage(params, "Wrong e-mail or password."));
        }
        String resource = params.get("resource") == null || params.get("resource").isBlank() ? null : mcp.resource();
        String code = codes.issue(params.get("client_id"), params.get("redirect_uri"), params.get("code_challenge"), resource, user.getId());
        log.info("MCP connector authorized for staff user {}", user.getId());
        // Values go through template variables so they are fully percent-encoded ('&' and '=' in state included).
        Map<String, String> values = new LinkedHashMap<>();
        values.put("code", code);
        UriComponentsBuilder redirect = UriComponentsBuilder.fromUriString(params.get("redirect_uri")).queryParam("code", "{code}");
        if (params.get("state") != null) {
            redirect.queryParam("state", "{state}");
            values.put("state", params.get("state"));
        }
        return ResponseEntity.status(HttpStatus.FOUND)
                .header("Location", redirect.encode().buildAndExpand(values).toUriString())
                .cacheControl(CacheControl.noStore()).build();
    }

    // ---- token endpoint ------------------------------------------------------------------

    @PostMapping(value = "/oauth/token", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Map<String, Object>> token(@RequestParam Map<String, String> params, HttpServletRequest request) {
        rateLimiter.check("mcp-token", request.getRemoteAddr(), 30);
        if (!"authorization_code".equals(params.get("grant_type"))) {
            return oauthError(HttpStatus.BAD_REQUEST, "unsupported_grant_type", "Only authorization_code is supported");
        }
        var grant = codes.redeem(params.get("code")).orElse(null);
        if (grant == null
                || !grant.clientId().equals(params.get("client_id"))
                || !grant.redirectUri().equals(params.get("redirect_uri"))
                || !AuthorizationCodeStore.verifierMatches(params.get("code_verifier"), grant.codeChallenge())
                || !resourceMatches(params.get("resource"))
                // RFC 8707: a code requested for this resource must be redeemed for it too.
                || (grant.resource() != null && (params.get("resource") == null || params.get("resource").isBlank()))) {
            return oauthError(HttpStatus.BAD_REQUEST, "invalid_grant", "The authorization code is invalid or expired");
        }
        String accessToken;
        try {
            accessToken = authService.createSession(grant.staffUserId(), StaffSession.MCP);
        } catch (UnauthorizedException e) {
            return oauthError(HttpStatus.BAD_REQUEST, "invalid_grant", "The authorization code is invalid or expired");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("access_token", accessToken);
        body.put("token_type", "Bearer");
        body.put("expires_in", authService.idleTtl(StaffSession.MCP).toSeconds());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Pragma", "no-cache").body(body);
    }

    // ---- helpers -------------------------------------------------------------------------

    /** Returns a human-readable problem, or null when the request may proceed to the login page. */
    private String invalidAuthorizeRequest(Map<String, String> p) {
        String redirectUri = p.get("redirect_uri");
        if (redirectUri == null || !mcp.allowedRedirectUris().contains(redirectUri)) return "This redirect URI is not allowed.";
        if (!"code".equals(p.get("response_type"))) return "Only response_type=code is supported.";
        String clientId = p.get("client_id");
        if (clientId == null || clientId.isBlank() || clientId.length() > 100) return "client_id is required.";
        String challenge = p.get("code_challenge");
        if (challenge == null || !challenge.matches("[A-Za-z0-9_-]{43}")) return "A PKCE code_challenge is required.";
        if (!"S256".equals(p.get("code_challenge_method"))) return "Only code_challenge_method=S256 is supported.";
        if (p.get("state") != null && p.get("state").length() > 500) return "state is too long.";
        if (!resourceMatches(p.get("resource"))) return "Unknown resource.";
        return null;
    }

    /**
     * Browsers send Origin on form posts and Sec-Fetch-Site on modern engines; either one naming
     * another site means the post did not come from our own sign-in page.
     */
    private boolean isCrossSite(HttpServletRequest request) {
        String fetchSite = request.getHeader("Sec-Fetch-Site");
        if (fetchSite != null && !fetchSite.equals("same-origin") && !fetchSite.equals("none")) return true;
        String origin = request.getHeader("Origin");
        return origin != null && !origin.equals("null") && !origin.equalsIgnoreCase(originOf(mcp.publicUrl()));
    }

    private static String originOf(String url) {
        java.net.URI uri = java.net.URI.create(url);
        return uri.getScheme() + "://" + uri.getAuthority();
    }

    /** RFC 8707: the resource is optional, but when sent it must be this server's MCP endpoint. */
    private boolean resourceMatches(String resource) {
        if (resource == null || resource.isBlank()) return true;
        String normalized = resource.replaceAll("/+$", "");
        return normalized.equals(mcp.resource());
    }

    private static ResponseEntity<Map<String, Object>> oauthError(HttpStatus status, String error, String description) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .body(Map.of("error", error, "error_description", description));
    }

    private ResponseEntity<String> page(HttpStatus status, String html) {
        return ResponseEntity.status(status).contentType(MediaType.TEXT_HTML).cacheControl(CacheControl.noStore()).body(html);
    }

    private static final List<String> FORWARDED = List.of("response_type", "client_id", "redirect_uri", "state",
            "code_challenge", "code_challenge_method", "resource", "scope");

    private String loginPage(Map<String, String> params, String error) {
        StringBuilder hidden = new StringBuilder();
        for (String name : FORWARDED) {
            String value = params.get(name);
            if (value != null) {
                hidden.append("<input type=\"hidden\" name=\"").append(name).append("\" value=\"")
                        .append(HtmlUtils.htmlEscape(value)).append("\">");
            }
        }
        String errorHtml = error == null ? "" : "<p class=\"error\" role=\"alert\">" + HtmlUtils.htmlEscape(error) + "</p>";
        String email = HtmlUtils.htmlEscape(params.getOrDefault("email", ""));
        return shell("Connect Claude",
                "<h1>Connect Claude to ArtWithGab</h1>"
                        + "<p>Sign in with your staff account. Claude will be able to read orders, the agenda and stock, "
                        + "and add markets after you confirm.</p>"
                        + errorHtml
                        + "<form method=\"post\" action=\"/oauth/authorize\">" + hidden
                        + "<label>E-mail<input name=\"email\" type=\"email\" autocomplete=\"username\" required value=\"" + email + "\"></label>"
                        + "<label>Password<input name=\"password\" type=\"password\" autocomplete=\"current-password\" required></label>"
                        + "<button type=\"submit\">Sign in and connect</button></form>");
    }

    private String errorPage(String problem) {
        return shell("Cannot connect", "<h1>Cannot connect</h1><p class=\"error\">" + HtmlUtils.htmlEscape(problem) + "</p>");
    }

    private static String shell(String title, String body) {
        return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
                + "<meta name=\"robots\" content=\"noindex\"><title>" + title + "</title><style>"
                + "body{font-family:system-ui,sans-serif;background:#f4f6fb;color:#1b2333;margin:0;padding:32px 16px}"
                + "main{max-width:400px;margin:0 auto;background:#fff;border-radius:12px;padding:24px}"
                + "h1{font-size:1.25rem;margin:0 0 16px}p{margin:0 0 24px;line-height:1.5}"
                + "form{display:grid;gap:24px}label{display:grid;gap:8px;font-weight:600}"
                + "input{font:inherit;padding:12px;border:1px solid #9aa3b5;border-radius:8px;min-height:48px;box-sizing:border-box}"
                + "button{font:inherit;font-weight:600;min-height:56px;border:0;border-radius:8px;background:#1d3d8f;color:#fff}"
                + ".error{color:#b00020}</style></head><body><main>" + body + "</main></body></html>";
    }
}
