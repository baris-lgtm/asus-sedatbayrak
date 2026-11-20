"use server";

/**
 * "Sahneye Soru Sor" yönetimi. Her işlem requireAdmin() + kullanıcının kendi oturumuyla
 * DB fonksiyonu (yetki orada da kontrol edilir, denetim kaydı yazılır).
 */
import { z } from "zod";
import { AuthorizationError, TransientAuthError, requireAdmin, requireStageStaff } from "@/lib/auth";
import { dbErrorCode, dbErrorMessage } from "@/lib/db-errors";

export type StageStatus = "new" | "selected" | "asked" | "archived" | "merged";

export interface StageQuestion {
  id: string;
  author_name: string | null;
  body: string;
  status: StageStatus;
  merged_into: string | null;
  created_at: string;
  status_changed_at: string;
}

export interface StageResult {
  ok: boolean;
  message?: string;
  sessionExpired?: boolean;
}

export interface StageList extends StageResult {
  open: boolean;
  questions: StageQuestion[];
}

function fail(e: unknown): StageResult {
  if (e instanceof AuthorizationError) return { ok: false, message: e.message, sessionExpired: e.status === 401 };
  if (e instanceof TransientAuthError) return { ok: false, message: e.message };
  console.error("[stage-admin] beklenmeyen hata");
  return { ok: false, message: "İşlem tamamlanamadı. Lütfen tekrar dene." };
}

const ids = z.array(z.uuid()).min(1).max(500);
const settable = z.enum(["new", "selected", "asked", "archived"]);

export async function listStageQuestions(): Promise<StageList> {
  try {
    const admin = await requireStageStaff();
    const [s, q] = await Promise.all([
      admin.supabase.from("stage_settings").select("is_open").eq("id", 1).single<{ is_open: boolean }>(),
      admin.supabase
        .from("stage_questions")
        .select("id, author_name, body, status, merged_into, created_at, status_changed_at")
        .order("created_at", { ascending: true })
        .limit(3000)
        .returns<StageQuestion[]>(),
    ]);
    if (s.error || q.error) return { ok: false, message: "Sorular okunamadı. Bağlantını kontrol et.", open: false, questions: [] };
    return { ok: true, open: Boolean(s.data?.is_open), questions: q.data ?? [] };
  } catch (e) {
    return { ...fail(e), open: false, questions: [] };
  }
}

export async function setStageStatusAction(idList: string[], status: string): Promise<StageResult> {
  try {
    const admin = await requireStageStaff();
    const p = ids.safeParse(idList);
    const st = settable.safeParse(status);
    if (!p.success || !st.success) return { ok: false, message: "Geçersiz istek." };
    const { error } = await admin.supabase.rpc("admin_stage_set_status", { p_ids: p.data, p_status: st.data });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function mergeStageAction(target: string, idList: string[]): Promise<StageResult> {
  try {
    const admin = await requireStageStaff();
    const t = z.uuid().safeParse(target);
    const p = ids.safeParse(idList);
    if (!t.success || !p.success) return { ok: false, message: "Geçersiz istek." };
    const { data, error } = await admin.supabase.rpc("admin_stage_merge", { p_target: t.data, p_ids: p.data });
    if (error && dbErrorCode(error) === "ERR_NOT_FOUND") return { ok: false, message: "Ana soru bulunamadı veya başka bir soruyla birleştirilmiş." };
    if (error) return { ok: false, message: dbErrorMessage(error) };
    return { ok: true, message: `${Number(data)} soru birleştirildi.` };
  } catch (e) {
    return fail(e);
  }
}

export async function updateStageBodyAction(id: string, body: string): Promise<StageResult> {
  try {
    const admin = await requireStageStaff();
    const v = z.object({ id: z.uuid(), body: z.string().trim().min(3).max(600) }).safeParse({ id, body });
    if (!v.success) return { ok: false, message: "Soru metni 3–600 karakter olmalı." };
    const { error } = await admin.supabase.rpc("admin_stage_update_body", { p_id: v.data.id, p_body: v.data.body });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    return { ok: true, message: "Soru metni güncellendi." };
  } catch (e) {
    return fail(e);
  }
}

export async function setStageOpenAction(open: boolean): Promise<StageResult> {
  try {
    const admin = await requireAdmin();
    const { error } = await admin.supabase.rpc("admin_stage_set_open", { p_open: open === true });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    return { ok: true, message: open ? "Soru alımı açıldı." : "Soru alımı kapatıldı." };
  } catch (e) {
    return fail(e);
  }
}

export async function resetStageAction(confirmText: string): Promise<StageResult> {
  try {
    const admin = await requireAdmin();
    if (confirmText.trim().toLocaleUpperCase("tr-TR") !== "SIFIRLA") return { ok: false, message: "Onay için kutuya SIFIRLA yaz." };
    const { data, error } = await admin.supabase.rpc("admin_stage_reset");
    if (error) return { ok: false, message: dbErrorMessage(error) };
    return { ok: true, message: `${Number(data)} soru silindi.` };
  } catch (e) {
    return fail(e);
  }
}
