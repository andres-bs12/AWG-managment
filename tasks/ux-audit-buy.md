# Auditoría UX de la tienda pública

Revisión estática del flujo de cinco pasos, con foco en una primera visita móvil desde anuncios. La comprobación visual, de contraste y con lector de pantalla en dispositivos reales sigue pendiente.

## Alta

- **Condiciones inaccesibles:** se pide aceptar AGB y desistimiento sin ofrecer los textos. Solución: enlazar documentos legales reales cuando estén disponibles; no inventar textos ni destinos. Pendiente de decisión del dueño.
- **Validación y foco:** al regresar a un paso desde el pago, el foco del encabezado puede competir con el del campo inválido. Solución: priorizar el primer error y anunciarlo.
- **Borrador vacío:** al filtrar artículos antiguos puede quedar un carrito sin productos. Solución: restaurar al menos un artículo.

## Media

- **Acción alejada en móvil:** el carrito completo precede al botón de continuar. Solución: barra inferior compacta con total y acción, dejando el desglose visible en la página.
- **Expectativas después del pago:** Stripe se explica, pero no qué sucede después. Solución: explicar la confirmación y el seguimiento sin prometer notificaciones no implementadas.
- **Fotos y recarga:** la pérdida de fotos solo se comunica tras recargar. Solución: advertir antes de seleccionarlas.
- **Errores de carga y pago:** configuración sin reintento y errores técnicos potencialmente no localizados. Solución: ofrecer reintento y mensaje localizado que conserve los datos.
- **Límite de fotos:** al elegir más de las permitidas se descartan silenciosamente. Solución: informar del límite.
- **Jerarquía visual del producto:** el símbolo decorativo no representa el producto ni el color. Solución: ilustración de una esfera en el color seleccionado.
- **Campos obligatorios:** no se distingue claramente qué datos de contacto son necesarios. Solución: indicarlo en ambos idiomas y mantener errores asociados a cada campo.

## Baja

- **Revisión de pedido:** volver a editar implica navegar hacia atrás por varios pasos. Solución futura: enlaces de edición por sección.
- **Confianza en el producto:** ya se identifica a Gaby y la entrega en Viena, pero faltan fotografías reales y reseñas verificadas. Solución futura: incorporar material aprobado por el dueño.
- **Accesibilidad y pantalla de 360 px:** controles de color y fecha usan etiquetas y objetivos de al menos 44 px, y hay foco visible; comprobar manualmente contraste, navegación por teclado y lector de pantalla en navegador y móvil antes de publicar.
