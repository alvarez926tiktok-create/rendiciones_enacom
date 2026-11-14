'use client';

import { useState } from 'react';

export type GastoItem = {
  id: string;
  categoria: string;
  numero_comprobante: string;
  monto: number;
  foto_url: string;
  created_at: string;
  signedUrl?: string | null;
};

interface HistorialGastosProps {
  gastos: GastoItem[];
}

export default function HistorialGastos({ gastos }: HistorialGastosProps) {
  const [modalFoto, setModalFoto] = useState<string | null>(null);

  const totalAcumulado = gastos.reduce((sum, g) => sum + g.monto, 0);

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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            Mis Rendiciones Enviadas
          </h2>
          <p className="text-xs text-slate-500">
            Total acumulado: <span className="font-bold text-slate-800">{formatCLP(totalAcumulado)}</span>
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
          {gastos.length} {gastos.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {gastos.length === 0 ? (
        <div className="text-center py-8 px-4 text-slate-500">
          <p className="text-sm font-medium">Aún no has registrado ninguna rendición.</p>
          <p className="text-xs text-slate-400 mt-1">
            Usa el formulario superior para registrar tu primer gasto.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {gastos.map((gasto) => (
            <div
              key={gasto.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                <p className="text-base font-black text-slate-900">
                  {formatCLP(gasto.monto)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formatDate(gasto.created_at)}
                </p>
              </div>

              {gasto.signedUrl && (
                <button
                  type="button"
                  onClick={() => setModalFoto(gasto.signedUrl!)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:text-sky-600 text-xs font-bold shadow-sm active:bg-slate-100"
                >
                  <svg
                    className="w-4 h-4 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  Ver Boleta
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal visor de foto */}
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
              <span className="text-xs font-semibold">Comprobante de Gasto</span>
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
    </div>
  );
}
