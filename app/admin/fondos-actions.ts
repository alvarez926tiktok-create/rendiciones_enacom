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

// 2. Pagar / Reembolsar un gasto propio de empleado (Total)
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

    // 3. Registrar también en la tabla 'abonos_reembolsos' para trazabilidad
    await supabase.from('abonos_reembolsos').insert({
      gasto_id: gastoId,
      admin_id: adminUser.id,
      monto_abonado: gasto.monto,
      comprobante_pago_url: filePath,
      notas: 'Pago total de reembolso',
    });

    // 4. Actualizar gasto a estado 'cerrado' y guardar comprobante_pago_url
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

// 3. Registrar un Abono Parcial o Pago en un Gasto/Reembolso
export async function registrarAbonoReembolso(
  prevState: FondoActionState | null,
  formData: FormData
): Promise<FondoActionState> {
  const adminUser = await verificarAdmin();
  if (!adminUser) {
    return { error: 'Acceso no autorizado. Se requieren permisos de administrador.' };
  }

  const gastoId = formData.get('gastoId') as string;
  const montoAbonadoRaw = formData.get('montoAbonado') as string;
  const comprobantePago = formData.get('comprobantePago') as File | null;
  const notas = (formData.get('notas') as string)?.trim() || null;

  if (!gastoId) {
    return { error: 'Identificador de gasto no válido.' };
  }

  const montoAbonado = parseInt(montoAbonadoRaw, 10);
  if (isNaN(montoAbonado) || montoAbonado <= 0) {
    return { error: 'El monto abonado debe ser un número entero positivo.' };
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

    // 2. Obtener abonos previos registrados
    const { data: abonosPrevios } = await supabase
      .from('abonos_reembolsos')
      .select('monto_abonado')
      .eq('gasto_id', gastoId);

    const totalAbonadoPrevio = (abonosPrevios || []).reduce((sum, a) => sum + a.monto_abonado, 0);
    const saldoPendiente = gasto.monto - totalAbonadoPrevio;

    if (montoAbonado > saldoPendiente) {
      return {
        error: `El monto abonado ($${new Intl.NumberFormat('es-CL').format(montoAbonado)}) no puede superar el saldo pendiente ($${new Intl.NumberFormat('es-CL').format(saldoPendiente)}).`,
      };
    }

    // 3. Subir comprobante bancario a storage
    const timestamp = Date.now();
    const filePath = `reembolsos/${gasto.user_id}_abono_${timestamp}.jpg`;

    const arrayBuffer = await comprobantePago.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('comprobantes')
      .upload(filePath, fileBuffer, {
        contentType: comprobantePago.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      return { error: `Error al subir comprobante de abono: ${uploadError.message}` };
    }

    // 4. Insertar abono en la tabla 'abonos_reembolsos'
    const { error: insertAbonoError } = await supabase.from('abonos_reembolsos').insert({
      gasto_id: gastoId,
      admin_id: adminUser.id,
      monto_abonado: montoAbonado,
      comprobante_pago_url: filePath,
      notas,
    });

    if (insertAbonoError) {
      await supabase.storage.from('comprobantes').remove([filePath]);
      return { error: `Error al registrar abono: ${insertAbonoError.message}` };
    }

    // 5. Verificar si se saldó completamente la deuda
    const nuevoTotalAbonado = totalAbonadoPrevio + montoAbonado;
    const estaCompletado = nuevoTotalAbonado >= gasto.monto;

    await supabase
      .from('gastos')
      .update({
        estado: estaCompletado ? 'cerrado' : 'por_pagar',
        comprobante_pago_url: filePath,
      })
      .eq('id', gastoId);

    revalidatePath('/admin');
    revalidatePath('/rendiciones');

    return {
      success: true,
      message: estaCompletado
        ? `Abono de $${new Intl.NumberFormat('es-CL').format(montoAbonado)} registrado. El gasto ha sido saldado y cerrado completamente.`
        : `Abono de $${new Intl.NumberFormat('es-CL').format(montoAbonado)} registrado con éxito. Saldo restante: $${new Intl.NumberFormat('es-CL').format(gasto.monto - nuevoTotalAbonado)}.`,
    };
  } catch (err: any) {
    console.error('Error inesperado en registrarAbonoReembolso:', err);
    return { error: `Error del servidor: ${err.message || 'Error desconocido'}` };
  }
}

// 4. Cerrar Folio Definitivamente (Gastos)
export async function cerrarFolioDefinitivo(gastoId: string): Promise<FondoActionState> {
  const adminUser = await verificarAdmin();
  if (!adminUser) {
    return { error: 'Acceso no autorizado.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('gastos')
      .update({ estado: 'cerrado' })
      .eq('id', gastoId);

    if (error) {
      return { error: `Error al cerrar folio: ${error.message}` };
    }

    revalidatePath('/admin');
    revalidatePath('/rendiciones');
    return { success: true, message: 'Folio cerrado definitivamente.' };
  } catch (err: any) {
    return { error: err.message || 'Error desconocido' };
  }
}

// 5. Cerrar Fondo Definitivamente
export async function cerrarFondoDefinitivo(fondoId: string): Promise<FondoActionState> {
  const adminUser = await verificarAdmin();
  if (!adminUser) {
    return { error: 'Acceso no autorizado.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('fondos_asignados')
      .update({ estado: 'cerrado' })
      .eq('id', fondoId);

    if (error) {
      return { error: `Error al cerrar fondo: ${error.message}` };
    }

    revalidatePath('/admin');
    revalidatePath('/rendiciones');
    return { success: true, message: 'Fondo cerrado definitivamente.' };
  } catch (err: any) {
    return { error: err.message || 'Error desconocido' };
  }
}
