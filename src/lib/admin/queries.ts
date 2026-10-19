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

const FOLD_FROM = "İIıŞşĞğÜüÖöÇçÂâÎîÛû";
const FOLD_TO = "iiissgguuooccaaiiuu";

/**
 * Türkçe gevşek katlama — veritabanındaki public.tr_fold() ile BİREBİR aynı.
 * "IŞIK", "ışık", "Işık" ve "isik" aynı sonucu verir.
 */
export function trFold(value: string): string {
  let out = "";
  for (const ch of value.normalize("NFC")) {
    const i = FOLD_FROM.indexOf(ch);
    out += i >= 0 ? FOLD_TO[i] : ch;
  }
  return out.toLowerCase();
}

/**
 * Arama terimleri: katlanmış, PostgREST filtre sözdizimini ve LIKE joker
 * karakterlerini (% _) bozabilecek her şeyden arındırılmış. Telefon aramasında
 * boşluklu yazım ("0555 111 22 33") tek terime birleştirilir.
 */
export function searchTerms(q: string): string[] {
  const cleaned = trFold(q).replace(/[^\p{L}\p{N}@.+\- ]/gu, " ").trim();
  if (/^[+\d][\d\s-]*$/.test(cleaned)) {
    // Yalnızca rakamlardan oluşan arama: telefon. Baştaki 0 / +90 farkını yok say.
    const digits = cleaned.replace(/\D/g, "").replace(/^(90|0)(?=5)/, "");
    return digits ? [digits] : [];
  }
  return cleaned.split(/\s+/).filter(Boolean).slice(0, 4);
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
 * Arama: ad, soyad, e-posta, telefon, kurum ve bölümden üretilen search_text sütununda.
 */
export function applicationsQuery(supabase: StaffSession["supabase"], p: Omit<ListParams, "page">) {
  let query = supabase.from("applications").select(LIST_COLUMNS, { count: "exact" });
  if (p.status !== "all") query = query.eq("status", p.status);
  for (const term of searchTerms(p.q)) query = query.like("search_text", `%${term}%`);
  return query.order("created_at", { ascending: p.sort === "oldest" }).order("id");
}

/**
 * Sayfalı liste. İstenen sayfa son sayfadan büyükse (ör. onaylar sonrası filtre
 * küçüldü, geri tuşu) hata vermek yerine son sayfa gösterilir; page değeri düzeltilir.
 */
export async function listApplications(supabase: StaffSession["supabase"], p: ListParams) {
  const fetchPage = (page: number) => {
    const from = (page - 1) * PAGE_SIZE;
    return applicationsQuery(supabase, p)
      .range(from, from + PAGE_SIZE - 1)
      .returns<ListedApplication[]>();
  };
  let page = p.page;
  let { data, count, error } = await fetchPage(page);
  if (error?.code === "PGRST103" || (!error && (data?.length ?? 0) === 0 && (count ?? 0) > 0 && page > 1)) {
    // Aralık dışı → toplamı öğren ve son sayfaya git
    const head = await applicationsQuery(supabase, p).range(0, 0);
    if (head.error) throw new Error(`Başvurular okunamadı (${head.error.code})`);
    page = Math.max(1, Math.ceil((head.count ?? 0) / PAGE_SIZE));
    ({ data, count, error } = await fetchPage(page));
  }
  if (error) throw new Error(`Başvurular okunamadı (${error.code})`);
  return { rows: data ?? [], total: count ?? 0, page };
}

/** CSV için tüm eşleşen satırlar; PostgREST'in satır sınırı (max_rows) aşılmaması için 500'erli sayfalar. */
export async function allApplications(supabase: StaffSession["supabase"], p: Omit<ListParams, "page">) {
  const out: ListedApplication[] = [];
  for (let from = 0; from < 20_000; from += 500) {
    const { data, error } = await applicationsQuery(supabase, p)
      .range(from, from + 499)
      .returns<ListedApplication[]>();
    if (error) throw new Error(`Başvurular okunamadı (${error.code})`);
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }
  return out;
}

/** Her başvurunun en son e-posta kaydı (tablo sütunu için). */
export async function latestEmailStatus(supabase: StaffSession["supabase"], ids: string[]) {
  const map = new Map<string, Pick<EmailLog, "status" | "email_type" | "created_at">>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("email_logs")
    .select("application_id, status, email_type, created_at")
    .in("application_id", ids)
    .order("created_at", { ascending: false })
    .returns<(Pick<EmailLog, "application_id" | "status" | "email_type" | "created_at">)[]>();
  if (error) throw new Error(`E-posta durumları okunamadı (${error.code})`);
  for (const row of data ?? []) if (!map.has(row.application_id)) map.set(row.application_id, row);
  return map;
}
