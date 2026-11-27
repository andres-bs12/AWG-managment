# Revisión de formularios del cliente — 2026-11-27

Pedido del dueño: comprobar que los formularios del cliente siguen funcionando tras los PRs #5–#15 (tamaños, precios, descuentos, «Sold at», fin de semana con dos mercados) y revisar su UX con la «Lista de revisión de UI» de AGENTS.md. Sin pagos reales ni pedidos en producción; sin desplegar.

## Qué se probó

- **E2E en local (mock):** `journey`, `journey-deep`, `form`, `validation`, `track`, `success`, `pickup`, `multi-ornament`, `qr-received`, `persistence` en `desktop` y `mobile`: 137 en verde, 1 omitido (de diseño). Después de los arreglos: `pickup`, `journey`, `persistence`, `sale-discount`, `track` en desktop, mobile e iPad: en verde.
- **Producción en solo lectura** (navegador del dueño, solo GET y consultas sin efecto): `GET /api/shop/config` → tienda abierta, 50/45/35 €, nombre 5 €, envío 5 €, máx. 5 letras. `POST /api/shop/shipping-quote` → Post disponible, recogida de Correos 1 dic, llegada 3–4 dic. `POST /api/shop/pickup-days` → **lista vacía**.
- **Correos:** lectura de `CustomerMailComposer`/`CustomerMailTemplates` y prueba unitaria.
- **Regla de Baden (27–29 nov):** la tienda nunca ofrece recogida el mismo día (pinta siempre en días anteriores) y valida el lugar de pintura en el checkout; la regla del puesto vive en New sale (staff), cubierta por `SplitWeekend*Tests`. El formulario QR no deja elegir recogida. Sin cambios.

## Hallazgos y arreglos (PR de este hilo)

1. **Bug · descuento en correos y Track:** con un descuento del puesto, las líneas del pedido muestran el precio de lista (p. ej. 3 × 35 €) pero el total es lo cobrado (90 €), sin explicar la diferencia. En Track además desaparecía la línea de envío de un pedido por Post con descuento. Arreglo: el correo añade «Rabatt / Discount −15,00 €» (como ya hacía la factura) y `GET /api/track/{code}` devuelve `discount`; `OrderReceipt` lo muestra como línea propia y el envío se calcula sobre el precio de lista. Pruebas: `CustomerMailRulesTests.stallDiscountIsShownSoTheLinesAddUpToTheTotal` y `e2e/sale-discount.spec.ts` (Track tras la venta con descuento).
2. **UX · recogida sin días:** en producción no hay ningún día de recogida web (`SHOP_DELIVERIES_FROM=2026-11-30` y los mercados terminan el 29 nov; además del 27 al 29 hay dos mercados y sin `SHOP_PRIMARY_PICKUP_MARKET_ID` no se ofrece recogida web esos días). Antes, «Abholung am Markt» se podía elegir y llevaba a «Derzeit sind keine Markttage verfügbar.», un callejón sin salida. Arreglo: los días se cargan al entrar en Lieferung y, si no hay ninguno y Post sí es posible, la tarjeta sale desactivada con ese texto (igual que Post cuando ya no llega antes de Navidad). Prueba: `e2e/pickup.spec.ts` («with no market day to offer…»).

## Para decidir (sin cambio de código)

- **Medium agotado en producción:** las 6 filas Medium están a 0 y Beige mate Big también; en `/buy` Medium sale «Ausverkauft». Ya está en el traspaso (contar stock).
- **¿Recogida web en mercado?** Si se quiere recogida web antes del 30 nov o en días con dos mercados, hay que cambiar `SHOP_DELIVERIES_FROM` y/o fijar `SHOP_PRIMARY_PICKUP_MARKET_ID` (necesita redeploy). Si habrá mercados en diciembre, la opción vuelve sola cuando estén cargados.
- **Total del paso 1:** en «Deine Kugel» el total ya suma los 5 € de Post (Post es la opción por defecto) sin decirlo; el cliente ve una Kugel de 50 € y «Gesamt 55 €». Las pruebas lo fijan a propósito, así que no se cambió; propuesta: mostrar solo las Kugeln hasta elegir la entrega.
