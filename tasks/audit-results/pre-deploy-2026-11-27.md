# Revisión antes de desplegar `main` (2026-11-27)

Alcance: todo lo que va de v3.2.0 (producción) a `main` (PRs #5–#15): tamaños y precios (V21–V22), límite de letras (V20, V23), descuentos (V24), «Sold at», detalle de pedido simplificado y la prueba del fin de semana con dos mercados.

## Seguridad (diff del backend v3.2.0..main, 41 archivos)
- Endpoints nuevos `PATCH /api/orders/{id}/price` y `/market`: solo staff (no están en la lista `permitAll` de `SecurityConfig`). Validan el importe (≥ 0, 2 decimales, nunca mayor que el precio de lista) y rechazan pedidos web (`WEB_ORDER_PRICE`, `WEB_ORDER_MARKET`); el mercado nuevo tiene que estar abierto el día de la venta y no puede ser «Casa».
- Tienda: el precio sigue calculándose en el servidor (`PricingService.itemCost` por tamaño); el tamaño que falta se vende como Big, nunca más barato. Límite de letras del nombre con tope fijo (`BACK_NAME_MAX_LIMIT`) en la validación de entrada.
- Track y MCP solo añaden el tamaño; no exponen datos personales nuevos.
- Migraciones V20–V24 validadas contra PostgreSQL 17 real en CI (`PostgresSchemaTests`), que es lo que tumbó producción el 26 nov.
- Sin hallazgos que bloqueen el despliegue.

## UX (mock, iPad vertical, contra la «Lista de revisión de UI»)
- /buy, New sale, Sales, Stock y Agenda: sin duplicados ni bloques vacíos.
- Observación menor, no bloquea: en /buy el total de abajo muestra 55 € antes de elegir tamaño (usa el precio Big + Post por defecto).
- Tras desplegar, Medium sale «Agotado» hasta que el dueño cuente las bases Medium en Stock (V22 las deja en 0).

## Pruebas
- CI del PR #15: backend (con PostgreSQL), frontend y e2e completos; `main` pasa otra vez el CI completo (workflow_dispatch) antes de `deploy/deploy.sh`, que lo exige.
