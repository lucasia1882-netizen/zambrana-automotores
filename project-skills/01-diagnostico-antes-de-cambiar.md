# Diagnostico Antes De Cambiar

## Cuando usarla

Usar esta skill antes de modificar cualquier archivo de la web de Zambrana Automotores, especialmente si el pedido toca home, catalogo, fichas, WhatsApp, formularios, responsive, imagenes, SEO o lanzamiento.

## Objetivo

Entender el estado real del proyecto, detectar riesgos y definir el proximo paso recomendado sin modificar archivos.

## Reglas

- No modificar archivos durante esta skill.
- No editar HTML, CSS, JS, `vehicles.js`, assets ni integraciones.
- No crear funciones, backend, panel ni login.
- No refactorizar.
- Leer primero la estructura actual del proyecto.
- Separar hechos comprobados de recomendaciones.
- Priorizar problemas que afecten venta, consulta, stock o publicacion.

## Checklist

- Revisar estado general del proyecto.
- Identificar archivos principales e implicados.
- Revisar como esta armado el catalogo.
- Revisar donde se cargan vehiculos y datos.
- Revisar manejo de imagenes, galerias, estados y datos.
- Revisar home: hero, propuesta comercial, CTAs, WhatsApp, secciones repetidas o flojas.
- Revisar catalogo: cards, filtros, orden, paginacion, datos faltantes y mantenimiento.
- Revisar ficha individual: carga por slug, fotos, datos, CTA y errores posibles.
- Revisar WhatsApp: links, numero, mensajes generales y mensajes por vehiculo.
- Revisar mobile/responsive: cortes, botones, cards, filtros y peso visual.
- Revisar performance: imagenes pesadas, videos, lazy loading y carga inicial.
- Revisar SEO basico: title, meta description, H1, textos principales y fichas.
- Revisar mantenimiento: si conviene seguir con `vehicles.js` y que flujo minimo usar.
- Listar riesgos antes de lanzamiento.

## Clasificacion de hallazgos

Separar siempre en:

- A) Critico antes de publicar.
- B) Importante pero puede esperar.
- C) Mejoras futuras.

## Formato de respuesta esperado

- Estado general: Verde / Amarillo / Rojo.
- Resumen ejecutivo en 5 lineas.
- Archivos relevantes detectados.
- Problemas encontrados.
- Recomendaciones por prioridad.
- Que no conviene tocar todavia.
- Proximo paso recomendado.
