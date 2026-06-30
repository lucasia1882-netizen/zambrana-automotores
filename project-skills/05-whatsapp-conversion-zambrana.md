# WhatsApp Conversion Zambrana

## Cuando usarla

Usar esta skill cuando el pedido toque WhatsApp, CTAs, mensajes de consulta, numero telefonico, fichas de vehiculos, home, financiacion o conversion.

## Objetivo

Asegurar que todos los caminos importantes abran WhatsApp con el numero correcto y un mensaje comercial claro.

## Reglas

- Revisar todos los links a WhatsApp.
- Detectar numeros repetidos o inconsistentes.
- Recomendar centralizar el numero si corresponde.
- No cambiar el numero sin confirmacion.
- No dejar botones genericos tipo "Hola, quiero consultar" si se puede mejorar con contexto.
- Cada ficha debe abrir WhatsApp con consulta especifica del auto.
- Home y financiacion deben tener mensajes comerciales claros.
- No inventar condiciones comerciales.

## Checklist

- Revisar WhatsApp flotante.
- Revisar WhatsApp del header/nav.
- Revisar CTA principal del hero.
- Revisar CTA de catalogo.
- Revisar CTA de ficha individual.
- Revisar CTA de financiacion, si existe.
- Revisar CTA de toma de usados.
- Revisar footer.
- Verificar que el numero sea consistente.
- Verificar si el numero esta centralizado en `config.js` o repetido en HTML.
- Verificar mensajes por vehiculo: nombre, modelo y año.
- Verificar mensajes generales: origen web y motivo de consulta.
- Verificar que los links usen `encodeURIComponent` cuando se generen por JS.
- Verificar que no haya botones muertos o anchors incorrectos.

## Formato de respuesta esperado

- Cantidad de links revisados.
- Numero detectado.
- Lugares donde se repite.
- Mensajes generales encontrados.
- Mensajes por vehiculo encontrados.
- Problemas o inconsistencias.
- Recomendaciones concretas.
- Estado final: OK / requiere centralizacion / requiere mejora de mensajes.
