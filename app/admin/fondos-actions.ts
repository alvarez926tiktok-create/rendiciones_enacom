'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type FondoActionState = {
  success?: boolean;
  error?: string;
  message?: string;
};

// Verificar si el usuario actual es admin
async function verificarAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  return profile?.rol === 'admin' ? user : null;
}

// 1. Asignar fondo / viático a un empleado
export async function asignarFondo(
  prevState: FondoActionState | null,
  formData: FormData
): Promise<FondoActionState> {
  const adminUser = await verificarAdmin();
  if (!adminUser) {
    return { error: 'Acceso no autorizado. Se requieren permisos de administrador.' };
  }

  const userId = formData.get('userId') as string;
  const motivo = (formData.get('motivo') as string)?.trim();
  const montoRaw = formData.get('monto') as string;

  if (!userId) {
    return { error: 'Debes seleccionar un colaborador.' };
  }
  if (!motivo) {
    return { error: 'Debes ingresar el motivo de la asignación de fondo (ej. Viático Terreno Sur).' };
  }

  const montoAsignado = parseInt(montoRaw, 10);
  if (isNaN(montoAsignado) || montoAsignado <= 0) {
    return { error: 'El monto asignado debe ser un número entero positivo (sin decimales).' };
  }

  try {
    const supabase = await createClient();

    const { error: insertError } = await supabase.from('fondos_asignados').insert({
      user_id: userId,
      admin_id: adminUser.id,
      motivo,
      monto_asignado: montoAsignado,
      estado: 'activo',
      monto_devuelto: 0,
    });

    if (insertError) {
      console.error('Error al asignar fondo:', insertError);
      return { error: `Error al registrar fondo: ${insertError.message}` };
    }

    revalidatePath('/admin');
    revalidatePath('/rendiciones');
    return {
      success: true,
      message: `Fondo de $${new Intl.NumberFormat('es-CL').format(montoAsignado)} asignado exitosamente.`,
    };
  } catch (err: any) {
    console.error('Error inesperado en asignarFondo:', err);
    return { error: `Error del servidor: ${err.message || 'Error desconocido'}` };
  }
}

// 2. Pagar / Reembolsar un gasto propio de empleado
export async function reembolsarGasto(
  prevState: FondoActionState | null,
  formData: FormData
): Promise<FondoActionState> {
  const adminUser = await verificarAdmin();
  if (!adminUser) {
    return { error: 'Acceso no autorizado. Se requieren permisos de administrador.' };
  }

  const gastoId = formData.get('gastoId') as string;
  const comprobantePago = formData.get('comprobantePago') as File | null;

  if (!gastoId) {
    return { error: 'Identificador de gasto no válido.' };
  }
  if (!comprobantePago || comprobantePago.size === 0) {
    return { error: 'Debes adjuntar el comprobante o captura de la transferencia bancaria.' };
  }

  try {
    const supabase = await createClient();

    // 1. Obtener datos del gasto
    const { data: gasto, error: fetchError } = await supabase
      .from('gastos')
      .select('id, user_id, monto, numero_comprobante')
      .eq('id', gastoId)
      .single();

    if (fetchError || !gasto) {
      return { error: 'El gasto no fue encontrado.' };
    }

    // 2. Subir comprobante bancario a storage
    const timestamp = Date.now();
    const filePath = `reembolsos/${gasto.user_id}_${timestamp}.jpg`;

    const arrayBuffer = await comprobantePago.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('comprobantes')
      .upload(filePath, fileBuffer, {
        contentType: comprobantePago.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error al subir comprobante de reembolso:', uploadError);
      return { error: `Error al subir comprobante: ${uploadError.message}` };
    }

    // 3. Actualizar gasto a estado 'cerrado' y guardar comprobante_pago_url
    const { error: updateError } = await supabase
      .from('gastos')
      .update({
        estado: 'cerrado',
        comprobante_pago_url: filePath,
      })
      .eq('id', gastoId);

    if (updateError) {
      await supabase.storage.from('comprobantes').remove([filePath]);
      return { error: `Error al cerrar gasto: ${updateError.message}` };
    }

    revalidatePath('/admin');
    revalidatePath('/rendiciones');
    return {
      success: true,
      message: `Reembolso del comprobante #${gasto.numero_comprobante} registrado y cerrado exitosamente.`,
    };
  } catch (err: any) {
    console.error('Error inesperado en reembolsarGasto:', err);
    return { error: `Error del servidor: ${err.message || 'Error desconocido'}` };
  }
}
