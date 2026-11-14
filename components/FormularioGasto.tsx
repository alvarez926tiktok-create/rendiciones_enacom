'use client';

import { useActionState, useState, useRef, useEffect } from 'react';
import { registrarGasto, type FormState } from '@/app/rendiciones/actions';

const CATEGORIAS = [
  'Bencina',
  'Transporte',
  'Comida',
  'Materiales',
  'Viáticos',
  'Otro',
] as const;

export default function FormularioGasto() {
  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    registrarGasto,
    null
  );

  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Manejo de preview de foto
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  // Limpiar formulario y preview tras guardado exitoso
  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [state?.success]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-900">
          Nueva Rendición
        </h2>
        <p className="text-xs text-slate-500">
          Registra tu comprobante en terreno de forma rápida.
        </p>
      </div>

      {state?.error && (
        <div className="mb-4 rounded-xl bg-red-50 p-3.5 border border-red-200 text-sm font-medium text-red-800">
          {state.error}
        </div>
      )}

      {state?.success && state.message && (
        <div className="mb-4 rounded-xl bg-emerald-50 p-3.5 border border-emerald-200 text-sm font-medium text-emerald-800">
          ✓ {state.message}
        </div>
      )}

      <form ref={formRef} action={formAction} className="space-y-4">
        {/* Categoría */}
        <div>
          <label
            htmlFor="categoria"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
          >
            Categoría *
          </label>
          <select
            id="categoria"
            name="categoria"
            required
            defaultValue=""
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-base text-slate-900 font-medium focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 shadow-sm"
          >
            <option value="" disabled>
              Selecciona una categoría...
            </option>
            {CATEGORIAS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Número de Comprobante */}
        <div>
          <label
            htmlFor="numero_comprobante"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
          >
            Nº de Comprobante / Boleta *
          </label>
          <input
            id="numero_comprobante"
            name="numero_comprobante"
            type="text"
            required
            placeholder="Ej: 984512"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-base text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 shadow-sm"
          />
        </div>

        {/* Monto */}
        <div>
          <label
            htmlFor="monto"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
          >
            Monto Total ($ CLP) *
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-3 text-slate-500 font-bold text-base">
              $
            </span>
            <input
              id="monto"
              name="monto"
              type="number"
              step="1"
              min="1"
              required
              placeholder="15000"
              className="w-full rounded-xl border border-slate-300 pl-8 pr-3.5 py-3 text-base text-slate-900 font-semibold placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 shadow-sm"
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Ingresa solo números enteros sin puntos ni decimales.
          </p>
        </div>

        {/* Foto del Comprobante (Cámara Trasera) */}
        <div>
          <label
            htmlFor="foto"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
          >
            Foto del Comprobante *
          </label>

          <input
            ref={fileInputRef}
            id="foto"
            name="foto"
            type="file"
            accept="image/*"
            capture="environment"
            required
            onChange={handlePhotoChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 border-dashed border-sky-400 bg-sky-50/60 hover:bg-sky-100/70 active:bg-sky-100 text-sky-800 font-bold text-sm transition-colors"
          >
            <svg
              className="w-5 h-5 text-sky-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {preview ? 'Cambiar Foto de Boleta' : 'Tomar Foto con Cámara / Subir Boleta'}
          </button>

          {preview && (
            <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-300 bg-slate-900 flex justify-center">
              <img
                src={preview}
                alt="Vista previa del comprobante"
                className="max-h-56 w-auto object-contain"
              />
              <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-semibold px-2 py-1 rounded-md">
                Foto lista
              </span>
            </div>
          )}
        </div>

        {/* Botón de Envío */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full mt-2 flex justify-center items-center py-4 px-4 rounded-xl text-base font-black text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 transition-colors shadow-md"
        >
          {isPending ? 'Guardando comprobante...' : 'Enviar Rendición'}
        </button>
      </form>
    </div>
  );
}
