# Plan: `/buy` premium y reactivo

**Fecha:** 2026-11-05

**Decisiones del dueño (2026-11-05):** las fotos subidas son referencias y nunca se colocan sobre el adorno. El frente alterna nuestros retratos ilustrados (`PetFaces.tsx`, `PetOrnamentMini.tsx`), incluso después de subir fotos. El estilo actual del adorno está aprobado; no hace falta imitar exactamente el producto real. La interacción debe sentirse premium y reactiva, al estilo Apple/Airbnb (T).

**Base:**
- Dos investigaciones independientes, en `tasks/ux-research/`:
  - Claude: `premium-claude.md`.
  - Codex: `premium-codex.md` y `name-option-codex.md`.
- Tu feedback.

**Marcas de cada decisión:**
- **(E):** basada en evidencia (Baymard, NN/g, GOV.UK, Material, WCAG).
- **(T):** criterio de diseño, al estilo Apple/Airbnb. Hay que validarla con usuarios.

## La idea en una frase

Que el cliente sienta que **está creando su adorno** y que el pago sea solo el final. El adorno es el protagonista y reacciona a cada elección: color, acabado y nombre detrás; el frente muestra ilustraciones de gato y perro.

## 1. Estructura: de 5 pasos a 3 pantallas, más Stripe

| Pantalla | Qué contiene | En el celular |
|---|---|---|
| **1. Diseña tu Kugel** | Color, acabado, foto(s) y nombre de la mascota, nombre detrás (opcional) | Una decisión por subpaso, con la vista previa fija arriba (GOV.UK "una cosa por página", E) |
| **2. Lieferung** | Fecha de entrega, contacto y dirección | Fecha primero, luego datos |
| **3. Prüfen & bezahlen** | Resumen con el adorno renderizado, enlaces "Ändern" y botón de pago | Igual |

**Por qué:** Baymard mide que lo que cansa es la cantidad de campos y su esfuerzo, no el número de pasos (E). Juntar lo que se decide junto reduce la sensación de trámite (T). Codex prefería mantener 5 etapas; la diferencia se resuelve con subpasos en el celular, que conservan "una decisión a la vez".

En escritorio son dos columnas:
- a la izquierda, el adorno grande y fijo;
- a la derecha, las opciones;
- abajo, el resumen con el precio siempre visible (T, Apple/Airbnb).

## 2. El adorno en vivo (`OrnamentPreview`), la pieza central

Es un solo componente SVG que reacciona a todo:

| Elección | Qué cambia | Animación |
|---|---|---|
| Color | El adorno cambia a rojo, verde o beige | Fundido de 200 ms entre capas |
| Acabado | Brillante: reflejo y un destello que cruza una vez. Mate: superficie plana y suave | 200–300 ms |
| Foto subida | Permanece como miniatura de referencia junto al mosaico «+»; nunca aparece sobre el adorno | Aparece en la galería |
| Nombre detrás | El adorno **gira 180°** y muestra el nombre letra a letra mientras se escribe. Debajo hay un control "Vorne / Hinten" | 450 ms; es la única animación grande |
| Frente | Se alternan los retratos ilustrados de gato y perro, haya o no fotos | Fundido lento |

- Con varios adornos, cada uno tiene su vista previa y una miniatura en el resumen.
- **Aviso honesto (Codex):** debajo de la vista previa, "Vorschau: Gaby malt dein Tier von Hand" / "Preview: Gaby paints your pet by hand". La foto es una referencia, no el resultado final.
- **Estilo:** el dibujo actual es suficiente; no tiene que reproducir exactamente el producto real.

## 3. Movimiento y respuesta (sensación premium)

- **Duraciones:** 100 ms (presionar), 200 ms (cambios), 300 ms (aparecer) y 450 ms solo para el giro. Nada pasa de 500 ms (E, NN/g y Material 3).
- **Curvas:**
  - entradas que desaceleran: `cubic-bezier(.05,.7,.1,1)`;
  - salidas más cortas: `cubic-bezier(.3,0,.8,.15)`.
- **Respuesta inmediata:** el precio, el total y la vista previa se actualizan al instante con cada clic. El total "cuenta" hasta el número nuevo.
- **Movimiento reducido:** con `prefers-reduced-motion` todo se vuelve un fundido de 150 ms o menos, sin balanceo (E, WCAG).
- **Rendimiento:** solo se animan `transform` y `opacity`. Objetivo: INP ≤ 200 ms en celulares (E, web.dev).

## 4. Cada parte

- **Fotos:**
  - Las fotos son referencias para Gaby y quedan en miniaturas con un mosaico «+»; no se colocan sobre el adorno para evitar confundirlas con el resultado.
  - Una sola línea de ayuda: "Ein klares Foto vom Gesicht wirkt am besten".
- **Nombre de la mascota:** se reutiliza como sugerencia del nombre de detrás (E, GOV.UK "no pedir dos veces").
- **Fecha:**
  - Arriba, las **próximas 3 fechas** como tarjetas grandes ("Mi, 2. Dez · abends").
  - Debajo, el calendario que pediste, para ver el mes completo.
  - La primera fecha se resalta, pero no se elige sola (Codex y Claude).
  - No inventamos una franja horaria; se dice "abends".
- **Datos y dirección:**
  - Una columna; solo PLZ y ciudad comparten fila, según las reglas de formulario de `docs/sprint6-buy-ux.md`.
  - Validación al salir del campo, que se limpia mientras escribes.
  - Los campos correctos muestran un check discreto (E, Baymard).
- **Resumen y pago:**
  - Cada adorno con su render pequeño, enlaces "Ändern" que llevan al subpaso exacto, total claro y una línea "Sicher bezahlen mit Stripe".
  - Botón "Zahlungspflichtig bestellen · € X".
  - El e-mail se pasa a Stripe (`customer_email`).
- **Después de pagar:**
  - Pantalla "Zahlung wird bestätigt…" hasta que el servidor confirma. No damos por hecho el pago solo porque Stripe redirigió (Codex).
  - Después: render del adorno, línea de tiempo "Bezahlt → Wird gemalt → Lieferung", código, enlace a Track y descarga para el calendario (.ics).
- **Si cancela en Stripe:** "Es wurde nichts abgebucht" y el diseño sigue guardado.

## 5. Cómo medimos que funciona

| Qué | Cómo | Meta inicial (se ajusta a las 2 semanas) |
|---|---|---|
| Embudo | Eventos sin datos personales: `buy_view`, `buy_step`, `buy_choice`, `buy_photo_added`, `buy_validation_error` (solo campo y código), `buy_pay_click`; `buy_paid` lo envía el servidor desde el webhook | ≥ 35 % de las visitas llegan a pagar; ≥ 80 % de esas pagan |
| Fricción | Errores por campo | Menos de 0,3 errores por pedido; ningún campo por encima del 10 % |
| Rapidez | `web-vitals` en el navegador | INP ≤ 200 ms, LCP ≤ 2,5 s, CLS ≤ 0,1 en celulares |
| Facilidad | Pregunta SEQ en la página de éxito: "¿Qué tan fácil fue?", de 1 a 7 | Media ≥ 6 |
| Pruebas con personas | 2 rondas de 5 personas (alemán e inglés, en celular, al menos una con teclado o lector de pantalla) | 4 de 5 terminan sin ayuda |

**Herramienta:**
- Primero, conteos en nuestro propio servidor, sin cookies.
- Después, si hace falta, Plausible o Umami (UE, sin cookies).
- Codex aclara que en Austria "sin cookies" no significa automáticamente "sin aviso de consentimiento". Va a la lista del asesor legal.
- Nunca enviamos nombres, direcciones, fotos ni textos escritos.

## 6. Orden de trabajo propuesto

1. **`OrnamentPreview`** en vivo, con color, acabado, retratos ilustrados, giro y nombre. Lo construyo yo y Codex lo revisa.
2. **Pantalla 1 "Diseña tu Kugel":** escritorio a dos columnas y subpasos en el celular. La hace Codex y la reviso yo en el navegador.
3. **Pantalla 2:** tarjetas de fecha más calendario, y los datos.
4. **Pantalla 3 y página de éxito:** confirmación de pago, línea de tiempo, .ics y SEQ.
5. **Medición:** eventos en el servidor y `web-vitals`.
6. **Auditoría cruzada:** UX, accesibilidad y rendimiento a 360 px y escritorio. Luego una prueba guiada contigo como primer usuario.
7. Lo que funcione, se lleva después al formulario del pedido del puesto (`/form`).

## Lo que necesito de ti

- **Una foto de un adorno terminado** para el frente de la tienda, y si es posible una de la parte de atrás con un nombre.
- Que el asesor revise el texto "Vorschau, gemalt von Hand" y la analítica sin cookies.

## Más reactividad

- Cada elección debe responder de inmediato y mantener el contexto del cliente, con la claridad y fluidez de un configurador Apple/Airbnb (T).
- El precio cuenta hasta el nuevo total; al pulsar hay respuesta visual de 100 ms.
- Al pasar el puntero o enfocar color y acabado, el adorno los previsualiza antes de seleccionarlos; al salir recupera la elección guardada. En pantalla táctil, elegir responde de inmediato sin depender de hover.
- La línea del resumen resalta lo que acaba de cambiar; los campos válidos muestran un check discreto al perder el foco.
- Al añadir otra Kugel, entra deslizándose; mientras cargan fechas se ven esqueletos y una barra indica el progreso entre pasos.
- Las entradas de paneles con texto mantienen opacidad completa durante todo el movimiento: las ayudas y los contadores deben conservar contraste ≥ 4,5:1 desde el primer fotograma. No retrasar axe para ocultar un contraste insuficiente durante la entrada.
- Mantener solo animaciones de `transform` y `opacity`. Con movimiento reducido, cambios instantáneos o fundidos de hasta 150 ms, sin giros, deslizamientos ni contador animado; la selección y el total siguen siendo inmediatos.
- Las fotos subidas permanecen en miniaturas de referencia junto al mosaico «+»; el adorno alterna los retratos ilustrados de gato y perro, sin presentar la foto como resultado.
- Comprobar a 360 px y en escritorio, con teclado y toque: ninguna respuesta pierde foco, borra respuestas ni tapa el control activo. Algunas mejoras ya están implementadas; su comportamiento y calidad visual siguen pendientes de validación en navegador.
- Al recorrer los enlaces de cabecera y pie con Tab o Shift+Tab, mantener el control y su anillo completos dentro del contenedor público desplazable, con margen también en los bordes. La protección de foco no termina al salir del formulario.
- Antes de abrir Stripe, volver a consultar las fechas. Si el día elegido se agota, explicar el cambio, enfocar el calendario con alternativas y conservar diseño, fotos, notas, contacto, dirección y aceptación de condiciones. Una consulta fallida permite reintentar sin crear un checkout.
- Las tres pantallas participan en el historial del navegador: Atrás/Adelante y «Zurück» conservan las respuestas y las fotos de la sesión. El historial solo guarda el número de pantalla; al recargar se vuelve al diseño para volver a añadir las fotos, manteniendo los campos de texto.
- Medir la respuesta desde el evento de clic con `performance.now`, sin incluir el desplazamiento ni la comunicación con Playwright: mediana de cinco clics < 100 ms. Cambiar color o acabado no modifica el precio; comprobar que el total sigue correcto y medir también cinco cambios de la opción de nombre, que sí añade/quita 12,99 €. El inicio del cambio de precio y su valor accesible deben ser inmediatos; el contador puede terminar después.

## Cómo probamos que el UX funciona

- Automatizar recorridos completos, incluidos varios adornos, validación, recarga y checkout simulado; ejecutar axe en las pantallas.
- Comparar visualmente 360, 768 y 1280 px y medir INP en móvil con presupuesto ≤ 200 ms.
- Prueba moderada con 5 personas: pedir que configuren y completen un pedido sin ayuda, observar errores y tiempo, y preguntar SEQ de 1 a 7 tras cada tarea. Repetir tras corregir problemas.
- Medir el embudo descrito arriba, abandonos por paso y errores por campo, sin datos personales. La instrumentación inicial existe; su validación en navegador y las mediciones con usuarios siguen pendientes.
- `frontend/e2e/success.spec.ts` cubre la espera de pago hasta que Track confirma, el límite de 60 segundos (también con una petición bloqueada), código/copia/enlace, contenido del .ics, SEQ de 6 con un único evento, cancelación conservando el diseño y privacidad durante todo el recorrido. Usa rutas HTTP interceptadas y eventos observables del mock; no se omiten casos por usar el mock.
- `frontend/e2e/keyboard-availability.spec.ts`: recorrido completo de escritorio sin ratón hasta el botón de pago (selector de fotos abierto con Enter), Tab y Shift+Tab con anillo comprobado mediante estilos calculados, controles sin recorte ni solapamiento, flechas en radios, Space en opciones y Enter en calendario. A 360/768/1280 px comprueba subpasos ocultos, notas plegadas, agotados y recuperación de una fecha perdida en DE/EN; también contempla un fallo de red al volver a consultar. Usa los helpers existentes y el adaptador HTTP real con `page.route` para la disponibilidad; el stock de prueba se configura por la API mock. Sin esperas fijas ni cambios en otros specs; pendiente de ejecución externa.
- `frontend/e2e/journey-deep.spec.ts` (Task 5C): siete casos completos por escrito. Pedido de una Kugel con nombre en DE y tras cambiar a EN; payload multipart exacto, foto y total calculado; dos diseños independientes y retirada; giro/nombre/precio al activar y desactivar; latencia; historial entre las tres pantallas; recarga desde entrega con recuperación de texto y aviso para volver a añadir fotos. Incluido en los cuatro proyectos, también movimiento reducido. La latencia también se incluye en móvil: el reloj comienza en el clic del documento, después de la demora del driver o de emulación táctil, y adjunta las muestras. No se omite ningún caso. Sin ejecutar Playwright aquí ni modificar otros specs.
- Claude ejecuta Playwright después, fuera del sandbox, y revisa los resultados. Escribir la suite y pasar build/lint no equivale a haber validado estos recorridos en navegador.
