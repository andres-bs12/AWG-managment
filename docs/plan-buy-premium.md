# Plan: `/buy` premium y reactivo

**Fecha:** 2026-11-05

**Base:**
- Dos investigaciones independientes, en `tasks/ux-research/`:
  - Claude: `premium-claude.md`.
  - Codex: `premium-codex.md` y `name-option-codex.md`.
- Tu feedback.

**Marcas de cada decisión:**
- **(E):** basada en evidencia (Baymard, NN/g, GOV.UK, Material, WCAG).
- **(T):** criterio de diseño, al estilo Apple/Airbnb. Hay que validarla con usuarios.

## La idea en una frase

Que el cliente sienta que **está creando su adorno** y que el pago sea solo el final. El adorno es el protagonista y reacciona a cada elección: color, acabado, foto de su mascota y nombre detrás.

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
| Color | El adorno cambia a rojo, verde o beige | Transición de color de 200 ms |
| Acabado | Brillante: reflejo y un destello que cruza una vez. Mate: superficie plana y suave | 200–300 ms |
| Foto subida | La primera foto aparece en el frente, recortada en círculo con un filtro de pintura suave | Escala 0,9→1 y aparece, 300 ms |
| Nombre detrás | El adorno **gira 180°** y muestra el nombre letra a letra mientras se escribe. Debajo hay un control "Vorne / Hinten" | 450 ms; es la única animación grande |
| Sin foto todavía | Se alternan gato y perro, como ahora | Fundido lento |

- Con varios adornos, cada uno tiene su vista previa y una miniatura en el resumen.
- **Aviso honesto (Codex):** debajo de la vista previa, "Vorschau: Gaby malt dein Tier von Hand" / "Preview: Gaby paints your pet by hand". La foto es una referencia, no el resultado final.
- **Fotos reales:** cuando tengas fotos de los 6 adornos (3 colores × 2 acabados, misma luz y ángulo), reemplazan al dibujo. Es más honesto con el material (Codex). Hasta entonces se usa el SVG.

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
  - Al subir una foto, aparece en el adorno; ese es el momento en que el cliente "entiende" el producto (T).
  - Debajo quedan las miniaturas con el "+".
  - Una sola línea de ayuda: "Ein klares Foto vom Gesicht wirkt am besten".
- **Nombre de la mascota:** se reutiliza como sugerencia del nombre de detrás (E, GOV.UK "no pedir dos veces").
- **Fecha:**
  - Arriba, las **próximas 3 fechas** como tarjetas grandes ("Mi, 2. Dez · abends").
  - Debajo, el calendario que pediste, para ver el mes completo.
  - La primera fecha se resalta, pero no se elige sola (Codex y Claude).
  - No inventamos una franja horaria; se dice "abends".
- **Datos y dirección:**
  - La cuadrícula alineada que ya hicimos.
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

1. **`OrnamentPreview`** en vivo, con color, acabado, foto, giro y nombre. Lo construyo yo y Codex lo revisa.
2. **Pantalla 1 "Diseña tu Kugel":** escritorio a dos columnas y subpasos en el celular. La hace Codex y la reviso yo en el navegador.
3. **Pantalla 2:** tarjetas de fecha más calendario, y los datos.
4. **Pantalla 3 y página de éxito:** confirmación de pago, línea de tiempo, .ics y SEQ.
5. **Medición:** eventos en el servidor y `web-vitals`.
6. **Auditoría cruzada:** UX, accesibilidad y rendimiento a 360 px y escritorio. Luego una prueba guiada contigo como primer usuario.
7. Lo que funcione, se lleva después al formulario del pedido del puesto (`/form`).

## Lo que necesito de ti

- **Fotos reales** de los 6 adornos, con la misma luz y fondo, para la vista previa. Opcional; el dibujo funciona mientras tanto.
- **Una foto de un adorno terminado** para el frente de la tienda, y si es posible una de la parte de atrás con un nombre.
- Que el asesor revise el texto "Vorschau, gemalt von Hand" y la analítica sin cookies.
