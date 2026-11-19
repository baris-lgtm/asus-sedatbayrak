"use server";

/**
 * Toplu ret + "katılamayanlar" e-postası (ProArt indirimi).
 *  - Onaylı / giriş yapmış kişilere ASLA dokunulmaz.
 *  - pending / reviewing / waitlisted → admin_set_status('rejected') (admin'in kendi oturumuyla) + e-posta.
 *  - Zaten reddedilmiş ama bu e-postayı almamış → yalnızca e-posta.
 *  - dedupe "regret:<başvuru>" → kişi başı tek e-posta; tekrar çalıştırmak güvenlidir.
 * Parça parça gönderim: istemci her seferinde en fazla `limit` kişi işler.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthorizationError, TransientAuthError, requireAdmin } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { ConfigError } from "@/lib/env";
import { regretPreview, sendRegret } from "@/lib/email/notifications";
import { sendPreviewEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApplicationStatus } from "@/lib/types";

const MAX_EMAILS = 3000;
const BATCH = 15;
const SPACING_MS = 550;
const REJECTABLE: ApplicationStatus[] = ["pending", "reviewing", "waitlisted"];

export type RegretMode = "all" | "list";

export interface RegretPlan {
  ok: boolean;
  message?: string;
  sessionExpired?: boolean;
  requested: number;
  /** Reddedilip e-posta alacak */
  toReject: number;
  /** Zaten reddedilmiş, e-postayı henüz almamış */
  toSend: number;
  /** E-postayı zaten almış */
  done: number;
  /** Onaylı / giriş yapmış — dokunulmaz */
  protectedCount: number;
  protectedEmails: string[];
  cancelled: number;
  notFound: string[];
}

export interface RegretStep {
  ok: boolean;
  message?: string;
  sessionExpired?: boolean;
  rejected: number;
  sent: number;
  /** Bu turda ele alınan kişi sayısı (başarılı + sorunlu) */
  processed: number;
  failed: { email: string; reason: string }[];
  remaining: number;
}

function authFail(e: unknown) {
  if (e instanceof AuthorizationError) return { message: e.message, sessionExpired: e.status === 401 };
  if (e instanceof TransientAuthError) return { message: e.message };
  if (e instanceof ConfigError) return { message: `Sunucu yapılandırması eksik: ${e.variable}` };
  console.error("[bulk-regret] beklenmeyen hata");
  return { message: "İşlem tamamlanamadı. Lütfen tekrar dene." };
}

function parseEmails(raw: string): string[] {
  const found = raw.toLowerCase().match(/[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? [];
  return [...new Set(found)].slice(0, MAX_EMAILS);
}

type Row = { id: string; first_name: string; email: string; email_normalized: string; status: ApplicationStatus; created_at: string };
const COLS = "id, first_name, email, email_normalized, status, created_at";

async function loadRows(mode: RegretMode, emails: string[]): Promise<Row[]> {
  const db = createAdminClient();
  const rows: Row[] = [];
  if (mode === "list") {
    for (let i = 0; i < emails.length; i += 200) {
      const { data, error } = await db.from("applications").select(COLS).in("email_normalized", emails.slice(i, i + 200)).returns<Row[]>();
      if (error) throw new Error("Başvurular okunamadı");
      rows.push(...(data ?? []));
    }
  } else {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("applications").select(COLS).order("created_at").order("id").range(from, from + 999).returns<Row[]>();
      if (error) throw new Error("Başvurular okunamadı");
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
  }
  // Aynı e-postanın birden fazla kaydı varsa etkin olanı tercih et (iptal edilmiş eski kayıt değil).
  const rank = (s: ApplicationStatus) => (s === "checked_in" ? 0 : s === "approved" ? 1 : s === "cancelled" ? 9 : 5);
  const byEmail = new Map<string, Row>();
  for (const r of rows) {
    const prev = byEmail.get(r.email_normalized);
    if (!prev || rank(r.status) < rank(prev.status)) byEmail.set(r.email_normalized, r);
  }
  return [...byEmail.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

async function analyse(mode: RegretMode, emails: string[]) {
  const db = createAdminClient();
  const rows = await loadRows(mode, emails);
  const rejected = rows.filter((r) => r.status === "rejected");
  const sent = new Set<string>();
  for (let i = 0; i < rejected.length; i += 200) {
    const keys = rejected.slice(i, i + 200).map((r) => `regret:${r.id}`);
    const { data, error } = await db.from("email_logs").select("dedupe_key").in("dedupe_key", keys).eq("status", "sent");
    if (error) throw new Error("E-posta kayıtları okunamadı");
    for (const l of data ?? []) sent.add(l.dedupe_key.slice("regret:".length));
  }
  const toReject: Row[] = [];
  const toSend: Row[] = [];
  const protectedRows: Row[] = [];
  let done = 0;
  let cancelled = 0;
  for (const r of rows) {
    if (REJECTABLE.includes(r.status)) toReject.push(r);
    else if (r.status === "rejected") (sent.has(r.id) ? done++ : toSend.push(r));
    else if (r.status === "approved" || r.status === "checked_in") protectedRows.push(r);
    else cancelled++;
  }
  const known = new Set(rows.map((r) => r.email_normalized));
  const notFound = mode === "list" ? emails.filter((e) => !known.has(e)) : [];
  return { toReject, toSend, done, protectedRows, cancelled, notFound };
}

const modeSchema = z.enum(["all", "list"]);

export async function previewBulkRegret(mode: RegretMode, raw: string): Promise<RegretPlan> {
  const empty = { requested: 0, toReject: 0, toSend: 0, done: 0, protectedCount: 0, protectedEmails: [], cancelled: 0, notFound: [] };
  try {
    await requireAdmin();
    const m = modeSchema.parse(mode);
    const emails = m === "list" ? parseEmails(raw) : [];
    if (m === "list" && emails.length === 0) return { ok: false, message: "Listede e-posta adresi bulunamadı.", ...empty };
    const a = await analyse(m, emails);
    return {
      ok: true,
      requested: m === "list" ? emails.length : a.toReject.length + a.toSend.length + a.done + a.protectedRows.length + a.cancelled,
      toReject: a.toReject.length,
      toSend: a.toSend.length,
      done: a.done,
      protectedCount: a.protectedRows.length,
      // Listede onaylı biri varsa göster (yanlışlıkla eklenmiş olabilir); "herkes" modunda liste uzun olacağından gösterilmez.
      protectedEmails: m === "list" ? a.protectedRows.map((r) => r.email) : [],
      cancelled: a.cancelled,
      notFound: a.notFound,
    };
  } catch (e) {
    return { ok: false, ...authFail(e), ...empty };
  }
}

/** En fazla min(BATCH, take) kişi işler; istemci `remaining` 0 olana veya kendi sınırına gelene kadar tekrar çağırır. */
export async function runBulkRegretStep(mode: RegretMode, raw: string, take: number, skip: string[] = []): Promise<RegretStep> {
  const result: RegretStep = { ok: true, rejected: 0, sent: 0, processed: 0, failed: [], remaining: 0 };
  try {
    const admin = await requireAdmin();
    const m = modeSchema.parse(mode);
    const n = Math.max(1, Math.min(BATCH, Math.floor(Number(take) || 0)));
    const emails = m === "list" ? parseEmails(raw) : [];
    const a = await analyse(m, emails);
    const skipSet = new Set(skip.map((e) => e.toLowerCase()));
    const work = [...a.toSend.map((row) => ({ reject: false, row })), ...a.toReject.map((row) => ({ reject: true, row }))].filter(
      (w) => !skipSet.has(w.row.email_normalized),
    );

    for (const [i, item] of work.slice(0, n).entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, SPACING_MS));
      result.processed += 1;
      if (item.reject) {
        const { error } = await admin.supabase.rpc("admin_set_status", {
          p_application_id: item.row.id,
          p_status: "rejected",
          p_note: "Toplu ret (kontenjan doldu)",
        });
        if (error) {
          result.failed.push({ email: item.row.email, reason: dbErrorMessage(error) });
          continue;
        }
        result.rejected += 1;
      }
      const outcome = await sendRegret(item.row);
      if (outcome.status === "sent") result.sent += 1;
      else if (outcome.status !== "duplicate")
        result.failed.push({ email: item.row.email, reason: outcome.status === "failed" ? outcome.error : "E-posta servisi yapılandırılmamış" });
    }

    await createAdminClient()
      .from("admin_audit_logs")
      .insert({
        admin_user_id: admin.userId,
        action: "bulk_regret",
        metadata: { rejected: result.rejected, sent: result.sent, failed: result.failed.length },
      });
    revalidatePath("/admin", "layout");

    const after = await analyse(m, emails);
    for (const f of result.failed) skipSet.add(f.email.toLowerCase());
    result.remaining = [...after.toReject, ...after.toSend].filter((r) => !skipSet.has(r.email_normalized)).length;
    return result;
  } catch (e) {
    return { ...result, ok: false, ...authFail(e) };
  }
}

/** Tasarımı kontrol için test gönderimi: hiçbir başvuruya dokunmaz, kayıt tutmaz. */
export async function sendRegretTestAction(to: string): Promise<{ ok: boolean; message: string; sessionExpired?: boolean }> {
  try {
    await requireAdmin();
    const addr = z.email().safeParse(to.trim());
    if (!addr.success) return { ok: false, message: "Geçerli bir e-posta adresi yaz." };
    const { content, attachments } = await regretPreview();
    const out = await sendPreviewEmail(addr.data, content, attachments);
    if (out.status === "sent") return { ok: true, message: `Test e-postası ${addr.data} adresine gönderildi. Konu: “[TEST] ${content.subject}”` };
    if (out.status === "not_configured") return { ok: false, message: "E-posta servisi yapılandırılmamış (RESEND_API_KEY / EMAIL_FROM)." };
    return { ok: false, message: `Gönderilemedi: ${out.status === "failed" ? out.error : "bilinmeyen hata"}` };
  } catch (e) {
    const f = authFail(e);
    return { ok: false, message: f.message, sessionExpired: "sessionExpired" in f ? f.sessionExpired : undefined };
  }
}
