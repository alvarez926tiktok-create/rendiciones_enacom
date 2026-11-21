-- ==============================================================================
-- MIGRACIÓN: TRAZABILIDAD Y AUDITORÍA DE APROBACIONES, RECHAZOS Y ABONOS
-- ==============================================================================

-- 1. AGREGAR COLUMNAS DE AUDITORÍA EN TABLA GASTOS
ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS revisado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revisado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT;

CREATE INDEX IF NOT EXISTS idx_gastos_revisado_por ON public.gastos(revisado_por);
CREATE INDEX IF NOT EXISTS idx_gastos_revisado_at ON public.gastos(revisado_at);

-- 2. ASEGURAR COLUMNAS DE AUDITORÍA EN TABLA ABONOS_REEMBOLSOS
ALTER TABLE public.abonos_reembolsos
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_abonos_admin_id ON public.abonos_reembolsos(admin_id);

-- 3. ASEGURAR COLUMNAS DE AUDITORÍA EN TABLA RECARGAS_FONDOS
ALTER TABLE public.recargas_fondos
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recargas_admin_id ON public.recargas_fondos(admin_id);

-- 4. ASEGURAR COLUMNAS DE AUDITORÍA EN TABLA FONDOS_ASIGNADOS
ALTER TABLE public.fondos_asignados
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fondos_admin_id ON public.fondos_asignados(admin_id);
