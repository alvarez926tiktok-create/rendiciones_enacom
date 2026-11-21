import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import HeaderEmpleado from '@/components/HeaderEmpleado';
import FormularioGasto from '@/components/FormularioGasto';
import HistorialGastos, { type GastoItem } from '@/components/HistorialGastos';
import PanelSaldosEmpleado, { type FondoAsignadoActivo } from '@/components/PanelSaldosEmpleado';
import { type AbonoItem, type GastoDetalleItem, type FondoDetalleItem, type RecargaFondoItem } from '@/components/ModalCartolaDetalle';

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

  // 4. Obtener todos los fondos asignados del usuario (activos y cerrados)
  const { data: todosLosFondosData } = await supabase
    .from('fondos_asignados')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const todosLosFondos = todosLosFondosData || [];
  const fondoActivoRaw =
    todosLosFondos.find((f) => f.estado === 'activo' || f.estado === 'por_devolver') || null;

  let totalRendidoEnFondo = 0;
  if (fondoActivoRaw && gastos) {
    totalRendidoEnFondo = gastos
      .filter(
        (g) =>
          g.tipo_rendicion === 'anticipo' &&
          g.fondo_id === fondoActivoRaw.id &&
          (g.estado === 'aplicado_a_fondo' || g.estado === 'cerrado')
      )
      .reduce((sum, g) => sum + g.monto, 0);
  }

  const saldoRestante = fondoActivoRaw
    ? fondoActivoRaw.monto_asignado - totalRendidoEnFondo - (fondoActivoRaw.monto_devuelto || 0)
    : 0;

  // 4.1 Obtener historial de asignaciones y recargas de los fondos del usuario
  const fondoIds = todosLosFondos.map((f) => f.id);
  let recargasRaw: any[] = [];
  if (fondoIds.length > 0) {
    const { data: recargasData } = await supabase
      .from('recargas_fondos')
      .select('*')
      .in('fondo_id', fondoIds)
      .order('created_at', { ascending: true });
    recargasRaw = recargasData || [];
  }

  const recargas: RecargaFondoItem[] = recargasRaw.map((r) => ({
    id: r.id,
    fondo_id: r.fondo_id,
    admin_id: r.admin_id,
    monto: r.monto,
    motivo: r.motivo,
    tipo: r.tipo as 'inicial' | 'recarga',
    created_at: r.created_at,
  }));

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
  let fondosConUrls: FondoDetalleItem[] = [];
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
    todosLosFondos.forEach((f) => {
      if (f.comprobante_devolucion_url) pathsToSign.push(f.comprobante_devolucion_url);
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
      estado: (g.estado as any) || 'pendiente',
      motivo_rechazo: g.motivo_rechazo || null,
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

    fondosConUrls = todosLosFondos.map((f) => ({
      id: f.id,
      correlativo: f.correlativo || null,
      user_id: f.user_id,
      admin_id: f.admin_id,
      motivo: f.motivo,
      monto_asignado: f.monto_asignado,
      estado: f.estado,
      comprobante_devolucion_url: f.comprobante_devolucion_url || null,
      signedDevolucionUrl: f.comprobante_devolucion_url ? signedMap.get(f.comprobante_devolucion_url) || null : null,
      monto_devuelto: f.monto_devuelto || 0,
      created_at: f.created_at,
      nombre_empleado: profile?.nombre || 'Colaborador',
      area_empleado: profile?.area || 'Terreno',
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
      estado: (g.estado as any) || 'pendiente',
      motivo_rechazo: g.motivo_rechazo || null,
      comprobante_pago_url: g.comprobante_pago_url || null,
      created_at: g.created_at,
      signedUrl: null,
      signedPagoUrl: null,
    }));

    fondosConUrls = todosLosFondos.map((f) => ({
      id: f.id,
      correlativo: f.correlativo || null,
      user_id: f.user_id,
      admin_id: f.admin_id,
      motivo: f.motivo,
      monto_asignado: f.monto_asignado,
      estado: f.estado,
      comprobante_devolucion_url: f.comprobante_devolucion_url || null,
      signedDevolucionUrl: null,
      monto_devuelto: f.monto_devuelto || 0,
      created_at: f.created_at,
      nombre_empleado: profile?.nombre || 'Colaborador',
      area_empleado: profile?.area || 'Terreno',
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

  // Gastos completos mapeados para cartolas de fondos
  const todosLosGastosDetalle: GastoDetalleItem[] = gastosConUrls.map((g) => ({
    ...g,
    nombre_empleado: profile?.nombre || 'Colaborador',
    area_empleado: profile?.area || 'Terreno',
  }));

  // Gastos vinculados al fondo activo para la Cartola
  const gastosVinculadosFondo: GastoDetalleItem[] = todosLosGastosDetalle.filter(
    (g) => fondoActivoRaw && g.fondo_id === fondoActivoRaw.id && g.tipo_rendicion === 'anticipo'
  );

  // Fondos cerrados para historial de viáticos
  const fondosHistoricosCerrados: FondoAsignadoActivo[] = fondosConUrls
    .filter((f) => f.estado === 'cerrado')
    .map((f) => {
      const rendidoF = gastosConUrls
        .filter((g) => g.fondo_id === f.id && g.tipo_rendicion === 'anticipo')
        .reduce((sum, g) => sum + g.monto, 0);
      return {
        id: f.id,
        correlativo: f.correlativo || null,
        motivo: f.motivo,
        monto_asignado: f.monto_asignado,
        total_rendido: rendidoF,
        saldo_restante: 0,
        monto_devuelto: f.monto_devuelto || 0,
        estado: f.estado,
        comprobante_devolucion_url: f.comprobante_devolucion_url || null,
        signedDevolucionUrl: f.signedDevolucionUrl || null,
        created_at: f.created_at,
      };
    });

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* Barra superior Mobile-First con Autogestión de Cuenta */}
      <HeaderEmpleado
        nombre={profile?.nombre}
        area={profile?.area}
        email={profile?.email}
      />

      {/* Contenido principal Adaptativo Mobile-First & Desktop */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda (lg:col-span-5): Saldos arriba + Formulario de Nueva Rendición Sticky */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
            {/* Panel Superior de Saldos */}
            <PanelSaldosEmpleado
              fondoActivo={fondoActivoData}
              totalReembolsosPendientes={totalReembolsosPendientes}
              gastosVinculados={gastosVinculadosFondo}
              recargas={recargas}
              fondosHistoricos={fondosHistoricosCerrados}
              todosLosGastos={todosLosGastosDetalle}
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
          </div>

          {/* Columna Derecha (lg:col-span-7): Historial de Rendiciones con Filtros y Cartola */}
          <div className="lg:col-span-7">
            <HistorialGastos
              gastos={gastosConUrls}
              abonos={abonosConUrls}
              fondos={fondosConUrls}
              recargas={recargas}
              nombreUsuario={profile?.nombre}
              areaUsuario={profile?.area}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
