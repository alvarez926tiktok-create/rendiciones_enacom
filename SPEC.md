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
  - **Modalidad Contable de Rendición:**
    - *Descontar de Fondo Asignado (Anticipo):* Si el colaborador tiene un fondo activo, descuenta del saldo otorgado por la empresa (`tipo_rendicion = 'anticipo'`, `estado = 'aplicado_a_fondo'`).
    - *Gasto Propio (Solicitar Reembolso):* Dinero pagado del bolsillo del trabajador (`tipo_rendicion = 'reembolso'`, `estado = 'por_pagar'`).
  - **Panel de Saldos y Conciliación del Empleado:**
    - *Fondo Activo:* Muestra Monto Asignado, Total Rendido y Saldo Restante por devolver. Incluye botón "Devolver Sobrante y Cerrar Fondo" con subida de comprobante de transferencia bancaria y cierre en $0.
    - *Reembolsos Acumulados:* Total adeudado por la empresa en estado `'por_pagar'`.
  - **Modificación y Eliminación:** El colaborador tiene la facultad de **editar** o **eliminar** sus propias rendiciones enviadas en caso de error o boletas duplicadas (rectificar categoría, comprobante, monto o foto, o eliminar el registro y su archivo asociado).
  - **Filtros Temporales en Historial:** Consulta de rendiciones por períodos ('Todos', 'Hoy / Del día', 'Últimos 7 días', 'Último mes', 'Mes en particular') con tarjeta/banner de total acumulado en el período y estado de conciliación (`Aplicado a Fondo`, `Por Pagar`, `Cerrado`).

### 4.2. Rol `admin`
- **Experiencia de Usuario:**
  - Panel centralizado con visibilidad completa de todas las rendiciones de todos los usuarios.
  - **Tarjetas de Sumatoria Total y Balance Contable:**
    - Total Por Pagar a Empleados (Reembolsos pendientes).
    - Total Fondos Activos / Por Devolver (Saldos en manos de colaboradores).
    - Total Saldado / Cerrado (Histórico conciliado).
  - **Asignación de Fondos / Viáticos:** Modal para asignar dinero previo a un colaborador indicando Motivo y Monto asignado.
  - **Conciliación y Pago de Reembolsos:** Opción "Pagar / Reembolsar" en gastos pendientes, con subida de comprobante de transferencia bancaria de la empresa y cierre del gasto.
  - **Filtros Dinámicos Combinados:**
    - Por **Estado**: 'Todos', 'Por Pagar', 'Aplicado a Fondo', 'Cerrado'.
    - Por **Fecha / Período**: 'Todos', 'Últimos 7 días', 'Últimos 15 días', 'Último mes', 'Mes en particular' (input month nativo), 'Último año'.
    - Por **Usuario**.
    - Por **Área de la empresa** (lista fija obligatoria):
      - `Ingeniería Eléctrica`
      - `Informática`
      - `Administrativo`
      - `Contabilidad`
      - `Ventas`
      - `Logística`
      - `Gerencia`
    - Por **Categoría**.
  - **Tabla de Rendiciones:** Registro detallado de todas las rendiciones con datos del empleado, área, fecha, categoría, comprobante, tipo de rendición, estado y monto.
  - **Modal Visor de Comprobantes:** Visualización en alta resolución de la foto de la boleta o factura bajo demanda y de comprobantes de pago.
  - **Exportación de Informes Ejecutivos en PDF:**
    - Botón de exportación rápida a PDF reactivo a los filtros activos (por Área, Colaborador, Rango de Fecha, Estado y Categoría).
    - Maquetado corporativo para impresión (`@media print` nativo sin librerías pesadas): membrete ENACOM, parámetros de auditoría filtrados, tarjetas de sumatoria total y tabla completa de rendiciones con tipo y estado.
  - **Módulo de Gestión de Personal (Usuarios):**
    - Creación directa de usuarios (Nombre, Email, Contraseña temporal, Rol, Área).
    - Edición completa de colaboradores: actualización de Nombre, Email, Rol, Área y Contraseña (opcional) mediante Supabase Admin API (`updateUserById`) y sincronización con `public.profiles`.

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

#### Tabla `fondos_asignados`
Registro de anticipos / viáticos entregados previamente por la empresa:
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `correlativo`: `SERIAL` (correlativo numérico para generación de folios cortos `#F-001`)
- `user_id`: `UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
- `admin_id`: `UUID REFERENCES profiles(id) ON DELETE SET NULL`
- `motivo`: `TEXT NOT NULL`
- `monto_asignado`: `INTEGER NOT NULL CHECK (monto_asignado > 0)`
- `estado`: `TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'por_devolver', 'cerrado'))`
- `comprobante_devolucion_url`: `TEXT NULL`
- `monto_devuelto`: `INTEGER NOT NULL DEFAULT 0 CHECK (monto_devuelto >= 0)`
- `created_at`: `TIMESTAMPTZ DEFAULT now()`

#### Tabla `gastos`
Registro individual de rendición de gastos:
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `correlativo`: `SERIAL` (correlativo numérico para generación de folios cortos `#G-101`)
- `user_id`: `UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
- `categoria`: `TEXT NOT NULL CHECK (categoria IN ('Bencina', 'Transporte', 'Comida', 'Materiales', 'Viáticos', 'Otro'))`
- `numero_comprobante`: `TEXT NOT NULL`
- `monto`: `INTEGER NOT NULL CHECK (monto > 0)`
- `foto_url`: `TEXT NOT NULL`
- `tipo_rendicion`: `TEXT NOT NULL DEFAULT 'reembolso' CHECK (tipo_rendicion IN ('anticipo', 'reembolso'))`
- `fondo_id`: `UUID NULL REFERENCES fondos_asignados(id) ON DELETE SET NULL`
- `estado`: `TEXT NOT NULL DEFAULT 'por_pagar' CHECK (estado IN ('aplicado_a_fondo', 'por_pagar', 'cerrado'))`
- `comprobante_pago_url`: `TEXT NULL`
- `created_at`: `TIMESTAMPTZ DEFAULT now()`
- **Constraint de Unicidad:**
  - `CONSTRAINT unique_user_comprobante UNIQUE (user_id, numero_comprobante)` para evitar duplicidad de boletas para un mismo usuario.

#### Tabla `abonos_reembolsos`
Registro de pagos parciales o abonos realizados por la empresa para cubrir gastos propios:
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `gasto_id`: `UUID NOT NULL REFERENCES gastos(id) ON DELETE CASCADE`
- `admin_id`: `UUID REFERENCES profiles(id) ON DELETE SET NULL`
- `monto_abonado`: `INTEGER NOT NULL CHECK (monto_abonado > 0)`
- `comprobante_pago_url`: `TEXT NULL`
- `notas`: `TEXT NULL`
- `created_at`: `TIMESTAMPTZ DEFAULT now()`

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
  - Empleados pueden modificar (`UPDATE`) y eliminar (`DELETE`) únicamente sus propias rendiciones (`auth.uid() = user_id`).
  - Administradores tienen permisos completos de lectura, modificación y eliminación sobre todos los registros.
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

5. **Fase 5: Lógica Contable de Fondos por Rendir (Anticipos) vs Reembolsos y Conciliación**
   - Implementación de `fondos_asignados` y asignación de viáticos por parte del administrador.
   - Registro de gastos con modalidad clara: Descontar de Fondo vs Gasto Propio (Reembolso).
   - Panel de saldos para el colaborador con conciliación y devolución de sobrantes con comprobante bancario.
   - Panel de control contable con tarjetas de balance (Por Pagar, Fondos Activos, Total Conciliado).
   - Acción de nivelación administrativa (Pagar / Reembolsar) con respaldo fotográfico de transferencia.
   - Exportación de informes ejecutivos en PDF con filtros de auditoría cruzados.

6. **Fase 6: Folios Cortos, Abonos Parciales y Modal de Cartola / Detalle**
   - Identificadores legibles automáticos: `#F-001` para fondos/viáticos y `#G-101` para gastos/reembolsos.
   - Tabla `abonos_reembolsos` para pagos parciales escalonados con comprobante bancario.
   - Modal de Cartola / Detalle con trazabilidad cronológica completa para empleados y administradores.
   - Acciones rápidas administrativas de abono y cierre definitivo desde la cartola.

7. **Fase 7: Control de Saldo en Viáticos y Autogestión de Contraseña**
   - **Validación de Saldo en Fondos Asignados (Tope de Viáticos):**
     - Cálculo reactivo en tiempo real del saldo disponible (`monto_asignado - boletas_descontadas - monto_devuelto`).
     - Alerta visual y bloqueo preventivo mediante modal si el monto supera el saldo disponible.
     - Botones de acción rápida: ajuste automático del monto al saldo disponible exacto o cambio de modalidad a "Gasto Propio (Reembolso)".
     - Validación atómica en servidor (`registrarGasto` y `modificarGasto`) para garantizar consistencia y prevenir sobregiros.
   - **Autogestión de Contraseña de Empleados:**
     - Botón de gestión en cabecera del empleado con modal seguro para ingreso y confirmación de nueva contraseña (mínimo 6 caracteres).
     - Actualización mediante Server Action usando `supabase.auth.updateUser({ password })`.
