import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicKey, supabaseUrl } from "@/lib/env";

/**
 * Oturumlu istemci (kullanıcının çerezleriyle). RLS ve veritabanı
 * fonksiyonlarındaki yetki kontrolleri bu kullanıcıya göre uygulanır.
 * Her istekte yeni oluşturulmalıdır.
 */
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublicKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Component içinden çağrıldığında çerez yazılamaz; oturum yenilemesini proxy yapar.
        }
      },
    },
  });
}

/** Oturumsuz public istemci (yalnızca herkese açık veriler: event_settings). */
export function createPublicClient() {
  return createClient(supabaseUrl(), supabasePublicKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
