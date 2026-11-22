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
