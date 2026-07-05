# Configuración de Supabase

Sigue estos pasos una sola vez para dejar la base de datos lista.

## 1. Crear el proyecto

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto nuevo.
2. En **Project Settings → API** copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (¡secreto! solo servidor)
3. Pega esos valores en `.env.local` junto con tu `OPENAI_API_KEY`.

## 2. Aplicar las migraciones

Las migraciones están en `supabase/migrations/` y deben ejecutarse **en orden**.

### Opción A — SQL Editor (rápido)
Abre **SQL Editor** en el panel de Supabase y pega/ejecuta el contenido de cada
archivo, en este orden:

1. `0001_esquema_inicial.sql` — tablas, enums, índices, trigger.
2. `0002_rls_y_helpers.sql` — helpers de sesión + Row Level Security.
3. `0003_funciones.sql` — RPCs (movimientos atómicos, importación, bootstrap, KPIs).
4. `0004_storage.sql` — bucket de imágenes `productos-img` + políticas.

### Opción B — CLI de Supabase
```bash
npx supabase link --project-ref <TU-REF>
npx supabase db push
```

## 3. Desactivar confirmación de email (para desarrollo)

En **Authentication → Providers → Email**, desactiva *"Confirm email"* para poder
registrarte y entrar de inmediato. En producción puedes volver a activarlo.

## 4. Primer uso

1. `npm run dev` y abre la app.
2. Regístrate con correo y contraseña.
3. La pantalla de *onboarding* crea tu ferretería y te asigna como **ADMIN**
   (función `bootstrap_negocio`).

## 5. Agregar un operario (rol ALMACEN)

1. Que la persona se registre con su propio correo (quedará sin negocio).
2. Como ADMIN, agrega su fila en `roles_usuario` con tu `negocio_id` y `rol='ALMACEN'`
   (desde el SQL Editor o una futura pantalla de gestión de usuarios):
   ```sql
   insert into roles_usuario (id, negocio_id, rol)
   values ('<user_id_del_operario>', '<tu_negocio_id>', 'ALMACEN');
   ```

> El rol **ALMACEN** no puede ver `precio_costo` ni márgenes: la tabla `productos_costos`
> tiene RLS que la restringe solo a ADMIN.
