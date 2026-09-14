# ArtWithGab — contexto del proyecto

## Objetivo
Gestionar las ventas de Navidad desde la última semana de noviembre de 2026. Andresito dispone de ~15 h/semana (~150 h hasta finales de noviembre) para un proyecto entendible, mantenible y presentable en portafolio.

## Stack confirmado
- Backend: Java + Spring Boot (una app, módulos: pedidos, agenda, pagos, inventario)
- Frontend: React + TypeScript
- Base de datos: PostgreSQL
- Pagos online: Stripe (página de pago alojada por Stripe tras el formulario)
- Efectivo: registro desde pantalla de gestión
- Pendiente: alojamiento, almacenamiento de fotos, servicio de email (presupuesto provisional ~30–60 €/mes en temporada + dominio + comisiones)

## Sitio público (home)
- Repo: https://github.com/andres-bs12/AWG-managment
- Home mínima: **Buy** + **Track** (marca + footer con Instagram/contacto). Sin tienda/catálogo.
- **Track:** búsqueda por código y/o enlace privado (sin cuenta) — confirmado.
- **Buy (self-serve):** reserva el **siguiente slot libre** automáticamente; el cliente elige entrega — **recogida en un mercado** (los configurados) o **entrega a domicilio**. No es tienda/catálogo: solo iniciar pedido + personalizar + pagar.

## Venta y pedidos
- Canal staff: Andresito/Gaby acuerdan entregas, reservan capacidad y generan el QR.
- Canal web Buy: siguiente slot libre + elección mercado/domicilio (ver arriba).
- Un pedido puede incluir varios ornamentos con fechas y modalidades distintas, un único pago.
- También se puede completar el formulario desde su dispositivo.

## Personalización
- Fotos de móvil, varias imágenes, nota opcional.
- Precio base provisional 49,99 € (configurable por mercado).
- Nombre: +12,99 €, límite inicial configurable de 6 caracteres.
- Se selecciona antes del QR; el cliente escribe el nombre o lo quita antes de confirmar.

## Pagos
- Tarjeta online tras el formulario, o efectivo registrado por el equipo.
- Si quitar el nombre genera devolución de efectivo, queda pendiente de confirmación.
- Tras confirmar y completar el pago, el cliente no puede modificar ni cancelar la personalización.

## Capacidad
- En mercados: bloques continuos de 60 min, o 75 con nombre, dentro del horario de apertura.
- Fuera del mercado: 3 ornamentos/día, o 2 en días de entrega.
- Fechas y capacidades ajustables; no sumar ambas capacidades el mismo día.

## Agenda
- Pedidos flexibles pausables, conservando tiempo restante.
- Reubicación manual o automática con propuesta a confirmar (capacidad y compromisos).
- Controles: iniciar, pausar, terminar; ajuste manual del tiempo.
- La reubicación automática es la parte con mayor incertidumbre de esfuerzo.

## Entregas
- Recogida en el mercado de compra, en otro mercado (listo para su apertura), o a domicilio en toda Viena (incluida en el precio; miércoles y viernes, sin hora concreta).
- Pueden entregar lo pintado ese mismo día.

## Seguimiento
- Enlace privado por email y búsqueda por código desde la página principal, sin cuenta.
- Estado individual por ornamento.
- Emails: confirmación, recogida lista, cambios de entrega.
- Si pasa a envío, el enlace solicita la dirección.
- Email y teléfono siempre obligatorios.

## Gestión
- Dos accesos con iguales permisos; pantalla compartida sincronizada entre dispositivos.
- Dashboard de ventas y cobros, lista de entregas.
- Inventarios separados: ornamentos en blanco y extras terminados.
- Extras: precio configurable; no consumen tiempo de pintura.

## Diseño y UX
- Cliente: alemán e inglés; identidad ArtWithGab; escenas navideñas animadas junto al progreso.
- Gestión: sencilla, en español.
- Instagram y contacto en el footer.
- Proceso de diseño: bocetos → Figma (componentes) → implementación. Diseño va por delante del desarrollo.

## Límites v1
- Requiere conexión a internet.
- Sin IA dentro de la app; sin tienda/catálogo online.
- Buy self-serve permitido: siguiente slot libre + elección mercado/domicilio + formulario + pago.

## Organización
- Sprints semanales de 15 h, gestionados en Jira.
- Demo revisable con Gaby al final de cada sprint.
- Sprint 1 empieza lunes 14 sep 2026; ~10 semanas hasta 22 nov 2026 (últimas dos enfocadas a pruebas/ajuste).

## Decisiones cerradas
- Definición de producto confirmada por Andresito.
- Stack Java/Spring + React/TS + PostgreSQL + Stripe confirmado.
- Ritmo: sprints semanales en Jira.
- Home = Buy + Track; Buy asigna al siguiente slot libre; entrega = mercado configurado o domicilio.
