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
    const tipoRendicion = ((formData.get('tipo_rendicion') as string)?.trim() || 'reembolso') as 'anticipo' | 'reembolso';
    const fondoId = (formData.get('fondo_id') as string)?.trim() || null;

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

    let estadoGasto: 'aplicado_a_fondo' | 'por_pagar' = 'por_pagar';
    let finalFondoId: string | null = null;

    if (tipoRendicion === 'anticipo') {
      if (!fondoId) {
        return { error: 'Debes seleccionar el fondo asignado del cual descontar este gasto.' };
      }
      const { data: fondoCheck } = await supabase
        .from('fondos_asignados')
        .select('id, monto_asignado, monto_devuelto, estado')
        .eq('id', fondoId)
        .eq('user_id', user.id)
        .single();

      if (!fondoCheck || fondoCheck.estado === 'cerrado') {
        return { error: 'El fondo asignado seleccionado ya no está activo.' };
      }

      // Validar saldo restante en servidor
      const { data: gastosFondo } = await supabase
        .from('gastos')
        .select('monto')
        .eq('fondo_id', fondoId)
        .eq('tipo_rendicion', 'anticipo');

      const totalRendido = (gastosFondo || []).reduce((sum, g) => sum + g.monto, 0);
      const saldoRestante = fondoCheck.monto_asignado - totalRendido - (fondoCheck.monto_devuelto || 0);

      if (monto > saldoRestante) {
        const saldoFmt = new Intl.NumberFormat('es-CL').format(Math.max(0, saldoRestante));
        return {
          error: `No hay fondos suficientes en tu viático actual (Saldo disponible: $${saldoFmt}). Tienes dos opciones: ajusta el monto al saldo restante, o selecciona la categoría 'Gasto Propio (Solicitar Reembolso)' para este gasto.`,
        };
      }

      estadoGasto = 'aplicado_a_fondo';
      finalFondoId = fondoId;
    } else {
      estadoGasto = 'por_pagar';
      finalFondoId = null;
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
      tipo_rendicion: tipoRendicion,
      fondo_id: finalFondoId,
      estado: estadoGasto,
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
    const rawTipo = formData.get('tipo_rendicion') as string | null;
    const updateData: Record<string, unknown> = {
      categoria,
      numero_comprobante: numeroComprobante,
      monto,
      foto_url: filePath,
    };

    if (rawTipo === 'anticipo' || rawTipo === 'reembolso') {
      updateData.tipo_rendicion = rawTipo;
      if (rawTipo === 'anticipo') {
        const fId = (formData.get('fondo_id') as string)?.trim() || gastoActual.fondo_id;
        updateData.fondo_id = fId;
        if (gastoActual.estado !== 'cerrado') {
          updateData.estado = 'aplicado_a_fondo';
        }

        if (fId) {
          const { data: fCheck } = await supabase
            .from('fondos_asignados')
            .select('id, monto_asignado, monto_devuelto, estado')
            .eq('id', fId)
            .single();

          if (fCheck) {
            const { data: otrosGastos } = await supabase
              .from('gastos')
              .select('monto')
              .eq('fondo_id', fId)
              .eq('tipo_rendicion', 'anticipo')
              .neq('id', gastoId);

            const totalOtros = (otrosGastos || []).reduce((sum, g) => sum + g.monto, 0);
            const saldoDisp = fCheck.monto_asignado - totalOtros - (fCheck.monto_devuelto || 0);

            if (monto > saldoDisp) {
              const saldoFmt = new Intl.NumberFormat('es-CL').format(Math.max(0, saldoDisp));
              return {
                error: `No hay fondos suficientes en el viático actual (Saldo disponible: $${saldoFmt}). Ajusta el monto o cámbialo a Reembolso.`,
              };
            }
          }
        }
      } else {
        updateData.fondo_id = null;
        if (gastoActual.estado !== 'cerrado') {
          updateData.estado = 'por_pagar';
        }
      }
    }

    const { error: updateError } = await supabase
      .from('gastos')
      .update(updateData)
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

export async function devolverSobrante(
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

    const fondoId = (formData.get('fondoId') as string)?.trim();
    const montoDevueltoRaw = formData.get('montoDevuelto') as string;
    const foto = formData.get('foto') as File | null;

    if (!fondoId) {
      return { error: 'Identificador de fondo no válido.' };
    }

    const montoDevuelto = parseInt(montoDevueltoRaw, 10);
    if (isNaN(montoDevuelto) || montoDevuelto < 0) {
      return { error: 'El monto devuelto debe ser un número igual o mayor a 0.' };
    }

    // 1. Obtener fondo activo del usuario
    const { data: fondo, error: fetchError } = await supabase
      .from('fondos_asignados')
      .select('*')
      .eq('id', fondoId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !fondo) {
      return { error: 'El fondo no existe o no te pertenece.' };
    }

    if (fondo.estado === 'cerrado') {
      return { error: 'Este fondo ya fue cerrado previamente.' };
    }

    // 2. Si devolvió dinero (> 0), subir comprobante de transferencia bancaria
    let filePath: string | null = null;
    if (montoDevuelto > 0) {
      if (!foto || foto.size === 0) {
        return { error: 'Debes adjuntar el comprobante o captura de la transferencia de devolución a la empresa.' };
      }

      const timestamp = Date.now();
      filePath = `${user.id}/devolucion_${fondoId}_${timestamp}.jpg`;

      const arrayBuffer = await foto.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from('comprobantes')
        .upload(filePath, fileBuffer, {
          contentType: foto.type || 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error al subir comprobante de devolución:', uploadError);
        return { error: `Error al subir comprobante: ${uploadError.message}` };
      }
    }

    // 3. Cerrar fondo en la base de datos
    const { error: updateError } = await supabase
      .from('fondos_asignados')
      .update({
        estado: 'cerrado',
        monto_devuelto: montoDevuelto,
        comprobante_devolucion_url: filePath,
      })
      .eq('id', fondoId)
      .eq('user_id', user.id);

    if (updateError) {
      if (filePath) {
        await supabase.storage.from('comprobantes').remove([filePath]);
      }
      return { error: `Error al cerrar el fondo: ${updateError.message}` };
    }

    // 4. Actualizar todas las boletas vinculadas a este fondo a estado 'cerrado'
    await supabase
      .from('gastos')
      .update({ estado: 'cerrado' })
      .eq('fondo_id', fondoId)
      .eq('user_id', user.id);

    revalidatePath('/rendiciones');
    revalidatePath('/admin');
    return {
      success: true,
      message: 'Fondo devuelto y conciliado exitosamente. La cuenta ha sido cerrada.',
    };
  } catch (err: any) {
    console.error('Error inesperado en devolverSobrante:', err);
    return { error: `Error del servidor: ${err.message || 'Error desconocido'}` };
  }
}

export async function cambiarPasswordEmpleado(
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

    const password = (formData.get('password') as string)?.trim();
    const confirmPassword = (formData.get('confirm_password') as string)?.trim();

    if (!password || password.length < 6) {
      return { error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }

    if (password !== confirmPassword) {
      return { error: 'Las contraseñas no coinciden. Verifícalas e inténtalo de nuevo.' };
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error('Error al actualizar contraseña:', error);
      return { error: `Error al actualizar contraseña: ${error.message}` };
    }

    return {
      success: true,
      message: 'Contraseña actualizada correctamente.',
    };
  } catch (err: any) {
    console.error('Error inesperado al cambiar contraseña:', err);
    return { error: `Error del servidor: ${err.message || 'Error desconocido'}` };
  }
}
