-- ==============================================================================
-- MIGRACIÓN CONTABLE: FONDOS POR RENDIR (ANTICIPOS) VS REEMBOLSOS (GASTOS PROPIOS)
-- ==============================================================================

-- 1. TABLA: fondos_asignados
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

-- 2. ACTUALIZAR TABLA: gastos
ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS tipo_rendicion TEXT NOT NULL DEFAULT 'reembolso' CHECK (tipo_rendicion IN ('anticipo', 'reembolso')),
  ADD COLUMN IF NOT EXISTS fondo_id UUID REFERENCES public.fondos_asignados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'por_pagar' CHECK (estado IN ('aplicado_a_fondo', 'por_pagar', 'cerrado')),
  ADD COLUMN IF NOT EXISTS comprobante_pago_url TEXT;

CREATE INDEX IF NOT EXISTS idx_gastos_fondo_id ON public.gastos(fondo_id);
CREATE INDEX IF NOT EXISTS idx_gastos_estado ON public.gastos(estado);
CREATE INDEX IF NOT EXISTS idx_gastos_tipo ON public.gastos(tipo_rendicion);

-- 3. POLÍTICAS RLS PARA fondos_asignados
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

-- 4. POLÍTICAS DE STORAGE ADICIONALES PARA COMPROBANTES DE PAGO Y DEVOLUCIÓN
-- Permite que administradores suban comprobantes de pago a cualquier carpeta
DROP POLICY IF EXISTS "comprobantes_admin_insert" ON storage.objects;
CREATE POLICY "comprobantes_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comprobantes' AND public.is_admin()
  );
