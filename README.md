# Ferretería IA — SaaS Multi-Cliente (Rose Industry)

Sistema integral **Cloud POS, Inventario Inteligente y ERP Móvil** para ferreterías, arquitecturado como una plataforma **SaaS Multi-Tenant** con aislamiento estricto por organización (Row Level Security), inteligencia artificial integrada (OpenAI), y soporte nativo multiplataforma mediante **Capacitor** (Android e iOS).

---

## 🚀 Características Principales

### 1. POS & Inventario Inteligente
- **Captura Híbrida**: Escaneo de códigos de barras (EAN-13, Code128 con ML Kit / ZXing), dictado por voz y captura de productos con foto + IA (`gpt-4o-mini` Vision con Structured Outputs).
- **Gestión de Turnos y Caja**: Apertura de caja con montos en Bolívares (Bs) y Dólares ($), control de ventas por vendedor, impresión de tickets térmicos (Bluetooth ESC/POS o PDF compartido) y cierre de caja detallado.
- **Importación y Reportes**: Importación transaccional masiva de ventas/inventario desde Excel (`xlsx`) con vista previa de validación y generación de reportes valorizados.

### 2. Modelo SaaS Multi-Empresa (Multi-Tenant)
- **Aislamiento por Negocio**: Cada ferretería opera en su propio espacio aislado mediante **Row Level Security (RLS)** en PostgreSQL, garantizando que ninguna empresa vea datos de otra.
- **Membresías y Roles Múltiples**: Un usuario (dueño, contador, gerente o vendedor) puede pertenecer y alternar entre varias ferreterías sin reautenticarse.
- **Planes, Suscripciones y Cuotas**: Gestión de planes, ciclos de facturación, estado de prueba gratuita (14 días), registro de pagos manuales (Pago Móvil, Zelle, Transferencia, Binance) y control estricto de límites por plan.
- **Cuotas de IA por Negocio**: Control de consumo de tokens y llamadas a la IA por organización para proteger el presupuesto de la plataforma.

### 3. Aplicación Móvil Nativa (Capacitor)
- **Modo WebView Remoto**: Conexión directa a la app desplegada en Vercel con soporte completo de cookies, SSR y rutas API, asegurando actualizaciones instantáneas sin pasar por las tiendas.
- **Plugins Nativos**: Escáner de código de barras ML Kit, dictado por voz offline/nativo, manejo de archivos y recursos (`@capacitor/filesystem` + `@capacitor/share`), impresión térmica BLE y biometría opcional.
- **Workflows CI/CD**: Automatización con GitHub Actions para generar APKs de Android firmados y archivos IPA para TestFlight/App Store.

### 4. Pantalla de Ajustes Avanzada (Inspirada en BiMoneda)
- **Perfil de Empresa**: Datos fiscales (RIF, razón social, domicilio, datos de imprenta autorizada).
- **Seguridad y Cuenta**: Actualización de datos de usuario, cambio de contraseña con verificación de clave actual, cierre de sesión remota y opción de eliminación de cuenta.
- **Preferencias**: Configuración de notificaciones push, modo de apariencia (Claro/Oscuro/Sistema) y gestión de empresas.

---

## 🛠️ Stack Tecnológico

- **Frontend & SSR**: [Next.js 16](https://nextjs.org/) (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui.
- **Backend & Base de Datos**: [Supabase](https://supabase.com/) (PostgreSQL, Auth `@supabase/ssr`, Storage, RLS, RPCs con `SECURITY DEFINER`).
- **Mobile Wrapper**: [Capacitor 6](https://capacitorjs.com/) (`@capacitor/android`, `@capacitor/ios`, plugins ML Kit, Bluetooth, Filesystem, Share, Network).
- **Inteligencia Artificial**: [OpenAI API](https://openai.com/) (`gpt-4o-mini` para extracción estructurada y análisis visual de facturas/productos).
- **Utilidades**: SheetJS (`xlsx`) para Excel, `zod` para validaciones, `sonner` para notificaciones toast.

---

## 📁 Estructura del Proyecto

```text
src/
  app/
    (app)/                 # Rutas protegidas (dashboard, POS, inventario, reportes)
    ajustes/               # Pantalla y subrutas de ajustes (empresa, cuenta, seguridad, etc.)
    plataforma/            # Panel administrativo global para el dueño del SaaS
    login/ onboarding/     # Autenticación y alta de negocio autónoma
    api/                   # Endpoints de API (IA, procesamiento de facturas, pagos, etc.)
  components/              # Componentes UI reutilizables, POS, captura, navegación
  lib/                     # Clientes Supabase, helpers nativos Capacitor, utilidades
supabase/
  migrations/              # Migraciones SQL secuenciales e inmutables (0001 a 0032+)
capacitor.config.ts        # Configuración de Capacitor y WebView remoto
.github/workflows/         # Pipelines CI/CD para compilación de APK y IPA
```

---

## ⚙️ Puesta en Marcha Local

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/AppSoftwares/SaaS-multi-cliente.git
   cd SaaS-multi-cliente
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**:
   Crea un archivo `.env.local` basado en `.env.example`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   OPENAI_API_KEY=tu_openai_api_key
   ```

4. **Aplicar migraciones SQL** en tu proyecto de Supabase (`supabase/migrations/`).

5. **Ejecutar en entorno de desarrollo**:
   ```bash
   npm run dev
   ```

6. **Verificar compilación de producción**:
   ```bash
   npm run build
   ```

---

## 📱 Sincronización y Capacitor (Android / iOS)

Para preparar los proyectos nativos de Capacitor:
```bash
npx cap sync
```

- **Android**:
  ```bash
  npx cap open android
  ```
  *(Compilar APK/AAB con Gradle).*

- **iOS**:
  ```bash
  npx cap open ios
  ```
  *(Requiere macOS y Xcode, o GitHub Actions).*

---

## 📄 Licencia y Prividez

Desarrollado por **App Sotfwares**. Todos los derechos reservados.
Sistema protegido por politicas de aislamiento multi-cliente y normativas de seguridad de datos comerciales.
