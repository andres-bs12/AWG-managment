# Tareas AWG

## Traspaso 2026-11-27 (lo primero)

Contexto y porqué en [AGENTS.md → Estado y siguientes tareas](../AGENTS.md#estado-y-siguientes-tareas).

- [x] **Hecho 27 nov:** «Gaby paints at» = FRANCIS el 27, 28 y 29 en producción (Agenda).
- [x] **Desplegado 27 nov ~02:10:** `main` 72eb858 (V20–V24), CI completo en verde; ver AGENTS.md.
- [x] **Hecho 2026-11-27 · Ventas del 26 nov** (por API del staff, sin tocar stock): AWG93Y5A7 y AWG8R9T2K → «Sold at» → Change → Weihnachtsmarkt Kurpark Baden. AWG93Y5A7 → Change junto al total → 90 €.
- [ ] **Dueño · Desplegar `main`** (PRs #16–#19 y #21 integrados y con CI completo en verde el 27 nov; sin migraciones): fuera del horario de mercado con `deploy/deploy.sh`. Ver AGENTS.md → Estado, paso 4.
- [ ] **Dueño · Stock Medium:** contar y cargar las bases Medium en Stock (empiezan en 0; hasta entonces Medium sale agotado). Revisar también Beige mate Big, que sale agotada.
- [ ] **Dueño · Foto de vista previa para Google:** revisar la propuesta pendiente.
- [ ] **Dueño · Recogida web:** hoy `/buy` no ofrece ningún día de recogida (empieza el 30 nov y del 27 al 29 hay dos mercados). Decidir si se quiere (cambiar `SHOP_DELIVERIES_FROM` o fijar `SHOP_PRIMARY_PICKUP_MARKET_ID`, con redeploy) o esperar a los mercados de diciembre. Ver [revisión](audit-results/customer-forms-2026-11-27.md).
- [ ] **Dueño · Total del paso 1 de `/buy`:** ya suma los 5 € de Post antes de elegir la entrega. ¿Mostrar solo las Kugeln hasta el paso 2?
- [ ] **Agentes · UI:** pasar la «Lista de revisión de UI» de AGENTS.md sobre cada pantalla y captura antes de enseñarla (el dueño corrigió muchos errores simples el 26 nov).

## Pendientes tras v3.2.0 (2026-11-22)

- [ ] **Asesor · Datenschutz:** ¿hay que nombrar a Anthropic? Con el conector MCP, Andrés y Gaby consultan pedidos (nombre, teléfono, dirección) desde claude.ai.
- [ ] **Asesor · Datenschutz:** Brevo añade a los correos un píxel de apertura y enlaces con seguimiento de clics, y no se puede apagar sin plan Enterprise. ¿Hay que mencionarlo o pedir otra solución?
- [ ] **Dueño · Mercados reales:** cargar los mercados del 25–29 nov (nombre, puesto, coste, días y horarios) en Markets o por el conector.
- [ ] **Dueño · Precio del nombre:** en producción está en 5 € (guardado en Stock el 21 nov); cambiarlo allí si no era lo previsto.

- [ ] **Dueño · Correos:** confirmar si habrá recogida el viernes 27 de noviembre, cuando hay mercado.
- [ ] **Dueño y asesor · AGB:** confirmar el plazo publicado de siete días para avisar de un adorno dañado.
- [ ] **Asesor · Datenschutz:** revisar si corresponde mencionar el Data Privacy Framework (DPF) de Cloudflare.
- [ ] **Stripe (siguiente tarea, dueño 2026-11-22):** pasar a claves live y webhook live; la compra con 4242 en modo de pruebas ya se verificó (`AWG5CFZGE`).
- [ ] **Mercados:** decidir si hace falta un campo opcional de dirección para el enlace de Google Maps. Actualmente se busca el nombre del mercado en Viena.
