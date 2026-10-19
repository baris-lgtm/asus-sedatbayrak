import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createSessionClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/types";

export interface StaffSession {
  userId: string;
  email: string | null;
  role: StaffRole;
  supabase: Awaited<ReturnType<typeof createSessionClient>>;
}

/**
 * Oturum/rol bilgisi geçici bir bağlantı sorunu yüzünden okunamadı.
 * "Oturum yok" ile karıştırılmamalı: kullanıcıyı girişe atmak yerine
 * "tekrar dene" gösterilir (etkinlik günü Wi-Fi kesintisinde önemli).
 */
export class TransientAuthError extends Error {
  constructor() {
    super("Geçici bağlantı sorunu. Birkaç saniye sonra tekrar dene.");
    this.name = "TransientAuthError";
  }
}

/**
 * Oturumdaki kullanıcıyı DOĞRULANMIŞ JWT (getClaims) ile belirler ve rolünü
 * istemcinin yazamadığı staff_members tablosundan okur. user_metadata'ya
 * güvenilmez. İstek başına bir kez çalışır (React cache).
 *  - Oturum yok / geçersiz → null
 *  - Ağ veya veritabanı hatası → TransientAuthError
 */
export const getStaff = cache(async (): Promise<StaffSession | null> => {
  const supabase = await createSessionClient();
  let claims;
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error) {
      if (isAuthRetryableFetchError(error) || (error.status ?? 0) >= 500) throw new TransientAuthError();
      return null;
    }
    claims = data?.claims;
  } catch (e) {
    if (e instanceof TransientAuthError) throw e;
    // fetch hatası (ağ yok, DNS) → geçici
    throw new TransientAuthError();
  }
  const sub = claims?.sub;
  if (!sub) return null;

  const { data: row, error: roleError } = await supabase
    .from("staff_members")
    .select("role")
    .eq("user_id", sub)
    .maybeSingle<{ role: StaffRole }>();
  if (roleError) {
    // JWT süresi dolmuş/geçersiz → oturum yok; diğer her şey geçici
    if (roleError.code === "PGRST301" || roleError.code === "PGRST303") return null;
    throw new TransientAuthError();
  }
  if (!row) return null;

  return { userId: sub, email: (claims?.email as string | undefined) ?? null, role: row.role, supabase };
});

/** Sayfalar için: yetkisizse güvenli yönlendirme; geçici hata error.tsx'e düşer. */
export async function requireStaffPage(): Promise<StaffSession> {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  return staff;
}

export async function requireAdminPage(): Promise<StaffSession> {
  const staff = await requireStaffPage();
  if (staff.role !== "admin") redirect("/admin/check-in");
  return staff;
}

export class AuthorizationError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "Oturumun sona ermiş. Sayfayı yenileyip tekrar giriş yap." : "Bu işlem için yetkin yok.");
    this.name = "AuthorizationError";
  }
}

/** Server action ve API rotaları için: yetkisizse hata fırlatır. */
export async function requireStaff(): Promise<StaffSession> {
  const staff = await getStaff();
  if (!staff) throw new AuthorizationError(401);
  return staff;
}

export async function requireAdmin(): Promise<StaffSession> {
  const staff = await requireStaff();
  if (staff.role !== "admin") throw new AuthorizationError(403);
  return staff;
}

/** API rotaları için ortak hata yanıtı. */
export function authErrorResponse(e: unknown): { status: number; body: { error: string; code: string } } {
  if (e instanceof AuthorizationError) {
    return { status: e.status, body: { error: e.message, code: e.status === 401 ? "session_expired" : "forbidden" } };
  }
  if (e instanceof TransientAuthError) {
    return { status: 503, body: { error: e.message, code: "transient" } };
  }
  return { status: 500, body: { error: "Beklenmeyen bir hata oluştu. Tekrar dene.", code: "server" } };
}
