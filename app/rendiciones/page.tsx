import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '@/app/auth/actions';

export default async function RendicionesPage() {
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

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="max-w-lg mx-auto">
        <header className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
              Rendición en Terreno
            </span>
            <h1 className="text-xl font-black text-slate-900 mt-1">
              Hola, {profile?.nombre || 'Colaborador'}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {profile?.area} • {profile?.email}
            </p>
          </div>

          <form action={signOut}>
            <button
              type="submit"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg px-3 py-1.5 shadow-sm"
            >
              Salir
            </button>
          </form>
        </header>

        <main className="mt-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Fase 2: Autenticación Lista
            </h2>
            <p className="text-xs text-slate-600">
              El formulario Mobile-First con cámara trasera y el historial de gastos se activarán en la Fase 3.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
