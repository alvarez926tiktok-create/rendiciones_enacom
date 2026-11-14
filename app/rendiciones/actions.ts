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
  try {
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

    // 2. Asegurar que el perfil exista en public.profiles (previene error de Foreign Key)
    const { data: profileCheck } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profileCheck) {
      await supabase.from('profiles').insert({
        id: user.id,
        nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || 'Colaborador',
        email: user.email || '',
        rol: (user.user_metadata?.rol as any) || 'empleado',
        area: (user.user_metadata?.area as any) || 'Administrativo',
      });
    }

    // 3. Subida a Supabase Storage (Bucket 'comprobantes')
    const timestamp = Date.now();
    const sanitizedNumero = numeroComprobante.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = `${user.id}/${timestamp}_${sanitizedNumero}.jpg`;

    // Convertir File a Buffer para evitar errores de streaming en Node.js serverless
    const arrayBuffer = await foto.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('comprobantes')
      .upload(filePath, fileBuffer, {
        contentType: foto.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error al subir comprobante a storage:', uploadError);
      return { error: `Error al subir la fotografía: ${uploadError.message}` };
    }

    // 4. Registro en tabla 'gastos'
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
        await supabase.storage.from('comprobantes').remove([filePath]);
        return {
          error: `Ya registraste un comprobante con el número "${numeroComprobante}". No se permiten rendiciones duplicadas.`,
        };
      }

      console.error('Error al insertar gasto:', insertError);
      await supabase.storage.from('comprobantes').remove([filePath]);
      return { error: `Error al guardar la rendición: ${insertError.message}` };
    }

    revalidatePath('/rendiciones');
    revalidatePath('/admin');
    return {
      success: true,
      message: `Rendición #${numeroComprobante} guardada exitosamente.`,
    };
  } catch (err: any) {
    console.error('Error inesperado en registrarGasto:', err);
    return {
      error: `Error al procesar la rendición: ${err.message || 'Error desconocido del servidor.'}`,
    };
  }
}

export async function modificarGasto(
  prevState: FormState | null,
  formData: FormData
): Promise<FormState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'No tienes una sesión activa. Inicia sesión nuevamente.' };
    }

    const gastoId = (formData.get('gastoId') as string)?.trim();
    const categoria = (formData.get('categoria') as string)?.trim();
    const numeroComprobante = (formData.get('numero_comprobante') as string)?.trim();
    const montoRaw = formData.get('monto') as string;
    const foto = formData.get('foto') as File | null;

    if (!gastoId) {
      return { error: 'Identificador de rendición no válido.' };
    }
    if (!categoria || !CATEGORIAS_VALIDAS.includes(categoria as any)) {
      return { error: 'Debes seleccionar una categoría válida.' };
    }
    if (!numeroComprobante) {
      return { error: 'Debes ingresar el número de comprobante.' };
    }

    const monto = parseInt(montoRaw, 10);
    if (isNaN(monto) || monto <= 0) {
      return { error: 'El monto debe ser un número entero positivo.' };
    }

    // 1. Obtener gasto existente para verificar propiedad
    const { data: gastoActual, error: fetchError } = await supabase
      .from('gastos')
      .select('*')
      .eq('id', gastoId)
      .single();

    if (fetchError || !gastoActual) {
      return { error: 'La rendición no existe o ya fue eliminada.' };
    }

    // 2. Verificar permisos (dueño o admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (gastoActual.user_id !== user.id && profile?.rol !== 'admin') {
      return { error: 'No tienes permisos para modificar esta rendición.' };
    }

    let filePath = gastoActual.foto_url;

    // 3. Si el usuario subió una nueva foto de reemplazo
    if (foto && foto.size > 0) {
      const timestamp = Date.now();
      const sanitizedNumero = numeroComprobante.replace(/[^a-zA-Z0-9_-]/g, '_');
      const newFilePath = `${gastoActual.user_id}/${timestamp}_${sanitizedNumero}.jpg`;

      const arrayBuffer = await foto.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(newFilePath, fileBuffer, {
          contentType: foto.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        return { error: `Error al subir la nueva foto: ${uploadError.message}` };
      }

      // Eliminar foto antigua de storage
      if (gastoActual.foto_url && gastoActual.foto_url !== newFilePath) {
        await supabase.storage.from('comprobantes').remove([gastoActual.foto_url]);
      }
      filePath = newFilePath;
    }

    // 4. Actualizar registro en tabla 'gastos'
    const { error: updateError } = await supabase
      .from('gastos')
      .update({
        categoria,
        numero_comprobante: numeroComprobante,
        monto,
        foto_url: filePath,
      })
      .eq('id', gastoId);

    if (updateError) {
      if (updateError.code === '23505') {
        return {
          error: `Ya existe otra rendición registrada con el número "${numeroComprobante}".`,
        };
      }
      return { error: `Error al actualizar rendición: ${updateError.message}` };
    }

    revalidatePath('/rendiciones');
    revalidatePath('/admin');
    return {
      success: true,
      message: `Rendición #${numeroComprobante} modificada exitosamente.`,
    };
  } catch (err: any) {
    console.error('Error inesperado en modificarGasto:', err);
    return { error: `Error del servidor al modificar: ${err.message || 'Error desconocido'}` };
  }
}

export async function eliminarGasto(gastoId: string): Promise<FormState> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'No tienes una sesión activa. Inicia sesión nuevamente.' };
    }

    // 1. Obtener la rendición para conocer su foto_url y verificar pertenencia
    const { data: gasto, error: fetchError } = await supabase
      .from('gastos')
      .select('id, user_id, foto_url')
      .eq('id', gastoId)
      .single();

    if (fetchError || !gasto) {
      return { error: 'La rendición no existe o ya fue eliminada.' };
    }

    // 2. Verificar permisos
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    if (gasto.user_id !== user.id && profile?.rol !== 'admin') {
      return { error: 'No tienes permisos para eliminar esta rendición.' };
    }

    // 3. Eliminar archivo de storage si existe
    if (gasto.foto_url) {
      await supabase.storage.from('comprobantes').remove([gasto.foto_url]);
    }

    // 4. Eliminar registro de tabla gastos
    const { error: deleteError } = await supabase
      .from('gastos')
      .delete()
      .eq('id', gastoId);

    if (deleteError) {
      return { error: `Error al eliminar de la base de datos: ${deleteError.message}` };
    }

    revalidatePath('/rendiciones');
    revalidatePath('/admin');
    return {
      success: true,
      message: 'Rendición eliminada exitosamente.',
    };
  } catch (err: any) {
    console.error('Error al eliminar gasto:', err);
    return { error: `Error del servidor al eliminar: ${err.message || 'Error desconocido'}` };
  }
}
