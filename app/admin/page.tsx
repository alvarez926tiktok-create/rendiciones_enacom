import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/auth/actions';

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    redirect('/rendiciones');
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                Panel Administrador
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {profile?.area}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1">
              Control de Rendiciones
            </h1>
            <p className="text-sm text-slate-600">
              Sesión activa: <span className="font-semibold text-slate-800">{profile?.nombre}</span> ({profile?.email})
            </p>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              Cerrar Sesión
            </button>
          </form>
        </header>

        <main className="mt-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-2">
              Conexión y Autenticación Supabase Verificada
            </h2>
            <p className="text-sm text-slate-600">
              Redirección automática por rol completada con éxito. Listo para la implementación de métricas, filtros y tabla de rendiciones en la Fase 4.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
