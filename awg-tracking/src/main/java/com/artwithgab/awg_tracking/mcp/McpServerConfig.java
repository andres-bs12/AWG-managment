package com.artwithgab.awg_tracking.mcp;

import com.artwithgab.awg_tracking.security.AuthService;
import com.artwithgab.awg_tracking.security.BearerTokenFilter;
import io.modelcontextprotocol.json.jackson3.JacksonMcpJsonMapper;
import io.modelcontextprotocol.server.McpServer;
import io.modelcontextprotocol.server.McpStatelessSyncServer;
import io.modelcontextprotocol.server.transport.HttpServletStatelessServerTransport;
import io.modelcontextprotocol.spec.McpSchema;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Wires the stateless Streamable HTTP MCP server (JSON responses, no SSE sessions) and its own
 * security chain. Only active with {@code awg.mcp.enabled=true}; otherwise /mcp and /oauth fall
 * through to the main chain, which denies them.
 */
@Configuration
@ConditionalOnProperty(prefix = "awg.mcp", name = "enabled", havingValue = "true")
public class McpServerConfig {

    static final String SERVER_INSTRUCTIONS = """
            ArtWithGab (AWG) sells hand-painted, personalised Christmas ornaments ("Kugeln") at Vienna markets.
            Dates are ISO (YYYY-MM-DD) in Europe/Vienna; hours are decimals (14.5 = 14:30).
            Market stock ids: first letter is the colour (R red, W wine, G green, C champagne shown as beige),
            second letter the finish (S shiny, M matte), then a number, e.g. WM03.
            Write tools never act without confirm=true: call them first without it, show the owner the preview,
            and only repeat with confirm=true after the owner explicitly agrees.
            Customer data is personal data: only show what the owner asked for.""";

    @Bean
    HttpServletStatelessServerTransport mcpTransport(JsonMapper jsonMapper) {
        return HttpServletStatelessServerTransport.builder()
                .jsonMapper(new JacksonMcpJsonMapper(jsonMapper))
                .messageEndpoint("/mcp")
                .maxRequestSize(256 * 1024)
                .build();
    }

    @Bean
    McpStatelessSyncServer mcpServer(HttpServletStatelessServerTransport transport, JsonMapper jsonMapper, McpTools tools) {
        return McpServer.sync(transport)
                .serverInfo("artwithgab", "0.1.0")
                .instructions(SERVER_INSTRUCTIONS)
                .jsonMapper(new JacksonMcpJsonMapper(jsonMapper))
                .capabilities(McpSchema.ServerCapabilities.builder().tools(false).build())
                // Run tools on the request thread so the Spring Security context and transactions apply.
                .immediateExecution(true)
                .requestTimeout(Duration.ofSeconds(30))
                .tools(tools.specifications())
                .build();
    }

    /**
     * Ordered before the main API chain. /mcp needs a staff bearer token; a missing or expired one
     * gets 401 with the RFC 9728 pointer so claude.ai can start the OAuth flow.
     */
    @Bean
    @Order(1)
    SecurityFilterChain mcpChain(HttpSecurity http, AuthService authService, McpProperties mcp) throws Exception {
        http
                .securityMatcher("/mcp", "/mcp/**", "/oauth/**", "/.well-known/oauth-protected-resource",
                        "/.well-known/oauth-protected-resource/**", "/.well-known/oauth-authorization-server")
                .csrf(AbstractHttpConfigurer::disable)
                .cors(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h.contentSecurityPolicy(csp -> csp.policyDirectives(
                        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action " + formActionSources(mcp))))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.GET, "/.well-known/**").permitAll()
                        .requestMatchers("/oauth/authorize").permitAll()
                        .requestMatchers(HttpMethod.POST, "/oauth/register", "/oauth/token").permitAll()
                        .requestMatchers("/mcp", "/mcp/**").hasRole("STAFF")
                        .anyRequest().denyAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> {
                            res.setStatus(401);
                            res.setHeader("WWW-Authenticate", "Bearer resource_metadata=\"" + mcp.resourceMetadataUrl() + "\"");
                            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            res.getWriter().write("{\"error\":\"invalid_token\",\"error_description\":\"Sign in to ArtWithGab.\"}");
                        })
                        .accessDeniedHandler((req, res, ex) -> res.sendError(403)))
                .addFilterBefore(new BearerTokenFilter(authService), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** The login form posts to itself and then redirects to the client; browsers apply form-action to that redirect. */
    private static String formActionSources(McpProperties mcp) {
        Set<String> sources = new LinkedHashSet<>();
        sources.add("'self'");
        for (String uri : mcp.allowedRedirectUris()) {
            URI parsed = URI.create(uri);
            if (parsed.getScheme() != null && parsed.getAuthority() != null) {
                sources.add(parsed.getScheme() + "://" + parsed.getAuthority());
            }
        }
        return String.join(" ", sources);
    }
}
