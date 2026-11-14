'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { formatFolioFondo, formatFolioGasto } from '@/lib/folios';
import {
  registrarAbonoReembolso,
  cerrarFolioDefinitivo,
  cerrarFondoDefinitivo,
  type FondoActionState,
} from '@/app/admin/fondos-actions';

export interface AbonoItem {
  id: string;
  gasto_id: string;
  admin_id?: string | null;
  monto_abonado: number;
  comprobante_pago_url: string | null;
  signedUrl?: string | null;
  notas?: string | null;
  created_at: string;
}

export interface GastoDetalleItem {
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
  nombre_empleado: string;
  email_empleado?: string;
  area_empleado: string;
  signedUrl?: string | null;
  signedPagoUrl?: string | null;
}

export interface FondoDetalleItem {
  id: string;
  correlativo?: number | null;
  user_id: string;
  admin_id?: string | null;
  motivo: string;
  monto_asignado: number;
  estado: 'activo' | 'por_devolver' | 'cerrado';
  comprobante_devolucion_url: string | null;
  monto_devuelto: number;
  created_at: string;
  nombre_empleado?: string;
  email_empleado?: string;
  area_empleado?: string;
  signedDevolucionUrl?: string | null;
}

interface ModalCartolaDetalleProps {
  tipo: 'gasto' | 'fondo';
  gasto?: GastoDetalleItem | null;
  fondo?: FondoDetalleItem | null;
  abonos?: AbonoItem[];
  gastosVinculados?: GastoDetalleItem[];
  isAdmin?: boolean;
  onClose: () => void;
  onVerFoto?: (url: string, titulo: string) => void;
  onDevolverSobrante?: () => void;
}

export default function ModalCartolaDetalle({
  tipo,
  gasto,
  fondo,
  abonos = [],
  gastosVinculados = [],
  isAdmin = false,
  onClose,
  onVerFoto,
  onDevolverSobrante,
}: ModalCartolaDetalleProps) {
  const [mostrarFormAbono, setMostrarFormAbono] = useState<boolean>(false);
  const [montoAbonoInput, setMontoAbonoInput] = useState<number>(0);
  const abonoFormRef = useRef<HTMLFormElement>(null);

  // Server action para nuevo abono
  const [abonoState, abonoAction, isAbonando] = useActionState<FondoActionState | null, FormData>(
    registrarAbonoReembolso,
    null
  );

  // Server actions para cierre definitivo
  const [isCerrando, setIsCerrando] = useState<boolean>(false);
  const [cierreFeedback, setCierreFeedback] = useState<string | null>(null);

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

  // Cálculos matemáticos para Reembolsos (Gasto)
  const totalAbonado = abonos.reduce((sum, a) => sum + a.monto_abonado, 0);
  // Si fue cerrado anteriormente con comprobante directo y no tiene abonos en tabla
  const montoGastoEfectivo = gasto?.monto || 0;
  const totalPagadoReembolso =
    abonos.length > 0
      ? totalAbonado
      : gasto?.estado === 'cerrado' && gasto.comprobante_pago_url
      ? montoGastoEfectivo
      : 0;
  const saldoPendienteReembolso = Math.max(0, montoGastoEfectivo - totalPagadoReembolso);

  // Cálculos matemáticos para Fondos
  const totalRendidoEnFondo = gastosVinculados.reduce((sum, g) => sum + g.monto, 0);
  const montoAsignadoFondo = fondo?.monto_asignado || 0;
  const montoDevueltoFondo = fondo?.monto_devuelto || 0;
  const saldoRestanteFondo = Math.max(0, montoAsignadoFondo - totalRendidoEnFondo - montoDevueltoFondo);

  useEffect(() => {
    if (gasto) {
      setMontoAbonoInput(saldoPendienteReembolso);
    }
  }, [gasto, saldoPendienteReembolso]);

  useEffect(() => {
    if (abonoState?.success) {
      setMostrarFormAbono(false);
      abonoFormRef.current?.reset();
    }
  }, [abonoState?.success]);

  const handleCerrarDefinitivo = async () => {
    if (!isAdmin) return;
    setIsCerrando(true);
    setCierreFeedback(null);
    try {
      if (tipo === 'gasto' && gasto) {
        const res = await cerrarFolioDefinitivo(gasto.id);
        if (res.success) {
          setCierreFeedback('Folio cerrado definitivamente.');
        }
      } else if (tipo === 'fondo' && fondo) {
        const res = await cerrarFondoDefinitivo(fondo.id);
        if (res.success) {
          setCierreFeedback('Fondo cerrado definitivamente.');
        }
      }
    } finally {
      setIsCerrando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 my-8 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header de Cartola */}
        <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg text-xs font-black tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/30 font-mono">
                {tipo === 'fondo'
                  ? formatFolioFondo(fondo?.correlativo, fondo?.id)
                  : formatFolioGasto(gasto?.correlativo, gasto?.id)}
              </span>
              <span className="text-xs font-bold text-slate-300">
                {tipo === 'fondo' ? 'Cartola de Fondo / Viático' : 'Cartola de Rendición de Gasto'}
              </span>
              {tipo === 'gasto' && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    gasto?.tipo_rendicion === 'anticipo'
                      ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-700'
                      : 'bg-amber-900/60 text-amber-300 border border-amber-700'
                  }`}
                >
                  {gasto?.tipo_rendicion === 'anticipo' ? 'Anticipo / Fondo' : 'Reembolso Propio'}
                </span>
              )}
            </div>

            <h2 className="text-lg font-black text-white leading-tight">
              {tipo === 'fondo' ? fondo?.motivo : `${gasto?.categoria} (Doc #${gasto?.numero_comprobante})`}
            </h2>

            <p className="text-xs text-slate-400">
              Colaborador: <strong className="text-slate-200">{tipo === 'fondo' ? fondo?.nombre_empleado : gasto?.nombre_empleado}</strong> • {tipo === 'fondo' ? fondo?.area_empleado : gasto?.area_empleado}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-xl p-2 text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 2. Cuerpo desplazable */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Alertas */}
          {abonoState?.error && (
            <div className="p-3.5 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs font-bold">
              ✕ {abonoState.error}
            </div>
          )}
          {(abonoState?.message || cierreFeedback) && (
            <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              ✓ {abonoState?.message || cierreFeedback}
            </div>
          )}

          {/* Tarjetas de Resumen Matemático */}
          {tipo === 'gasto' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Monto Total Boleta
                </span>
                <span className="text-xl font-black text-slate-900 block mt-0.5">
                  {formatCLP(montoGastoEfectivo)}
                </span>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Total Pagado / Abonado
                </span>
                <span className="text-xl font-black text-emerald-950 block mt-0.5">
                  {formatCLP(totalPagadoReembolso)}
                </span>
              </div>

              <div
                className={`rounded-2xl p-3.5 text-center border ${
                  saldoPendienteReembolso > 0
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider block ${
                    saldoPendienteReembolso > 0 ? 'text-amber-700' : 'text-slate-500'
                  }`}
                >
                  Saldo Deuda Pendiente
                </span>
                <span
                  className={`text-xl font-black block mt-0.5 ${
                    saldoPendienteReembolso > 0 ? 'text-amber-900' : 'text-slate-600'
                  }`}
                >
                  {formatCLP(saldoPendienteReembolso)}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Monto Asignado</span>
                <span className="text-base font-black text-slate-900 block mt-0.5">
                  {formatCLP(montoAsignadoFondo)}
                </span>
              </div>
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-sky-700 block">Total Rendido</span>
                <span className="text-base font-black text-sky-950 block mt-0.5">
                  {formatCLP(totalRendidoEnFondo)}
                </span>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-center">
                <span className="text-[10px] font-bold uppercase text-emerald-700 block">Devuelto</span>
                <span className="text-base font-black text-emerald-950 block mt-0.5">
                  {formatCLP(montoDevueltoFondo)}
                </span>
              </div>
              <div
                className={`rounded-2xl p-3 text-center border ${
                  saldoRestanteFondo > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span
                  className={`text-[10px] font-bold uppercase block ${
                    saldoRestanteFondo > 0 ? 'text-amber-700' : 'text-slate-500'
                  }`}
                >
                  Saldo a Devolver
                </span>
                <span
                  className={`text-base font-black block mt-0.5 ${
                    saldoRestanteFondo > 0 ? 'text-amber-900' : 'text-slate-600'
                  }`}
                >
                  {formatCLP(saldoRestanteFondo)}
                </span>
              </div>
            </div>
          )}

          {/* 3. LÍNEA DE TIEMPO / HISTORIAL CRONOLÓGICO */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Evolución y Trazabilidad Cronológica
            </h3>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {tipo === 'gasto' && gasto && (
                <>
                  {/* Evento 1: Carga de Boleta */}
                  <div className="relative">
                    <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-sky-500 ring-4 ring-white"></span>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Rendición Registrada en Terreno
                        </span>
                        <span className="text-[11px] text-slate-400">{formatDate(gasto.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Boleta #{gasto.numero_comprobante} por valor de <strong className="text-slate-900">{formatCLP(gasto.monto)}</strong> en categoría <strong>{gasto.categoria}</strong>.
                      </p>
                      {gasto.signedUrl && onVerFoto && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => onVerFoto(gasto.signedUrl!, `Boleta #${gasto.numero_comprobante}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:text-sky-600 shadow-sm"
                          >
                            Ver Foto de Boleta
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Evento 2: Abonos Parciales Registrados */}
                  {abonos.map((abono, idx) => (
                    <div key={abono.id} className="relative">
                      <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white"></span>
                      <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-900">
                            Abono #{idx + 1} de la Empresa: +{formatCLP(abono.monto_abonado)}
                          </span>
                          <span className="text-[11px] text-slate-400">{formatDate(abono.created_at)}</span>
                        </div>
                        {abono.notas && (
                          <p className="text-xs text-slate-600 italic">
                            Nota: &ldquo;{abono.notas}&rdquo;
                          </p>
                        )}
                        {(abono.signedUrl || abono.comprobante_pago_url) && onVerFoto && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                onVerFoto(
                                  abono.signedUrl || abono.comprobante_pago_url!,
                                  `Comprobante Abono #${idx + 1}`
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-50 shadow-sm"
                            >
                              Ver Transferencia Bancaria
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Si no hubo abonos en tabla pero se pagó directo */}
                  {abonos.length === 0 && gasto.comprobante_pago_url && (
                    <div className="relative">
                      <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white"></span>
                      <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-900">
                            Pago Completo de Reembolso: {formatCLP(gasto.monto)}
                          </span>
                          <span className="text-[11px] text-slate-400">Conciliado</span>
                        </div>
                        {gasto.signedPagoUrl && onVerFoto && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => onVerFoto(gasto.signedPagoUrl!, `Transferencia Reembolso`)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-50 shadow-sm"
                            >
                              Ver Comprobante de Transferencia
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Estado Final */}
                  {saldoPendienteReembolso === 0 && (
                    <div className="relative">
                      <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-slate-900 ring-4 ring-white"></span>
                      <div className="bg-slate-100 rounded-xl p-2.5 text-xs text-slate-700 font-bold flex items-center justify-between">
                        <span>✓ Cuenta 100% saldada y conciliada.</span>
                        <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-white border border-slate-200">
                          Folio Cerrado
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {tipo === 'fondo' && fondo && (
                <>
                  {/* Evento 1: Asignación Inicial */}
                  <div className="relative">
                    <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-sky-500 ring-4 ring-white"></span>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Entrega de Fondo Asignado / Viático
                        </span>
                        <span className="text-[11px] text-slate-400">{formatDate(fondo.created_at)}</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        La empresa asignó <strong className="text-slate-900">{formatCLP(fondo.monto_asignado)}</strong> para: <em>&ldquo;{fondo.motivo}&rdquo;</em>.
                      </p>
                    </div>
                  </div>

                  {/* Evento 2: Boletas descontadas */}
                  {gastosVinculados.length === 0 ? (
                    <div className="relative text-xs text-slate-400 italic py-1">
                      Aún no se han registrado boletas asociadas a este fondo.
                    </div>
                  ) : (
                    gastosVinculados.map((g) => (
                      <div key={g.id} className="relative">
                        <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-amber-500 ring-4 ring-white"></span>
                        <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-3 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">
                              Descuento Boleta #{g.numero_comprobante} ({g.categoria}): -{formatCLP(g.monto)}
                            </span>
                            <span className="text-[11px] text-slate-400">{formatDate(g.created_at)}</span>
                          </div>
                          {g.signedUrl && onVerFoto && (
                            <button
                              type="button"
                              onClick={() => onVerFoto(g.signedUrl!, `Boleta #${g.numero_comprobante}`)}
                              className="text-[11px] font-bold text-sky-700 hover:underline pt-0.5 block"
                            >
                              Ver Boleta Adjunta
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Evento 3: Devolución de Sobrante */}
                  {fondo.monto_devuelto > 0 && (
                    <div className="relative">
                      <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white"></span>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-950">
                            Devolución de Sobrante: {formatCLP(fondo.monto_devuelto)}
                          </span>
                          <span className="text-[11px] text-emerald-700 font-bold">Transferido a Empresa</span>
                        </div>
                        {fondo.signedDevolucionUrl && onVerFoto && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                onVerFoto(fondo.signedDevolucionUrl!, `Devolución de Sobrante - ${fondo.motivo}`)
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-50 shadow-sm"
                            >
                              Ver Comprobante Bancario
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Evento 4: Cierre del Fondo */}
                  {fondo.estado === 'cerrado' && (
                    <div className="relative">
                      <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-slate-900 ring-4 ring-white"></span>
                      <div className="bg-slate-100 rounded-xl p-2.5 text-xs text-slate-700 font-bold flex items-center justify-between">
                        <span>✓ Fondo completamente conciliado y cerrado.</span>
                        <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-white border border-slate-200">
                          Cerrado
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 4. FORMULARIO PARA REGISTRAR ABONO PARCIAL (Solo Admin y si hay saldo) */}
          {isAdmin && tipo === 'gasto' && gasto && saldoPendienteReembolso > 0 && mostrarFormAbono && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-300 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                  Registrar Abono / Pago Parcial
                </h4>
                <button
                  type="button"
                  onClick={() => setMostrarFormAbono(false)}
                  className="text-xs font-bold text-amber-800 hover:text-amber-950"
                >
                  Cancelar
                </button>
              </div>

              <form ref={abonoFormRef} action={abonoAction} className="space-y-3">
                <input type="hidden" name="gastoId" value={gasto.id} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Monto a Abonar ($ CLP) *
                    </label>
                    <input
                      type="number"
                      name="montoAbonado"
                      required
                      min="1"
                      max={saldoPendienteReembolso}
                      step="1"
                      value={montoAbonoInput}
                      onChange={(e) => setMontoAbonoInput(parseInt(e.target.value, 10) || 0)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 font-black focus:border-amber-500 focus:outline-none bg-white"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Máximo disponible: {formatCLP(saldoPendienteReembolso)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nota / Detalle (Opcional)
                    </label>
                    <input
                      type="text"
                      name="notas"
                      placeholder="Ej: Pago 50% quincena"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Comprobante de Transferencia Bancaria *
                  </label>
                  <input
                    type="file"
                    name="comprobantePago"
                    accept="image/*"
                    required
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-900 hover:file:bg-amber-200"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isAbonando}
                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 shadow-sm"
                  >
                    {isAbonando ? 'Registrando Abono...' : 'Guardar Abono Bancario'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* 5. Footer con Acciones Rápidas */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Si es Admin viendo un Gasto con saldo pendiente */}
            {isAdmin && tipo === 'gasto' && gasto && saldoPendienteReembolso > 0 && !mostrarFormAbono && (
              <button
                type="button"
                onClick={() => setMostrarFormAbono(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-sm transition-colors"
              >
                + Registrar Abono / Pago Parcial
              </button>
            )}

            {/* Si es Admin, botón para Cerrar Folio Definitivamente */}
            {isAdmin && ((tipo === 'gasto' && gasto?.estado !== 'cerrado') || (tipo === 'fondo' && fondo?.estado !== 'cerrado')) && (
              <button
                type="button"
                disabled={isCerrando}
                onClick={handleCerrarDefinitivo}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs shadow-sm transition-colors disabled:opacity-50"
              >
                {isCerrando ? 'Cerrando...' : 'Cerrar Folio Definitivamente'}
              </button>
            )}

            {/* Si es Empleado viendo un Fondo con saldo a favor de empresa */}
            {!isAdmin && tipo === 'fondo' && fondo && saldoRestanteFondo > 0 && onDevolverSobrante && (
              <button
                type="button"
                onClick={onDevolverSobrante}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-sm transition-colors"
              >
                Devolver Sobrante y Cerrar Fondo
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors ml-auto"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
}
