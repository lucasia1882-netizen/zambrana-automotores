# Conexion del formulario con Google Sheets

Esta web ya envia un `POST` JSON con estos campos:

- `name`
- `phone`
- `message`
- `source`
- `channel`
- `status`
- `vendor`
- `pageUrl`
- `pageTitle`
- `createdAt`
- `submittedAt`

## Estructura del archivo

El script `zambrana-leads.gs` esta preparado para escribir en una hoja llamada:

`📋 Leads`

Y asume que los encabezados reales estan en la fila `3`.

## Pasos

1. Abrir el archivo en Google Sheets.
2. Ir a `Extensiones -> Apps Script`.
3. Crear un proyecto nuevo.
4. Pegar el contenido de `zambrana-leads.gs`.
5. Reemplazar:

`PEGAR_SPREADSHEET_ID_ACA`

por el ID real del Google Sheet.

6. Guardar.
7. Ir a `Implementar -> Nueva implementacion`.
8. Elegir `Aplicacion web`.
9. Ejecutar como:

`Tu cuenta`

10. Acceso:

`Cualquiera`

o `Cualquiera con el enlace`, segun prefieras.

11. Copiar la URL del Web App.
12. Pegar esa URL en:

`config.js`

en la propiedad:

`googleSheetsEndpoint`

## Mapeo con tus columnas

La insercion queda asi:

- `A - ID` -> consecutivo tipo `001`, `002`, `003`
- `B - FECHA ENTRADA` -> fecha del envio
- `C - NOMBRE Y APELLIDO` -> `name`
- `D - TELEFONO` -> `phone`
- `E - CONSULTA` -> `message`
- `F - FUENTE` -> `source`
- `G - ESTADO` -> `Nuevo`
- `H - VENDEDOR` -> vacio
- `I - FECHA CONTACTO` -> vacio
- `J - CANAL CONTACTO` -> `Web`
- `K - NOTAS DE SEGUIMIENTO` -> URL y metadatos del envio
- `L - RESULTADO` -> vacio
- `M - DIAS SIN CONTACTO` -> vacio

## Recomendacion

Si queres, despues podemos hacer una segunda pasada para:

- asignar vendedor automaticamente,
- tomar el auto de interes desde la ficha,
- marcar estado inicial distinto segun canal,
- o separar leads de home y leads de ficha.
