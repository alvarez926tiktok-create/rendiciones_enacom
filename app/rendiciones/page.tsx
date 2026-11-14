import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HeaderEmpleado from '@/components/HeaderEmpleado';
import FormularioGasto from '@/components/FormularioGasto';
import HistorialGastos, { type GastoItem } from '@/components/HistorialGastos';
import PanelSaldosEmpleado, { type FondoAsignadoActivo } from '@/components/PanelSaldosEmpleado';
import { type AbonoItem, type GastoDetalleItem } from '@/components/ModalCartolaDetalle';

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

  // 3. Obtener abonos registrados a las rendiciones del usuario
  const gastoIds = (gastos || []).map((g) => g.id);
  let abonosRaw: any[] = [];
  if (gastoIds.length > 0) {
    const { data: abonosData, error: abonosError } = await supabase
      .from('abonos_reembolsos')
      .select('*')
      .in('gasto_id', gastoIds)
      .order('created_at', { ascending: true });

    if (abonosError) {
      console.warn('Abonos no disponibles aún:', abonosError.message);
    } else {
      abonosRaw = abonosData || [];
    }
  }

  // 4. Obtener fondo activo del usuario
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

  // 5. Calcular total de reembolsos acumulados pendientes (restando abonos parciales)
  const totalReembolsosPendientes = (gastos || [])
    .filter((g) => g.tipo_rendicion === 'reembolso' && g.estado === 'por_pagar')
    .reduce((sum, g) => {
      const abonosGasto = abonosRaw.filter((a) => a.gasto_id === g.id);
      const abonado = abonosGasto.reduce((s: number, a: any) => s + a.monto_abonado, 0);
      return sum + Math.max(0, g.monto - abonado);
    }, 0);

  // 6. Generar URLs firmadas seguras para boletas, pagos y devoluciones
  let gastosConUrls: GastoItem[] = [];
  let abonosConUrls: AbonoItem[] = [];
  let signedDevolucionUrlFondo: string | null = null;

  try {
    const pathsToSign: string[] = [];
    (gastos || []).forEach((g) => {
      if (g.foto_url) pathsToSign.push(g.foto_url);
      if (g.comprobante_pago_url) pathsToSign.push(g.comprobante_pago_url);
    });
    abonosRaw.forEach((a) => {
      if (a.comprobante_pago_url) pathsToSign.push(a.comprobante_pago_url);
    });
    if (fondoActivoRaw?.comprobante_devolucion_url) {
      pathsToSign.push(fondoActivoRaw.comprobante_devolucion_url);
    }

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

    if (fondoActivoRaw?.comprobante_devolucion_url) {
      signedDevolucionUrlFondo = signedMap.get(fondoActivoRaw.comprobante_devolucion_url) || null;
    }

    gastosConUrls = (gastos || []).map((g) => ({
      id: g.id,
      correlativo: g.correlativo || null,
      user_id: g.user_id,
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

    abonosConUrls = abonosRaw.map((a) => ({
      id: a.id,
      gasto_id: a.gasto_id,
      admin_id: a.admin_id,
      monto_abonado: a.monto_abonado,
      comprobante_pago_url: a.comprobante_pago_url,
      signedUrl: a.comprobante_pago_url ? signedMap.get(a.comprobante_pago_url) || null : null,
      notas: a.notas,
      created_at: a.created_at,
    }));
  } catch (err) {
    console.error('Error al procesar URLs firmadas:', err);
    gastosConUrls = (gastos || []).map((g) => ({
      id: g.id,
      correlativo: g.correlativo || null,
      user_id: g.user_id,
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

  const fondoActivoData: FondoAsignadoActivo | null = fondoActivoRaw
    ? {
        id: fondoActivoRaw.id,
        correlativo: fondoActivoRaw.correlativo || null,
        motivo: fondoActivoRaw.motivo,
        monto_asignado: fondoActivoRaw.monto_asignado,
        total_rendido: totalRendidoEnFondo,
        saldo_restante: saldoRestante,
        monto_devuelto: fondoActivoRaw.monto_devuelto || 0,
        estado: fondoActivoRaw.estado,
        comprobante_devolucion_url: fondoActivoRaw.comprobante_devolucion_url || null,
        signedDevolucionUrl: signedDevolucionUrlFondo,
        created_at: fondoActivoRaw.created_at,
      }
    : null;

  // Gastos vinculados al fondo activo para la Cartola
  const gastosVinculadosFondo: GastoDetalleItem[] = gastosConUrls
    .filter((g) => fondoActivoRaw && g.fondo_id === fondoActivoRaw.id && g.tipo_rendicion === 'anticipo')
    .map((g) => ({
      ...g,
      nombre_empleado: profile?.nombre || 'Colaborador',
      area_empleado: profile?.area || 'Terreno',
    }));

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* Barra superior Mobile-First con Autogestión de Cuenta */}
      <HeaderEmpleado
        nombre={profile?.nombre}
        area={profile?.area}
        email={profile?.email}
      />

      {/* Contenido principal Mobile-First */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Panel Superior de Saldos */}
        <PanelSaldosEmpleado
          fondoActivo={fondoActivoData}
          totalReembolsosPendientes={totalReembolsosPendientes}
          gastosVinculados={gastosVinculadosFondo}
          nombreUsuario={profile?.nombre}
          areaUsuario={profile?.area}
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

        {/* Historial propio con folios cortos y acceso a Cartola */}
        <HistorialGastos
          gastos={gastosConUrls}
          abonos={abonosConUrls}
          nombreUsuario={profile?.nombre}
          areaUsuario={profile?.area}
        />
      </main>
    </div>
  );
}
