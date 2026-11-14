-- ==============================================================================
-- FASE 1: ESQUEMA DE BASE DE DATOS, SEGURIDAD RLS Y STORAGE (SUPABASE)
-- Proyecto: Rendición de Gastos ENACOM (Mobile-First)
-- ==============================================================================

-- 1. TABLA: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'empleado' CHECK (rol IN ('admin', 'empleado')),
  area TEXT NOT NULL CHECK (area IN (
    'Ingeniería Eléctrica',
    'Informática',
    'Administrativo',
    'Contabilidad',
    'Ventas',
    'Logística',
    'Gerencia'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. TABLA: fondos_asignados
CREATE TABLE IF NOT EXISTS public.fondos_asignados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  motivo TEXT NOT NULL,
  monto_asignado INTEGER NOT NULL CHECK (monto_asignado > 0),
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'por_devolver', 'cerrado')),
  comprobante_devolucion_url TEXT,
  monto_devuelto INTEGER NOT NULL DEFAULT 0 CHECK (monto_devuelto >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fondos_user_id ON public.fondos_asignados(user_id);
CREATE INDEX IF NOT EXISTS idx_fondos_estado ON public.fondos_asignados(estado);

-- 3. TABLA: gastos
CREATE TABLE IF NOT EXISTS public.gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'Bencina',
    'Transporte',
    'Comida',
    'Materiales',
    'Viáticos',
    'Otro'
  )),
  numero_comprobante TEXT NOT NULL,
  monto INTEGER NOT NULL CHECK (monto > 0),
  foto_url TEXT NOT NULL,
  tipo_rendicion TEXT NOT NULL DEFAULT 'reembolso' CHECK (tipo_rendicion IN ('anticipo', 'reembolso')),
  fondo_id UUID REFERENCES public.fondos_asignados(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'por_pagar' CHECK (estado IN ('aplicado_a_fondo', 'por_pagar', 'cerrado')),
  comprobante_pago_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_comprobante UNIQUE (user_id, numero_comprobante)
);

-- Índices recomendados para optimización de consultas
CREATE INDEX IF NOT EXISTS idx_gastos_user_id ON public.gastos(user_id);
CREATE INDEX IF NOT EXISTS idx_gastos_created_at ON public.gastos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gastos_fondo_id ON public.gastos(fondo_id);
CREATE INDEX IF NOT EXISTS idx_gastos_estado ON public.gastos(estado);
CREATE INDEX IF NOT EXISTS idx_gastos_tipo ON public.gastos(tipo_rendicion);

-- ==============================================================================
-- 3. FUNCIONES AUXILIARES DE SEGURIDAD (SECURITY DEFINER)
-- ==============================================================================

-- Función para verificar si el usuario autenticado tiene rol 'admin'
-- Evita recursión infinita en las políticas RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND rol = 'admin'
  );
$$;

-- Trigger opcional para auto-crear perfil al registrarse en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email, rol, area)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.raw_user_meta_data->>'rol', 'empleado'),
    COALESCE(new.raw_user_meta_data->>'area', 'Administrativo')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nombre = CASE WHEN profiles.nombre = '' THEN EXCLUDED.nombre ELSE profiles.nombre END;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- 4.1. Habilitar RLS en tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

-- 4.2. Políticas para 'profiles'
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR public.is_admin()
  );

DROP POLICY IF EXISTS "profiles_insert_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_insert_own_or_admin"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id OR public.is_admin()
  );

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = id OR public.is_admin()
  );

-- 4.3. Políticas para 'gastos'
-- SELECT: Empleado ve sus propios gastos; Administrador ve todos
DROP POLICY IF EXISTS "gastos_select_policy" ON public.gastos;
CREATE POLICY "gastos_select_policy"
  ON public.gastos FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR public.is_admin()
  );

-- INSERT: Solo el usuario autenticado puede ingresar sus propios gastos
DROP POLICY IF EXISTS "gastos_insert_policy" ON public.gastos;
CREATE POLICY "gastos_insert_policy"
  ON public.gastos FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
  );

-- UPDATE: Permitido para el propio colaborador (para corregir errores) o el admin
DROP POLICY IF EXISTS "gastos_update_policy" ON public.gastos;
CREATE POLICY "gastos_update_policy"
  ON public.gastos FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = user_id OR public.is_admin()
  );

-- DELETE: Permitido para el propio colaborador o el admin
DROP POLICY IF EXISTS "gastos_delete_policy" ON public.gastos;
CREATE POLICY "gastos_delete_policy"
  ON public.gastos FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR public.is_admin()
  );

-- 4.4. Políticas para 'fondos_asignados'
ALTER TABLE public.fondos_asignados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fondos_select_policy" ON public.fondos_asignados;
CREATE POLICY "fondos_select_policy"
  ON public.fondos_asignados FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR public.is_admin()
  );

DROP POLICY IF EXISTS "fondos_insert_policy" ON public.fondos_asignados;
CREATE POLICY "fondos_insert_policy"
  ON public.fondos_asignados FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
  );

DROP POLICY IF EXISTS "fondos_update_policy" ON public.fondos_asignados;
CREATE POLICY "fondos_update_policy"
  ON public.fondos_asignados FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = user_id OR public.is_admin()
  );

DROP POLICY IF EXISTS "fondos_delete_policy" ON public.fondos_asignados;
CREATE POLICY "fondos_delete_policy"
  ON public.fondos_asignados FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );

-- ==============================================================================
-- 5. STORAGE: BUCKET 'comprobantes' Y POLÍTICAS
-- ==============================================================================

-- Crear bucket privado si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprobantes', 'comprobantes', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acceso para storage.objects
DROP POLICY IF EXISTS "comprobantes_insert_own_folder" ON storage.objects;
CREATE POLICY "comprobantes_insert_own_folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comprobantes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "comprobantes_select_own_or_admin" ON storage.objects;
CREATE POLICY "comprobantes_select_own_or_admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'comprobantes' AND (
      (storage.foldername(name))[1] = auth.uid()::text OR
      public.is_admin()
    )
  );

DROP POLICY IF EXISTS "comprobantes_delete_own_or_admin" ON storage.objects;
CREATE POLICY "comprobantes_delete_own_or_admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'comprobantes' AND (
      (storage.foldername(name))[1] = auth.uid()::text OR
      public.is_admin()
    )
  );
