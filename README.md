SISTEMA GUIAS DE MOVIIZACION VERSION OFICIAL

Plataforma Premium de Despacho Inteligente de Gas. Sistema bimonetario con gestión de cuotas de combustible (Gasolina/Gasoil) y portal de beneficiarios.

## 🚀 Stack Tecnológico
- **Frontend**: Next.js 16 (App Router) con TypeScript y TailwindCSS.
- **Backend/API**: Next.js Route Handlers (ubicados en `src/server_logic/_api`).
- **Base de Datos**: Supabase (PostgreSQL) con Supabase JS SDK.
- **App Móvil**: Capacitor (Android Nativo).
- **Despliegue**: Vercel.

## 🛠️ Configuración Local

1. **Instalar Dependencias**:
   ```bash
   npm install
   ```

2. **Variables de Entorno**:
   Crea un archivo `.env.local` con las siguientes claves:
   ```env
   DATABASE_URL="tu_url_de_pooler_supabase"
   SUPABASE_URL="tu_url_supabase"
   SUPABASE_ANON_KEY="tu_anon_key"
   SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key"
   SECRET_KEY="tu_clave_secreta_jwt"
   ```

3. **Ejecutar en Desarrollo**:
   ```bash
   npm run dev
   ```

## 📱 Compilación Android (Capacitor)

Para generar el APK de la aplicación:
1. Generar el build estático:
   ```bash
   npm run build
   ```
2. Sincronizar con el proyecto Android:
   ```bash
   npx cap sync
   ```
3. Abrir en Android Studio para generar el APK firmado:
   ```bash
   npx cap open android
   ```

## 📁 Estructura del Proyecto
- `src/app`: Páginas y layouts de Next.js (Admin y Cliente).
- `src/server_logic/_api`: Lógica interna de la API (Auth, Clientes, Retiros).
- `src/contexts`: Contextos de React para autenticación persistente.
- `android/`: Código fuente nativo de la app Android.

## 📄 Documentación Adicional
- [Guía de Despliegue en Vercel](file:///c:/Users/Usuario/Desktop/Despacho%20gas+/despacho-gas/GUIA_DESPLIEGUE_VERCEL.md)
- [Documentación de Base de Datos](file:///c:/Users/Usuario/Desktop/Despacho%20gas+/despacho-gas/DOCUMENTACION_DATABASE.md)
- [Fix de Reset de Litros](file:///c:/Users/Usuario/Desktop/Despacho%20gas+/despacho-gas/GUIA_FIX_DATABASE.md)

## Licencia
MIT
