# Web pública con Supabase y rollback legacy

## 1. Arquitectura

La web continúa siendo HTML, CSS y JavaScript sin React ni dependencias nuevas.
Las páginas cargan, en este orden:

1. `config.js`: configuración comercial existente;
2. `public-config.js`: feature flag, URL y publishable key;
3. `vehicles.js`: catálogo legacy disponible para rollback;
4. `public-vehicles.js`: consulta, firma y transformación de datos;
5. `script.js` y, en el catálogo, `catalog.js`: renderizado existente.

`public-vehicles.js` expone `window.ZambranaPublicVehicles.ready`. Home,
catálogo y ficha esperan esa misma promesa antes de renderizar, evitando un
flash del catálogo legacy mientras Supabase responde.

## 2. Fuente principal

Con `USE_SUPABASE_VEHICLES: true`, Supabase es la única fuente del catálogo.
Se realiza una consulta REST de vehículos con la relación `vehicle_images`:

```text
vehicles
  ?select=<campos>,vehicle_images(...)
  &is_published=eq.true
  &order=is_featured.desc,featured_order.asc.nullslast,created_at.desc
  &vehicle_images.order=position.asc
```

RLS vuelve obligatorio el filtro de publicación en la base, incluso si un
cliente intenta cambiar manualmente la URL de la consulta.

## 3. Feature flag

La bandera está en `public-config.js`:

```js
USE_SUPABASE_VEHICLES: true
```

- `true`: intenta cargar Supabase y usa legacy solo ante un fallo global.
- `false`: no consulta Supabase y usa exclusivamente `vehicles.js`.

El cambio no escribe ni altera datos de Supabase.

## 4. Fallback

Un error de configuración, red, timeout, respuesta inválida o fallo global al
firmar imágenes activa un fallback completo a `vehicles.js`. No se mezclan
ambos catálogos. La página muestra un aviso de que utiliza el respaldo.

Una respuesta válida con cero vehículos publicados se considera un catálogo
vacío, no un error, y no activa el fallback.

La única combinación intencional es visual y está limitada al Citroën C3
`citroen-c3-exclusive-14-hdi-2007`: si su fila publicada no tiene imágenes
válidas en Supabase, usa temporalmente las ocho imágenes correctas existentes
en `assets/vehiculos/c3`. Nunca usa las referencias de Titano. Cuando el C3
tenga imágenes válidas en Supabase, estas reemplazarán automáticamente el
fallback específico.

## 5. Configuración pública

`public-config.js` contiene únicamente:

- Project URL;
- publishable key;
- feature flag;
- vencimiento de URLs firmadas;
- timeout de carga.

La publishable key es pública y su capacidad depende de RLS. Nunca deben
colocarse en ese archivo `service_role`, secret keys, contraseñas o tokens de
usuarios administradores.

## 6. Mapeo de datos

| Supabase | Web legacy |
| --- | --- |
| `full_name` | `fullName` |
| `mileage` | `kms` |
| `price_amount` | `priceValue` |
| precio formateado ARS/USD | `price` |
| `short_description` | `shortDescription` |
| `is_featured` | `isFeatured` |
| `featured_order` | `featuredOrder` |
| `is_published` | `isPublished` |

`price_amount = null` genera `priceValue: null` y el texto `Consultar`.
`mileage = null` genera `kms: null` y el frontend muestra `Consultar`.

## 7. Imágenes

El bucket `vehicle-images` continúa privado. Después de traer la relación en
la consulta de vehículos, la capa reúne todas las rutas y solicita URLs
firmadas en lotes de hasta 100. De este modo no hay una consulta por vehículo
ni una firma por imagen.

Las imágenes se ordenan por `position`. La fila con `is_cover = true` se usa
como `image`; las restantes se exponen como `gallery` sin duplicar la portada.
Una unidad sin imágenes utiliza el logo institucional como placeholder seguro,
salvo el fallback específico y documentado del C3.

## 8. Estados

| Supabase | Web pública |
| --- | --- |
| `available` | Disponible |
| `reserved` | Reservado |
| `preparing` | En preparación |
| `sold` | Vendido |

Un vehículo vendido permanece visible si está publicado.

## 9. Publicación y seguridad

La visibilidad depende exclusivamente de `is_published`. Las políticas
instaladas establecen:

- `anon`: `SELECT` de vehículos publicados y sus imágenes;
- `anon`: sin `INSERT`, `UPDATE` ni `DELETE`;
- vehículos no publicados: invisibles para usuarios anónimos;
- Storage: lectura anónima solamente cuando el objeto está asociado a una
  imagen de un vehículo publicado;
- escrituras: reservadas a usuarios autenticados con perfil administrativo
  activo.

## 10. Destacados

La home usa `is_featured = true`, ordenado por `featured_order`, con un máximo
de seis unidades. Si existen menos de seis, completa con vehículos publicados
en estado Disponible sin repetir slugs. El carrusel nunca renderiza más de seis
vehículos.

## 11. Rollback

Editar únicamente `public-config.js`:

```js
USE_SUPABASE_VEHICLES: false
```

Luego desplegar/recargar los archivos estáticos. La web vuelve a usar
`vehicles.js`; Supabase no se modifica. Para restaurar la fuente principal,
cambiar nuevamente la bandera a `true`.

No eliminar `vehicles.js`, `Catalogo` ni `assets/vehiculos` hasta retirar
formalmente esta estrategia de rollback.

## 12. Checklist de producción

- [ ] `USE_SUPABASE_VEHICLES` está en `true`.
- [ ] La configuración contiene publishable key, nunca credenciales privadas.
- [ ] RLS permite leer publicados y oculta no publicados.
- [ ] RLS bloquea escrituras anónimas.
- [ ] Los destacados tienen orden único y coherente.
- [ ] Todos los vehículos, salvo excepciones documentadas, tienen portada.
- [ ] El C3 fue corregido y migrado antes de retirar su fallback específico.
- [ ] Home muestra como máximo seis destacados distintos.
- [ ] Búsqueda, filtros, orden y paginación funcionan.
- [ ] Fichas históricas conservan exactamente sus slugs.
- [ ] Precio y kilometraje nulos muestran `Consultar`.
- [ ] Un vehículo no publicado no aparece por catálogo, búsqueda ni URL directa.
- [ ] El rollback con bandera `false` fue probado en el entorno desplegado.
- [ ] Se revisaron consola, carga móvil y expiración/renovación al recargar URLs.
