package com.artwithgab.awg_tracking.mcp;

import io.modelcontextprotocol.server.transport.HttpServletStatelessServerTransport;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/**
 * Serves the MCP transport through the DispatcherServlet, so /mcp shares the security filter
 * chain, error handling and MockMvc tests with the rest of the API. The SDK transport is a plain
 * HttpServlet that blocks until the JSON-RPC response is written.
 */
@RestController
@ConditionalOnProperty(prefix = "awg.mcp", name = "enabled", havingValue = "true")
public class McpEndpointController {
    private final HttpServletStatelessServerTransport transport;

    public McpEndpointController(HttpServletStatelessServerTransport transport) {
        this.transport = transport;
    }

    @RequestMapping(value = "/mcp", method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.DELETE})
    public void handle(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        transport.service(request, response);
    }
}
