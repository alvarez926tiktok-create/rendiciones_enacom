'use client';

import { useState, useActionState, useRef, useEffect } from 'react';
import { crearUsuario, actualizarPassword, type UserActionState } from '@/app/admin/user-actions';
import { type ProfileItem } from '@/components/PanelAdmin';

interface GestionUsuariosProps {
  profiles: ProfileItem[];
}

const AREAS = [
  'Ingeniería Eléctrica',
  'Informática',
  'Administrativo',
  'Contabilidad',
  'Ventas',
  'Logística',
  'Gerencia',
] as const;

export default function GestionUsuarios({ profiles }: GestionUsuariosProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userToUpdatePass, setUserToUpdatePass] = useState<ProfileItem | null>(null);

  // Acción para crear usuario
  const [createState, createAction, isCreating] = useActionState<UserActionState | null, FormData>(
    crearUsuario,
    null
  );
  const createFormRef = useRef<HTMLFormElement>(null);

  // Acción para cambiar contraseña
  const [passState, passAction, isUpdatingPass] = useActionState<UserActionState | null, FormData>(
    actualizarPassword,
    null
  );
  const passFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (createState?.success) {
      createFormRef.current?.reset();
      setShowCreateForm(false);
    }
  }, [createState?.success]);

  useEffect(() => {
    if (passState?.success) {
      passFormRef.current?.reset();
      setUserToUpdatePass(null);
    }
  }, [passState?.success]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Encabezado y botón para desplegar formulario */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base font-black text-slate-900">
            Gestión de Personal ({profiles.length})
          </h2>
          <p className="text-xs text-slate-500">
            Administra los usuarios del sistema, sus roles y contraseñas.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 shadow-sm transition-colors self-start sm:self-auto"
        >
          {showCreateForm ? '✕ Cancelar Registro' : '+ Dar de Alta a Nuevo Colaborador'}
        </button>
      </div>

      {/* Notificaciones globales de usuario */}
      {createState?.error && (
        <div className="rounded-xl bg-red-50 p-3.5 border border-red-200 text-xs font-semibold text-red-800">
          {createState.error}
        </div>
      )}
      {createState?.success && createState.message && (
        <div className="rounded-xl bg-emerald-50 p-3.5 border border-emerald-200 text-xs font-semibold text-emerald-800">
          ✓ {createState.message}
        </div>
      )}
      {passState?.error && (
        <div className="rounded-xl bg-red-50 p-3.5 border border-red-200 text-xs font-semibold text-red-800">
          {passState.error}
        </div>
      )}
      {passState?.success && passState.message && (
        <div className="rounded-xl bg-emerald-50 p-3.5 border border-emerald-200 text-xs font-semibold text-emerald-800">
          ✓ {passState.message}
        </div>
      )}

      {/* Formulario para Crear Usuario */}
      {showCreateForm && (
        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/40">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Crear Nuevo Usuario / Empleado
          </h3>
          <form ref={createFormRef} action={createAction} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  name="nombre"
                  type="text"
                  required
                  placeholder="Ej: Carlos Silva"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Correo Electrónico *
                </label>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="ejemplo@enacom.cl"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contraseña Temporal *
                </label>
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rol en el Sistema *
                </label>
                <select
                  name="rol"
                  required
                  defaultValue="empleado"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                >
                  <option value="empleado">Empleado (Rendición en terreno)</option>
                  <option value="admin">Administrador (Control total)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Área Corporativa *
                </label>
                <select
                  name="area"
                  required
                  defaultValue="Administrativo"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
                >
                  {AREAS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 shadow-sm"
              >
                {isCreating ? 'Creando...' : 'Guardar Usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista / Tabla de Personal */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-700">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <tr>
              <th scope="col" className="px-4 py-2.5">Colaborador</th>
              <th scope="col" className="px-4 py-2.5">Área</th>
              <th scope="col" className="px-4 py-2.5">Rol</th>
              <th scope="col" className="px-4 py-2.5 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {profiles.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-bold text-slate-900 block leading-tight">
                    {p.nombre}
                  </span>
                  <span className="text-xs text-slate-400 block">
                    {p.email}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                  {p.area}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.rol === 'admin'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-sky-100 text-sky-800 border border-sky-200'
                    }`}
                  >
                    {p.rol}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setUserToUpdatePass(p)}
                    className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-sky-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Actualizar Contraseña
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal para Actualizar Contraseña */}
      {userToUpdatePass && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setUserToUpdatePass(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-black text-slate-900 mb-1">
              Actualizar Contraseña
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Colaborador: <strong className="text-slate-800">{userToUpdatePass.nombre}</strong> ({userToUpdatePass.email})
            </p>

            <form ref={passFormRef} action={passAction} className="space-y-4">
              <input type="hidden" name="userId" value={userToUpdatePass.id} />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nueva Contraseña *
                </label>
                <input
                  name="newPassword"
                  type="password"
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserToUpdatePass(null)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPass}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 shadow-sm"
                >
                  {isUpdatingPass ? 'Guardando...' : 'Cambiar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
