import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/auth/actions';
import AdminViewContainer from '@/components/AdminViewContainer';
import { type GastoAdminItem, type ProfileItem, type FondoAdminItem } from '@/components/PanelAdmin';
import { type AbonoItem } from '@/components/ModalCartolaDetalle';

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Validar que el usuario sea administrador
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    redirect('/rendiciones');
  }

  // 2. Obtener lista completa de usuarios
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, nombre, email, area, rol')
    .order('nombre', { ascending: true });

  const profiles: ProfileItem[] = profilesData || [];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  // 3. Obtener todas las rendiciones ordenadas por fecha descendente
  const { data: gastosData, error: gastosError } = await supabase
    .from('gastos')
    .select('*')
    .order('created_at', { ascending: false });

  if (gastosError) {
    console.error('Error al cargar rendiciones admin:', gastosError);
  }

  // 4. Obtener todos los fondos asignados
  const { data: fondosData, error: fondosError } = await supabase
    .from('fondos_asignados')
    .select('*')
    .order('created_at', { ascending: false });

  if (fondosError) {
    console.error('Error al cargar fondos asignados admin:', fondosError);
  }

  // 5. Obtener todos los abonos a reembolsos
  const { data: abonosData, error: abonosError } = await supabase
    .from('abonos_reembolsos')
    .select('*')
    .order('created_at', { ascending: true });

  if (abonosError) {
    console.warn('Abonos no disponibles aún (se requerirá migración):', abonosError.message);
  }

  const abonos: AbonoItem[] = (abonosData || []).map((a) => ({
    id: a.id,
    gasto_id: a.gasto_id,
    admin_id: a.admin_id,
    monto_abonado: a.monto_abonado,
    comprobante_pago_url: a.comprobante_pago_url,
    notas: a.notas,
    created_at: a.created_at,
  }));

  // Firmar URLs de devolución de fondos para visualización directa en Cartola
  const devolucionPaths = (fondosData || [])
    .map((f) => f.comprobante_devolucion_url)
    .filter((url): url is string => Boolean(url));

  const signedDevolucionMap = new Map<string, string>();
  if (devolucionPaths.length > 0) {
    try {
      const { data: signedDevoluciones } = await supabase.storage
        .from('comprobantes')
        .createSignedUrls(devolucionPaths, 3600);
      signedDevoluciones?.forEach((item) => {
        if (item.path && item.signedUrl) {
          signedDevolucionMap.set(item.path, item.signedUrl);
        }
      });
    } catch (err) {
      console.warn('Error al firmar URLs de devoluciones en admin:', err);
    }
  }

  // 6. Mapear datos consolidados con la información de cada colaborador y correlativos
  const gastosConsolidados: GastoAdminItem[] = (gastosData || []).map((g) => {
    const userProfile = profileMap.get(g.user_id);
    return {
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
      nombre_empleado: userProfile?.nombre || 'Colaborador',
      email_empleado: userProfile?.email || '',
      area_empleado: userProfile?.area || 'Sin Área',
    };
  });

  const fondosConsolidados: FondoAdminItem[] = (fondosData || []).map((f) => {
    const userProfile = profileMap.get(f.user_id);
    return {
      id: f.id,
      correlativo: f.correlativo || null,
      user_id: f.user_id,
      admin_id: f.admin_id,
      motivo: f.motivo,
      monto_asignado: f.monto_asignado,
      estado: f.estado,
      comprobante_devolucion_url: f.comprobante_devolucion_url,
      signedDevolucionUrl: f.comprobante_devolucion_url
        ? signedDevolucionMap.get(f.comprobante_devolucion_url) || null
        : null,
      monto_devuelto: f.monto_devuelto,
      created_at: f.created_at,
      nombre_empleado: userProfile?.nombre || 'Colaborador',
      email_empleado: userProfile?.email || '',
      area_empleado: userProfile?.area || 'Sin Área',
    };
  });

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* Barra superior de Administrador */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3.5 shadow-sm print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 px-2 py-1 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <img src="/logo-enacom.png" alt="ENACOM" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-slate-900 leading-tight">
                  Panel de Control Administrativo
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  Admin
                </span>
              </div>
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{profile?.nombre}</span> • {profile?.area} ({profile?.email})
              </p>
            </div>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors shadow-sm"
            >
              Cerrar Sesión
            </button>
          </form>
        </div>
      </header>

      {/* Contenido principal del Dashboard */}
      <main className="max-w-6xl mx-auto px-4 pt-6">
        <AdminViewContainer
          gastos={gastosConsolidados}
          profiles={profiles}
          fondos={fondosConsolidados}
          abonos={abonos}
        />
      </main>
    </div>
  );
}
