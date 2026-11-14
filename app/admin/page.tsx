import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/auth/actions';
import AdminViewContainer from '@/components/AdminViewContainer';
import { type GastoAdminItem, type ProfileItem } from '@/components/PanelAdmin';

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

  // 4. Mapear datos consolidados con la información de cada colaborador
  const gastosConsolidados: GastoAdminItem[] = (gastosData || []).map((g) => {
    const userProfile = profileMap.get(g.user_id);
    return {
      id: g.id,
      user_id: g.user_id,
      categoria: g.categoria,
      numero_comprobante: g.numero_comprobante,
      monto: g.monto,
      foto_url: g.foto_url,
      created_at: g.created_at,
      nombre_empleado: userProfile?.nombre || 'Colaborador',
      email_empleado: userProfile?.email || '',
      area_empleado: userProfile?.area || 'Sin Área',
    };
  });

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* Barra superior de Administrador */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3.5 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center text-white font-black text-lg shadow-sm">
              E
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
        <AdminViewContainer gastos={gastosConsolidados} profiles={profiles} />
      </main>
    </div>
  );
}
