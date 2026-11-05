# Validación de UX de /buy y /form

## Estado y ejecución

**Fix e-4: preparación de referencias terminada; comparación de navegador pendiente (2026-11-05).** Claude informó **378 aprobados, 3 fallidos y 2 omitidos de 383**. Se inspeccionaron las tres `trace.zip` actuales en `frontend/test-results/`: cada una registra exclusivamente tres errores «A snapshot doesn't exist … writing actual» para design/delivery/review de su proyecto (mobile/tablet/desktop). No registran diferencias de píxeles, fallos funcionales ni de axe. El fallo de foco de fotos de e-3 ya no aparece en el resultado externo comunicado.

Las nueve referencias en `frontend/e2e/a11y-visual.spec.ts-snapshots/` **ya se regeneraron durante esa ejecución**. Se revisaron visualmente las nueve imágenes y se verificó que cada PNG coincide byte a byte con su `*-actual.png`. Se conservan: no son referencias obsoletas; borrarlas repetiría los mismos tres fallos de inicialización. No se copió ni sustituyó ninguna imagen, ni se cambió código de la aplicación, selectores, tolerancias o checks de accesibilidad.

**Siguiente paso de Claude:** desde `frontend/`, ejecutar `npx playwright test` normalmente, conservando estos nueve PNG, sin `--update-snapshots`. Si aparece una diferencia nueva, revisar su traza y sus imágenes antes de decidir si corresponde a una regresión o a otro cambio intencional. No hay todavía evidencia de una comparación normal aprobada con estas referencias presentes.

Límite de la revisión visual: los PNG miden 360×740, 768×1024 y 1280×900. El scroll pertenece al contenedor público, así que `fullPage` no muestra todo el contenido desplazable. La vista móvil de entrega deja buena parte del calendario/contacto fuera del encuadre; las revisiones tampoco cubren todos los totales/condiciones inferiores y muestran espacio vertical amplio en la tarjeta del adorno. Conservar estas referencias sirve para detectar cambios, no cierra los hallazgos visuales pendientes ni certifica reflow, zoom o foco durante el scroll. Revisar esos puntos en navegador; mantener axe íntegro.

Verificación local de e-4: `npm run build`, `npm run lint` (advertencias existentes; 26 módulos de contratos CSS staff aprobados) y `node --test tests/*.test.mjs` (**23/23**) pasan. Persiste la advertencia PostCSS sobre `from`. Sin Playwright ni commits. Los seguimientos siguientes son históricos; e-4 sustituye sus instrucciones de regenerar/borrar referencias para esta versión.

## Historial de validaciones anteriores

**Fix e-3: implementación terminada; validación de navegador pendiente (2026-11-05).** El dueño comunicó la ejecución de Claude: **377 aprobados, 4 fallidos, 2 omitidos de 383**. Se inspeccionaron las cuatro `trace.zip` locales: los tres casos de `a11y-visual.spec.ts` contienen únicamente los nueve errores de referencia ausente (design/delivery/review × mobile/tablet/desktop); el caso desktop `form.spec.ts` falla en `toBeFocused` del contador tras alcanzar seis fotos. No hay otro fallo registrado en esas cuatro trazas. Este resultado precede al fix y no valida el código modificado.

`PhotoTiles` compartido por `/buy` y `/form` sustituye la restauración mediante `requestAnimationFrame` por una petición de foco consumida en `useLayoutEffect`, tras actualizar los nodos. Así no intenta enfocar el botón añadir justo antes de retirarlo al alcanzar seis fotos. Las refs locales apuntan al botón o al contador montado; al eliminar una foto se enfoca el botón que vuelve a aparecer. El E2E conserva las aserciones de foco, errores, límite, axe y overflow, y añade conservación de la foto válida tras el fallo parcial y quitar/reponer la sexta foto. No se cambiaron tolerancias visuales ni accesibilidad.

Se eliminaron los nueve PNG en `frontend/e2e/a11y-visual.spec.ts-snapshots/` por instrucción expresa del dueño. Las trazas y `*-actual.png` se conservan como evidencia; no se copiaron como referencias ni se aceptaron automáticamente. **Siguiente paso de Claude**, desde `frontend/`: ejecutar `npx playwright test`, revisar los nueve candidatos regenerados y el caso de fotos en todos los proyectos, conservar las referencias aprobadas y repetir la comparación normal sin volver a borrarlas. La primera ejecución sin referencias puede registrar los tres fallos visuales de inicialización; no implica por sí sola una regresión de la aplicación. Revisar además el contenido desplazable, teclado/toque y el calendario móvil junto a la barra. Mantener axe íntegro.

Verificación local: `npm run build`, `npm run lint` (advertencias existentes) y `node --test tests/*.test.mjs` (**23/23**) pasan. Sin Playwright ni commits. El build conserva la advertencia del plugin PostCSS sobre `from`. Los resultados y las instrucciones de snapshots que siguen son **históricos** y quedan sustituidos por este seguimiento cuando entren en conflicto.

**Fix b-2: incompleto.** Claude comunicó 190/193. Las trazas de tablet y escritorio registran referencias ausentes; la traza móvil también registra una infracción axe `target-size`: la barra de acciones tapa parcialmente los radios del 9 y 11 de diciembre. Este problema sigue pendiente y no debe ocultarse ni desactivar axe. Por instrucción del dueño se eliminaron los siete PNG presentes; los otros dos ya faltaban. Claude debe regenerar y revisar las nueve imágenes y repetir la suite tras corregir el solapamiento. No se ejecutó Playwright aquí. Las indicaciones anteriores de conservar referencias son históricas.

**Task 8 (estado actual): implementación terminada, navegador sin verificar.** El formulario QR comparte ahora los componentes de `/buy`; esto cambia intencionalmente shell, progreso y mosaicos. La nueva `e2e/form.spec.ts` añade 11 casos × cuatro proyectos (44 ejecuciones; total previsto 193). DE/EN, axe por pantalla, validación, fotos, recarga, caducidad, teclado y varios adornos; detalles y comandos en [handoff Task 8](task8-form-handoff.md). Build/lint y 15 pruebas Node pasan; el chequeo TS adicional solo informa del conflicto previo en `helpers.ts:45`. No se ha ejecutado Playwright ni se han tocado las nueve referencias. Claude debe repetir la suite normalmente, inspeccionar las diferencias visuales previstas y decidir con evidencia antes de actualizar referencias. Los resultados de Fix a-3 que siguen son históricos y no validan este código.


Fix a-3: **referencias preparadas; comparación en navegador pendiente**. La última ejecución externa comunicada por Claude obtuvo **146 aciertos y 3 fallos de 149**. Se leyeron las tres trazas locales: cada una contiene solo los tres errores de referencia ausente de `a11y-visual.spec.ts` (design, delivery y review); no registran otro fallo funcional ni de axe. No se ejecutó Playwright aquí por instrucción del dueño. Desde `frontend/`, Claude debe repetir la suite normalmente, con las dependencias instaladas y Chromium de Playwright disponible:

```sh
npx playwright test
# Solo un proyecto o prueba:
npx playwright test --project=mobile
npx playwright test --grep 'validation'
```

La configuración inicia Vite en el puerto 5199 con `VITE_DATA_SOURCE=mock` y no reutiliza servidores. La fecha se fija en noviembre de 2026 para que la temporada y las fechas del mock no dependan del día de ejecución. Hay proyectos de 360 × 740, 768 × 1024 y 1280 × 900, más uno de movimiento reducido. Los fallos guardan captura y traza; `npx playwright show-report` abre el informe cuando el reporter lo genera.

Las comparaciones visuales necesitan imágenes de referencia: la primera ejecución sin ellas falla y escribe capturas candidatas. En Fix a-3 ya están presentes las nueve referencias recién generadas en `frontend/e2e/a11y-visual.spec.ts-snapshots/`: `design`, `delivery` y `review` para `mobile`, `tablet` y `desktop`, con sufijo `-darwin.png`. Se inspeccionaron las nueve y se comprobó que cada archivo coincide byte a byte con su `*-actual.png` de `frontend/test-results/`. Se conservan estas referencias actuales; las antiguas ya se retiraron en Fix a-2. Borrarlas de nuevo repetiría el mismo fallo de inicialización. No se cambiaron app, selectores, checks axe ni tolerancias de comparación. No usar `--update-snapshots` para ocultar diferencias en la siguiente ejecución. Las fuentes, el SO y la versión de Chromium afectan las imágenes: comparar en el mismo entorno.

Límite de la revisión de imágenes: aunque el test solicita `fullPage`, el scroll pertenece al contenedor público; los PNG disponibles miden exactamente 360×740, 768×1024 y 1280×900. Solo muestran la porción visible de cada pantalla. No certifican el calendario/contacto completo en móvil ni las condiciones/totales inferiores de revisión. La captura móvil de revisión también muestra enlaces largos partidos entre líneas; conservar una referencia para detectar regresiones no cierra la auditoría de reflow/zoom ni aprueba toda la calidad visual. Claude debe revisar el contenido desplazable y las filas móviles además de repetir la comparación. Las filas pendientes de `docs/design-system-audit.md` permanecen abiertas.

Verificación local de Fix a-3: `npm run build`, `npm run lint` (advertencias existentes) y `node --test tests/*.test.mjs` (12/12) pasan. Sin commits. No hay aún un resultado de 149/149.

Los resultados anteriores de 49 y 122 casos son históricos; el seguimiento actual es el de 149 casos indicado arriba. Que las capturas automatizadas pasen no sustituye la revisión visual de sus referencias.

## Cobertura y límites

Los archivos comparten `helpers.ts` y se ejecutan en las tres resoluciones salvo `reduced-motion.spec.ts`. `journey-deep.spec.ts` se incluye además en el proyecto de movimiento reducido:

- `journey.spec.ts`: recorrido DE/EN y payload mock de un adorno; elecciones independientes de dos adornos.
- `journey-deep.spec.ts` (Task 5C): siete casos implementados, sin fallos en la última ejecución externa comunicada. Checkout DE y cambio visible a EN con un adorno y nombre; payload multipart entero, bytes de la foto, contacto, dirección, fecha y total del botón calculado desde la configuración. Dos adornos con color/acabado/nombres distintos, sus previews y retirada con recálculo. Opción de nombre (+12,99 €), caso escrito conservado en el input y nombre con inicial mayúscula en el reverso, giro y Vorne/Hinten, valor conservado al apagar/encender. Atrás/Adelante del navegador y Zurück por las tres pantallas, conservando fotos, nota, fecha, contacto, dirección y condiciones. Recarga desde entrega que vuelve al diseño, restaura texto, exige volver a añadir fotos y conserva la fecha. Stock preparado por `api.inventory` del mock; disponibilidad y checkout usan el adaptador HTTP real con `page.route`. Sin hooks nuevos ni modificaciones de los otros specs.
- `validation.spec.ts`: foco y errores, postcódigos, selección agotada y límites de fotos.
- `persistence.spec.ts`: nombre y precio, recarga y edición desde la revisión.
- `keyboard.spec.ts`: comprobación inicial de radios, foco y navegación por teclado; no cubre todavía el recorrido completo.
- `keyboard-availability.spec.ts` (Task 5B): siete casos implementados; sin fallos en la última ejecución externa comunicada (146/149). Recorrido de escritorio sin ratón hasta el botón de pago; Tab/Shift+Tab con estilos calculados de foco, geometría, recorte y solapamiento; subpasos/notas ocultos fuera del orden de Tab; fecha agotada antes del pago y opciones de color/acabado agotadas en DE/EN; fallo de red al reconsultar sin crear checkout. El recorrido de escritorio fija 1280 × 900; los demás conservan los tamaños de cada proyecto. La disponibilidad usa el adaptador HTTP real con `page.route`; el stock se prepara mediante `api.inventory` del mock. No modifica otros specs ni necesita hooks de producción. Fotos, notas, diseño, dirección y condiciones deben conservarse al volver al calendario.
- `a11y-visual.spec.ts`: axe en pantallas y algunos errores, capturas de las tres pantallas y desbordamiento móvil.
- `layout.spec.ts`: etiquetas, espacio de campos, alineación PLZ/ciudad y controles visibles en entrega.
- `success.spec.ts`: nueve casos escritos para confirmación `unpaid` → `paid`, código/copia/enlace Track, límite de 60 segundos con Track sin pagar o bloqueado, contenido del .ics, SEQ único de 6 por HTTP y mock, cancelación con diseño guardado y privacidad durante un recorrido completo por ambos transportes. Usan `helpers.ts`, rutas interceptadas, aserciones con reintento y reloj virtual; sin esperas fijas. Sin fallos en la última ejecución externa comunicada a 360/768/1280 px.
- `reduced-motion.spec.ts`: busca animaciones transform activas bajo movimiento reducido.

El resultado externo comunicado es **146/149; solo fallan los tres casos visuales por referencias ausentes al iniciar la ejecución**. No se ejecuta Playwright aquí por instrucción del dueño. Claude debe repetir la suite completa fuera del sandbox y revisar los resultados de los tres tamaños y movimiento reducido, además de las referencias visuales. En Fix a-3 no se editaron los specs ni la aplicación. Siguen pendientes ampliar axe a todos los errores y medir el rendimiento completo en todas las pantallas. Estas pruebas tampoco validan Stripe real, webhook ni transporte multipart HTTP contra un backend real.

La latencia de 5C se mide dentro del navegador con `performance.now` desde el evento de clic hasta el estado seleccionado, el `aria-label` esperado y el precio correcto. El color no tiene sobreprecio: se comprueba su precio estable y se mide aparte el primer cambio visible del precio al alternar el nombre. Cada medición usa cinco muestras, exige mediana < 100 ms y adjunta `configuration-latency.json`; no es una medición de INP. El hover previo y el tiempo de comunicación con Playwright quedan fuera. Los siete casos se incluyen en los cuatro proyectos, sin omisiones. El reloj comienza en el clic del documento, por lo que no incluye la demora del driver ni de emulación táctil; no se presupone que móvil vaya a ser inestable sin ejecutarlo. No hay esperas fijas.

En Task 5A pasan `npm run build` y `npm run lint` (con advertencias existentes). La comprobación TypeScript adicional de `success.spec.ts` encuentra un conflicto previo en `helpers.ts:45`: `@playwright/test` usa Playwright 1.49.1 y axe resuelve `playwright-core` 1.64.1, con tipos `Page` incompatibles. No se cambiaron dependencias ni el helper. El build normal no incluye `e2e/`; su resultado no sustituye esta comprobación ni la ejecución del navegador.

En Task 5B pasan `npm run build` y `npm run lint` (advertencias existentes). La comprobación TypeScript vuelve a encontrar únicamente ese conflicto en `helpers.ts:45`; no informa de errores en el spec nuevo. No se han cambiado dependencias para ocultarlo. Las correcciones de app añaden una consulta real de fechas antes del checkout, mensaje DE/EN con regreso al calendario, radios con área completa e indicador de foco, Enter que confirma el día sin enviar el formulario y foco al cambiar de subpaso móvil. El botón de fotos conserva el foco mientras lee; `aria-disabled` y una guarda impiden abrir otra carga durante ese estado. Claude debe verificar estos comportamientos en navegador.

En Task 5C pasan `npm run build` y `npm run lint` (advertencias existentes). La comprobación TypeScript adicional del spec solo encuentra el conflicto previo en `helpers.ts:45`; no informa de errores en `journey-deep.spec.ts`. Se corrigió la navegación que solo vivía en estado React: las tres pantallas ahora usan historial del router sin guardar datos personales allí ni desmontar el formulario. Recargar conserva el comportamiento de volver al diseño para reañadir fotos. Queda pendiente verificar en navegador tanto la suite como esta corrección; no se ha contactado Stripe.

Para probar Track con respuestas controladas, los casos de éxito sustituyen únicamente `api.tracking.getByCode` por el adaptador HTTP real y navegan por el router; `page.route` intercepta `/api/track/{code}`. El resto del flujo conserva el mock predeterminado. Las pruebas de privacidad observan todas las peticiones de métricas y el array `window.__awgMetrics` del mock, incluso al recargar tras checkout; comprueban nombres de evento permitidos, campos y ausencia de textos personales. La variante HTTP usa el adaptador real de métricas con POST interceptados. No contactan Stripe ni un backend real.

## Prueba moderada con cinco personas

Reclutar cinco participantes que usen teléfonos, incluyendo hablantes de alemán y de inglés; registrar idioma, dispositivo y tamaño de pantalla sin datos personales innecesarios. No usar empleados que conozcan el flujo como sustitutos de clientes. Preparar una foto de prueba y un entorno sin pagos reales.

Leer: «Queremos evaluar la web, no a ti. Piensa en voz alta: dime qué esperas que pase, qué buscas y qué te resulta confuso. No te ayudaré salvo que quedes bloqueado; puedes parar cuando quieras». Evitar explicar los controles o el resultado esperado.

Tareas: (1) configurar un adorno para una mascota y añadir una foto; (2) elegir nombre detrás, comprobar precio y cambiar de decisión; (3) añadir un segundo adorno diferente; (4) seleccionar fecha y dirección de Viena, revisar y llegar al pago simulado; (5) volver a editar un dato y recuperar el progreso tras recargar. Tras cada tarea preguntar SEQ: «En una escala de 1 a 7, ¿qué tan fácil fue esta tarea? 1 = muy difícil, 7 = muy fácil». Anotar también por qué eligió ese número, sin sugerir respuestas.

Criterio: al menos **4 de 5** completan cada tarea sin ayuda; registrar tiempo, éxito, errores, retrocesos, bloqueos, solicitudes de ayuda, SEQ y citas textuales con un identificador anónimo. Pedir consentimiento antes de grabar pantalla o voz, guardar el material con acceso limitado y una fecha de eliminación. Priorizar problemas por gravedad y frecuencia, corregir y repetir la prueba; no extrapolar porcentajes poblacionales de cinco personas.

## Embudo y objetivos

Con staff autenticado, consultar `GET /api/metrics/buy?from=2026-11-01&to=2026-11-30` con fechas inclusivas. Sumar `count` por `event`, `step`, `field` y `value`; los eventos son contadores agregados, no sesiones únicas ni recorridos enlazables. Comparar `buy_view` → `buy_step` (design/delivery/review) → `buy_pay_click` → `buy_paid`, y los errores `buy_validation_error` por campo y los valores 1–7 de `buy_seq`. El mock conserva copias completas de los eventos en `window.__awgMetrics` solo en desarrollo o modo test/mock, sin enviarlos ni persistirlos; esto permite detectar filtraciones sin sanear previamente el payload de prueba. En un build de producción normal no expone este registro. `buy_paid` lo registra el servidor al confirmar Stripe.

Objetivos iniciales para contrastar tras dos semanas: vista → clic de pago ≥ 35 %, clic → pago ≥ 80 %, errores < 0,3 por pedido pagado, ningún campo > 10 % de visitas, SEQ medio ≥ 6. Son aproximaciones de eventos: reintentos y visitas repetidas pueden inflar los cocientes; no atribuirlos a usuarios únicos. Tiempo mediano < 4 min sin fotos e INP móvil p75 ≤ 200 ms necesitan medición adicional: este endpoint no los registra. No enviar nombres, direcciones, correos ni fotos como métricas.
# Fix b-1 — pendiente de validación

Claude informó 189/193 casos aprobados: tres fallos visuales y un fallo de foco del código postal en escritorio. Se evita que la validación al perder foco desplace el botón durante la pulsación de ratón; el envío sigue validando y enfocando el primer error. El caso E2E también comprueba el enlace del resumen. Por instrucción del dueño se eliminaron las nueve referencias PNG existentes: regenerarlas y revisarlas visualmente, sin relajar axe. Repetir los 193 casos y comprobar el envío con ratón, teclado y táctil. Build, lint (advertencias existentes) y 15 pruebas Node pasan; Playwright no se ejecutó aquí. Este seguimiento sustituye las instrucciones anteriores de conservar las referencias.

## Moderated usability protocol — QR form at the stall (`/form/:token`)

**Goal:** confirm that customers can complete the QR form unaided on their own phone and on the stall iPad Air 11" (820×1180 portrait). This includes older customers.

**Participants:**
- 5 people.
- At least 2 aged 60+.
- At least 1 who rarely shops online.
- A mix of German and English speakers.
- Each person uses their own phone for one round and the stall iPad for the other. Alternate the order.

**Setup:**
- A real order created in staff, with the QR card printed as at the stall.
- Two pet photos on the participant's phone; on the iPad, use the bundled demo photos.
- The moderator stays silent and helps only after 60 s of being stuck. Record each intervention.

**Tasks** (read aloud, one at a time):
1. Scan the QR code and open the form.
2. Add your pet's name and two photos.
3. Check that the colour, finish and name match what you bought, then change the pet name.
4. Send the details.
5. A day later, find your order again (Track code or link).

**Success criteria:**
- Each task completed without help by at least 4 of 5 participants.
- The full form completed in under 4 minutes on a phone.
- No mis-tap that removes a photo by mistake.
- Every participant correctly states when their ornament is handed over after reading the Track page.

**After each task:** ask the SEQ, "How easy was this?" on a 1–7 scale. The target median is ≥ 6, and any task with a median below 5 is a finding.

**What to observe and note:**
- Hesitation over 5 s.
- Reading text aloud or re-reading it.
- Zooming or pinching.
- Mis-taps, especially the photo remove control and the stepper.
- Scrolling past the sticky action bar.
- Confusion about payment ("Do I pay here?").
- Whether the Track page after sending is understood as "done".
- Text size changes in iOS or Android accessibility settings: test at least one participant with large system text.

**Report:**
- Record each finding with its severity (blocker / major / minor), screen, quote and suggested fix.
- Retest the fixed screens with 2 new participants.
