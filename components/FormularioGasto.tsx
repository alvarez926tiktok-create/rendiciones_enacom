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

// Compresión nativa en navegador para fotos de celular de alto peso
function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    // Si ya pesa menos de 600KB, enviarlo sin alterar
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

export interface FondoActivoInfo {
  id: string;
  motivo: string;
  monto_asignado: number;
  saldo_restante: number;
}

interface FormularioGastoProps {
  fondoActivo?: FondoActivoInfo | null;
}

export default function FormularioGasto({ fondoActivo }: FormularioGastoProps) {
  const [state, formAction, isPending] = useActionState<FormState | null, FormData>(
    registrarGasto,
    null
  );

  const [tipoRendicion, setTipoRendicion] = useState<'anticipo' | 'reembolso'>(() => {
    return fondoActivo ? 'anticipo' : 'reembolso';
  });

  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (fondoActivo) {
      setTipoRendicion('anticipo');
    } else {
      setTipoRendicion('reembolso');
    }
  }, [fondoActivo]);

  // Manejo de foto con optimización automática
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      try {
        const optimized = await compressImage(file);
        setSelectedFile(optimized);
        const url = URL.createObjectURL(optimized);
        setPreview(url);
      } catch (err) {
        console.error('Error al optimizar imagen:', err);
        setSelectedFile(file);
        setPreview(URL.createObjectURL(file));
      } finally {
        setIsCompressing(false);
      }
    } else {
      setSelectedFile(null);
      setPreview(null);
    }
  };

  // Limpiar formulario y preview tras guardado exitoso
  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setPreview(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [state?.success]);

  const handleSubmit = (formData: FormData) => {
    formData.set('tipo_rendicion', tipoRendicion);
    if (tipoRendicion === 'anticipo' && fondoActivo) {
      formData.set('fondo_id', fondoActivo.id);
    } else {
      formData.delete('fondo_id');
    }
    if (selectedFile) {
      formData.set('foto', selectedFile, selectedFile.name);
    }
    formAction(formData);
  };

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

      <form ref={formRef} action={handleSubmit} className="space-y-4">
        {/* Selector de Modalidad: Descontar de Fondo vs Gasto Propio */}
        <div className="space-y-1.5 pb-2 border-b border-slate-100">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Modalidad de Rendición *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!fondoActivo}
              onClick={() => setTipoRendicion('anticipo')}
              className={`p-3 rounded-xl border text-left transition-all ${
                tipoRendicion === 'anticipo' && fondoActivo
                  ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20'
                  : !fondoActivo
                  ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 block">
                  Descontar de Fondo Asignado
                </span>
                {tipoRendicion === 'anticipo' && fondoActivo && (
                  <span className="h-2 w-2 rounded-full bg-sky-600"></span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {fondoActivo
                  ? `${fondoActivo.motivo} (Disp: $${new Intl.NumberFormat('es-CL').format(fondoActivo.saldo_restante)})`
                  : 'Sin fondo activo asignado'}
              </p>
            </button>

            <button
              type="button"
              onClick={() => setTipoRendicion('reembolso')}
              className={`p-3 rounded-xl border text-left transition-all ${
                tipoRendicion === 'reembolso'
                  ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20'
                  : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 block">
                  Gasto Propio (Reembolso)
                </span>
                {tipoRendicion === 'reembolso' && (
                  <span className="h-2 w-2 rounded-full bg-amber-600"></span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Dinero pagado de tu bolsillo para devolución de la empresa.
              </p>
            </button>
          </div>
        </div>

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
            disabled={isCompressing}
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 border-dashed border-sky-400 bg-sky-50/60 hover:bg-sky-100/70 active:bg-sky-100 text-sky-800 font-bold text-sm transition-colors disabled:opacity-50"
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
            {isCompressing
              ? 'Optimizando imagen...'
              : preview
              ? 'Cambiar Foto de Boleta'
              : 'Tomar Foto con Cámara / Subir Boleta'}
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
          disabled={isPending || isCompressing}
          className="w-full mt-2 flex justify-center items-center py-4 px-4 rounded-xl text-base font-black text-white bg-sky-600 hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 transition-colors shadow-md"
        >
          {isPending ? 'Guardando comprobante...' : 'Enviar Rendición'}
        </button>
      </form>
    </div>
  );
}
