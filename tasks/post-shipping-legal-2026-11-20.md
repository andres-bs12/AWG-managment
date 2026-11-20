# Envío por Correos — qué cambia en los textos legales (para el asesor)

**No es texto legal.** Lista de puntos de `frontend/src/content/legal.ts` (DE y EN) que dejan de ser ciertos o necesitan revisión cuando la tienda envía por Österreichische Post en lugar de entregar en mano en Viena. El asesor redacta; nadie inventa el texto.

## AGB
1. **Preise und Bestellung:** «Die Lieferung kostet derzeit 0 €» → hay gastos de envío (5,00 €, editables por el staff; se muestran en el checkout). ¿Se cita el importe o se remite al checkout?
2. **Lieferung und Marktstand:** hoy dice «nur innerhalb Wiens (1010–1230), an Mittwochen und Freitagen», «letzter Liefertag 24. Dezember». Nuevo hecho: envío a toda Austria por Österreichische Post; plazo estimado (rango de días hábiles, no una fecha fija); el envío no se ofrece si no puede llegar antes del 23 de diciembre; recogida en el puesto sigue igual.
3. **Plazo de entrega y retrasos:** el rango es una estimación de Correos. ¿Hace falta una cláusula sobre retrasos del transportista y sobre qué pasa si llega después de Navidad?
4. **Transmisión del riesgo (§ 7b KSchG):** con envío, el riesgo pasa al consumidor cuando recibe el paquete. ¿Qué se dice sobre adornos rotos en el transporte (reclamación, foto del daño, plazo)?
5. **Dirección incorrecta / paquete no recogido:** ¿quién paga el reenvío o la devolución a remitente?
6. **Adornos terminados enviados desde el puesto:** contrato en el puesto pero con envío. ¿Sigue siendo contrato presencial o aplica algo de FAGG (desistimiento de 14 días para productos no personalizados)?

## Widerruf
7. Los personalizados siguen excluidos (§ 18 Abs. 1 Z 3 FAGG). Confirmar que la exclusión cubre el envío y si hay que mencionar los gastos de envío.

## Datenschutz
8. **Destinatarios:** añadir a Österreichische Post AG como destinataria de nombre y dirección de entrega (y e-mail/teléfono si se ponen en la etiqueta para avisos). Base: ejecución del contrato.
9. **Número de seguimiento:** se guarda en el pedido (opcional) y Track enlaza a post.at; post.at tiene su propia política de privacidad.
10. **Speicherdauer:** el número de seguimiento se borra junto con la dirección (60 días tras la entrega; ver `RetentionService`). El texto actual habla de borrar dirección y fotos «hasta el 31 de enero de 2027»: revisar que coincida.

## Impressum
11. Sin cambios por el envío.
