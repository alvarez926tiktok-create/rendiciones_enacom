-- ==============================================================================
-- MIGRACIÓN: FOLIOS CORTOS, ABONOS PARCIALES Y TRAZABILIDAD (CARTOLA)
-- ==============================================================================

-- 1. CORRELATIVO NUMÉRICO PARA FOLIOS CORTOS
ALTER TABLE public.fondos_asignados
  ADD COLUMN IF NOT EXISTS correlativo SERIAL;

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS correlativo SERIAL;

CREATE INDEX IF NOT EXISTS idx_fondos_correlativo ON public.fondos_asignados(correlativo);
CREATE INDEX IF NOT EXISTS idx_gastos_correlativo ON public.gastos(correlativo);

-- 2. TABLA: abonos_reembolsos (Soporte para pagos parciales de la empresa)
CREATE TABLE IF NOT EXISTS public.abonos_reembolsos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id UUID NOT NULL REFERENCES public.gastos(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  monto_abonado INTEGER NOT NULL CHECK (monto_abonado > 0),
  comprobante_pago_url TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abonos_gasto_id ON public.abonos_reembolsos(gasto_id);
CREATE INDEX IF NOT EXISTS idx_abonos_created_at ON public.abonos_reembolsos(created_at);

-- 3. SEGURIDAD Y POLÍTICAS RLS PARA abonos_reembolsos
ALTER TABLE public.abonos_reembolsos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "abonos_select_policy" ON public.abonos_reembolsos;
CREATE POLICY "abonos_select_policy"
  ON public.abonos_reembolsos FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.gastos g
      WHERE g.id = gasto_id AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "abonos_insert_policy" ON public.abonos_reembolsos;
CREATE POLICY "abonos_insert_policy"
  ON public.abonos_reembolsos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
  );

DROP POLICY IF EXISTS "abonos_update_policy" ON public.abonos_reembolsos;
CREATE POLICY "abonos_update_policy"
  ON public.abonos_reembolsos FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
  )
  WITH CHECK (
    public.is_admin()
  );

DROP POLICY IF EXISTS "abonos_delete_policy" ON public.abonos_reembolsos;
CREATE POLICY "abonos_delete_policy"
  ON public.abonos_reembolsos FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
  );
