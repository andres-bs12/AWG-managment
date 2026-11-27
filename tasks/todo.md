# Tareas AWG

## Traspaso 2026-11-27 (lo primero)

Contexto y porqué en [AGENTS.md → Estado y siguientes tareas](../AGENTS.md#estado-y-siguientes-tareas).

- [ ] **Dueño · Hoy, antes de abrir Baden (14:30):** Agenda → viernes 27, sábado 28 y domingo 29 → «Gaby paints at» = Weihnachtsquartier – FRANCIS. Así Baden no ofrece recogida el mismo día de personalizados y FRANCIS sí. Sin despliegue; por qué en AGENTS.md («Dos mercados con una sola pintora»).
- [ ] **Dueño · PR #14:** aprobar y fusionar en `main` (detalle de pedido simplificado; sin backend ni migraciones; CI en verde).
- [ ] **Dueño · Despliegue:** `deploy/deploy.sh` desde su Mac, fuera del horario del mercado. Un solo despliegue con todo `main` (V20–V24).
- [ ] **Tras desplegar · Ventas del 26 nov:** AWG93Y5A7 y AWG8R9T2K → «Sold at» → Change → Weihnachtsmarkt Kurpark Baden. AWG93Y5A7 → Change junto al total → 90 €.
- [ ] **Dueño · Stock Medium:** contar y cargar las bases Medium en Stock (empiezan en 0).
- [ ] **Dueño · Foto de vista previa para Google:** revisar la propuesta pendiente.
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
