# Auditoría UX (usabilidad / QA) — Claude — 2026-11-05

Pruebas en vivo en http://localhost:5174 (backend real :8080), sobre todo a 375×812 en mi propia pestaña. Datos ficticios ("Test Kunde", test@example.test, Neubaugasse 1, 1070). Cuando un hallazgo se verificó solo en código, lo indico.

**Limpieza:** cancelé los 4 pedidos que creé (AWGZ44PG7, AWG6J95HY, AWG3RQ7L9 y AWGXL4GFL; los dos últimos son el duplicado del hallazgo 1). Volví a abrir el lunes 9/11 en Painting days (máx. 2, igual que antes). El stock quedó como estaba (rojo 200, gris 199, terminados 198). No cambié la contraseña.

## Hallazgos (de más a menos grave)

### 1. Alta · Staff /staff/sales/new (venta de adornos terminados) · `pages/staff/NewSalePage.tsx:409-440`
**Observado:** en una venta solo de adornos terminados, elegí Cash y toqué "Done" dos veces seguidas, como pasa con un doble toque en el celular. Se enviaron **2 × `POST /api/orders` → 201** y **2 × `PATCH payment-state`**, y se crearon dos pedidos pagados: AWG3RQ7L9 y AWGXL4GFL. La UI mostró solo uno. `busy` es un estado de React, así que el botón sigue activo hasta el siguiente render.
**Por qué importa:** la caja cuenta la venta dos veces, se descuenta stock dos veces y queda un pedido fantasma que Gaby no ve. En un pedido custom, el segundo POST falla por choque de horario. Eso evita el duplicado, pero genera el hallazgo 9.
**Arreglo:** usar un candado síncrono con `useRef` (como `busyRef` en BuyPage) en `continueFromDelivery`, `finishFinishedSale` y `recordPayment`. Lo ideal es agregar también una clave de idempotencia en `POST /api/orders`.

### 2. Alta · Público /buy, paso 2 "Dein Tier" · `pages/public/buy/BuyPetStep.tsx:15` + `BuyPage.tsx:158`
**Observado:** el campo "Name des Tiers" no tiene límite de longitud y el servidor acepta como máximo 60 caracteres. Con un nombre de 66 caracteres llegué hasta el pago. `POST /api/shop/checkout` respondió `400 "Invalid items[0].petName: size must be between 0 and 60"`, pero la UI mostró «Die Zahlung konnte nicht gestartet werden. Bitte versuche es erneut; deine Angaben bleiben erhalten.»
**Por qué importa:** la clienta reintenta sin fin con un dato que nunca va a pasar y abandona la compra. Cualquier 400 de validación (nota >1000, nombre >120, teléfono >40, calle >120) termina en el mismo callejón.
**Arreglo:** poner `maxLength` en el cliente para todos los campos del DTO (petName 60, customerName 120, phone 40, line1/line2 120, note 1000). Distinguir 400, 409 y 5xx en `pay()`: con un 400 hay que volver al paso y campo afectados con un mensaje localizado, y con un 409 ("día lleno") hay que volver al paso de fecha.

### 3. Alta · Público /buy (móvil), todos los pasos · `BuyPage.module.css:65`
**Observado:** la barra de acciones es `position: sticky; bottom: 0` (su borde superior queda en y≈713 px de 812) y no hay `scroll-padding-bottom`. Al tocar "Weiter" sin elegir color, el foco va al fieldset y el error «Wähle eine verfügbare Farbe.» queda en y=728, **detrás de la barra**: en pantalla no cambia nada. Lo mismo pasa en el paso 5: el checkbox de AGB (y=700) y su error, y el error de pago «Die Zahlung konnte nicht gestartet werden…» (y=782), quedan tapados.
**Por qué importa:** en el celular parece que el botón no funciona. Es el principal punto de abandono en el flujo de Facebook.
**Arreglo:** usar `html { scroll-padding-bottom: <altura de la barra + 16px> }` y llamar a `scrollIntoView({block:'center'})` al enfocar el primer error. Otra opción es mostrar un resumen de errores arriba de la barra.

### 4. Alta · Público /form/:token (pedido del puesto con entrega en Viena) · `pages/public/FormPage.tsx`
**Observado:** creé una venta en el puesto con entrega a Viena (miércoles 11/11). En el formulario de la clienta no se pide la dirección en ningún paso. Al enviar se muestra «Danke — wir haben alles». La única forma de dar la dirección es "Lieferadresse ändern" en /track, que solo funciona en el mismo navegador porque necesita el form token. El pedido queda con "Address pending".
**Por qué importa:** la app afirma algo que no es cierto ("tenemos todo") y Gaby sale de reparto sin dirección.
**Arreglo:** si algún ítem es `vienna`, agregar al formulario un paso de dirección obligatorio, con validación de PLZ 1010–1230. Hasta que exista, mostrar en "done" un aviso destacado con un enlace para cargar la dirección.

### 5. Alta · Público /form/:token, paso "Namen" · `FormPage.tsx:54`, `OrderService.java:108`
**Observado:** el campo "Dein Name" viene relleno con **"Walk-in"**, el texto interno que usa el staff. La clienta puede enviarlo así, y /track saludaría con «Hallo Walk-in».
**Por qué importa:** se ve poco profesional y deja datos basura en el pedido.
**Arreglo:** si `customer.name === 'Walk-in'`, iniciar el campo vacío. Mejor aún, que el backend guarde `null` y que el staff vea "Walk-in" solo como etiqueta.

### 6. Alta · Público /form/:token, fotos · `FormPage.tsx:198-207, 300-325`
**Observado:**
- No hay botón para **quitar** una foto: solo aparecen las `<img>` (comprobado: no existe ningún botón de quitar).
- Si se eligen 6 fotos, se guardan 4 y no aparece ningún mensaje ni contador "x de 4". El límite también difiere de la tienda (6) y del servidor (6).
- Un archivo que no es imagen produce un rechazo de promesa sin manejar (`Error: Please choose an image file.` en consola) y la pantalla no muestra nada.
**Por qué importa:** si se sube una foto equivocada, no hay forma de corregirla. Los errores son invisibles.
**Arreglo:** reutilizar el componente de fotos de la tienda (miniatura con botón ×, contador, `MAX_PHOTOS = 6` compartido y errores localizados) y envolver `toPhoto` en try/catch.

### 7. Alta · Público /form y /track: mensajes del servidor en inglés en la UI alemana · `FormPage.tsx:140, 280`, `TrackPage.tsx:101`
**Observado (con DE activo):**
- Formulario con token inválido o de un pedido cancelado: «This form link is not valid.»
- Envío del formulario cuando la pintura ya empezó: «Painting has already started. Contact us to change the details.» Aparece después de completar los 5 pasos.
- /track al guardar la dirección: «Invalid postalCode: must not be blank» y «We only deliver inside Vienna (postal codes 1010–1230).»
- Rate limit (verificado en código): «Too many attempts. Wait a minute and try again.»
**Por qué importa:** el público es alemán, el texto es técnico y no dice cómo resolver el problema. La clienta completa todo el formulario para recién al final enterarse de que no se puede.
**Arreglo:** que el backend devuelva un `code` estable y el front lo traduzca a claves i18n. Para el formulario bloqueado, mostrar el estado "ya no editable" al cargar (en `getForm`), no al enviar. Validar la PLZ en el cliente de /track como se hace en /buy.

### 8. Media · Staff wizard: entrega en Viena · día de entrega
**Observado:** la lista "Delivery day" del staff ofrece **Fri 27 Nov, Fri 4/11/18 Dec**, que son viernes de mercado («7 h free», es decir, el horario del puesto). También ofrece **Fri 25 Dec, Wed 30 Dec y Fri 1 Jan**, que son posteriores al fin de temporada (24/12) o feriados. La tienda pública excluye correctamente esos viernes.
**Por qué importa:** viola la regla «si un viernes coincide con mercado, tiene prioridad el puesto» y permite comprometer entregas que no se pueden cumplir.
**Arreglo:** usar en el wizard la misma regla del backend (`ShopService.isDeliveryDay`): excluir los viernes con `MarketDay` y las fechas posteriores a `seasonEnd`, y mostrar la capacidad de pintura en lugar del horario del mercado.

### 9. Media · Staff wizard, paso QR · `NewSalePage.tsx:459` / `saleDraft.ts:216`
**Observado:** después de crear AWGZ44PG7 (con doble toque en "Create order & show QR"), la pantalla del QR mostraba en rojo «That hour is taken · change / place on board» aunque el pedido y su bloque de pintura se habían creado bien. El error venía del segundo POST.
**Por qué importa:** Gaby cree que la venta falló y puede repetirla.
**Arreglo:** el mismo candado del hallazgo 1, y limpiar `error` al pasar a la fase `qr`.

### 10. Media · Staff /staff/orders/:id · `components/staff/CompleteOrderDialog.tsx:94`
**Observado:** el diálogo "Complete order?" dice «**No message is sent automatically.**». Sin embargo, `NotificationService` envía un e-mail a la clienta en `ALL_FINISHED` (y en pagos, entregas y cancelaciones) cuando el mail está configurado.
**Por qué importa:** la UI hace una afirmación falsa sobre las notificaciones.
**Arreglo:** cambiar el texto según la configuración. Por ejemplo, «Si el e-mail está configurado, la clienta recibe un aviso», o exponer `mailEnabled` en `/api/staff/me`.

### 11. Media · Staff /staff/orders/:id: marcar "Ready" sin datos de la clienta
**Observado:** pude marcar como listo un adorno custom que todavía estaba en «Waiting for form / Waiting for reference photos / Name to paint: Waiting for form». El diálogo no avisa que faltan fotos ni nombre. Después de eso, la clienta ya no puede enviar el formulario (ver hallazgo 7).
**Arreglo:** si `formComplete=false`, mostrar en el diálogo una advertencia explícita («Faltan fotos/nombre: la clienta ya no podrá enviarlos») o bloquear la acción con una confirmación aparte.

### 12. Media · Staff /staff/orders/:id: pago sin deshacer · `components/staff/OrderPaymentPanel.tsx:28-37`
**Observado:** "Mark paid" no pide confirmación. Una vez pagado, el panel solo muestra «Paid · Card» y no hay forma de volver a Unpaid o Deposit ni de corregir el método. El importe personalizado del depósito solo existe en la página del pedido. En el wizard el depósito es fijo al 50 % y el método es obligatorio, mientras que en el pedido es opcional.
**Arreglo:** agregar "Undo / change payment", con confirmación y registro en `paymentEntries`. Unificar en ambos lugares la regla del método y el campo de importe del depósito.

### 13. Media · Público /buy: errores que desaparecen al escribir · `BuyPage.tsx:90-94`
**Observado:** en "Deine Daten", al tocar Weiter vacío aparecen 5 errores. Al escribir **una letra** en Name, desaparecen los 5 (se midió: quedan 0 elementos `-error`), porque `patch()` hace `setErrors({})`.
**Arreglo:** borrar solo el error del campo editado: `setErrors(({[key]:_, ...rest}) => rest)`.

### 14. Media · Público /buy, fotos: el aviso de límite nunca aparece · `BuyPetStep.tsx:73` + `BuyPage.tsx:137`
**Observado:** subí 7 fotos: se guardaron 6 y no salió «shopPhotoLimit». El `FileList` es "vivo" y `event.target.value = ''` lo vacía antes de que termine el `await`, así que `files.length` vale 0. Lo verifiqué: después de `value=''`, el `FileList` guardado pasa de 1 a 0 elementos. El error de un PDF dice solo «Dieses Foto konnte nicht hinzugefügt werden.», sin explicar el motivo (formato).
**Arreglo:** copiar `Array.from(files)` antes de resetear el input y usar esa copia para la cuenta. Dar un mensaje específico para formatos no admitidos.

### 15. Media · Público /buy, pago cancelado en Stripe (`?cancelled=CODE`) · verificado en código (`StripeClient.java:75`, `ShopService` 233/350)
**Observado:** el código de `cancelled` no se usa. El pedido `PENDING` sigue reteniendo horas de pintura y stock unos 32 minutos hasta que expira. Al volver, la clienta empieza en el paso 1 y tiene que volver a subir las fotos (el aviso lo explica bien). Si reintenta en ese momento, su propio pedido pendiente compite por la capacidad y puede encontrar su día "lleno" o el color "agotado".
**Arreglo:** un endpoint público `POST /api/shop/checkout/{code}/abandon` (validado con el token de la sesión) que libere el `PENDING` al volver con `cancelled`, o expirar la sesión de Stripe de inmediato.

### 16. Media · Público /buy: "Santa ist schon losgeflogen" a mitad de temporada · `BuyPage.tsx:81` (verificado en código)
**Observado:** `if (datesState==='ready' && dates.length===0) return <SeasonClosed/>`. Si se llena la capacidad, o si el carrito (hasta 10 adornos con nombre) no entra en ningún día, la clienta ve «Bestellungen sind für dieses Jahr geschlossen» con la lista de espera, y pierde de vista su carrito. En vivo no pude llegar a 0 fechas (con 10 adornos con nombre quedan 9).
**Arreglo:** separar los dos casos. Si no es fin de temporada, mostrar «No hay días libres para este carrito; quita adornos o vuelve más tarde» sin perder el borrador.

### 17. Media · Staff /staff/deliveries: entregas en Viena sin fecha
**Observado:** con el filtro "All days", la sección "Home deliveries" muestra «AWG6J95HY · Bello · Vienna · Wed/Fri», sin el día concreto (11/11). Pasa lo mismo en /track («Lieferung in Wien · Mi / Fr») y en la revisión del formulario. El filtro "Day" lista «Wed 4 … Fri 4 … Fri 1» **sin mes**, lo que es ambiguo entre noviembre, diciembre y enero.
**Arreglo:** mostrar siempre la fecha (`Mi., 11. Nov.`) y agregar el mes a las opciones del select.

### 18. Media · Staff wizard: adorno terminado "Deliver now" que termina como "Pickup"
**Observado:** el resumen decía «Finished 2 · Deliver now», pero en el pedido apareció como «Pickup · Market 27/11» con «1 still to finish / Mark picked up». En la revisión del formulario se veía «Rathausplatz · Fr., 27. Nov.» duplicado debajo del custom. Hoy no hay mercado, así que "ahora" se asignó al próximo día de mercado.
**Arreglo:** guardar las entregas "ahora" con la fecha de hoy y `handedOver=true` (o un tipo `now`), y no mostrarlas como recogida futura.

### 19. Media · Staff /staff/inventory y /staff/painting-days: sin confirmación al guardar
**Observado:** al tocar "Save" el texto cambia a "Saving…" y vuelve a "Save", sin ningún «Saved». Tampoco hay indicador de cambios sin guardar: el valor 201 se queda en pantalla aunque no se haya guardado y se pierde al navegar. En Painting days, el checkbox cambia la etiqueta a "Closed" **antes** de guardar, como si ya se hubiera aplicado. En el stock, "Save" envía una cantidad absoluta: si mientras tanto se hace una venta, la pisa (pérdida de datos por concurrencia, verificado en código).
**Arreglo:** mensaje `role="status"` «Saved ✓», marcar las filas modificadas y un aviso `beforeunload`. Para el stock, enviar un delta o un control de versión.

### 20. Media · Público Home: el CTA "Am Stand kaufen" / "Buy at the stall" lleva a la tienda online · `i18n/LocaleContext.tsx:94, 262`
**Observado:** el botón secundario del Home dice «Am Stand kaufen», pero abre /buy («Kugel online bestellen… direkt zu dir nach Hause in Wien»).
**Por qué importa:** quien llega desde un anuncio no encuentra la compra online, y quien quiere ir al puesto entra a un checkout.
**Arreglo:** usar «Online bestellen» / «Order online».

### 21. Baja · Staff wizard: duración por defecto con nombre
**Observado:** al marcar "Add name on ornament", "Paint time" sigue en **1 h**. Según las reglas de producto, con nombre son unos 75 min. El resumen muestra «Paint to reserve · 1 h».
**Arreglo:** cambiar automáticamente a 1 h 15 al marcar el nombre, salvo que el staff lo haya cambiado a mano.

### 22. Baja · Inconsistencias de texto en público
- /buy, paso Liefertag: «Wir liefern nur … mittwochs oder freitags», pero se ofrece «Donnerstag, 24. Dezember» (es intencional en el backend porque es el último día, pero el texto lo contradice).
- Nombre en la bola: en la tienda dice «Max. 6 Buchstaben, in Großbuchstaben» y convierte «jürgen 2» en «JÜRGEN». En el formulario dice «Max. 6 Zeichen» y acepta «mäx 2!» tal cual.
- /track en DE: «Stadt: Vienna», «Stiege / extra»; la tienda usa «Wien».
- Se mezclan «Kugel» y «Ornament» («dein Ornament zu verfolgen»).
- «Dieses Feld wird gebraucht.» suena raro; mejor «Bitte ausfüllen.».
- Inputs de dirección en /track sin `autocomplete` (en /buy sí lo tienen).

### 23. Baja · Público /buy, barra móvil del paso 5
**Observado:** a 375 px, el botón "Zurück" mide 66 px de ancho y corta la palabra en «Zur / ück». «Sicher mit Stripe bezahlen» ocupa 3 líneas.
**Arreglo:** usar un texto más corto («Jetzt bezahlen») o una flecha ← como botón de volver, y `hyphens: manual` / `white-space: nowrap` en las etiquetas.

### 24. Baja · Recuperabilidad en /buy y /form
**Observado:** el paso actual no está en la URL. Al recargar se vuelve al paso 1 (el borrador sí se conserva) y el botón "atrás" del navegador sale del checkout. En /form el contenedor no es `<form>`, así que Enter no avanza. Los inputs con error no tienen `aria-invalid` ni `aria-describedby`, y el foco no se mueve al error (`document.activeElement` = BODY).
**Arreglo:** guardar `step` en `?step=` o en el borrador. Usar `<form onSubmit>` y el mismo manejo de errores accesible que /buy.

### 25. Baja · Staff: textos y feedback menores
- En el wizard, el encabezado «**1 Items**» se lee como una cantidad («1 artículo») aunque el carrito esté vacío. Mejor «Step 1 · Items».
- «Fill on this **iPad** instead», aunque Gaby usa un celular.
- En el wizard, "Mark paid/deposit" quedan deshabilitados hasta elegir método, sin explicar por qué. Hay «Register cash» y «Card» como etiquetas paralelas.
- Login vacío: «Invalid password: must not be blank» (técnico; solo menciona la contraseña). Verificado vía API.
- Después de "Cancel order" se redirige a Agenda sin ningún «Order cancelled». Para un pedido pagado en el puesto, el diálogo solo menciona el reembolso en Stripe y no el dinero recibido en efectivo o tarjeta.
- En Change password no se anuncia el mínimo de 10 caracteres hasta que hay un error, y no hay enlace para volver.
- Painting days muestra sábados y domingos como "Open · 0/2", aunque esos días no tienen horas de pintura.

## Qué está bien
- Los diálogos destructivos y de cierre (Cancel order, Complete order) son claros. Muestran el código del pedido, explican las consecuencias y tienen un botón seguro.
- /buy: buena validación por campo (PLZ de Viena con mensaje específico, e-mail), `autocomplete` e `inputmode` correctos, el borrador sobrevive a la recarga y el aviso de que hay que volver a subir las fotos es honesto. El error de Stripe (502) se maneja sin perder datos y el servidor revierte el pedido.
- El "Choose on agenda" del wizard funciona bien. Lleva a la agenda en modo colocación, «Paint this ornament · 11:15–12:15 · Use this time», y vuelve con el bloque asignado. Las sugerencias responden al cerrar un día de pintura (lun → mar).
- El TrackDialog tiene buen manejo de foco, mensajes claros para código vacío o inexistente, y normaliza las mayúsculas.
- En el staff, el feedback de pago y producción es inmediato («Marked as paid.», «Ornament finished — order ready.»), y los botones de quitar foto en la tienda miden 44×44 px.

## Qué NO pude probar
- Login y logout por la UI, y el mensaje de rate limit en pantalla: la sesión del navegador es compartida con otros auditores y cerrar sesión o agotar el límite (por IP) los habría bloqueado. Revisé los mensajes vía API y en el código.
- Pago real o cancelación real en Stripe (la clave es ficticia) y la página /buy/thanks con un pedido pagado.
- El estado de fin de temporada (D) en vivo: la temporada está abierta. Revisé `SeasonClosed.tsx` y las claves i18n DE/EN (completas).
- Lector de pantalla real (solo revisé el árbol de accesibilidad y los atributos ARIA), red lenta o sin conexión, y el envío real de e-mails.
- Crear o guardar un mercado nuevo (solo validé el formulario vacío) y la vista "Open delivery run".
