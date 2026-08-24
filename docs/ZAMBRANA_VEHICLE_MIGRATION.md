# Migración de `vehicles.js` a Supabase

El script `scripts/migrate-vehicles-to-supabase.mjs` lee directamente
`window.zambranaVehicles`, valida su contenido, consulta los slugs actuales de
Supabase y clasifica cada registro como faltante, coincidencia exacta o
conflicto. No migra imágenes ni modifica los archivos de la web pública.

## Requisitos

- Node.js 18 o posterior.
- `SUPABASE_URL` del proyecto.
- La `service_role key` disponible solo en la terminal local durante la
  migración. No debe guardarse en el repositorio, `admin-config.js`, el
  navegador ni ningún archivo servido públicamente.

## Ejecución segura en PowerShell

Primero se puede validar únicamente la fuente, sin credenciales:

```powershell
node scripts/migrate-vehicles-to-supabase.mjs --source-only
```

Para hacer el preflight contra Supabase sin escribir:

```powershell
$env:SUPABASE_URL = "https://TU-PROYECTO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "TU-SERVICE-ROLE-KEY"
node scripts/migrate-vehicles-to-supabase.mjs
```

El preflight informa los registros faltantes, ya migrados y conflictivos. Si
el resultado es correcto, la inserción se habilita explícitamente:

```powershell
node scripts/migrate-vehicles-to-supabase.mjs --apply
```

Al terminar, retirar la credencial de la sesión:

```powershell
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
```

## Comportamiento e idempotencia

- Los slugs se copian textualmente; no se regeneran ni normalizan.
- Los primeros seis elementos del array se marcan como destacados con orden
  del 1 al 6.
- Los precios usan exclusivamente `priceValue`; los kilometrajes usan `kms`.
- `legacy_source_path` conserva el slug y la ruta de la imagen principal del
  registro original para facilitar una migración posterior de imágenes.
- Los slugs existentes nunca se actualizan ni sobrescriben automáticamente.
- Las coincidencias exactas se omiten.
- Los conflictos se informan campo por campo y se omiten.
- La inserción por lote usa conflicto por `slug` con `ignore-duplicates`, por
  lo que una segunda ejecución no crea duplicados y también queda protegida
  ante una inserción concurrente.
- Después de `--apply`, el script vuelve a leer los registros y compara todos
  los campos migrados vehículo por vehículo.
- Si hay slugs duplicados o registros inválidos dentro de `vehicles.js`, la
  migración se cancela antes de consultar o escribir en Supabase.

Los códigos de salida son `0` para éxito, `1` para un error de ejecución y `2`
cuando existen conflictos o la validación posterior no coincide por completo.
