"use server";

/**
 * Toplu onay: yapıştırılan e-posta listesindeki başvuruları onaylar ve davetiye gönderir.
 * Tek tek onayla aynı yoldan geçer (admin_approve + "invitation:<id>" dedupe), bu yüzden
 * tekrar çalıştırmak güvenlidir: onaylı kişi yeniden onaylanmaz, davetiye ikinci kez gitmez.
 */
import { revalidatePath } from "next/cache";
import { AuthorizationError, TransientAuthError, requireAdmin } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { ConfigError, requireEnv } from "@/lib/env";
import { issueInvitation } from "@/lib/server/invitation-token";
import { sendInvitation } from "@/lib/email/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApplicationStatus } from "@/lib/types";

const MAX_EMAILS = 2000;
const BATCH = 15;
const SPACING_MS = 550;
const APPROVABLE: ApplicationStatus[] = ["pending", "reviewing", "waitlisted"];

export interface BulkPlan {
  ok: boolean;
  message?: string;
  sessionExpired?: boolean;
  requested: number;
  /** Onaylanacak (pending/reviewing/waitlisted) */
  toApprove: number;
  /** Onaylı ama davetiye e-postası henüz başarıyla gitmemiş */
  toSend: number;
  /** Onaylı ve davetiye gitmiş — dokunulmaz */
  done: number;
  notFound: string[];
  blocked: { email: string; status: string }[];
  capacity: number;
  taken: number;
}

export interface BulkStep {
  ok: boolean;
  message?: string;
  sessionExpired?: boolean;
  approved: number;
  sent: number;
  failed: { email: string; reason: string }[];
  remaining: number;
}

function parseEmails(raw: string): string[] {
  const found = raw.toLowerCase().match(/[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? [];
  return [...new Set(found)].slice(0, MAX_EMAILS);
}

function authFail(e: unknown) {
  if (e instanceof AuthorizationError) return { message: e.message, sessionExpired: e.status === 401 };
  if (e instanceof TransientAuthError) return { message: e.message };
  if (e instanceof ConfigError) return { message: `Sunucu yapılandırması eksik: ${e.variable}` };
  console.error("[bulk-approve] beklenmeyen hata");
  return { message: "İşlem tamamlanamadı. Lütfen tekrar dene." };
}

type Row = { id: string; first_name: string; email: string; email_normalized: string; status: ApplicationStatus };

async function analyse(emails: string[]) {
  const db = createAdminClient();
  const rows: Row[] = [];
  for (let i = 0; i < emails.length; i += 200) {
    const { data, error } = await db
      .from("applications")
      .select("id, first_name, email, email_normalized, status")
      .in("email_normalized", emails.slice(i, i + 200))
      .returns<Row[]>();
    if (error) throw new Error("Başvurular okunamadı");
    rows.push(...(data ?? []));
  }
  // Aynı e-postanın iptal edilmiş eski kaydı olabilir; etkin olanı tercih et.
  const byEmail = new Map<string, Row>();
  for (const r of rows) {
    const prev = byEmail.get(r.email_normalized);
    if (!prev || prev.status === "cancelled") byEmail.set(r.email_normalized, r);
  }

  const approved = [...byEmail.values()].filter((r) => r.status === "approved");
  const invByApp = new Map<string, string>();
  const sentInv = new Set<string>();
  for (let i = 0; i < approved.length; i += 200) {
    const ids = approved.slice(i, i + 200).map((r) => r.id);
    const { data: invs, error } = await db
      .from("invitations")
      .select("id, application_id")
      .in("application_id", ids)
      .is("revoked_at", null);
    if (error) throw new Error("Davetiyeler okunamadı");
    for (const inv of invs ?? []) invByApp.set(inv.application_id, inv.id);
    const keys = (invs ?? []).map((inv) => `invitation:${inv.id}`);
    if (keys.length) {
      const { data: logs, error: logErr } = await db.from("email_logs").select("dedupe_key").in("dedupe_key", keys).eq("status", "sent");
      if (logErr) throw new Error("E-posta kayıtları okunamadı");
      for (const l of logs ?? []) sentInv.add(l.dedupe_key.slice("invitation:".length));
    }
  }

  const toApprove: Row[] = [];
  const toSend: { row: Row; invitationId: string }[] = [];
  const blocked: { email: string; status: string }[] = [];
  let done = 0;
  for (const r of byEmail.values()) {
    if (APPROVABLE.includes(r.status)) toApprove.push(r);
    else if (r.status === "approved") {
      const inv = invByApp.get(r.id);
      if (inv && !sentInv.has(inv)) toSend.push({ row: r, invitationId: inv });
      else if (inv) done += 1;
      else toApprove.push(r); // onaylı ama davetiyesi yok → admin_approve yeniden oluşturur
    } else if (r.status === "checked_in") done += 1;
    else blocked.push({ email: r.email, status: r.status });
  }
  const notFound = emails.filter((e) => !byEmail.has(e));

  const { data: settings } = await db.from("event_settings").select("capacity").eq("id", 1).single();
  const { count: taken } = await db
    .from("applications")
    .select("id", { count: "exact", head: true })
    .in("status", ["approved", "checked_in"]);

  return { toApprove, toSend, done, blocked, notFound, capacity: settings?.capacity ?? 0, taken: taken ?? 0 };
}

const STATUS_TR: Record<string, string> = { rejected: "reddedilmiş", cancelled: "iptal edilmiş" };

export async function previewBulkApprove(raw: string): Promise<BulkPlan> {
  const empty = { requested: 0, toApprove: 0, toSend: 0, done: 0, notFound: [], blocked: [], capacity: 0, taken: 0 };
  try {
    await requireAdmin();
    const emails = parseEmails(raw);
    if (emails.length === 0) return { ok: false, message: "Listede e-posta adresi bulunamadı.", ...empty };
    const a = await analyse(emails);
    return {
      ok: true,
      requested: emails.length,
      toApprove: a.toApprove.length,
      toSend: a.toSend.length,
      done: a.done,
      notFound: a.notFound,
      blocked: a.blocked.map((b) => ({ email: b.email, status: STATUS_TR[b.status] ?? b.status })),
      capacity: a.capacity,
      taken: a.taken,
    };
  } catch (e) {
    return { ok: false, ...authFail(e), ...empty };
  }
}

/** Bir tur işler (en fazla BATCH kişi); istemci `remaining` 0 olana kadar tekrar çağırır. */
export async function runBulkApproveStep(raw: string, skip: string[] = []): Promise<BulkStep> {
  const result: BulkStep = { ok: true, approved: 0, sent: 0, failed: [], remaining: 0 };
  try {
    const admin = await requireAdmin();
    const emails = parseEmails(raw);
    const a = await analyse(emails);
    // Bu oturumda zaten hata veren kişiler atlanır (tur tıkanmasın); sonunda ayrıca listelenir.
    const skipSet = new Set(skip.map((e) => e.toLowerCase()));
    const work: ({ kind: "approve"; row: Row } | { kind: "send"; row: Row; invitationId: string })[] = [
      ...a.toSend.map((t) => ({ kind: "send" as const, ...t })),
      ...a.toApprove.map((row) => ({ kind: "approve" as const, row })),
    ].filter((w) => !skipSet.has(w.row.email_normalized));
    const batch = work.slice(0, BATCH);
    const secret = requireEnv("INVITATION_TOKEN_SECRET");

    for (const [i, item] of batch.entries()) {
      if (i > 0) await new Promise((r) => setTimeout(r, SPACING_MS));
      let invitationId: string;
      if (item.kind === "approve") {
        const m = issueInvitation(secret);
        const { data, error } = await admin.supabase.rpc("admin_approve", {
          p_application_id: item.row.id,
          p_invitation_id: m.invitationId,
          p_qr_token_hash: m.qrTokenHash,
          p_manual_code_hash: m.manualCodeHash,
        });
        if (error) {
          const reason = dbErrorMessage(error);
          result.failed.push({ email: item.row.email, reason });
          if (/ERR_CAPACITY_FULL/.test(error.message ?? "")) {
            result.ok = false;
            result.message = "Kapasite doldu; kalan kişiler onaylanmadı. Etkinlik ayarlarından kapasiteyi artırıp devam et.";
            break;
          }
          continue;
        }
        result.approved += 1;
        invitationId = (data as { invitation_id: string }).invitation_id;
      } else {
        invitationId = item.invitationId;
      }
      const outcome = await sendInvitation(item.row, invitationId, "initial");
      if (outcome.status === "sent" || outcome.status === "duplicate") result.sent += outcome.status === "sent" ? 1 : 0;
      else result.failed.push({ email: item.row.email, reason: outcome.status === "failed" ? outcome.error : "E-posta servisi yapılandırılmamış" });
    }

    await createAdminClient()
      .from("admin_audit_logs")
      .insert({
        admin_user_id: admin.userId,
        action: "bulk_approve",
        metadata: { approved: result.approved, sent: result.sent, failed: result.failed.length },
      });
    revalidatePath("/admin", "layout");

    const after = await analyse(emails);
    for (const f of result.failed) skipSet.add(f.email.toLowerCase());
    result.remaining = [...after.toApprove, ...after.toSend.map((t) => t.row)].filter((r) => !skipSet.has(r.email_normalized)).length;
    return result;
  } catch (e) {
    return { ...result, ok: false, ...authFail(e) };
  }
}
