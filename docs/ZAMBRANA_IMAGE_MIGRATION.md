# Migración de imágenes actuales a Supabase

El script `scripts/migrate-vehicle-images-to-supabase.mjs` migra solamente las
rutas mencionadas en `image` y `gallery` dentro de `vehicles.js`. No recorre
`Catalogo`, no descubre fotografías adicionales y no modifica la web pública.

## Funcionamiento

Para cada uno de los 24 vehículos originales, el script:

1. coloca `image` en la posición 0 y después conserva el orden de `gallery`;
2. elimina rutas duplicadas dentro del vehículo;
3. valida existencia, formato real, dimensiones y límite de 10 MB;
4. obtiene el vehículo de Supabase por su slug exacto;
5. genera un UUID v5 estable usando `vehicle.id` y la ruta local original;
6. proyecta la ruta `vehicles/<vehicle-id>/<image-id>.<extension>`;
7. compara la fila `vehicle_images` y el objeto Storage esperados;
8. omite coincidencias completas y bloquea metadata incompatible;
9. con `--apply`, sube objetos faltantes e inserta las filas en lote;
10. vuelve a consultar Database y Storage y valida vehículo por vehículo.

El UUID determinístico sigue siendo independiente para cada fotografía, pero
permite reconstruir exactamente su identidad en una segunda ejecución sin
guardar rutas locales en nuevas columnas ni duplicar objetos.

## Dry-run y ejecución

Requiere Node.js 18 o posterior. La auditoría exclusivamente local no necesita
credenciales:

```powershell
node scripts/migrate-vehicle-images-to-supabase.mjs --source-only
```

Para el preflight completo, cargar temporalmente las credenciales en la misma
terminal de PowerShell:

```powershell
$env:SUPABASE_URL = "https://TU-PROYECTO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "TU-SERVICE-ROLE-KEY"
node scripts/migrate-vehicle-images-to-supabase.mjs
```

El comando anterior no escribe. Para aplicar únicamente vehículos sin
conflictos:

```powershell
node scripts/migrate-vehicle-images-to-supabase.mjs --apply
```

Al terminar, retirar las variables de la sesión:

```powershell
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
```

La `service_role key` nunca debe copiarse a archivos del repositorio,
`admin-config.js`, código del navegador o documentación real.

## Conflictos y continuidad

Un archivo faltante, no soportado, mayor a 10 MB, incompatible con su extensión
o compartido entre dos vehículos bloquea solamente a los vehículos afectados.
Esto evita crear posiciones incompletas o portadas incorrectas y permite que el
resto continúe. También se bloquea un vehículo si ya contiene filas u objetos
que no corresponden al manifiesto determinístico o si su metadata difiere.

El Citroën C3 `citroen-c3-exclusive-14-hdi-2007` se marca expresamente como
conflicto mientras apunte a `assets/vehiculos/titano`. Sus imágenes se omiten
completamente y el script no corrige sus archivos ni referencias.

## Idempotencia y recuperación ante fallos

- Storage se escribe con `x-upsert: false`: nunca se sobrescribe un objeto.
- Las filas se insertan por lote con conflicto por `id` e `ignore-duplicates`.
- Una coincidencia completa se omite.
- Una fila correcta sin objeto puede reparar el objeto faltante.
- Un objeto compatible sin fila puede reparar la fila faltante.
- Cualquier incompatibilidad se informa y no se sobrescribe.
- Si falla una inserción después de subir objetos nuevos, el script intenta
  eliminar solamente los objetos subidos en esa ejecución que todavía no
  tenían fila. Los objetos que estaban reparando filas existentes se conservan.

## Rollback

No hay rollback automático global porque Database y Storage no comparten una
transacción y podrían existir cambios administrativos posteriores. Para
revertir de forma segura:

1. ejecutar primero el dry-run y conservar su salida con las rutas exactas;
2. retirar en `vehicle_images` únicamente los UUID/rutas creados por el
   manifiesto de esta migración;
3. eliminar del bucket `vehicle-images` esas mismas rutas exactas;
4. volver a ejecutar el dry-run y confirmar que aparecen como faltantes;
5. no borrar carpetas completas por `vehicle-id`, ya que podrían contener
   imágenes agregadas posteriormente desde `/admin`.

La compensación automática durante un error de `--apply` es más limitada y
solo actúa sobre objetos recién subidos por esa ejecución.

## Validación posterior

Después de `--apply` se comprueban nuevamente cantidad, portada, posiciones,
ruta Storage, alt text, MIME, dimensiones y tamaño para cada imagen. El resumen
final informa vehículos completos, parciales u omitidos, imágenes subidas u
omitidas, filas insertadas, errores y conflictos.

Los códigos de salida son `0` para éxito completo, `1` para error de ejecución
y `2` cuando el preflight o la validación final mantienen conflictos o estados
parciales.
