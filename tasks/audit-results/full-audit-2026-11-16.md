# Auditoría completa — seguridad, código sobrante y SEO (2026-11-16)

Rama `release/v3.1`. Revisó Claude Fable 5.2 (backend, despliegue, sitio en vivo), con dos revisores de otra familia: Codex `gpt-6.1-sol` (frontend) y GLM-5.3 Flash (backend). Cada hallazgo de los agentes se comprobó a mano antes de aceptarlo.

## 1. Veredicto

- **Seguridad del código: buena.** No se encontró ninguna forma de entrar sin contraseña, de leer pedidos ajenos, de cambiar precios desde el navegador ni de inyectar código. No hay secretos en el repositorio ni en su historial.
- **Lo que más urge no es código:** la tienda está abierta y cobra, pero Impressum, AGB y Datenschutz en vivo siguen como borrador con huecos (`[Vollständiger Name / Firmenname]`, `[Anschrift]`…). Ver §4.
- **SEO: no había nada.** Sin descripción, sin `robots.txt`, sin `sitemap.xml`, mismo título en todas las páginas. Base añadida (§3); falta una imagen para compartir.
- **Código sobrante:** unas 700 líneas borradas sin tocar ninguna función (§2).

## 2. Cambios aplicados (sin commit)

**Seguridad**
- iPad del puesto: un formulario a medio llenar dejaba nombre, teléfono, e-mail y dirección del cliente anterior guardados en la pestaña, bajo una clave que contiene su enlace privado. Ahora se borran al cerrar sesión, que es lo que inicia cada entrega del iPad (`lib/formDraft.ts`, `auth/AuthContext.tsx`, prueba nueva). Hallazgo de Codex, confirmado.
- Contraseñas de más de 72 caracteres daban error 500 (límite de bcrypt): ahora responden 400 al cambiarla y 401 al entrar (`AuthService.java`).
- `GET /api/metrics/buy` (solo staff) aceptaba cualquier rango de fechas: mismo tope de 400 días que Statistics.

**Código sobrante — frontend**
- Archivos sin ningún uso: `App.css`, `index.css`, `assets/{hero.png,react.svg,vite.svg}` (restos de la plantilla de Vite), `DeliveryIcon.tsx`, `ViennaDeliveryCard.tsx` + su CSS, `BuyPlaceholderPage.tsx`.
- Funciones sin uso: `FormEditHelp`, `reconcilePetName`, `patchPetName` (del campo de nombre de mascota ya eliminado) y sus pruebas.
- 64 claves de traducción muertas en EN y DE (subpasos, textos de tranquilidad ya quitados, etc.). Se conservaron las que se arman dinámicamente o traducen mensajes del servidor.
- 140 selectores CSS sin uso en 12 archivos (los mayores: `BuyPage.module.css` y `Panel.module.css`).
- Los dos constructores de formularios multipart idénticos quedaron en uno (`api/http/services.ts`).

**Código sobrante — backend**
- Consultas sin uso: `existsByHandoffDate`, `existsPaintBetween`, `existsByEmail`; sobrecarga `PaintingDayService.update` de 3 argumentos; propiedad `checkoutMinutes` (nadie la leía: la reserva es de 15 min fijos). Comentarios desactualizados corregidos.

**SEO**
- `index.html`: título descriptivo, meta descripción, Open Graph, `theme-color`.
- `public/robots.txt` (bloquea `/api/`, `/staff`, `/form/`, `/track/`, `/buy/thanks`, `/waitlist/`) y `public/sitemap.xml` (`/`, `/buy`, `/track`).
- Título propio por página pública en DE/EN (`PublicLayout.tsx`, clave nueva `metaHomeTitle`).
- **Texto nuevo a aprobar por el dueño:** título «ArtWithGab – Handbemalte Weihnachtskugeln mit deinem Haustier · Wien» y descripción «Handbemalte Weihnachtskugeln mit deinem Haustier, von Gaby in Wien gemalt. Online bestellen, mit Lieferung in Wien oder Abholung am Christkindlmarkt.» Solo se ven en Google y al compartir el enlace, no en la página.

**Verificación:** backend 171 pruebas en verde; frontend `tsc`, lint y 89 pruebas Node en verde; build de producción correcto. E2E local: 145/145 en escritorio y móvil (capturas visuales, sistema de diseño, layout, compra, formulario, Track, varias Kugeln, staff y ventas). La suite completa de CI no se corrió porque no se subió nada. Nada desplegado, nada subido.

## 3. Revisado y correcto (sin cambios)

- Sesiones de staff: token aleatorio de 256 bits, guardado con hash, caduca (12 h deslizantes, 7 días máximo); cambio de contraseña cierra las demás sesiones; límite de intentos por cuenta + cliente.
- Todas las rutas `/api` exigen sesión salvo la lista explícita de públicas; el resto se deniega.
- Precios y disponibilidad calculados solo en el servidor; consultas a la base siempre con parámetros.
- Webhook de Stripe: firma HMAC con comparación en tiempo constante, tolerancia de 5 min, cuerpo limitado a 256 KiB.
- Fotos: tipo detectado por contenido, nombre aleatorio en disco, sin recorrido de rutas, se decodifican antes de guardarse.
- En vivo (artwithgab.com): HTTPS forzado, HSTS, CSP estricta (sin scripts externos ni en línea), `X-Frame-Options: DENY`, `nosniff`, `/api/orders` responde 401 sin sesión.
- Servidor: solo Cloudflare llega al puerto 443, base de datos sin puerto público, contenedores sin privilegios nuevos, snapshot diario del disco.
- Dependencias de producción del frontend: 0 vulnerabilidades (`npm audit --omit=dev`).
- Frontend: sin `innerHTML`, enlaces externos con `noreferrer`, redirección al pago solo a Stripe o al mismo origen, staff en trozos separados del bundle público.

## 4. Pendiente — decisiones o pasos del dueño

| # | Qué | Por qué importa |
|---|---|---|
| 1 | **Textos legales reales** (Impressum §5 ECG, AGB, Datenschutz, derecho de desistimiento en personalizados) | La tienda ya cobra con los huecos visibles. Es el riesgo más grande hoy (multas, abogados de abmahnung). Necesita al asesor; no se inventa. |
| 2 | Compra de prueba 4242 y métodos de pago en el Dashboard de Stripe | El pago web completo nunca se verificó en producción. |
| 3 | Regla de rate limit en Cloudflare para Track (`docs/deploy.md`) | Segunda barrera contra adivinar códigos; hoy solo protege el backend. |
| 4 | Subir nginx de 1.27 (sin soporte) a la versión estable actual | Parche de seguridad pendiente desde el 12-nov (`docker pull` se colgaba). |
| 5 | Borrar `PATCH /api/track/{code}/address` | Ya no lo usa nadie; menos superficie de ataque. Recomendado: borrarlo. |
| 6 | Imagen para compartir (`og:image`, 1200×630, foto real de una Kugel) e icono para iPhone | Sin ella, WhatsApp/Instagram muestran el enlace sin foto. |
| 7 | Alta en Google Search Console y envío del sitemap | Sin esto Google tarda semanas en indexar. |
| 8 | Aviso de caída (p. ej. un monitor gratuito sobre `/api/health`) | Hoy nadie se entera si el sitio se cae en un día de mercado. |
| 9 | `npm audit fix` para Vite (4 avisos altos, solo afectan al servidor de desarrollo local) | No toca producción; conviene tenerlo al día. |
| 10 | Probar una restauración del backup una vez | Un backup no probado no es un backup. |

Opcionales de baja prioridad (GLM, P3): Track muestra total y estado de pago a quien tenga el código (por diseño; el código tiene 2 000 millones de combinaciones y hay tope de intentos); `/api/photos/{id}` no tiene límite de peticiones (el id es imposible de adivinar y Cloudflare absorbe el tráfico).

## 5. Mejoras sugeridas (producto y UI)

Sin auditoría visual en esta pasada; son observaciones del código y del sitio en vivo.

- **Datos estructurados** (JSON-LD de negocio local y producto con precio) para que Google muestre precio y ubicación.
- **Página 404 propia**: hoy una dirección mal escrita lleva al inicio sin explicación.
- **Contenido sin JavaScript**: el HTML inicial está vacío; un `<noscript>` con una línea y el enlace a Instagram ayuda a buscadores simples y a vistas previas.
- **`hreflang` / URL por idioma**: el inglés solo existe tras pulsar el selector, así que Google solo indexa el alemán. Si se quiere tráfico en inglés hace falta `/en`.
- **Pantalla de carga del staff**: es un «Loading…» de texto; podría usar el mismo esqueleto que las listas.
- **Bundle inicial** 385 kB (122 kB comprimido): correcto, pero la escena del Home y todo el diccionario DE+EN viajan en la primera carga; se puede partir si algún día pesa.
- **Segundo factor para el staff**: hoy es solo contraseña (bien protegida). Con dos cuentas basta por ahora; si crece el equipo, añadir TOTP.
