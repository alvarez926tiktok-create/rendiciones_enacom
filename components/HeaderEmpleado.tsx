'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { cambiarPasswordEmpleado, type FormState } from '@/app/rendiciones/actions';
import { signOut } from '@/app/auth/actions';

interface HeaderEmpleadoProps {
  nombre?: string;
  area?: string;
  email?: string;
}

export default function HeaderEmpleado({ nombre, area, email }: HeaderEmpleadoProps) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    cambiarPasswordEmpleado,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Limpiar campos tras éxito
  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state?.success]);

  const handleCerrarModal = () => {
    setModalAbierto(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* Logo y Datos del Colaborador */}
          <div className="flex items-center gap-2.5">
            <div className="h-10 px-2 py-1 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              <img src="/logo-enacom.png" alt="ENACOM" className="h-7 w-auto object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-black text-slate-900 leading-none">
                  {nombre || 'Colaborador'}
                </h1>
              </div>
              <span className="text-[11px] font-semibold text-slate-500">
                {area || 'Terreno'}
              </span>
            </div>
          </div>

          {/* Acciones de Cuenta */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setModalAbierto(true)}
              title="Cambiar mi contraseña"
              className="text-xs font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg px-2.5 py-1.5 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
              <span>Contraseña</span>
            </button>

            <form action={signOut}>
              <button
                type="submit"
                className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Modal de Autogestión de Contraseña */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Cambiar Contraseña
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Actualiza tu clave de acceso al portal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCerrarModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {state?.error && (
              <div className="rounded-xl bg-red-50 p-3 border border-red-200 text-xs font-semibold text-red-800">
                {state.error}
              </div>
            )}

            {state?.success && (
              <div className="rounded-xl bg-emerald-50 p-3 border border-emerald-200 text-xs font-semibold text-emerald-800">
                ✓ {state.message || 'Contraseña actualizada correctamente.'}
              </div>
            )}

            <form ref={formRef} action={formAction} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Nueva Contraseña *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Confirmar Contraseña *
                </label>
                <input
                  type="password"
                  name="confirm_password"
                  required
                  minLength={6}
                  placeholder="Repite la nueva contraseña"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCerrarModal}
                  className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  {state?.success ? 'Cerrar' : 'Cancelar'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 px-3 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-colors shadow-sm"
                >
                  {isPending ? 'Guardando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
