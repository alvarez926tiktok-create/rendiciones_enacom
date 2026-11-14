import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabaseAdmin = createAdminClient();

    const targetEmail = 'daniela.ortega@enacom.cl';
    const targetPassword = 'Enacom.2026';

    // 1. Listar usuarios para verificar si ya existe en Supabase Auth
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      return NextResponse.json(
        { ok: false, error: `Error al consultar Auth: ${listError.message}` },
        { status: 500 }
      );
    }

    const existingUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === targetEmail.toLowerCase()
    );

    let userId = existingUser?.id;

    if (existingUser) {
      // Si ya existe: actualizar la contraseña mediante la API oficial de Supabase
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          password: targetPassword,
          email_confirm: true,
          user_metadata: {
            nombre: 'Daniela Ortega',
            rol: 'admin',
            area: 'Contabilidad',
          },
        }
      );

      if (updateError) {
        return NextResponse.json(
          { ok: false, error: `Error al actualizar contraseña: ${updateError.message}` },
          { status: 500 }
        );
      }
    } else {
      // Si no existe: crearlo con la API oficial de Supabase Auth
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: targetEmail,
        password: targetPassword,
        email_confirm: true,
        user_metadata: {
          nombre: 'Daniela Ortega',
          rol: 'admin',
          area: 'Contabilidad',
        },
      });

      if (createError || !createData.user) {
        return NextResponse.json(
          { ok: false, error: `Error al crear usuario: ${createError?.message}` },
          { status: 500 }
        );
      }
      userId = createData.user.id;
    }

    // 2. Asegurar que el perfil exista en public.profiles con rol admin y área Contabilidad
    if (userId) {
      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        id: userId,
        nombre: 'Daniela Ortega',
        email: targetEmail,
        rol: 'admin',
        area: 'Contabilidad',
      });

      if (profileError) {
        return NextResponse.json(
          { ok: false, error: `Error al actualizar perfil: ${profileError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Usuario administrador Daniela Ortega sincronizado y validado con éxito mediante la API oficial de Supabase.',
      email: targetEmail,
      clave: targetPassword,
      rol: 'admin',
      area: 'Contabilidad',
      instruccion: 'Ya puedes ir a /login e iniciar sesión.',
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message || 'Error inesperado al inicializar usuario.',
        ayuda: 'Verifica que la variable SUPABASE_SERVICE_ROLE_KEY esté configurada en Vercel.',
      },
      { status: 500 }
    );
  }
}
