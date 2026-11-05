# Auditoría UX estática

La revisión encontró problemas que pueden impedir completar un pedido, ocultar errores o comunicar un estado incorrecto. Los hallazgos se basan en rutas verificables del código; no se abrió el sitio ni se crearon pedidos.

1. **Alta · Formulario `/form/:token` · [FormPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/FormPage.tsx:290)**  
   Las fotos agregadas se muestran como imágenes, sin control para quitarlas. Una vez alcanzado el límite de cuatro, el selector sigue disponible, pero `addFiles` no agrega más archivos. Si el cliente eligió una foto equivocada, no puede reemplazarla desde el formulario. Agregar un botón accesible para eliminar cada foto, mostrar el conteo y explicar el límite.

2. **Alta · Formulario `/form/:token` · [FormPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/FormPage.tsx:198)**  
   Si una foto supera 10 MB, no es una imagen o falla su lectura, `toPhoto` rechaza la promesa, pero `addFiles` no captura el error y sus llamadores la descartan con `void`. No aparece una explicación y, si se eligieron varios archivos, tampoco se incorporan los anteriores al que falló. Capturar el error, indicar cuál archivo falló y cómo corregirlo, y conservar los archivos válidos.

3. **Alta · Formulario `/form/:token` · [FormPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/FormPage.tsx:150)**  
   Cada cambio guarda el borrador completo, incluidas las fotos en base64, en `sessionStorage` sin capturar errores de cuota o de acceso. Una foto aceptada de hasta 10 MB puede exceder la cuota disponible del navegador; el guardado falla y el borrador deja de ser recuperable tras recargar. Manejar el fallo y avisar al usuario; para fotos, usar almacenamiento adecuado o pedir que se vuelvan a adjuntar con una advertencia clara.

4. **Alta · Nueva venta de productos terminados · [NewSalePage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/NewSalePage.tsx:419)**  
   La venta se crea antes de registrar el pago. Si la creación funciona pero falla la llamada de pago, se muestra un error y el asistente permanece en el mismo paso; al reintentar, vuelve a llamar a `createOrder`. Esto puede generar pedidos duplicados y consumir stock adicional. Conservar y reutilizar el pedido ya creado al reintentar el pago, o hacer la operación idempotente.

5. **Alta · Seguimiento `/track/:code` · [TrackPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/TrackPage.tsx:106)**  
   Para entregas a domicilio, la UI traduce el estado `ready` como “In Zustellung” / “Out for delivery”. El backend asigna `ready` cuando todos los adornos están terminados, sin registrar que hayan salido a reparto ([TrackingService.java](/Users/andresbejarano/dev/AWG%20Tracking/awg-tracking/src/main/java/com/artwithgab/awg_tracking/service/TrackingService.java:85)). El cliente recibe una afirmación de entrega que el sistema no respalda. Mostrar “listo para entrega” hasta que exista un evento real de salida.

6. **Alta · Tienda `/buy` · [BuyPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/BuyPage.tsx:55)**  
   La disponibilidad se consulta para la cantidad y configuración actual de adornos. Si esa combinación devuelve cero fechas, la página reemplaza todo el asistente por `SeasonClosed`, incluso si reducir la cantidad podría permitir una entrega. El cliente pierde acceso a los controles para corregir el carrito y ve un mensaje de temporada terminada. Mantener el carrito editable y distinguir “no hay fechas para esta selección” de una temporada cerrada.

7. **Media · Formulario `/form/:token` · [FormPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/FormPage.tsx:134)**  
   Al volver a abrir un formulario ya enviado, la UI va directamente a la pantalla de agradecimiento. El servicio admite volver a enviarlo hasta que empiece la pintura ([FormService.java](/Users/andresbejarano/dev/AWG%20Tracking/awg-tracking/src/main/java/com/artwithgab/awg_tracking/service/FormService.java:58)), pero el cliente no tiene forma de corregir nombres o fotos. Ofrecer una acción para editar mientras el backend lo permita y explicar cuándo ya no se pueden hacer cambios.

8. **Media · Seguimiento `/track/:code` · [TrackPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/TrackPage.tsx:91)**  
   La opción de editar dirección aparece para cualquier pedido de Viena, aunque el navegador no tenga el token del formulario. En ese caso la dirección existente se oculta y el guardado es rechazado; el mensaje del servidor se presenta solo después de que el cliente complete los campos. Indicar antes de editar que debe abrir el enlace privado del formulario, y localizar la instrucción.

9. **Media · Seguimiento `/track/:code` · [TrackPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/TrackPage.tsx:118)**  
   Para una entrega en Viena se muestra únicamente “Mi / Fr” o “Wed / Fri”, no la fecha seleccionada en la compra. El cliente no puede confirmar en Track cuál de esos días corresponde a su pedido. Incluir la fecha concreta de entrega en la respuesta y mostrarla con el idioma elegido.

10. **Media · Nueva venta y detalle de pedido · [NewSalePage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/NewSalePage.tsx:468)**  
    El asistente de venta solo permite registrar un depósito del 50 %. El monto personalizado del contrato de sprint 4 aparece después, en el detalle, y solo mientras el pedido está `unpaid` ([OrderPaymentPanel.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/components/staff/OrderPaymentPanel.tsx:34)). Si se registró primero el 50 %, no hay control para corregirlo a otro anticipo ni volver a `unpaid`. Permitir introducir y corregir el monto recibido y el estado, con confirmación clara.

11. **Media · Formulario `/form/:token` · [FormPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/FormPage.tsx:496)**  
    El resumen presenta cualquier color distinto de rojo como gris; por ejemplo, un adorno verde o blanco aparece etiquetado como gris. Esto contradice la selección y dificulta detectar un error antes de enviar. Usar un mapa completo para los cuatro colores en todos los resúmenes del formulario.

12. **Media · Días de pintura e inventario · [PaintingDaysPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:17)**  
    Los controles muestran inmediatamente los valores editados, pero después de guardar no hay confirmación visible; tampoco se distingue una fila con cambios pendientes de una guardada. Inventario tiene el mismo comportamiento ([InventoryPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/InventoryPage.tsx:18)). Gaby puede salir creyendo que un cierre o una cantidad ya quedó guardada. Señalar cambios sin guardar y mostrar “Saved” tras la respuesta exitosa.

13. **Media · Días de pintura · [PaintingDaysPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:11)**  
    La pantalla carga únicamente desde hoy hasta 41 días después y no ofrece navegación a otras fechas. Por ejemplo, el 5 de noviembre no permite administrar directamente toda la temporada hasta el 24 de diciembre. Añadir navegación por intervalos o un selector de fechas que respete el máximo de 62 días de la API.

14. **Media · Errores públicos DE/EN · [services.ts](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/api/http/services.ts:19)**  
    Los fallos de red y mensajes del servidor se generan en inglés y algunas pantallas públicas los muestran directamente, entre ellas formulario y seguimiento. Un cliente alemán puede recibir mensajes en inglés al fallar la conexión, buscar un código o guardar una dirección. Traducir errores públicos mediante códigos estables y conservar mensajes genéricos localizados para fallos desconocidos.

15. **Baja · Formulario y teclado · [FormPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/FormPage.tsx:236)**  
    Al avanzar o al fallar la validación, el formulario cambia contenido o muestra errores sin mover el foco al título o al primer campo inválido. Los campos tampoco enlazan sus errores con `aria-describedby`. Esto dificulta encontrar el siguiente paso o corregir un error con lector de pantalla. Mover el foco de forma predecible y asociar cada error con su campo.

16. **Baja · Fotos de la tienda `/buy` · [BuyPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/BuyPage.tsx:132)**  
    Los errores de tipo, tamaño o lectura se reducen al mismo mensaje: “This photo could not be added”. El cliente no sabe que debe elegir una imagen de menos de 10 MB. Mostrar mensajes localizados y específicos junto al selector, incluyendo el límite antes de seleccionar.

### Qué está bien

- La tienda conserva los campos de texto durante la sesión y advierte que las fotos deben agregarse nuevamente después de recargar.
- El pago de la tienda protege contra envíos duplicados mientras la solicitud está en curso y conserva los datos ante un error.
- La tienda valida el código postal de Viena junto al campo y vuelve a comprobar los pasos antes de iniciar el pago.
- La cancelación de pedidos pide confirmación y advierte que los reembolsos de pagos en línea deben hacerse manualmente.
- La lista de espera tiene estados de envío, éxito y error, y la UI no afirma que se haya enviado un correo.

### Qué no pude probar

- Los recorridos reales en navegador, pantallas móviles, diseño visual, número de toques, foco efectivo y lectores de pantalla.
- La integración en vivo con Stripe, la recuperación después de cancelar el pago y los comportamientos ante red lenta o desconexiones reales.
- Login, límite de intentos, cambios de contraseña, logout, guardados y sugerencias de agenda contra el servidor en ejecución.
- Subidas reales desde cámara, compatibilidad de formatos y límites efectivos de almacenamiento de cada navegador.
- Compilación y pruebas automatizadas: se omitieron porque esta auditoría exige no escribir archivos y esos comandos pueden generar artefactos.