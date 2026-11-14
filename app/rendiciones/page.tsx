import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/auth/actions';
import FormularioGasto from '@/components/FormularioGasto';
import HistorialGastos, { type GastoItem } from '@/components/HistorialGastos';

export default async function RendicionesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 1. Obtener perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // 2. Obtener gastos del usuario en orden descendente
  const { data: gastos, error: gastosError } = await supabase
    .from('gastos')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (gastosError) {
    console.error('Error al cargar rendiciones:', gastosError);
  }

  // 3. Generar URLs firmadas seguras para ver los comprobantes privados
  let gastosConUrls: GastoItem[] = [];
  if (gastos && gastos.length > 0) {
    const paths = gastos.map((g) => g.foto_url);
    const { data: signedData } = await supabase.storage
      .from('comprobantes')
      .createSignedUrls(paths, 3600);

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
      created_at: g.created_at,
      signedUrl: signedMap.get(g.foto_url) || null,
    }));
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
      <main className="max-w-md mx-auto px-4 pt-4 space-y-5">
        {/* Formulario rápido en 1 pantalla */}
        <FormularioGasto />

        {/* Historial propio de gastos enviados */}
        <HistorialGastos gastos={gastosConUrls} />
      </main>
    </div>
  );
}
