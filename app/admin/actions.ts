'use server';

import { createClient } from '@/lib/supabase/server';

export async function obtenerUrlComprobante(fotoUrl: string): Promise<{ signedUrl?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'No autenticado.' };
  }

  // Verificar que sea admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (profile?.rol !== 'admin') {
    return { error: 'Acceso no autorizado.' };
  }

  const { data, error } = await supabase.storage
    .from('comprobantes')
    .createSignedUrl(fotoUrl, 3600);

  if (error || !data?.signedUrl) {
    console.error('Error al generar signed URL de comprobante:', error);
    return { error: 'No se pudo cargar la imagen del comprobante.' };
  }

  return { signedUrl: data.signedUrl };
}
