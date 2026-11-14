# Especificación Técnica y Funcional del Proyecto (SPEC.md)

## 1. Objetivo General
Desarrollar una aplicación web **Mobile-First** ultra simple y rápida para la **rendición de gastos de trabajadores en terreno** y el **control centralizado por parte de un administrador**.

---

## 2. Filosofía y Principios de Diseño
- **Principio KISS Estricto:** Mantener cada componente, flujo y vista lo más simple posible.
- **Prohibición de Sobreingeniería:** Prohibidos gráficos complejos, librerías innecesarias, wizards o flujos multipaso.
- **Mobile-First Real:** Diseñado prioritariamente para la experiencia ágil en smartphones en terreno con conexiones variables.
- **Inmutabilidad del Gasto:** Las rendiciones enviadas por los trabajadores no pueden ser modificadas ni borradas por el empleado.

---

## 3. Stack Tecnológico & Restricciones

- **Framework Web:** Next.js (App Router).
- **Estilos:** Tailwind CSS.
- **Backend / BaaS:** Supabase (PostgreSQL, Supabase Auth, Supabase Storage).
- **Librerías de Acceso a Supabase Autorizadas:**
  - `@supabase/ssr`
  - `@supabase/supabase-js`
- **Restricciones Tecnológicas Obligatorias:**
  - **Prohibido** el uso de ORMs (Prisma, Drizzle, TypeORM, etc.). Toda interacción se realiza mediante el cliente oficial de Supabase.
  - **Prohibidas** librerías de visualización de gráficos o paquetes redundantes.
- **Despliegue:** Vercel.

---

## 4. Roles, Permisos y Vistas

### 4.1. Rol `empleado`
- **Experiencia de Usuario:**
  - Formulario de rendición rápido en **1 sola pantalla**.
  - Visualización directa de su propio historial de rendiciones enviadas (orden descendente).
- **Campos Obligatorios del Formulario:**
  1. **Categoría** (lista fija obligatoria):
     - `Bencina`
     - `Transporte`
     - `Comida`
     - `Materiales`
     - `Viáticos`
     - `Otro`
  2. **Número de Comprobante:** Texto identificador del comprobante/boleta/factura.
  3. **Monto:** Número entero sin decimales (CLP).
  4. **Foto del Comprobante:** Permite abrir la cámara trasera en dispositivos móviles (`capture="environment"` con `accept="image/*"`).
- **Restricciones:** No puede editar ni eliminar rendiciones ya enviadas.

### 4.2. Rol `admin`
- **Experiencia de Usuario:**
  - Panel centralizado con visibilidad completa de todas las rendiciones de todos los usuarios.
  - **Tarjetas de Sumatoria Total:** Cálculo dinámico del monto total general.
  - **Filtros Dinámicos:**
    - Por **Usuario**.
    - Por **Área de la empresa** (lista fija obligatoria):
      - `Ingeniería Eléctrica`
      - `Informática`
      - `Administrativo`
      - `Contabilidad`
      - `Ventas`
      - `Logística`
      - `Gerencia`
  - **Tabla de Rendiciones:** Registro detallado de todas las rendiciones con datos del empleado, área, fecha, categoría, comprobante y monto.
  - **Modal Visor de Comprobantes:** Visualización en alta resolución de la foto de la boleta o factura.

---

## 5. Arquitectura de Base de Datos y Almacenamiento (Supabase)

### 5.1. Esquema Relacional (PostgreSQL)

#### Tabla `profiles`
Extensión del usuario autenticado en `auth.users`:
- `id`: `UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- `nombre`: `TEXT NOT NULL`
- `email`: `TEXT NOT NULL`
- `rol`: `TEXT NOT NULL CHECK (rol IN ('admin', 'empleado'))`
- `area`: `TEXT NOT NULL CHECK (area IN ('Ingeniería Eléctrica', 'Informática', 'Administrativo', 'Contabilidad', 'Ventas', 'Logística', 'Gerencia'))`
- `created_at`: `TIMESTAMPTZ DEFAULT now()`

#### Tabla `gastos`
Registro individual de rendición de gastos:
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id`: `UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT`
- `categoria`: `TEXT NOT NULL CHECK (categoria IN ('Bencina', 'Transporte', 'Comida', 'Materiales', 'Viáticos', 'Otro'))`
- `numero_comprobante`: `TEXT NOT NULL`
- `monto`: `INTEGER NOT NULL CHECK (monto > 0)`
- `foto_url`: `TEXT NOT NULL`
- `created_at`: `TIMESTAMPTZ DEFAULT now()`
- **Constraint de Unicidad:**
  - `CONSTRAINT unique_user_comprobante UNIQUE (user_id, numero_comprobante)` para evitar duplicidad de boletas para un mismo usuario.

### 5.2. Almacenamiento (Supabase Storage)
- **Bucket:** Privado, denominado `comprobantes`.
- **Estructura de Almacenamiento:**
  `{user_id}/{timestamp}_{numero_comprobante}.jpg`

### 5.3. Seguridad y Políticas RLS (Row Level Security)
- **Tabla `profiles`:**
  - Empleados pueden consultar únicamente su propio perfil (`auth.uid() = id`).
  - Administradores pueden consultar todos los perfiles.
- **Tabla `gastos`:**
  - Empleados pueden insertar únicamente registros propios (`auth.uid() = user_id`).
  - Empleados pueden consultar únicamente sus propias rendiciones (`auth.uid() = user_id`).
  - Empleados **no tienen permisos** de `UPDATE` ni `DELETE`.
  - Administradores tienen permisos de lectura completa (`SELECT`) sobre todos los registros.
- **Storage `comprobantes`:**
  - Subida (`INSERT`): Restringida al usuario autenticado dentro de su propio prefijo `{user_id}`.
  - Lectura (`SELECT`): El empleado accede a sus comprobantes; el administrador tiene acceso a todos los comprobantes.

---

## 6. Plan de Ejecución por Fases (Desarrollo Incremental)

1. **Fase 1: Script SQL de Supabase**
   - Creación de tablas `profiles` y `gastos` con tipos, checks y constraints de unicidad.
   - Creación y configuración del bucket privado de storage `comprobantes`.
   - Implementación y activación de políticas de seguridad RLS en tablas y storage.

2. **Fase 2: Configuración Base de Next.js, Conexión a Supabase y Autenticación**
   - Configuración limpia de Next.js (App Router) y Tailwind CSS.
   - Configuración de clientes Supabase (`@supabase/ssr`).
   - Pantalla de inicio de sesión (Login).
   - Middleware de protección de rutas y redirección automática según rol (`/admin` vs `/rendiciones`).

3. **Fase 3: Interfaz Empleado**
   - Formulario móvil rápido en 1 pantalla con soporte para cámara trasera (`capture="environment"`).
   - Subida directa al bucket y guardado atómico en la tabla `gastos`.
   - Manejo de comprobantes duplicados con mensaje claro al usuario.
   - Historial personal de rendiciones enviadas.

4. **Fase 4: Interfaz Administrador**
   - Tarjetas de sumatorias totales globales.
   - Filtros reactivos por Usuario y por Área corporativa.
   - Tabla de todas las rendiciones registradas.
   - Modal interactivo para visualizar comprobantes en alta resolución.
