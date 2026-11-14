'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function login(prevState: { error?: string } | null, formData: FormData) {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = (formData.get('password') as string)?.trim();

  if (!email || !password) {
    return { error: 'Por favor ingresa tu correo y contraseña.' };
  }

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    console.error('Error de autenticación:', authError);
    return { 
      error: authError?.message === 'Invalid login credentials'
        ? 'Credenciales inválidas. Verifica tu correo y contraseña.'
        : authError?.message || 'Error al iniciar sesión. Intenta nuevamente.'
    };
  }

  // Obtener rol del perfil
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', authData.user.id)
    .single();

  const role = profile?.rol || 'empleado';

  redirect(role === 'admin' ? '/admin' : '/rendiciones');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
