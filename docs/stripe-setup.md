# Activar Stripe (tienda web) — guía paso a paso

Stripe solo se usa en la tienda web `/buy` (entregas en Viena). En el puesto no se cobra con la app.
Tiempo estimado: 20–30 minutos. Todo se hace primero en **modo de prueba** (claves `sk_test_…`); no se mueve dinero real.

## 1. Cuenta y claves de prueba
1. Crea o entra en tu cuenta en https://dashboard.stripe.com y deja activado **Test mode** (interruptor arriba a la derecha).
2. *Developers → API keys*: copia la **Secret key** (`sk_test_…`). No la pegues en ningún archivo del repositorio ni en el chat.
3. *Settings → Payment methods*: deja activada **Cards** (la app pide solo tarjeta; Apple Pay y Google Pay van incluidos como tarjeta).
4. *Settings → Emails*: activa **Successful payments** para que Stripe le mande el recibo al cliente.
5. *Settings → Branding*: pon el logo y los colores de ArtWithGab (se ven en la página de pago).

## 2. Probar en tu Mac (sin desplegar)
1. La CLI de Stripe ya está instalada en tu Mac (`stripe version` → 1.55.8). Solo falta `stripe login`: abre el navegador para enlazarla con tu cuenta.
2. Ejecuta, en una terminal, desde la raíz del repositorio:
   ```bash
   STRIPE_SECRET_KEY=sk_test_xxx ./scripts/stripe-dev.sh
   ```
   El script abre el reenvío de webhooks de Stripe a tu backend local, toma el `whsec_…` temporal y arranca el backend con la tienda activada.
3. En otra terminal: `cd frontend && VITE_DATA_SOURCE=http npm run dev -- --port 5174` y abre http://localhost:5174/buy.
4. Haz un pedido y paga con la tarjeta de prueba `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC.
5. Comprueba:
   - Vuelves a `/buy/thanks`.
   - En la terminal del script aparece `checkout.session.completed` con respuesta `200`.
   - El pedido sale en Agenda y en Entregas como pagado con tarjeta.
6. Prueba también la cancelación: empieza un pago y pulsa "atrás" en Stripe. Tienes que volver a `/buy` con el aviso de que no se cobró nada. El pedido pendiente se libera solo cuando la sesión caduca (30 minutos).

## 3. Producción (cuando haya dominio)
1. En Stripe, *Developers → Webhooks → Add endpoint*:
   - URL: `https://<tu-dominio>/api/shop/stripe/webhook`
   - Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
   - Copia el **Signing secret** (`whsec_…`).
2. En el servidor (`.env`, ver `docs/deploy.md`):
   ```
   SHOP_ENABLED=true
   STRIPE_SECRET_KEY=sk_test_…   (cuando todo funcione: sk_live_… y su whsec de modo live)
   STRIPE_WEBHOOK_SECRET=whsec_…
   PUBLIC_BASE_URL=https://<tu-dominio>
   ```
3. Repite la prueba del paso 2 contra el dominio real. Después cambia a **live**: activa la cuenta (datos de la empresa y cuenta bancaria), crea el webhook también en modo live y cambia las dos claves.

## Qué hace la app con Stripe
- El servidor calcula el precio. El navegador no puede cambiarlo.
- Crea una sesión de Stripe Checkout (solo tarjeta) que caduca a los ~32 minutos.
- Mientras se paga, el pedido queda `PENDING`: ocupa horas de pintura y stock, pero no aparece en Agenda ni en Entregas.
- El webhook va firmado y se verifica (HMAC-SHA256, tolerancia de 5 minutos). Cuando el importe y la moneda coinciden, el pedido pasa a `PAID`/tarjeta y aparece en Agenda y Entregas.
- `expired` o `async_payment_failed` liberan el pedido (horas, stock y fotos). Cada 5 minutos, un job consulta a Stripe por si algún webhook se perdió.
- Reembolsos: se hacen a mano en el panel de Stripe (*Payments → Refund*). Después, cancela el pedido en la app (detalle del pedido → *Cancel order*).
