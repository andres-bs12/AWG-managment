# Servidor MCP para manejar AWG por chat (prototipo, 2026-11-22)

**Rama:** `claude/mcp-server-prototype-c0ceba` (sin push ni despliegue). **Estado:** prototipo funcional en el backend, apagado por defecto (`MCP_ENABLED=false`).

## Qué es

Andrés agrega `https://artwithgab.com/mcp` como **conector personalizado** en claude.ai (Ajustes → Conectores, también desde el iPad). Después puede escribir en cualquier chat «muéstrame el stock de la bola Wine», «busca a la clienta Müller», «qué recogidas hay el sábado» o «añade un mercado el 6 de diciembre», y Claude llama a las herramientas de AWG.

**Costo:** el conector usa el plan Max, así que no hay costo de API, y corre dentro del backend actual en el EC2 (sin servidor nuevo).

## Arquitectura

- Paquete nuevo `com.artwithgab.awg_tracking.mcp` dentro del backend Spring. SDK oficial MCP de Java **2.2.0** (`mcp-core` + `mcp-json-jackson3`, compatible con Spring Boot 4.1.1, Jackson 3 y Java 21). Spring AI no hace falta.
- Transporte **Streamable HTTP sin estado** en `POST /mcp`, con respuestas JSON (sin sesiones SSE). Así no guarda estado en memoria y sobrevive a reinicios.
- El endpoint pasa por el `DispatcherServlet` (`McpEndpointController`), así que usa la misma cadena de seguridad, el mismo manejo de errores y las mismas pruebas MockMvc que el resto de la API.
- Las herramientas llaman a los servicios existentes (`OrderService`, `AgendaService`, `MarketService`, `MarketStockService`, `InventoryService`) igual que los controladores REST. No se cambió ningún servicio de negocio. Tras la auditoría se añadió **V19** (`staff_session.audience`) y `AuthService` separa la verificación de la contraseña de la creación de la sesión.
- Las herramientas corren en el mismo hilo de la petición (`immediateExecution`), así aplican el contexto de seguridad y las transacciones normales.

## Autenticación (OAuth 2.1)

claude.ai exige OAuth para conectores remotos. Se implementó el flujo mínimo contra las cuentas staff existentes:

1. Sin token, `/mcp` responde 401 con `WWW-Authenticate: Bearer resource_metadata=…` (RFC 9728).
2. claude.ai lee `/.well-known/oauth-protected-resource/mcp` y `/.well-known/oauth-authorization-server` (RFC 8414).
3. Registro dinámico `POST /oauth/register` (RFC 7591): solo acepta redirect URIs de una lista fija (`MCP_REDIRECT_URIS`, por defecto los callbacks de claude.ai y claude.com).
4. `GET /oauth/authorize` muestra una página de login staff (e-mail y contraseña). Exige PKCE S256 y valida `resource` (RFC 8707). Usa los mismos límites de intentos que el login del staff.
5. `POST /oauth/token` canjea el código (de un solo uso, 2 minutos, guardado con hash) con el `code_verifier`. Si el código se pidió para `resource`, el canje también debe nombrarlo.
6. **El access token es una sesión staff con `audience = mcp`** (V19), creada recién al canjear el código. Funciona **solo en `/mcp`**: `/api/**` lo rechaza y `/mcp` rechaza los tokens de la app. Dura 7 días sin uso y 30 días como máximo, para que no caduque de noche en un fin de semana de mercado. Se cierra al cambiar la contraseña.
7. El login rechaza los envíos desde otro sitio (`Origin`/`Sec-Fetch-Site`) y codifica `state` completo en la redirección.

Nunca queda abierto: `/mcp` exige rol STAFF y, con `MCP_ENABLED=false`, `/mcp` y `/oauth` caen en la cadena principal, que los niega.

## Herramientas

| Herramienta | Tipo | Servicio |
|---|---|---|
| `search_orders` (código, nombre o teléfono) | lectura | `OrderService.search` |
| `get_order` (por código o id) | lectura | `getOrderByCode` + `getOrderBundle` |
| `get_agenda_day` (fecha; hoy por defecto) | lectura | `AgendaService.getDay` |
| `list_market_stock` (color, acabado, estado; con conteos) | lectura | `MarketStockService.list` |
| `list_inventory` | lectura | `InventoryService.list` |
| `list_markets` (con sus días y horas) | lectura | `MarketService.listMarkets/listMarketDays` |
| `list_needs_attention` | lectura | `OrderService.needingAttention` |
| `get_customer_contact` (teléfono, e-mail y dirección de un pedido) | lectura | `getOrderByCode` + `getOrderBundle` |
| `list_recent_orders` (pedidos entre dos fechas; por defecto ayer y hoy) | lectura | `OrderService.listSales` |
| `set_painting_hours` (horas de pintura de un día, o cerrarlo) | escritura con `confirm` | `PaintingDayService.update` |
| `record_stock_sale` (pieza numerada vendida hoy en un puesto abierto hoy, pagada completa en efectivo o tarjeta, entregada) | escritura con `confirm`, registra un pago | `createSale` + `updatePaymentState` + `setHandedOver` en una transacción |
| `create_market` | escritura con `confirm` | `MarketService.saveMarket` |
| `add_market_day` (amplía la temporada si hace falta) | escritura con `confirm` | `MarketService.saveMarket` |
| `delete_market_day` (solo días de mercado sin pedidos, ventas, recogidas ni pintura; el servicio lo impone) | borrado con `confirm` | `MarketService.deleteMarketDay` |

- Las escrituras sin `confirm=true` solo devuelven una vista previa con advertencias (día que no es vie/sáb/dom, fecha pasada, horas). Con `confirm=true` el servicio valida todo de nuevo y guarda. Cada escritura queda en el log con el id del usuario staff.
- El único pago que registra es la venta completa de una pieza numerada del stock (decisión del dueño, 2026-11-22), con el precio del servidor. No hay depósitos, cambios de pago, reembolsos ni cancelaciones. El único borrado es un día de mercado vacío (decisión del dueño, 2026-11-22); mercados completos, pedidos y clientas solo se borran desde la app.
- Las respuestas ocultan `trackToken`, `formToken`, fotos y listas de calendario repetidas. Teléfono, e-mail y dirección solo salen con `get_customer_contact`, un pedido a la vez y con registro en el log.
- Lo usan Andrés y Gaby, cada uno desde su cuenta de Claude y con su usuario staff; cada sesión del conector queda ligada a su usuario. Solo las cuentas de `MCP_ALLOWED_EMAILS` pueden conectarse (vacía = nadie). Se comprueba al emitir el código, al canjearlo y en cada llamada a `/mcp`.
- Los tokens del conector se guardan con hash `SHA-256("mcp:" + token)`: un backend anterior a V19 no los encuentra tras un rollback.
- El stock numerado se decodifica por el id: R rojo, W vino, G verde y C champán (Beige); S brillante, M mate.

## Riesgos y pendientes

- **Datos personales:** nombres, teléfonos y direcciones de clientes pasan a Anthropic al usarse en el chat. Hay que mencionarlo en la Datenschutzerklärung (consultar al asesor) y pedir solo lo necesario.
- **Una cuenta comprometida da acceso por chat.** Mismo riesgo que el login staff; mitigado con límites de intentos y la lista fija de redirect URIs. Se recomienda una contraseña larga para Andrés. Un token del conector filtrado solo abre `/mcp` (lectura y crear mercados), no pagos, cancelaciones ni cambio de contraseña.
- **Inyección de instrucciones:** una nota de clienta podría pedirle a Claude que cree un mercado. Las escrituras son de bajo impacto, claude.ai pide permiso para herramientas que no son de solo lectura y el servidor exige `confirm=true`; no hay herramientas de pagos, cancelación ni borrado.
- **Sin refresh token:** tras 7 días sin uso (o 30 en total) claude.ai pide reconectar. Guía para el dueño: `docs/conector-claude.md`. Prueba tras desplegar, sin contraseña: `scripts/mcp-smoke.sh`.
- **Los códigos OAuth viven en memoria:** un reinicio en medio del login obliga a repetirlo. Funciona porque hay una sola instancia del backend.
- **V19** se probó en una base PostgreSQL nueva y desechable (V1–V19 y flujo completo), no en la base local del dueño, porque la otra sesión prepara V18 allí. Al desplegar va después de V18.
- **Despliegue (no hecho; decisión del dueño: entra en la próxima subida, Claude elige cuándo y lo muestra funcionando):** nginx (`frontend/nginx.conf`) solo envía `/api/` al backend. Hay que añadir `location` para `/mcp`, `/oauth/` y `/.well-known/oauth-`, fijar `MCP_ENABLED=true` y `MCP_PUBLIC_URL=https://artwithgab.com`, y revisar que Cloudflare no bloquee ni guarde en caché esas rutas.
- No se probó con claude.ai real ni en el iPad (necesita el despliegue). Tampoco con PostgreSQL: solo H2 en pruebas.

## Cómo probarlo localmente

```bash
cd awg-tracking && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

```bash
npx @modelcontextprotocol/inspector
```

En el Inspector: transporte «Streamable HTTP», URL `http://localhost:8080/mcp`, «Open Auth Settings» → «Quick OAuth Flow». Se abre el login: `andres@artwithgab.com` / `andres`. Luego «Connect» → «List Tools». El perfil dev ya permite los callbacks del Inspector (`http://localhost:6274/oauth/callback`).

Pruebas: `./mvnw test` (290 en verde; `McpServerApiTests` 19 casos y `McpDisabledApiTests`).

## Auditoría cruzada (2026-11-22)

Gemini 4 Neon (medium, Antigravity) y GLM-5.3 Flash (Vibe), de solo lectura. Informe: `tasks/audit-results/mcp-security-2026-11-22.md`. Lo principal, que señalaron los dos (token del conector válido en toda la API), está corregido con V19.
