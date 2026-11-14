'use client';

import { useState, useRef, useEffect, useActionState } from 'react';
import { devolverSobrante, type FormState } from '@/app/rendiciones/actions';
import { formatFolioFondo } from '@/lib/folios';
import ModalCartolaDetalle, { type GastoDetalleItem } from '@/components/ModalCartolaDetalle';

// Compresión nativa en navegador para fotos de comprobante de devolución
function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    if (file.size < 600 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIMENSION = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIMENSION) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
            const compressed = new File([blob], cleanName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          'image/jpeg',
          0.8
        );
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export interface FondoAsignadoActivo {
  id: string;
  correlativo?: number | null;
  motivo: string;
  monto_asignado: number;
  total_rendido: number;
  saldo_restante: number;
  monto_devuelto: number;
  estado: string;
  comprobante_devolucion_url?: string | null;
  signedDevolucionUrl?: string | null;
  created_at?: string;
}

interface PanelSaldosEmpleadoProps {
  fondoActivo: FondoAsignadoActivo | null;
  totalReembolsosPendientes: number;
  gastosVinculados?: GastoDetalleItem[];
  fondosHistoricos?: FondoAsignadoActivo[];
  todosLosGastos?: GastoDetalleItem[];
  nombreUsuario?: string;
  areaUsuario?: string;
}

export default function PanelSaldosEmpleado({
  fondoActivo,
  totalReembolsosPendientes,
  gastosVinculados = [],
  fondosHistoricos = [],
  todosLosGastos = [],
  nombreUsuario = 'Colaborador',
  areaUsuario = 'Terreno',
}: PanelSaldosEmpleadoProps) {
  const [modalDevolucionOpen, setModalDevolucionOpen] = useState(false);
  const [modalCartolaOpen, setModalCartolaOpen] = useState(false);
  const [mostrarHistoricos, setMostrarHistoricos] = useState(false);
  const [fondoSeleccionadoCartola, setFondoSeleccionadoCartola] = useState<FondoAsignadoActivo | null>(null);
  const [modalFotoUrl, setModalFotoUrl] = useState<string | null>(null);
  const [modalFotoTitulo, setModalFotoTitulo] = useState<string>('Comprobante');
  const [montoDevolver, setMontoDevolver] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    devolverSobrante,
    null
  );

  useEffect(() => {
    if (fondoActivo) {
      setMontoDevolver(Math.max(0, fondoActivo.saldo_restante));
    }
  }, [fondoActivo]);

  useEffect(() => {
    if (state?.success) {
      setModalDevolucionOpen(false);
      setSelectedFile(null);
      setPreview(null);
    }
  }, [state?.success]);

  const formatCLP = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      try {
        const optimized = await compressImage(file);
        setSelectedFile(optimized);
        setPreview(URL.createObjectURL(optimized));
      } catch (err) {
        console.error('Error al optimizar comprobante:', err);
        setSelectedFile(file);
        setPreview(URL.createObjectURL(file));
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleSubmit = (formData: FormData) => {
    if (selectedFile) {
      formData.set('foto', selectedFile, selectedFile.name);
    }
    formAction(formData);
  };

  const folioFondo = fondoActivo
    ? formatFolioFondo(fondoActivo.correlativo, fondoActivo.id)
    : '';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Indicador 1: Fondo Asignado Activo */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Fondo Asignado
                </span>
                {fondoActivo && (
                  <span className="font-mono font-black text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                    {folioFondo}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-black text-slate-900 mt-0.5 truncate">
                {fondoActivo ? fondoActivo.motivo : 'Sin Fondo Activo'}
              </h3>
            </div>
            {fondoActivo && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  fondoActivo.saldo_restante > 0
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                {fondoActivo.saldo_restante > 0 ? 'Saldo Pendiente' : 'Al Día'}
              </span>
            )}
          </div>

          {fondoActivo ? (
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-3 gap-1 py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Asignado</span>
                  <span className="text-xs font-bold text-slate-700 block">
                    {formatCLP(fondoActivo.monto_asignado)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Rendido</span>
                  <span className="text-xs font-bold text-sky-700 block">
                    {formatCLP(fondoActivo.total_rendido)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Saldo Restante</span>
                  <span
                    className={`text-xs font-black block ${
                      fondoActivo.saldo_restante > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatCLP(fondoActivo.saldo_restante)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                {/* Botón Ver Cartola del Fondo */}
                <button
                  type="button"
                  onClick={() => setModalCartolaOpen(true)}
                  className="flex-1 py-2 px-2.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-300 text-sky-900 text-xs font-bold transition-colors text-center shadow-sm"
                >
                  Ver Cartola
                </button>

                {fondoActivo.saldo_restante > 0 && (
                  <button
                    type="button"
                    onClick={() => setModalDevolucionOpen(true)}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black transition-colors flex items-center justify-center gap-1 shadow-sm"
                  >
                    Devolver Sobrante
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-2">
              No tienes viáticos o cajas chicas activas asignadas por administración.
            </p>
          )}
        </div>

        {/* Indicador 2: Reembolsos Acumulados (Gastos Propios) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Reembolsos por Cobrar
            </span>
            <h3 className="text-sm font-black text-slate-900 mt-0.5">
              Gastos Propios Pendientes de Pago
            </h3>
          </div>

          <div className="mt-3">
            <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 block">
                  Total que la empresa te debe
                </span>
                <span className="text-2xl font-black text-sky-950 block mt-0.5">
                  {formatCLP(totalReembolsosPendientes)}
                </span>
              </div>
              <span className="px-2 py-1 rounded-lg bg-sky-100 text-sky-900 text-xs font-black">
                {totalReembolsosPendientes > 0 ? 'Por Pagar' : '$0'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de Viáticos / Fondos Cerrados del Empleado */}
      {fondosHistoricos.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm space-y-2.5">
          <button
            type="button"
            onClick={() => setMostrarHistoricos(!mostrarHistoricos)}
            className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span>Historial de Viáticos Cerrados y Conciliados</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                {fondosHistoricos.length}
              </span>
            </div>
            <span className="text-slate-400 text-xs font-medium">
              {mostrarHistoricos ? '▲ Ocultar' : '▼ Ver'}
            </span>
          </button>

          {mostrarHistoricos && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              {fondosHistoricos.map((fh) => {
                const folioFondoH = formatFolioFondo(fh.correlativo, fh.id);
                return (
                  <div
                    key={fh.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[11px]">
                          {folioFondoH}
                        </span>
                        <strong className="text-slate-900">{fh.motivo}</strong>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Asignado: {formatCLP(fh.monto_asignado)} • Rendido: {formatCLP(fh.total_rendido)}
                        {fh.monto_devuelto > 0 && (
                          <span className="text-emerald-700 font-bold ml-1">
                            • Devuelto: {formatCLP(fh.monto_devuelto)}
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFondoSeleccionadoCartola(fh)}
                      className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 font-bold text-[11px] shadow-sm whitespace-nowrap"
                    >
                      Ver Cartola
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Cartola del Fondo Activo */}
      {modalCartolaOpen && fondoActivo && (
        <ModalCartolaDetalle
          tipo="fondo"
          fondo={{
            id: fondoActivo.id,
            correlativo: fondoActivo.correlativo,
            motivo: fondoActivo.motivo,
            monto_asignado: fondoActivo.monto_asignado,
            estado: fondoActivo.estado as any,
            monto_devuelto: fondoActivo.monto_devuelto,
            comprobante_devolucion_url: fondoActivo.comprobante_devolucion_url || null,
            created_at: fondoActivo.created_at || new Date().toISOString(),
            user_id: '',
            nombre_empleado: nombreUsuario,
            area_empleado: areaUsuario,
            signedDevolucionUrl: fondoActivo.signedDevolucionUrl || null,
          }}
          gastosVinculados={gastosVinculados}
          isAdmin={false}
          onClose={() => setModalCartolaOpen(false)}
          onVerFoto={(url, titulo) => {
            setModalFotoTitulo(titulo);
            setModalFotoUrl(url);
          }}
          onDevolverSobrante={() => {
            setModalCartolaOpen(false);
            setModalDevolucionOpen(true);
          }}
        />
      )}

      {/* Modal Cartola de Fondo Histórico/Cerrado */}
      {fondoSeleccionadoCartola && (
        <ModalCartolaDetalle
          tipo="fondo"
          fondo={{
            id: fondoSeleccionadoCartola.id,
            correlativo: fondoSeleccionadoCartola.correlativo,
            motivo: fondoSeleccionadoCartola.motivo,
            monto_asignado: fondoSeleccionadoCartola.monto_asignado,
            estado: fondoSeleccionadoCartola.estado as any,
            monto_devuelto: fondoSeleccionadoCartola.monto_devuelto,
            comprobante_devolucion_url: fondoSeleccionadoCartola.comprobante_devolucion_url || null,
            created_at: fondoSeleccionadoCartola.created_at || new Date().toISOString(),
            user_id: '',
            nombre_empleado: nombreUsuario,
            area_empleado: areaUsuario,
            signedDevolucionUrl: fondoSeleccionadoCartola.signedDevolucionUrl || null,
          }}
          gastosVinculados={(todosLosGastos || []).filter(
            (g) => g.fondo_id === fondoSeleccionadoCartola.id && g.tipo_rendicion === 'anticipo'
          )}
          isAdmin={false}
          onClose={() => setFondoSeleccionadoCartola(null)}
          onVerFoto={(url, titulo) => {
            setModalFotoTitulo(titulo);
            setModalFotoUrl(url);
          }}
        />
      )}

      {/* Modal Visor de Comprobantes para Panel de Empleado */}
      {modalFotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setModalFotoUrl(null)}
        >
          <div
            className="relative max-w-lg w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3.5 border-b border-slate-800 text-white">
              <h3 className="text-xs font-bold truncate pr-3">{modalFotoTitulo}</h3>
              <button
                type="button"
                onClick={() => setModalFotoUrl(null)}
                className="text-white hover:text-red-400 bg-white/10 hover:bg-white/20 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors"
              >
                ✕ Cerrar
              </button>
            </div>
            <div className="flex items-center justify-center bg-black p-2 min-h-[250px] max-h-[70vh]">
              <img
                src={modalFotoUrl}
                alt={modalFotoTitulo}
                className="max-h-[65vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal Devolver Sobrante y Cerrar Fondo */}
      {modalDevolucionOpen && fondoActivo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setModalDevolucionOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Devolver Sobrante y Conciliar
                </h3>
                <p className="text-xs text-slate-500">
                  Fondo {folioFondo}: <strong>{fondoActivo.motivo}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalDevolucionOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {state?.error && (
              <div className="p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs font-bold">
                {state.error}
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <div className="flex justify-between">
                <span>Monto Asignado:</span>
                <strong className="text-slate-900">{formatCLP(fondoActivo.monto_asignado)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Total Rendido en Boletas:</span>
                <strong className="text-sky-700">{formatCLP(fondoActivo.total_rendido)}</strong>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-800">Saldo Sobrante a Transferir:</span>
                <strong className="font-black text-amber-700">{formatCLP(fondoActivo.saldo_restante)}</strong>
              </div>
            </div>

            <form action={handleSubmit} className="space-y-3.5">
              <input type="hidden" name="fondoId" value={fondoActivo.id} />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto a Transferir a la Empresa ($ CLP) *
                </label>
                <input
                  type="number"
                  name="montoDevuelto"
                  required
                  min="0"
                  step="1"
                  value={montoDevolver}
                  onChange={(e) => setMontoDevolver(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 font-black focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Comprobante de Transferencia Bancaria *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  name="foto"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isCompressing}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  </svg>
                  {isCompressing
                    ? 'Procesando imagen...'
                    : preview
                    ? 'Cambiar Comprobante de Transferencia'
                    : 'Subir Comprobante de Transferencia'}
                </button>

                {preview && (
                  <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 bg-black flex justify-center">
                    <img src={preview} alt="Comprobante de devolución" className="max-h-40 w-auto object-contain" />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalDevolucionOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || isCompressing || !selectedFile}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 shadow-sm"
                >
                  {isPending ? 'Conciliando y cerrando...' : 'Cerrar Fondo con Devolución'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
