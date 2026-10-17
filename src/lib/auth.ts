import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/types";

export interface StaffSession {
  userId: string;
  email: string | null;
  role: StaffRole;
  supabase: Awaited<ReturnType<typeof createSessionClient>>;
}

/**
 * Oturumdaki kullanıcıyı DOĞRULANMIŞ JWT (getClaims) ile belirler ve rolünü
 * istemcinin yazamadığı staff_members tablosundan okur. user_metadata'ya
 * güvenilmez. İstek başına bir kez çalışır (React cache).
 */
export const getStaff = cache(async (): Promise<StaffSession | null> => {
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;

  const { data: row } = await supabase
    .from("staff_members")
    .select("role")
    .eq("user_id", sub)
    .maybeSingle<{ role: StaffRole }>();
  if (!row) return null;

  return { userId: sub, email: (data.claims.email as string | undefined) ?? null, role: row.role, supabase };
});

/** Sayfalar için: yetkisizse güvenli yönlendirme. */
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
    super(status === 401 ? "Oturum açmalısın." : "Bu işlem için yetkin yok.");
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
