# Actualizar Stock Zambrana

## Cuando usarla

Usar esta skill cuando el usuario pida agregar, quitar, corregir, marcar vendido, marcar reservado, destacar o actualizar vehiculos del catalogo.

## Objetivo

Actualizar el stock manteniendo compatibilidad con el catalogo, fichas individuales, imagenes, filtros, WhatsApp y diseño existente.

## Reglas

- Revisar la estructura actual de `vehicles.js` antes de editar.
- Mantener compatibilidad con autos existentes.
- No cambiar arquitectura.
- No crear backend, panel, login ni base de datos.
- No modificar diseño si el pedido es solo de stock.
- No inventar datos comerciales faltantes.
- Si faltan datos, dejar listado claro de pendientes.
- Si se marca vendido, evitar que aparezca como oportunidad destacada.
- No borrar vehiculos sin confirmar si el usuario pidio solo ocultar, pausar o marcar estado.

## Checklist

- Verificar `slug` unico y estable.
- Verificar marca.
- Verificar modelo.
- Verificar version o nombre completo.
- Verificar año.
- Verificar kilometraje o dejar `Consultar` si corresponde.
- Verificar precio visible y `priceValue` coherente.
- Verificar combustible.
- Verificar transmision.
- Verificar color.
- Verificar estado: disponible, vendido, reservado, señalado o en preparacion segun criterio vigente.
- Verificar portada.
- Verificar galeria.
- Verificar destacado u orden de aparicion si aplica.
- Revisar que el vehiculo aparezca correctamente en catalogo.
- Revisar que la ficha individual cargue por `slug`.
- Revisar que el WhatsApp de ficha incluya el vehiculo correcto.
- Revisar que filtros por marca, tipo, año y precio sigan funcionando.

## Formato de respuesta esperado

- Vehiculos modificados.
- Campos actualizados.
- Datos pendientes, si los hay.
- Validaciones realizadas.
- Riesgos detectados.
- Estado final: listo / requiere datos / requiere revision visual.
