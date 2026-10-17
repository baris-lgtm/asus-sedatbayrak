import "server-only";
import { APPLICATION_STATUSES, type Application, type ApplicationStatus, type EmailLog } from "@/lib/types";
import type { StaffSession } from "@/lib/auth";

export const PAGE_SIZE = 25;

export interface ListParams {
  q: string;
  status: ApplicationStatus | "all";
  sort: "newest" | "oldest";
  page: number;
}

export function parseListParams(sp: Record<string, string | string[] | undefined>): ListParams {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const status = one("status");
  const page = Number.parseInt(one("page"), 10);
  return {
    q: one("q").slice(0, 80),
    status: (APPLICATION_STATUSES as readonly string[]).includes(status) ? (status as ApplicationStatus) : "all",
    sort: one("sort") === "oldest" ? "oldest" : "newest",
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 1000) : 1,
  };
}

/** PostgREST filtre sözdizimini bozabilecek karakterleri temizler. */
export function searchTerms(q: string): string[] {
  return q
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}@._+\- ]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
}

export const LIST_COLUMNS =
  "id, first_name, last_name, email, phone, participant_type, institution, department, status, created_at, reviewed_at, marketing_consent, kvkk_notice_version, additional_answers";

export type ListedApplication = Pick<
  Application,
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "participant_type"
  | "institution"
  | "department"
  | "status"
  | "created_at"
  | "reviewed_at"
  | "marketing_consent"
  | "kvkk_notice_version"
  | "additional_answers"
>;

/**
 * Oturumlu istemciyle sorgular → RLS yalnızca adminin okumasına izin verir.
 * range verilmezse tümü (CSV için, en fazla 10.000).
 */
export function applicationsQuery(supabase: StaffSession["supabase"], p: Omit<ListParams, "page">) {
  let query = supabase.from("applications").select(LIST_COLUMNS, { count: "exact" });
  if (p.status !== "all") query = query.eq("status", p.status);
  for (const term of searchTerms(p.q)) {
    const t = `*${term}*`;
    query = query.or(`first_name.ilike.${t},last_name.ilike.${t},email.ilike.${t},institution.ilike.${t},phone.ilike.${t}`);
  }
  return query.order("created_at", { ascending: p.sort === "oldest" }).order("id");
}

export async function listApplications(supabase: StaffSession["supabase"], p: ListParams) {
  const from = (p.page - 1) * PAGE_SIZE;
  const { data, count, error } = await applicationsQuery(supabase, p)
    .range(from, from + PAGE_SIZE - 1)
    .returns<ListedApplication[]>();
  if (error) throw new Error(`Başvurular okunamadı (${error.code})`);
  return { rows: data ?? [], total: count ?? 0 };
}

/** Her başvurunun en son e-posta kaydı (tablo sütunu için). */
export async function latestEmailStatus(supabase: StaffSession["supabase"], ids: string[]) {
  const map = new Map<string, Pick<EmailLog, "status" | "email_type" | "created_at">>();
  if (ids.length === 0) return map;
  const { data } = await supabase
    .from("email_logs")
    .select("application_id, status, email_type, created_at")
    .in("application_id", ids)
    .order("created_at", { ascending: false })
    .returns<(Pick<EmailLog, "application_id" | "status" | "email_type" | "created_at">)[]>();
  for (const row of data ?? []) if (!map.has(row.application_id)) map.set(row.application_id, row);
  return map;
}
