import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabaseFetch } from "@/lib/supabase/fetch";

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
    // Auth sunucusu yanıt vermezse istek asılı kalmasın (5 sn sonra geçici hata sayılır).
    global: { fetch: supabaseFetch({ timeoutMs: 5000 }) },
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

  // Ağ/Auth sunucusu geçici olarak yanıt vermiyorsa kullanıcıyı girişe ATMA:
  // isteği geçir; sayfa/route kendi yetki kontrolünde "tekrar dene" gösterir.
  let signedIn = false;
  let transient = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
    transient = Boolean(error && (isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500));
  } catch {
    transient = true;
  }
  response.headers.set("Cache-Control", "private, no-store");
  if (transient) return response;

  // Server action (form gönderimi) yanıtı yönlendirme OLAMAZ: tarayıcı beklenmeyen yanıt
  // hatası gösterir. Oturumu düşmüş action isteğini geçirip action'ın kendisinin
  // "oturumun sona ermiş" mesajını döndürmesine izin veriyoruz (requireAdmin yine reddeder).
  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  if (!signedIn && !isLogin && !isServerAction) {
    if (isApi) return NextResponse.json({ error: "Oturumun sona ermiş. Sayfayı yenileyip tekrar giriş yap.", code: "session_expired" }, { status: 401 });
    const login = new URL("/admin/login", request.url);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
