import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as any)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid using getSession() which is not secure for server environments
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname === '/login';
  const isAuthCallback = pathname.startsWith('/auth');
  const isRootPage = pathname === '/';
  const isAdminRoute = pathname.startsWith('/admin');
  const isRendicionesRoute = pathname.startsWith('/rendiciones');

  // Ignorar rutas públicas o de autenticación interna
  if (isAuthCallback) {
    return supabaseResponse;
  }

  // 1. Si no hay usuario y trata de ingresar a rutas protegidas
  if (!user && (isAdminRoute || isRendicionesRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 2. Si hay usuario autenticado
  if (user) {
    // Consultar el rol del usuario en la tabla profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .single();

    const role = profile?.rol || 'empleado';

    // Si está en /login o en la raíz (/), redirigir a su panel correspondiente
    if (isLoginPage || isRootPage) {
      const url = request.nextUrl.clone();
      url.pathname = role === 'admin' ? '/admin' : '/rendiciones';
      return NextResponse.redirect(url);
    }

    // Si un empleado intenta acceder al panel de admin
    if (isAdminRoute && role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/rendiciones';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
