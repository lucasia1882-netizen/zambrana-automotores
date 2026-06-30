# Imagenes Vehiculos Zambrana

## Cuando usarla

Usar esta skill cuando se agreguen, reemplacen, ordenen, revisen o diagnostiquen imagenes de vehiculos del catalogo.

## Objetivo

Mantener imagenes consistentes, livianas y compatibles con cards, galerias y fichas individuales.

## Reglas

- Usar carpetas y nombres consistentes.
- Evitar espacios raros, tildes, eñes, guiones largos o caracteres especiales en rutas.
- Preferir nombres simples: `foto-01.jpeg`, `foto-02.jpeg`, etc.
- No borrar imagenes sin confirmacion explicita.
- No cambiar diseño por un problema de imagenes.
- Mantener compatibilidad con catalogo y ficha individual.
- No dejar referencias a archivos inexistentes.

## Checklist

- Revisar carpeta del vehiculo.
- Revisar imagen de portada.
- Revisar `cardImage` si existe.
- Revisar galeria completa.
- Detectar imagenes rotas o rutas inexistentes.
- Confirmar que las rutas usadas en `vehicles.js` existen.
- Revisar formatos: preferir `.webp`, `.jpg` o `.jpeg` compatibles.
- Evitar `.heic` para web publica salvo que haya fallback compatible.
- Recomendar peso razonable: ideal menor a 300-500 KB por imagen de card y menor a 1 MB por imagen grande.
- Revisar orientacion y encuadre de portada.
- Revisar que las imagenes no rompan mobile.
- Revisar que no haya duplicados innecesarios en galeria.

## Formato de respuesta esperado

- Vehiculo o carpeta revisada.
- Imagenes correctas.
- Imagenes rotas o faltantes.
- Imagenes pesadas.
- Recomendaciones concretas.
- Archivos que no se deben borrar sin confirmacion.
- Estado final: OK / requiere conversion / requiere reemplazo.
