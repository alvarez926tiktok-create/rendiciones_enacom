-- ==============================================================================
-- MIGRACIÓN: FLUJO DE APROBACIÓN, RECARGAS EN MISMO FOLIO Y EXTENSIÓN DE ESTADOS
-- ==============================================================================

-- 1. ACTUALIZAR ESTADOS EN TABLA GASTOS
ALTER TABLE public.gastos DROP CONSTRAINT IF EXISTS gastos_estado_check;
ALTER TABLE public.gastos
  ADD CONSTRAINT gastos_estado_check
  CHECK (estado IN ('pendiente', 'aplicado_a_fondo', 'por_pagar', 'rechazado', 'cerrado'));

ALTER TABLE public.gastos
  ALTER COLUMN estado SET DEFAULT 'pendiente';

-- Agregar columna para motivo de rechazo
ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;

-- 2. TABLA: recargas_fondos (Historial de Asignaciones y Recargas sobre el mismo Fondo)
CREATE TABLE IF NOT EXISTS public.recargas_fondos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fondo_id UUID NOT NULL REFERENCES public.fondos_asignados(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  monto INTEGER NOT NULL CHECK (monto > 0),
  motivo TEXT,
  tipo TEXT NOT NULL DEFAULT 'recarga' CHECK (tipo IN ('inicial', 'recarga')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recargas_fondo_id ON public.recargas_fondos(fondo_id);
CREATE INDEX IF NOT EXISTS idx_recargas_created_at ON public.recargas_fondos(created_at);

-- 3. POLÍTICAS RLS PARA recargas_fondos
ALTER TABLE public.recargas_fondos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recargas_select_policy" ON public.recargas_fondos;
CREATE POLICY "recargas_select_policy"
  ON public.recargas_fondos FOR SELECT
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.fondos_asignados f
      WHERE f.id = fondo_id AND f.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "recargas_insert_policy" ON public.recargas_fondos;
CREATE POLICY "recargas_insert_policy"
  ON public.recargas_fondos FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
  );

-- 4. BACKFILL: Registrar asignación inicial para fondos existentes que no tengan registro
INSERT INTO public.recargas_fondos (fondo_id, admin_id, monto, motivo, tipo, created_at)
SELECT id, admin_id, monto_asignado, motivo, 'inicial', created_at
FROM public.fondos_asignados f
WHERE NOT EXISTS (
  SELECT 1 FROM public.recargas_fondos r WHERE r.fondo_id = f.id
);
