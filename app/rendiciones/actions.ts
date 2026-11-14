'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const CATEGORIAS_VALIDAS = [
  'Bencina',
  'Transporte',
  'Comida',
  'Materiales',
  'Viáticos',
  'Otro',
] as const;

export type FormState = {
  success?: boolean;
  error?: string;
  message?: string;
};

export async function registrarGasto(prevState: FormState | null, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No tienes una sesión activa. Inicia sesión nuevamente.' };
  }

  const categoria = (formData.get('categoria') as string)?.trim();
  const numeroComprobante = (formData.get('numero_comprobante') as string)?.trim();
  const montoRaw = formData.get('monto') as string;
  const foto = formData.get('foto') as File | null;

  // 1. Validaciones
  if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria as any)) {
    return { error: 'Debes seleccionar una categoría válida.' };
  }

  if (!numeroComprobante) {
    return { error: 'Debes ingresar el número de comprobante o boleta.' };
  }

  const monto = parseInt(montoRaw, 10);
  if (isNaN(monto) || monto <= 0) {
    return { error: 'El monto debe ser un número entero positivo (sin decimales).' };
  }

  if (!foto || foto.size === 0) {
    return { error: 'Debes adjuntar o tomar una foto del comprobante.' };
  }

  // 2. Subida a Supabase Storage (Bucket 'comprobantes')
  const timestamp = Date.now();
  const sanitizedNumero = numeroComprobante.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = `${user.id}/${timestamp}_${sanitizedNumero}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('comprobantes')
    .upload(filePath, foto, {
      contentType: foto.type || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    console.error('Error al subir comprobante:', uploadError);
    return { error: 'Error al subir la fotografía. Por favor intenta nuevamente.' };
  }

  // 3. Registro en tabla 'gastos'
  const { error: insertError } = await supabase.from('gastos').insert({
    user_id: user.id,
    categoria,
    numero_comprobante: numeroComprobante,
    monto,
    foto_url: filePath,
  });

  if (insertError) {
    // Si falla por restricción de unicidad (duplicado)
    if (insertError.code === '23505') {
      // Limpiar el archivo subido para no dejar huérfanos
      await supabase.storage.from('comprobantes').remove([filePath]);
      return {
        error: `Ya registraste un comprobante con el número "${numeroComprobante}". No se permiten rendiciones duplicadas.`,
      };
    }

    console.error('Error al insertar gasto:', insertError);
    await supabase.storage.from('comprobantes').remove([filePath]);
    return { error: 'Error al guardar la rendición. Intenta nuevamente.' };
  }

  revalidatePath('/rendiciones');
  return {
    success: true,
    message: `Rendición #${numeroComprobante} guardada exitosamente.`,
  };
}
