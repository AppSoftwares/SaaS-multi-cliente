# Inventario Ferretería IA

App **mobile-first** para controlar el inventario de una ferretería con captura por
**voz + cámara + IA**, escaneo de **código de barras**, alertas de reposición y
sincronización con Excel del software de facturación.

## Stack
- **Next.js 16** (App Router) · TypeScript · Tailwind v4 · shadcn/ui (Base UI)
- **Supabase** — PostgreSQL, Auth, Storage (con Row Level Security)
- **OpenAI** `gpt-4o-mini` — Structured Outputs + Vision
- **SheetJS (xlsx)** — reportes e importación
- **@zxing/browser** — escaneo de código de barras
- **browser-image-compression** — compresión de fotos en el cliente

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y rellena tus credenciales
```

1. Configura Supabase siguiendo **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)**
   (crear proyecto, aplicar migraciones, bucket, desactivar confirmación de email).
2. Rellena `.env.local` con las llaves de Supabase y OpenAI.
3. Arranca:
   ```bash
   npm run dev
   ```

## Funcionalidades

- **Captura híbrida** (`/capturar`):
  - *Escanear código* → repone stock de productos existentes al instante.
  - *Foto + voz* → la IA extrae los datos y el **wizard** deja crear el producto.
- **Detección de duplicados** segura (código de barras → SKU → nombre) al crear.
- **Stock atómico**: todo cambio pasa por la RPC `registrar_movimiento` (sin condiciones de carrera) y queda auditado en `movimientos_inventario`.
- **Roles (RBAC)**: `ADMIN` ve costos/márgenes/reportes; `ALMACEN` no ve el costo (aplicado por RLS).
- **Dashboard** con valor de inventario y **alertas de reposición** (stock ≤ mínimo).
- **Reportes Excel** (`/reportes`, ADMIN): inventario valorizado, reposición, movimientos por fecha.
- **Importar Excel** (`/importar`, ADMIN): sube el Excel de ventas de facturación,
  con vista previa que valida cada fila (coincide / sin datos / nueva) antes de aplicar,
  en modo *vendido* (resta) o *stock final* (fija). Transaccional vía `importar_movimientos`.

## Estructura

```
src/
  app/
    (app)/                 rutas protegidas (dashboard, productos, capturar, ...)
    login/  onboarding/    autenticación y alta de negocio
    api/procesar-ia/       extracción con IA + detección de duplicados
    api/commit/            confirmación (crea producto / suma stock)
  components/              wizard, captura, importar, nav, acciones
  lib/
    supabase/              clientes SSR (browser/server) + proxy de sesión
    openai.ts              esquema estricto + extracción con Vision
    importar-excel.ts      parseo y detección de columnas
    reportes.ts            generación de .xlsx
supabase/migrations/       esquema, RLS, RPCs, storage
```

## Notas
- Multi-tienda **listo**: todas las tablas llevan `negocio_id` y la RLS ya scopa por
  negocio. Hoy opera como una sola ferretería.
- Pendiente sugerido: rate-limit del endpoint de IA para controlar costo de OpenAI,
  y una pantalla de gestión de usuarios/roles.
