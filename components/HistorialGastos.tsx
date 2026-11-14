'use client';

import { useState, useMemo, useActionState, useEffect, useRef } from 'react';
import { modificarGasto, eliminarGasto, type FormState } from '@/app/rendiciones/actions';
import { formatFolioGasto } from '@/lib/folios';
import ModalCartolaDetalle, { type AbonoItem } from '@/components/ModalCartolaDetalle';

export type GastoItem = {
  id: string;
  correlativo?: number | null;
  user_id: string;
  categoria: string;
  numero_comprobante: string;
  monto: number;
  foto_url: string;
  tipo_rendicion: 'anticipo' | 'reembolso';
  fondo_id: string | null;
  estado: 'aplicado_a_fondo' | 'por_pagar' | 'cerrado';
  comprobante_pago_url: string | null;
  created_at: string;
  signedUrl?: string | null;
  signedPagoUrl?: string | null;
};

interface HistorialGastosProps {
  gastos: GastoItem[];
  abonos?: AbonoItem[];
  nombreUsuario?: string;
  areaUsuario?: string;
}

type PeriodoFiltro = 'todos' | 'hoy' | '7d' | '30d' | 'mes_particular';

const CATEGORIAS = [
  'Bencina',
  'Transporte',
  'Comida',
  'Materiales',
  'Viáticos',
  'Otro',
] as const;

export default function HistorialGastos({
  gastos,
  abonos = [],
  nombreUsuario = 'Colaborador',
  areaUsuario = 'Terreno',
}: HistorialGastosProps) {
  const [modalFoto, setModalFoto] = useState<string | null>(null);
  const [modalFotoTitulo, setModalFotoTitulo] = useState<string>('Comprobante de Gasto');
  const [gastoToEdit, setGastoToEdit] = useState<GastoItem | null>(null);
  const [gastoToDelete, setGastoToDelete] = useState<GastoItem | null>(null);
  const [selectedGastoCartola, setSelectedGastoCartola] = useState<GastoItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [periodo, setPeriodo] = useState<PeriodoFiltro>('todos');
  const [mesParticular, setMesParticular] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });

  // Estado para la edición
  const [editState, editAction, isEditing] = useActionState<FormState | null, FormData>(
    modificarGasto,
    null
  );
  const editFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (editState?.success) {
      setActionFeedback({ type: 'success', message: editState.message || 'Rendición actualizada con éxito.' });
      setGastoToEdit(null);
    } else if (editState?.error) {
      setActionFeedback({ type: 'error', message: editState.error });
    }
  }, [editState]);

  const formatCLP = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getCategoriaBadgeClass = (categoria: string) => {
    switch (categoria) {
      case 'Bencina':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Transporte':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Comida':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Materiales':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Viáticos':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  // Mapa de abonos por gasto
  const abonosPorGasto = useMemo(() => {
    const mapa = new Map<string, AbonoItem[]>();
    abonos.forEach((a) => {
      const arr = mapa.get(a.gasto_id) || [];
      arr.push(a);
      mapa.set(a.gasto_id, arr);
    });
    return mapa;
  }, [abonos]);

  // Filtrado de gastos según el período seleccionado
  const filteredGastos = useMemo(() => {
    const now = new Date();

    return gastos.filter((g) => {
      const gDate = new Date(g.created_at);

      if (periodo === 'todos') {
        return true;
      }
      if (periodo === 'hoy') {
        return (
          gDate.getDate() === now.getDate() &&
          gDate.getMonth() === now.getMonth() &&
          gDate.getFullYear() === now.getFullYear()
        );
      }
      if (periodo === '7d') {
        const sieteDiasAtras = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return gDate >= sieteDiasAtras;
      }
      if (periodo === '30d') {
        const treintaDiasAtras = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return gDate >= treintaDiasAtras;
      }
      if (periodo === 'mes_particular') {
        const gMonthStr = g.created_at.slice(0, 7);
        return gMonthStr === mesParticular;
      }
      return true;
    });
  }, [gastos, periodo, mesParticular]);

  const totalPeriodo = useMemo(() => {
    return filteredGastos.reduce((sum, g) => sum + g.monto, 0);
  }, [filteredGastos]);

  // Manejo de eliminación
  const handleConfirmDelete = async () => {
    if (!gastoToDelete) return;
    setIsDeleting(true);
    setActionFeedback(null);

    const res = await eliminarGasto(gastoToDelete.id);
    setIsDeleting(false);
    setGastoToDelete(null);

    if (res.success) {
      setActionFeedback({ type: 'success', message: res.message || 'Rendición eliminada con éxito.' });
    } else {
      setActionFeedback({ type: 'error', message: res.error || 'No se pudo eliminar la rendición.' });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      {/* Título */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            Mis Rendiciones Enviadas
          </h2>
          <p className="text-xs text-slate-500">
            Toca el Folio o &ldquo;Ver Cartola&rdquo; para ver la evolución y abonos.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
          {filteredGastos.length} {filteredGastos.length === 1 ? 'doc' : 'docs'}
        </span>
      </div>

      {/* Alertas de acción */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-xl text-xs font-bold border ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {actionFeedback.message}
        </div>
      )}

      {/* Selector de Período */}
      <div className="space-y-2">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Filtrar Período
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setPeriodo('todos')}
            className={`py-2 px-2.5 rounded-xl border text-center transition-colors ${
              periodo === 'todos'
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setPeriodo('hoy')}
            className={`py-2 px-2.5 rounded-xl border text-center transition-colors ${
              periodo === 'hoy'
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Hoy / Del día
          </button>
          <button
            type="button"
            onClick={() => setPeriodo('7d')}
            className={`py-2 px-2.5 rounded-xl border text-center transition-colors ${
              periodo === '7d'
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Últimos 7 días
          </button>
          <button
            type="button"
            onClick={() => setPeriodo('30d')}
            className={`py-2 px-2.5 rounded-xl border text-center transition-colors ${
              periodo === '30d'
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Último mes
          </button>
          <button
            type="button"
            onClick={() => setPeriodo('mes_particular')}
            className={`py-2 px-2.5 rounded-xl border text-center transition-colors col-span-2 sm:col-span-1 ${
              periodo === 'mes_particular'
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Mes particular
          </button>
        </div>

        {periodo === 'mes_particular' && (
          <div className="pt-1 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Seleccionar mes:</span>
            <input
              type="month"
              value={mesParticular}
              onChange={(e) => setMesParticular(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-800 font-bold focus:border-sky-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Banner de Total Acumulado en el Período */}
      <div className="rounded-xl bg-slate-900 text-white p-4 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Total Rendido en el Período
          </span>
          <span className="text-2xl font-black text-white block mt-0.5">
            {formatCLP(totalPeriodo)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold text-sky-400 bg-sky-950/80 px-2.5 py-1 rounded-lg border border-sky-800">
            {filteredGastos.length} {filteredGastos.length === 1 ? 'boleta' : 'boletas'}
          </span>
        </div>
      </div>

      {/* Lista de Rendiciones */}
      {filteredGastos.length === 0 ? (
        <div className="text-center py-8 px-4 text-slate-500">
          <p className="text-sm font-medium">No hay rendiciones registradas en este período.</p>
          <p className="text-xs text-slate-400 mt-1">
            Cambia el filtro de período o sube un comprobante con el formulario.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGastos.map((gasto) => {
            const folioGasto = formatFolioGasto(gasto.correlativo, gasto.id);
            const abonosGasto = abonosPorGasto.get(gasto.id) || [];
            const totalAbonado = abonosGasto.reduce((s, a) => s + a.monto_abonado, 0);
            const tieneAbonosParciales = totalAbonado > 0 && totalAbonado < gasto.monto;

            return (
              <div
                key={gasto.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedGastoCartola(gasto)}
                      className="font-mono font-black text-xs text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-200 hover:bg-sky-100"
                    >
                      {folioGasto}
                    </button>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getCategoriaBadgeClass(
                        gasto.categoria
                      )}`}
                    >
                      {gasto.categoria}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      Doc: #{gasto.numero_comprobante}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="text-base font-black text-slate-900 leading-tight">
                      {formatCLP(gasto.monto)}
                    </p>
                    {tieneAbonosParciales && (
                      <span className="text-[10px] font-bold text-amber-700 block">
                        Pendiente: {formatCLP(gasto.monto - totalAbonado)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Badges de Modalidad y Estado Contable */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {gasto.tipo_rendicion === 'anticipo' ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Anticipo / Fondo
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                      Reembolso Propio
                    </span>
                  )}

                  {gasto.estado === 'aplicado_a_fondo' && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      ✓ Aplicado a Fondo
                    </span>
                  )}
                  {gasto.estado === 'por_pagar' && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-50 text-yellow-800 border border-yellow-200">
                      ⏳ Por Pagar {tieneAbonosParciales ? '(Con Abonos)' : ''}
                    </span>
                  )}
                  {gasto.estado === 'cerrado' && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      ✓ Cerrado / Reembolsado
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                  <span className="text-slate-400 text-[11px]">{formatDate(gasto.created_at)}</span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Botón Ver Cartola */}
                    <button
                      type="button"
                      onClick={() => setSelectedGastoCartola(gasto)}
                      className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-300 text-sky-800 hover:bg-sky-100 text-xs font-bold shadow-sm"
                    >
                      Ver Cartola
                    </button>

                    {/* Ver Boleta */}
                    {gasto.signedUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalFotoTitulo(`Boleta #${gasto.numero_comprobante}`);
                          setModalFoto(gasto.signedUrl!);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-sky-600 text-xs font-bold shadow-sm"
                      >
                        Foto Boleta
                      </button>
                    )}

                    {/* Editar (solo si no está cerrado) */}
                    {gasto.estado !== 'cerrado' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionFeedback(null);
                          setGastoToEdit(gasto);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:text-amber-600 text-xs font-bold shadow-sm"
                      >
                        Editar
                      </button>
                    )}

                    {/* Eliminar (solo si no está cerrado) */}
                    {gasto.estado !== 'cerrado' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActionFeedback(null);
                          setGastoToDelete(gasto);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold shadow-sm"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Visor de Foto */}
      {modalFoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setModalFoto(null)}
        >
          <div
            className="relative max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-2 text-white">
              <span className="text-xs font-semibold">{modalFotoTitulo}</span>
              <button
                type="button"
                onClick={() => setModalFoto(null)}
                className="text-white hover:text-red-400 font-bold text-sm bg-white/10 hover:bg-white/20 rounded-lg px-2.5 py-1"
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="flex justify-center bg-black rounded-xl overflow-hidden max-h-[75vh]">
              <img
                src={modalFoto}
                alt="Comprobante en alta resolución"
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Cartola / Detalle de Gasto para Empleado */}
      {selectedGastoCartola && (
        <ModalCartolaDetalle
          tipo="gasto"
          gasto={{
            ...selectedGastoCartola,
            nombre_empleado: nombreUsuario,
            area_empleado: areaUsuario,
          }}
          abonos={abonosPorGasto.get(selectedGastoCartola.id) || []}
          isAdmin={false}
          onClose={() => setSelectedGastoCartola(null)}
          onVerFoto={(url, titulo) => {
            setModalFotoTitulo(titulo);
            setModalFoto(url);
          }}
        />
      )}

      {/* Modal para Editar Rendición */}
      {gastoToEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setGastoToEdit(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Modificar Rendición
                </h3>
                <p className="text-xs text-slate-500">
                  Corrige los datos o el número de comprobante.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGastoToEdit(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form ref={editFormRef} action={editAction} className="space-y-3.5">
              <input type="hidden" name="gastoId" value={gastoToEdit.id} />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Categoría *
                </label>
                <select
                  name="categoria"
                  required
                  defaultValue={gastoToEdit.categoria}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 font-medium focus:border-sky-500 focus:outline-none"
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nº de Comprobante / Boleta *
                </label>
                <input
                  name="numero_comprobante"
                  type="text"
                  required
                  defaultValue={gastoToEdit.numero_comprobante}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto Total ($ CLP) *
                </label>
                <input
                  name="monto"
                  type="number"
                  step="1"
                  min="1"
                  required
                  defaultValue={gastoToEdit.monto}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 font-semibold focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cambiar Foto de Comprobante (Opcional)
                </label>
                <input
                  name="foto"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  Si no seleccionas un nuevo archivo, se conservará la foto original.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGastoToEdit(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 shadow-sm"
                >
                  {isEditing ? 'Guardando...' : 'Guardar Corrección'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar */}
      {gastoToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setGastoToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-black text-slate-900 mb-1">
              ¿Eliminar Rendición?
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              ¿Estás seguro de que deseas eliminar la rendición del comprobante{' '}
              <strong className="text-slate-900">#{gastoToDelete.numero_comprobante}</strong> por{' '}
              <strong className="text-slate-900">{formatCLP(gastoToDelete.monto)}</strong>?
            </p>
            <p className="text-[11px] text-red-600 font-semibold mb-4 bg-red-50 p-2 rounded-lg border border-red-100">
              Esta acción borrará el comprobante y el registro de la base de datos de forma permanente.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGastoToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 shadow-sm"
              >
                {isDeleting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
