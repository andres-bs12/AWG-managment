# Auditoría de seguridad del servidor MCP (2026-11-22)

Revisores de solo lectura, distinta familia que el autor (Claude): **Gemini 4 Neon medium** (Antigravity, diff pegado) y **GLM-5.3 Flash** (Vibe, leyendo los archivos). Cada hallazgo se verificó contra el código.

| # | Hallazgo | Quién | Veredicto | Acción |
|---|---|---|---|---|
| 1 | El token del conector es una sesión staff completa: sirve en `/api/**` (pagos, cancelar, contraseña) | ambos (Neon alta, GLM media) | Real | V19 `staff_session.audience`; `/mcp` solo acepta `mcp` y `/api/**` solo `app`. Prueba `connectorAndAppTokensDoNotCross` |
| 2 | `resource` no queda atado entre authorize y token | Neon | Real (menor) | El código guarda el `resource`; el canje debe nombrarlo. Prueba `codeRequestedForTheResourceMustBeRedeemedForIt` |
| 3 | `state` con `&`/`=` añade parámetros a la redirección | GLM | Real (baja) | Variables de plantilla con codificación completa. Prueba `stateIsFullyEncodedInTheRedirect` |
| 4 | Un login abandonado deja una sesión viva 12 h | GLM | Real (baja) | La sesión se crea al canjear el código, no al hacer login |
| 5 | POST de login desde otro sitio (agotar el límite de intentos, login CSRF) | Neon | Real (baja) | Rechazo por `Origin`/`Sec-Fetch-Site`. Prueba `crossSiteLoginPostsAreRefused` |
| 6 | Rango de temporada sin tope en la vista previa (memoria) | Neon | Real (baja; solo staff) | Máximo 120 días. Prueba `overlongSeasonIsRefusedBeforeAnyWork` |
| 7 | Falta la alerta `login-failed-account` del login normal | Neon | Real | Añadida |
| 8 | `dataUrl` de fotos fuera de la lista de campos ocultos | GLM | Frágil, no explotable hoy | Añadido a la lista |
| 9 | La agenda manda e-mail, teléfono y dirección de todas las clientas | Neon | Minimización razonable | La agenda oculta e-mail y dirección; el teléfono se queda (útil en recogidas). `get_order` sigue completo |
| 10 | `confirm=true` se puede saltar por inyección en notas de clientas | Neon | Riesgo real pero acotado | No se cambia: escrituras de bajo impacto, claude.ai pide permiso para herramientas no de solo lectura; anotado en el memo |
| 11 | `expires_in` dice 12 h pero la sesión se renueva hasta 7 días | GLM | No es de seguridad | Sin cambio |
| 12 | Errores de authorize como página HTML en vez de redirección; sin `iss` (RFC 9207) | GLM | Conformidad, falla en lado seguro | Sin cambio |

Áreas que ambos revisaron sin hallazgos: PKCE, open redirect, XSS, clickjacking, orden de las cadenas de seguridad con el flag encendido o apagado, enumeración de usuarios, fugas en logs y caché.

Verificación tras las correcciones: `./mvnw test` 290 en verde; V19 aplicada en una base PostgreSQL nueva (V1–V19) con el flujo OAuth real, `tools/list` con 9 herramientas y el mismo token rechazado con 401 en `/api/orders/attention`.

## Revisión de Codex (sobre `1ceeb17..436dba6`, pedida por la sesión de despliegue)

| # | Hallazgo | Veredicto | Acción |
|---|---|---|---|
| C1 | Alta: tras un rollback, un backend anterior a V19 ignora `audience` y aceptaría los tokens del conector en `/api/**` | Real | Hash con espacio de nombres `SHA-256("mcp:" + token)`; nota en `docs/deploy.md` para borrar las sesiones `mcp` antes de un rollback. Prueba `connectorTokensAreHashedInTheirOwnNamespace` |
| C2 | Cualquier cuenta staff puede conectar Claude | Real | `MCP_ALLOWED_EMAILS` (vacía = nadie), comprobada al emitir, al canjear y en cada llamada a `/mcp`. Pruebas `onlyAllowedEmailsCanConnect`, `codeForAnAccountNotAllowedCannotBeRedeemed`, `connectorSessionOfAnAccountNotAllowedCannotUseMcp` |
| C3 | Un código de 2 minutos obtenido antes de un cambio de contraseña aún se puede canjear | **Riesgo aceptado** (decisión de la sesión de despliegue): ventana de 2 min, código de un solo uso y ligado a PKCE |
| C4 | `confirm=true` lo envía el cliente; el servidor no tiene prueba de la aprobación del dueño | **Riesgo aceptado**: escrituras de bajo impacto (crear mercado o día), claude.ai pide permiso para herramientas que no son de solo lectura, sin pagos, cancelaciones ni borrados |
| C5 | Secretos en query string de los POST de OAuth terminarían en los logs | Real | 400 si los POST traen query string; nginx registra esas rutas sin query string ni referrer (`log_format oauth_safe`). Prueba `oauthPostsWithAQueryStringAreRefused` |
| C6 | Las consultas normales de pedidos exportan teléfono, e-mail y dirección | Real | Ocultos en todas las herramientas salvo `get_customer_contact` (un pedido, registrado en el log). Prueba `contactDataOnlyComesFromTheContactTool` |
| C7 | `add_market_day` lee los días antes del lock y podría borrar un día añadido en paralelo | Real | Relee y guarda dentro de una transacción con `CalendarService.lockSchedule()` (el mismo lock que usa `saveMarket`) |

## `delete_market_day` (2026-11-22, pedido del dueño)

Revisión rápida con Gemini 4 Neon medium (solo lectura, diff pegado): sin hallazgos en borrado de días no vacíos o de Casa, día equivocado, fugas en los mensajes de error ni anotaciones. Una nota baja (TOCTOU entre la búsqueda y el borrado, sin riesgo porque el servicio vuelve a validar bajo el lock) aplicada igual: la búsqueda y el borrado confirmados corren dentro de la misma transacción con `lockSchedule()`. Pruebas: `deleteMarketDayOnlyDeletesWithConfirm`, `deleteMarketDayWithOrdersIsRefusedByTheApp`, `deleteMarketDayRefusesHomeDaysAndUnknownDates`.

## `list_recent_orders`, `set_painting_hours`, `record_stock_sale` (2026-11-22, pedido del dueño)

Revisión con Gemini 4 Neon medium (solo lectura, diff + métodos de servicio pegados). Sin hallazgos en: transacción única de la venta (sin venta sin pago ni pago sin entrega), doble venta (el servicio marca la pieza vendida con un UPDATE condicional bajo el lock), mercado abierto hoy y no en Casa, importe (precio del servidor, siempre PAID completo, sin reembolsos) y fugas de datos. Aplicado: `open` que no sea booleano da error (antes abría el día; medio), horas validadas en la vista previa y rechazo de horas junto con `open=false`, precio real en la vista previa de la venta y tope de un año para las horas de pintura (bajos). Pruebas: `recentOrdersListsTodaysSalesWithoutContactData`, `paintingHoursArePreviewedThenSavedAndWarnAboutBookingsOutside`, `McpStockSaleApiTests` (2).
