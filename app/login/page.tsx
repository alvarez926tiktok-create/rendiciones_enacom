'use client';

import { useActionState } from 'react';
import { login } from '@/app/auth/actions';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <div className="flex min-h-screen flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 bg-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img
            src="/logo-enacom.png"
            alt="Logo ENACOM"
            className="h-24 w-auto object-contain drop-shadow-sm"
          />
        </div>
        <h1 className="mt-3 text-center text-2xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
          PORTAL DE RENDICIONES ENACOM
        </h1>
        <p className="mt-1 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
          Control de Gastos y Rendición en Terreno
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-6 py-8 shadow-sm rounded-2xl sm:px-10 border border-slate-200">
          <form action={formAction} className="space-y-5">
            {state?.error && (
              <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-sm text-red-700">
                {state.error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Correo Electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="ejemplo@enacom.cl"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900 text-base placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-slate-900 text-base placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex justify-center items-center py-3 px-4 rounded-xl text-base font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isPending ? 'Iniciando sesión...' : 'Ingresar al Sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
