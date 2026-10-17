import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * /admin ve /api/admin için: Supabase oturum çerezlerini yeniler ve oturum
 * yoksa girişe yönlendirir. Bu yalnızca ilk savunma hattıdır — asıl yetki
 * kontrolü her sayfa, server action, API rotası ve veritabanı fonksiyonunda
 * ayrıca yapılır.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");
  const isLogin = pathname === "/admin/login";

  if (!url || !key) {
    if (isLogin) return NextResponse.next();
    return isApi
      ? NextResponse.json({ error: "Sunucu yapılandırması eksik." }, { status: 503 })
      : NextResponse.redirect(new URL("/admin/login", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  response.headers.set("Cache-Control", "private, no-store");

  if (!signedIn && !isLogin) {
    if (isApi) return NextResponse.json({ error: "Oturum açmalısın." }, { status: 401 });
    const login = new URL("/admin/login", request.url);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
