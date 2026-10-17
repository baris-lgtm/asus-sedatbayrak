import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireEnv, supabaseUrl } from "@/lib/env";

/**
 * service_role istemcisi — RLS'i ATLAR. Yalnızca sunucuda, yalnızca dar
 * kapsamlı işler için kullanılır: başvuru kaydı (doğrulama + rate limit
 * sonrası), e-posta logları, rate limit, davetiye sayfası doğrulaması.
 * "server-only" importu bu modülün istemci paketine girmesini engeller.
 */
export function createAdminClient() {
  return createClient(supabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
