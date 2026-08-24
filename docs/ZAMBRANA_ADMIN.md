# Zambrana Admin V1

## 1. Arquitectura

El administrador es una aplicación estática aislada dentro de `admin/`:

- `admin/index.html`: login, dashboard y editor.
- `admin/admin.css`: estilos exclusivos del backoffice.
- `admin/admin.js`: Auth, CRUD, validaciones y Storage.
- `admin/admin-config.js`: configuración pública del cliente Supabase.
- `supabase/migrations/202608240001_zambrana_admin_foundation.sql`: esquema reproducible.

No utiliza Vite, React, npm ni un proceso de build. La web pública continúa usando
`index.html`, `catalog.html`, `vehiculo.html`, `script.js`, `catalog.js` y
`vehicles.js` sin cambios.

El navegador usa `@supabase/supabase-js` 2.112.4 como módulo ES desde jsDelivr.
La disponibilidad del administrador requiere acceso a ese CDN y a Supabase.

## 2. Configuración de Supabase

1. Crear un proyecto desde el dashboard de Supabase.
2. Abrir **SQL Editor**.
3. Copiar y ejecutar el contenido completo de
   `supabase/migrations/202608240001_zambrana_admin_foundation.sql`.
4. Confirmar en **Table Editor** que existen:
   - `vehicles`
   - `vehicle_images`
   - `admin_profiles`
5. Confirmar en **Storage** que existe el bucket `vehicle-images`.
6. En **Project Settings → API** o en **Connect**, copiar:
   - Project URL
   - Publishable key; en proyectos anteriores puede figurar como anon key.
7. Completar `admin/admin-config.js`.

No ejecutar la migración parcialmente. Si aparece un error, no continuar creando
políticas a mano: guardar el mensaje completo y corregir la migración de forma
versionada.

## 3. Tablas

### `vehicles`

Contiene los datos comerciales, publicación y destacado. `price_amount` es numérico;
no se almacena un segundo precio formateado. Los estados permitidos son:

- `available`
- `reserved`
- `preparing`
- `sold`

Las monedas permitidas son `ARS` y `USD`. `slug` es único y solo admite minúsculas,
números y guiones simples.

### `vehicle_images`

Relaciona cada fotografía con un vehículo. `position` controla el orden e
`is_cover` identifica la portada. Un índice único parcial impide que un vehículo
tenga más de una portada.

La foreign key usa `on delete cascade`: al eliminar un vehículo también se eliminan
sus filas de imágenes. Los objetos de Storage se eliminan desde el administrador,
porque Postgres no elimina archivos físicos automáticamente.

### `admin_profiles`

Cada fila referencia un usuario de `auth.users`. Los roles iniciales son `admin` y
`editor`. En V1 ambos roles tienen los mismos permisos operativos. El campo `active`
permite bloquear el acceso sin borrar la cuenta de Auth.

## 4. Storage

El bucket se llama `vehicle-images` y acepta:

- `image/jpeg`
- `image/png`
- `image/webp`

El máximo es 10 MB por archivo. HEIC no está permitido.

Las rutas tienen esta forma:

```text
vehicles/<vehicle-id>/<image-id>.<extension>
```

El bucket se crea con `public = false` intencionalmente. La lectura anónima se concede
mediante RLS solo cuando `vehicle_images.storage_path` pertenece a un vehículo
publicado. Marcar el bucket como público en el dashboard anularía esa garantía y
expondría imágenes de borradores mediante URL directa.

El administrador genera URLs firmadas temporales para las previsualizaciones.

## 5. Auth

El panel utiliza login de email y contraseña mediante Supabase Auth.

- No existe formulario de registro.
- Una sesión de Auth no concede por sí sola acceso administrativo.
- Después del login, el panel busca una fila propia y activa en `admin_profiles`.
- Si el perfil no existe o `active = false`, se muestra “Acceso bloqueado”.
- Las sesiones se persisten en el almacenamiento seguro administrado por
  `supabase-js` y el botón **Cerrar sesión** llama a `signOut()`.

En **Authentication → Providers → Email**, mantener habilitado Email y desactivar la
opción que permite nuevos registros si el proyecto será completamente cerrado. El
panel no contiene ninguna llamada a `signUp`; crear las cuentas solo desde el
dashboard.

## 6. RLS

Las tres tablas tienen RLS habilitado.

### Anónimo

- `SELECT` de vehículos únicamente si `is_published = true`.
- `SELECT` de metadata y objetos de imágenes únicamente si el vehículo está publicado.
- Sin permisos de `INSERT`, `UPDATE` o `DELETE`.

### Autenticado y autorizado

La función `is_active_admin()` comprueba que `auth.uid()` tenga un perfil activo con
rol `admin` o `editor`. Solo entonces puede:

- leer todo el inventario;
- crear, editar y eliminar vehículos;
- administrar metadata de imágenes;
- subir, leer y eliminar objetos de `vehicle-images`.

`set_vehicle_cover()` y `reorder_vehicle_images()` validan autorización y ejecutan
los cambios de forma atómica en Postgres.

`admin_profiles` solo permite a un usuario autenticado leer su propia fila. Los
perfiles se administran desde SQL Editor o desde una herramienta de servidor futura,
no desde este panel.

## 7. Crear el primer administrador

1. Abrir **Authentication → Users**.
2. Elegir **Add user → Create new user**.
3. Completar email y una contraseña segura.
4. Crear el usuario con el email confirmado, o confirmar el correo antes de probar.
5. Copiar el UUID del usuario.
6. Abrir **SQL Editor** y ejecutar, reemplazando los valores:

```sql
insert into public.admin_profiles (id, role, active)
values ('UUID_DEL_USUARIO', 'admin', true);
```

Para un editor:

```sql
insert into public.admin_profiles (id, role, active)
values ('UUID_DEL_USUARIO', 'editor', true);
```

Para bloquear una cuenta sin eliminarla:

```sql
update public.admin_profiles
set active = false
where id = 'UUID_DEL_USUARIO';
```

Nunca crear perfiles con UUIDs que no existan en `auth.users`; la foreign key lo
impide.

## 8. Iniciar sesión

El sitio debe servirse por HTTP. Desde la carpeta `zambrana-automotores`, una opción
local sin build es:

```powershell
python -m http.server 8080
```

Luego abrir:

```text
http://localhost:8080/admin/
```

Ingresar con el email y contraseña creados en Supabase. La ruta de producción será
`/admin/` si el hosting publica esta carpeta estática.

## 9. Agregar o editar un vehículo

1. Presionar **+ Nuevo vehículo**.
2. Completar marca, modelo y nombre completo.
3. Revisar el slug generado antes de guardar. Se puede editar durante la creación.
4. Completar precio como número y elegir moneda.
5. Definir estado, publicación y destacado.
6. Si está destacado, indicar un orden no negativo.
7. Agregar las características necesarias.
8. Presionar **Guardar vehículo**.

Al editar una unidad, modificar `full_name` no cambia automáticamente su slug. Esto
preserva las URLs públicas futuras.

La eliminación no aparece como acción rápida en la tabla. Está dentro del editor y
exige escribir `ELIMINAR` como confirmación.

## 10. Subir fotografías

1. Abrir un vehículo existente o seleccionar imágenes durante la creación.
2. Presionar **Seleccionar imágenes**.
3. Elegir uno o más JPG, JPEG, PNG o WEBP de hasta 10 MB cada uno.
4. Guardar el vehículo para subir las imágenes pendientes.
5. Usar las flechas para cambiar el orden.
6. Usar **Portada** para seleccionar la imagen principal.
7. Usar **Eliminar** únicamente después de verificar la fotografía.

La primera imagen de un vehículo sin portada se establece automáticamente como
portada. Si se elimina la portada, la primera imagen restante pasa a ser la nueva.

Si la eliminación de metadata funciona pero Storage no puede borrar el archivo, el
panel avisa que quedó un archivo huérfano. El archivo ya no puede leerse públicamente
porque la política exige metadata asociada.

## 11. Variables y configuración necesarias

Editar `admin/admin-config.js`:

```js
window.zambranaAdminConfig = {
  supabaseUrl: "https://TU-PROYECTO.supabase.co",
  supabaseAnonKey: "TU_PUBLISHABLE_O_ANON_KEY"
};
```

Equivalencias conceptuales:

| Configuración solicitada | Archivo estático |
|---|---|
| `SUPABASE_URL` | `supabaseUrl` |
| `SUPABASE_ANON_KEY` | `supabaseAnonKey` |

Al no existir build, un archivo `.env` no puede inyectar valores en el navegador.
La URL y la publishable/anon key son identificadores públicos y pueden estar en el
cliente. La seguridad depende de grants y RLS.

Nunca colocar en este repositorio:

- `service_role`;
- secret key;
- contraseña de base de datos;
- access token personal;
- claves de Management API.

## Verificación operativa recomendada

Después de configurar un proyecto real:

1. Entrar con un admin activo.
2. Entrar con un usuario Auth sin `admin_profiles` y comprobar el bloqueo.
3. Crear un vehículo sin publicar.
4. Subir dos imágenes, cambiar orden y portada.
5. Editar precio, kilometraje y estado.
6. Publicar y comprobar lectura anónima de fila e imágenes.
7. Retirar y comprobar que la fila y sus imágenes dejan de ser legibles anónimamente.
8. Intentar `INSERT`, `UPDATE` y `DELETE` con la anon key y confirmar denegación.
9. Eliminar una imagen no principal.
10. Eliminar un vehículo de prueba desde la zona de riesgo.

La web pública todavía no lee Supabase en esta fase y no debe usarse para validar
estos registros.
