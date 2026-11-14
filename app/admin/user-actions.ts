'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const AREAS_VALIDAS = [
  'Ingeniería Eléctrica',
  'Informática',
  'Administrativo',
  'Contabilidad',
  'Ventas',
  'Logística',
  'Gerencia',
] as const;

export type UserActionState = {
  success?: boolean;
  error?: string;
  message?: string;
};

// Función auxiliar para verificar si el usuario es administrador
async function verificarAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  return profile?.rol === 'admin';
}

export async function crearUsuario(
  prevState: UserActionState | null,
  formData: FormData
): Promise<UserActionState> {
  const isAdmin = await verificarAdmin();
  if (!isAdmin) {
    return { error: 'Acceso no autorizado. Se requieren permisos de administrador.' };
  }

  const nombre = (formData.get('nombre') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = (formData.get('password') as string)?.trim();
  const rol = (formData.get('rol') as string)?.trim();
  const area = (formData.get('area') as string)?.trim();

  // Validaciones
  if (!nombre) {
    return { error: 'El nombre completo es obligatorio.' };
  }
  if (!email || !email.includes('@')) {
    return { error: 'El correo electrónico no es válido.' };
  }
  if (!password || password.length < 6) {
    return { error: 'La contraseña temporal debe tener al menos 6 caracteres.' };
  }
  if (rol !== 'admin' && rol !== 'empleado') {
    return { error: 'El rol debe ser "admin" o "empleado".' };
  }
  if (!AREAS_VALIDAS.includes(area as any)) {
    return { error: 'El área seleccionada no es válida.' };
  }

  try {
    const supabaseAdmin = createAdminClient();

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre,
        rol,
        area,
      },
    });

    if (authError || !authData.user) {
      if (authError?.message?.includes('already registered')) {
        return { error: `El correo "${email}" ya se encuentra registrado en el sistema.` };
      }
      return { error: `Error al crear usuario en Auth: ${authError?.message || 'Error desconocido'}` };
    }

    // 2. Asegurar fila en public.profiles
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: authData.user.id,
      nombre,
      email,
      rol,
      area,
    });

    if (profileError) {
      console.error('Error al sincronizar perfil:', profileError);
      return { error: 'El usuario se creó en Auth pero ocurrió un error al guardar su perfil.' };
    }

    revalidatePath('/admin');
    return {
      success: true,
      message: `Usuario ${nombre} (${email}) creado exitosamente como ${rol}.`,
    };
  } catch (err: any) {
    console.error('Error en crearUsuario:', err);
    return {
      error:
        err.message ||
        'Error de configuración del servidor. Verifica que SUPABASE_SERVICE_ROLE_KEY esté configurada.',
    };
  }
}

export async function actualizarPassword(
  prevState: UserActionState | null,
  formData: FormData
): Promise<UserActionState> {
  const isAdmin = await verificarAdmin();
  if (!isAdmin) {
    return { error: 'Acceso no autorizado. Se requieren permisos de administrador.' };
  }

  const userId = formData.get('userId') as string;
  const newPassword = (formData.get('newPassword') as string)?.trim();

  if (!userId) {
    return { error: 'Identificador de usuario no válido.' };
  }
  if (!newPassword || newPassword.length < 6) {
    return { error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
  }

  try {
    const supabaseAdmin = createAdminClient();

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return { error: `Error al actualizar contraseña: ${error.message}` };
    }

    return {
      success: true,
      message: 'Contraseña actualizada con éxito.',
    };
  } catch (err: any) {
    console.error('Error en actualizarPassword:', err);
    return {
      error:
        err.message ||
        'Error de configuración del servidor. Verifica que SUPABASE_SERVICE_ROLE_KEY esté configurada.',
    };
  }
}
