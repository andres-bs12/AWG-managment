# Auditoría UI estática — ArtWithGab

La revisión identificó problemas de contraste en Agenda, claridad al guardar cambios y consistencia de componentes. Los hallazgos se basan en código; no son observaciones de una sesión visual en navegador.

1. **Alta · Agenda · Contraste de sesiones** · [AgendaPage.module.css](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/AgendaPage.module.css:188), [AgendaSessionList.module.css](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/components/staff/AgendaSessionList.module.css:3)  
   Las sesiones `not_started` usan `#6a7672` sobre `#e4e8e6`: **3,82:1**, por debajo de 4,5:1 para texto normal. Las `delivered` usan `#9aa3a0` sobre `#eceeed`: **2,22:1 antes de aplicar la opacidad de 0,55**, que reduce aún más el contraste. Los valores se repiten en la lista móvil. Esto dificulta leer nombres, horarios y estados durante el trabajo en el puesto. **Corrección:** definir combinaciones de texto y fondo que alcancen 4,5:1 y evitar atenuar toda la tarjeta; distinguir entregados también con texto o borde.

2. **Alta · Días de pintura · Rango de fechas inaccesible** · [PaintingDaysPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:11)  
   La pantalla solicita únicamente desde hoy hasta 41 días después y no ofrece controles para avanzar a otro período. El 5 de noviembre, el último día mostrado sería el 16 de diciembre, aunque la temporada termina el 24. Gaby no puede preparar desde esta pantalla los límites o cierres de las fechas posteriores. **Corrección:** agregar navegación por períodos o selector de fechas, respetando el máximo de 62 días de la API.

3. **Media · Stock y días de pintura · Cambios sin confirmación visible** · [InventoryPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/InventoryPage.tsx:18), [PaintingDaysPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:17)  
   Al editar una cantidad o cambiar Open/Closed, el nuevo valor aparece inmediatamente, pero solo se persiste al pulsar **Save**. Tras guardar, el botón vuelve a “Save” sin mensaje de éxito ni indicación de cambios pendientes. Es fácil interpretar el valor mostrado como ya guardado o no saber si la operación terminó bien. **Corrección:** señalar “Unsaved changes”, deshabilitar Save cuando no haya cambios y mostrar una confirmación breve después de guardar.

4. **Media · Stock y días de pintura · Carga y errores sin tratamiento completo** · [InventoryPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/InventoryPage.tsx:7), [PaintingDaysPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/PaintingDaysPage.tsx:9)  
   Ambas páginas inicializan la lista vacía y no muestran un estado de carga; durante la petición solo se ven el título y la introducción. Si falla, aparece texto de error sin acción para reintentar. Esto no permite distinguir fácilmente una pantalla todavía cargando de una lista vacía y obliga a recargar la página tras un fallo. **Corrección:** agregar estados de carga y vacío, y un botón “Try again” para errores.

5. **Media · Todas las páginas públicas y nueva venta · Objetivos táctiles pequeños** · [PublicLayout.module.css](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/layouts/PublicLayout.module.css:55), [NewSalePage.module.css](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/NewSalePage.module.css:347), [StaffLayout.module.css](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/layouts/StaffLayout.module.css:102)  
   Los botones de idioma miden **44 × 36 px**, los cierres de los selectores de fecha **36 × 36 px** y “Log out” tiene una altura mínima de **32 px**. Son menores que el objetivo solicitado de 44 px en al menos una dimensión y resultan más difíciles de pulsar en teléfono. **Corrección:** dar a cada control un área interactiva mínima de 44 × 44 px, aunque el elemento visual interior siga siendo más pequeño.

6. **Media · Completar pedido · Mensaje contradictorio sobre notificaciones** · [CompleteOrderDialog.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/components/staff/CompleteOrderDialog.tsx:92)  
   El diálogo afirma “No message is sent automatically”. El contrato de sprint 4 establece que el backend envía correos cuando todos los adornos están terminados si SMTP está configurado. La afirmación absoluta puede llevar al staff a informar incorrectamente al cliente. **Corrección:** usar un texto que no prometa ni descarte el envío, o mostrar el estado real si la API llega a exponerlo.

7. **Media · Cancelar pedido · Diálogo inconsistente** · [OrderDetailPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/OrderDetailPage.tsx:206), [CompleteOrderDialog.module.css](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/components/staff/CompleteOrderDialog.module.css:87)  
   La confirmación de cancelación usa un `<dialog>` con botones directamente después del texto, mientras que la de completar pedido tiene espaciado, grupo de acciones y distribución vertical en móvil. La acción irreversible queda presentada de forma menos clara y consistente. **Corrección:** compartir estructura y estilos de diálogo, con separación explícita entre mensaje y acciones y botones adaptados a teléfono.

8. **Baja · Tienda · Progreso pequeño en teléfono** · [BuyPage.module.css](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/BuyPage.module.css:60)  
   Por debajo de 500 px, las etiquetas de los cinco pasos usan `0.7rem` —11,2 px con la base de 16 px— y se reparten en una sola fila. Esa escala dificulta leer el recorrido, especialmente en alemán. **Corrección:** aumentar el tamaño y considerar mostrar el paso actual con “Paso 2 de 5” o permitir una presentación más compacta sin reducir tanto el texto.

9. **Baja · Tienda en inglés · Formato monetario no localizado** · [money.ts](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/lib/money.ts:5), [BuyPage.tsx](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/BuyPage.tsx:177)  
   `formatEur` siempre usa `de-AT`, también cuando la tienda está en inglés. En cambio, el formulario y el recibo seleccionan el formato según el idioma. La misma experiencia bilingüe presenta convenciones distintas entre pantallas. **Corrección:** aceptar el idioma en el formateador compartido y aplicarlo a precios, carrito y resumen de compra.

10. **Baja · Componentes compartidos y ajustes staff · Colores fuera de tokens** · [Button.module.css](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/components/ui/Button.module.css:63), [SettingsRows.module.css](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/staff/SettingsRows.module.css:3), [BuyPage.module.css](/Users/andresbejarano/dev/AWG%20Tracking/frontend/src/pages/public/BuyPage.module.css:19)  
    Hay colores literales en estados de botones staff, advertencias de stock y muestras de la tienda, por ejemplo `#2c2923`, `#fff7e8` y `#8b929a`. Esto incumple el criterio de usar tokens y permite que estados equivalentes se desvíen al cambiar la paleta. **Corrección:** definir tokens semánticos para esos estados y colores de producto, y reutilizarlos en los componentes.

## Qué está bien

- La tienda marca el paso actual y enfoca el encabezado al cambiar de paso, lo que ayuda a orientarse.
- Los botones compartidos tienen una altura mínima de 44 px y un foco visible explícito.
- El pie público y la barra móvil de compra contemplan `safe-area-inset-bottom`.
- Las animaciones y transiciones tienen una regla global para `prefers-reduced-motion`; la intro también reduce su espera.
- El formulario y el recibo públicos ya usan formato de moneda según el idioma.

## Qué no pude probar

- La apariencia real, desbordamientos, recortes, superposiciones y áreas táctiles efectivas a **360 × 740, 768 y 1280+ px**.
- Los recorridos interactivos completos Home → Buy → Pay y login → venta → pedido → stock → días de pintura, incluidos los estados que dependen del servidor.
- El contraste sobre fondos ilustrados o semitransparentes en condiciones reales, la visibilidad de foco en navegador y la experiencia con zoom.
- La fidelidad visual frente a los frames de Figma, la escena de temporada cerrada y los diálogos renderizados.
- La integración real de Stripe y las notificaciones. No ejecuté compilaciones ni pruebas porque esta auditoría no permite escritura y esas tareas pueden generar archivos. No se crearon pedidos ni se modificaron archivos.