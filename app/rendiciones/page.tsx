import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/auth/actions';
import FormularioGasto from '@/components/FormularioGasto';
import HistorialGastos, { type GastoItem } from '@/components/HistorialGastos';
import PanelSaldosEmpleado, { type FondoAsignadoActivo } from '@/components/PanelSaldosEmpleado';

export default async function RendicionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Obtener o auto-crear perfil si no existe
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    const { data: createdProfile } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || 'Colaborador',
        email: user.email || '',
        rol: (user.user_metadata?.rol as any) || 'empleado',
        area: (user.user_metadata?.area as any) || 'Administrativo',
      })
      .select('*')
      .maybeSingle();

    profile = createdProfile;
  }

  // 2. Obtener gastos del usuario en orden descendente
  const { data: gastos, error: gastosError } = await supabase
    .from('gastos')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (gastosError) {
    console.error('Error al cargar rendiciones:', gastosError);
  }

  // 3. Obtener fondo activo del usuario (si tiene uno en estado 'activo' o 'por_devolver')
  const { data: fondoActivoRaw } = await supabase
    .from('fondos_asignados')
    .select('*')
    .eq('user_id', user.id)
    .in('estado', ['activo', 'por_devolver'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let totalRendidoEnFondo = 0;
  if (fondoActivoRaw && gastos) {
    totalRendidoEnFondo = gastos
      .filter((g) => g.tipo_rendicion === 'anticipo' && g.fondo_id === fondoActivoRaw.id)
      .reduce((sum, g) => sum + g.monto, 0);
  }

  const saldoRestante = fondoActivoRaw
    ? fondoActivoRaw.monto_asignado - totalRendidoEnFondo - (fondoActivoRaw.monto_devuelto || 0)
    : 0;

  const fondoActivoData: FondoAsignadoActivo | null = fondoActivoRaw
    ? {
        id: fondoActivoRaw.id,
        motivo: fondoActivoRaw.motivo,
        monto_asignado: fondoActivoRaw.monto_asignado,
        total_rendido: totalRendidoEnFondo,
        saldo_restante: saldoRestante,
        monto_devuelto: fondoActivoRaw.monto_devuelto || 0,
        estado: fondoActivoRaw.estado,
      }
    : null;

  // 4. Calcular total de reembolsos acumulados pendientes de pago a favor del empleado
  const totalReembolsosPendientes = (gastos || [])
    .filter((g) => g.tipo_rendicion === 'reembolso' && g.estado === 'por_pagar')
    .reduce((sum, g) => sum + g.monto, 0);

  // 5. Generar URLs firmadas seguras para boletas y comprobantes de pago de la empresa
  let gastosConUrls: GastoItem[] = [];
  if (gastos && gastos.length > 0) {
    try {
      const pathsToSign: string[] = [];
      gastos.forEach((g) => {
        if (g.foto_url) pathsToSign.push(g.foto_url);
        if (g.comprobante_pago_url) pathsToSign.push(g.comprobante_pago_url);
      });

      const { data: signedData, error: signedError } = await supabase.storage
        .from('comprobantes')
        .createSignedUrls(pathsToSign, 3600);

      if (signedError) {
        console.error('Error al firmar URLs:', signedError);
      }

      const signedMap = new Map<string, string>();
      signedData?.forEach((item) => {
        if (item.path && item.signedUrl) {
          signedMap.set(item.path, item.signedUrl);
        }
      });

      gastosConUrls = gastos.map((g) => ({
        id: g.id,
        categoria: g.categoria,
        numero_comprobante: g.numero_comprobante,
        monto: g.monto,
        foto_url: g.foto_url,
        tipo_rendicion: (g.tipo_rendicion as any) || 'reembolso',
        fondo_id: g.fondo_id || null,
        estado: (g.estado as any) || 'por_pagar',
        comprobante_pago_url: g.comprobante_pago_url || null,
        created_at: g.created_at,
        signedUrl: signedMap.get(g.foto_url) || null,
        signedPagoUrl: g.comprobante_pago_url ? signedMap.get(g.comprobante_pago_url) || null : null,
      }));
    } catch (err) {
      console.error('Error al procesar URLs firmadas:', err);
      gastosConUrls = gastos.map((g) => ({
        id: g.id,
        categoria: g.categoria,
        numero_comprobante: g.numero_comprobante,
        monto: g.monto,
        foto_url: g.foto_url,
        tipo_rendicion: (g.tipo_rendicion as any) || 'reembolso',
        fondo_id: g.fondo_id || null,
        estado: (g.estado as any) || 'por_pagar',
        comprobante_pago_url: g.comprobante_pago_url || null,
        created_at: g.created_at,
        signedUrl: null,
        signedPagoUrl: null,
      }));
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* Barra superior Mobile-First */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-sky-600 flex items-center justify-center text-white font-black text-base shadow-sm">
              E
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black text-slate-900 leading-none">
                  {profile?.nombre || 'Colaborador'}
                </h1>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {profile?.area || 'Terreno'}
              </span>
            </div>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              Cerrar Sesión
            </button>
          </form>
        </div>
      </header>

      {/* Contenido principal Mobile-First */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Panel Superior de Saldos */}
        <PanelSaldosEmpleado
          fondoActivo={fondoActivoData}
          totalReembolsosPendientes={totalReembolsosPendientes}
        />

        {/* Formulario rápido con selector de anticipo vs reembolso */}
        <FormularioGasto
          fondoActivo={
            fondoActivoData
              ? {
                  id: fondoActivoData.id,
                  motivo: fondoActivoData.motivo,
                  monto_asignado: fondoActivoData.monto_asignado,
                  saldo_restante: fondoActivoData.saldo_restante,
                }
              : null
          }
        />

        {/* Historial propio con badges de anticipo/reembolso y estado */}
        <HistorialGastos gastos={gastosConUrls} />
      </main>
    </div>
  );
}
