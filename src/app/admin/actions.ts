"use server";

/**
 * Admin işlemleri. Her action:
 *  1. Sunucuda requireAdmin() ile oturum + rol doğrular (buton gizlemeye güvenilmez).
 *  2. Değişikliği kullanıcının KENDİ oturumuyla veritabanı fonksiyonu üzerinden yapar
 *     → veritabanı da yetkiyi ikinci kez kontrol eder ve denetim kaydı yazar.
 *  3. E-posta sonucunu kullanıcıya açıkça bildirir.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthorizationError, requireAdmin } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/db-errors";
import { requireEnv, ConfigError } from "@/lib/env";
import { issueInvitation } from "@/lib/server/invitation-token";
import { describeOutcome, sendTransactional, type SendOutcome } from "@/lib/email/send";
import { buildEmail, sendEventUpdate, sendInvitation, sendStatusNotice } from "@/lib/email/notifications";
import { pendingUpdateTargets } from "@/lib/admin/event-update";
import { getEventSettings } from "@/lib/event-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { fromIstanbulLocalInput } from "@/lib/format";
import type { Application, EmailLog } from "@/lib/types";

export interface ActionState {
  ok?: boolean;
  message?: string;
}

const uuid = z.uuid();

function fail(e: unknown): ActionState {
  if (e instanceof AuthorizationError) return { ok: false, message: e.message };
  if (e instanceof ConfigError) return { ok: false, message: `Sunucu yapılandırması eksik: ${e.variable}` };
  console.error("[admin-action] beklenmeyen hata");
  return { ok: false, message: "İşlem tamamlanamadı. Lütfen tekrar dene." };
}

async function loadApplication(id: string) {
  // Yetki zaten doğrulandı; alıcı bilgisi için service client (RLS bağımsız, tek satır).
  const { data } = await createAdminClient()
    .from("applications")
    .select("id, first_name, email, status")
    .eq("id", id)
    .single<Pick<Application, "id" | "first_name" | "email" | "status">>();
  return data;
}

function withEmail(base: string, outcome: SendOutcome | null): ActionState {
  return { ok: true, message: outcome ? `${base} ${describeOutcome(outcome)}` : base };
}

const statusSchema = z.object({
  id: uuid,
  status: z.enum(["reviewing", "waitlisted", "rejected", "cancelled"]),
  notify: z.enum(["on"]).optional(),
  note: z.string().max(2000).optional(),
});

const STATUS_DONE: Record<string, string> = {
  reviewing: "Başvuru incelemeye alındı.",
  waitlisted: "Başvuru yedek listeye alındı.",
  rejected: "Başvuru reddedildi.",
  cancelled: "Katılım iptal edildi; davetiye geçersiz kılındı.",
};

export async function setStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const parsed = statusSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: "Geçersiz istek." };
    const { id, status, notify, note } = parsed.data;

    const { data, error } = await admin.supabase.rpc("admin_set_status", {
      p_application_id: id,
      p_status: status,
      p_note: note?.trim() || null,
    });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    const result = data as { changed: boolean };
    revalidatePath("/admin", "layout");
    if (!result.changed) return { ok: true, message: "Başvuru zaten bu durumda; değişiklik yapılmadı." };

    let outcome: SendOutcome | null = null;
    if (notify === "on" && status !== "reviewing") {
      const app = await loadApplication(id);
      if (app) outcome = await sendStatusNotice(app, status, new Date().toISOString().slice(0, 16));
    }
    return withEmail(STATUS_DONE[status], outcome);
  } catch (e) {
    return fail(e);
  }
}

export async function approveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = uuid.safeParse(formData.get("id"));
    if (!id.success) return { ok: false, message: "Geçersiz istek." };

    const material = issueInvitation(requireEnv("INVITATION_TOKEN_SECRET"));
    const { data, error } = await admin.supabase.rpc("admin_approve", {
      p_application_id: id.data,
      p_invitation_id: material.invitationId,
      p_qr_token_hash: material.qrTokenHash,
      p_manual_code_hash: material.manualCodeHash,
    });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    const result = data as { invitation_id: string; created: boolean };
    revalidatePath("/admin", "layout");

    // Davetiye e-postası "invitation:<id>" anahtarıyla bir kez gönderilir;
    // onay tekrar çalışsa bile ikinci e-posta gitmez.
    const app = await loadApplication(id.data);
    const outcome = app ? await sendInvitation(app, result.invitation_id, "initial") : null;
    return withEmail(result.created ? "Başvuru onaylandı ve QR davetiyesi oluşturuldu." : "Başvuru zaten onaylı; mevcut davetiye korundu.", outcome);
  } catch (e) {
    return fail(e);
  }
}

async function activeInvitationId(admin: Awaited<ReturnType<typeof requireAdmin>>, applicationId: string) {
  const { data } = await admin.supabase
    .from("invitations")
    .select("id")
    .eq("application_id", applicationId)
    .is("revoked_at", null)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

export async function resendInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = uuid.safeParse(formData.get("id"));
    if (!id.success) return { ok: false, message: "Geçersiz istek." };
    const app = await loadApplication(id.data);
    if (!app || app.status !== "approved") return { ok: false, message: "Yalnızca onaylı (henüz giriş yapmamış) başvurulara davetiye gönderilebilir." };
    const invitationId = await activeInvitationId(admin, id.data);
    if (!invitationId) return { ok: false, message: "Aktif davetiye bulunamadı." };

    const outcome = await sendInvitation(app, invitationId, "resend");
    await createAdminClient().from("admin_audit_logs").insert({
      admin_user_id: admin.userId,
      action: "resend_invitation",
      application_id: id.data,
      metadata: { invitation_id: invitationId, outcome: outcome.status },
    });
    revalidatePath("/admin", "layout");
    if (outcome.status === "duplicate") return { ok: true, message: "Davetiye az önce gönderildi; bir dakika sonra tekrar deneyebilirsin." };
    return { ok: outcome.status === "sent", message: describeOutcome(outcome) };
  } catch (e) {
    return fail(e);
  }
}

export async function reissueInvitationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = uuid.safeParse(formData.get("id"));
    if (!id.success) return { ok: false, message: "Geçersiz istek." };
    const material = issueInvitation(requireEnv("INVITATION_TOKEN_SECRET"));
    const { data, error } = await admin.supabase.rpc("admin_reissue_invitation", {
      p_application_id: id.data,
      p_invitation_id: material.invitationId,
      p_qr_token_hash: material.qrTokenHash,
      p_manual_code_hash: material.manualCodeHash,
    });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    revalidatePath("/admin", "layout");
    const app = await loadApplication(id.data);
    const outcome = app ? await sendInvitation(app, (data as { invitation_id: string }).invitation_id, "initial") : null;
    return withEmail("Yeni davetiye oluşturuldu; eski QR kodu artık geçersiz.", outcome);
  } catch (e) {
    return fail(e);
  }
}

/** Başarısız bir e-postayı aynı dedupe anahtarıyla yeniden dener. */
export async function retryEmailAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = uuid.safeParse(formData.get("logId"));
    if (!id.success) return { ok: false, message: "Geçersiz istek." };
    const { data: log } = await admin.supabase
      .from("email_logs")
      .select("id, application_id, invitation_id, email_type, status, dedupe_key")
      .eq("id", id.data)
      .single<Pick<EmailLog, "id" | "application_id" | "invitation_id" | "email_type" | "status" | "dedupe_key">>();
    if (!log) return { ok: false, message: "E-posta kaydı bulunamadı." };
    if (log.status !== "failed") return { ok: false, message: "Yalnızca başarısız e-postalar tekrar denenebilir." };
    const app = await loadApplication(log.application_id);
    if (!app) return { ok: false, message: "Başvuru bulunamadı." };

    if (log.invitation_id && (log.email_type === "invitation" || log.email_type === "invitation_resend")) {
      const { data: inv } = await admin.supabase
        .from("invitations")
        .select("revoked_at")
        .eq("id", log.invitation_id)
        .single<{ revoked_at: string | null }>();
      if (inv?.revoked_at) return { ok: false, message: "Bu davetiye iptal edilmiş; tekrar gönderilmedi." };
    }
    // Aynı dedupe anahtarıyla: claim_email yalnızca 'failed' kaydı yeniden sahiplenir.
    const built = await buildEmail(log.email_type, app, log.invitation_id);
    const outcome = await sendTransactional({
      applicationId: app.id,
      invitationId: log.invitation_id,
      type: log.email_type,
      dedupeKey: log.dedupe_key as string,
      to: app.email,
      content: built.content,
      attachments: built.attachments,
    });
    revalidatePath("/admin", "layout");
    return { ok: outcome.status === "sent", message: describeOutcome(outcome) };
  } catch (e) {
    return fail(e);
  }
}

const settingsSchema = z
  .object({
    event_name: z.string().trim().min(1, "Etkinlik adı boş olamaz.").max(120),
    starts_at: z.string().optional(),
    ends_at: z.string().optional(),
    date_confirmed: z.enum(["on"]).optional(),
    venue_name: z.string().trim().max(160).optional(),
    venue_address: z.string().trim().max(400).optional(),
    venue_map_url: z
      .string()
      .trim()
      .max(1000)
      .refine((v) => v === "" || /^https:\/\//.test(v), "Harita bağlantısı https:// ile başlamalı.")
      .optional(),
    transport_info: z.string().trim().max(2000).optional(),
    venue_confirmed: z.enum(["on"]).optional(),
    capacity: z.coerce.number({ error: "Kapasite sayı olmalı." }).int().min(1, "Kapasite en az 1 olmalı.").max(5000),
    applications_open: z.enum(["on"]).optional(),
    kvkk_notice_version: z.string().trim().min(1).max(40),
    marketing_consent_version: z.string().trim().min(1).max(40),
    retention_days: z.coerce.number().int().min(1).max(3650),
  })
  .transform((v) => ({
    event_name: v.event_name,
    starts_at: fromIstanbulLocalInput(v.starts_at ?? ""),
    ends_at: fromIstanbulLocalInput(v.ends_at ?? ""),
    date_confirmed: v.date_confirmed === "on",
    venue_name: v.venue_name || null,
    venue_address: v.venue_address || null,
    venue_map_url: v.venue_map_url || null,
    transport_info: v.transport_info || null,
    venue_confirmed: v.venue_confirmed === "on",
    capacity: v.capacity,
    applications_open: v.applications_open === "on",
    kvkk_notice_version: v.kvkk_notice_version,
    marketing_consent_version: v.marketing_consent_version,
    retention_days: v.retention_days,
  }));

export async function updateSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Geçersiz değer." };
    const v = parsed.data;
    if (v.date_confirmed && !v.starts_at) return { ok: false, message: "Tarihi kesinleşmiş olarak işaretlemek için başlangıç zamanını gir." };
    if (v.starts_at && v.ends_at && v.ends_at <= v.starts_at) return { ok: false, message: "Bitiş zamanı başlangıçtan sonra olmalı." };
    if (v.venue_confirmed && (!v.venue_name || !v.venue_address)) return { ok: false, message: "Mekânı kesinleşmiş olarak işaretlemek için ad ve adres gir." };

    // Kapasite, onaylı + giriş yapmış sayısının altına düşürülemez.
    const { data: stats } = await admin.supabase.rpc("admin_stats");
    const taken = ((stats as { approved?: number; checked_in?: number }) ?? {}).approved ?? 0;
    const checked = ((stats as { checked_in?: number }) ?? {}).checked_in ?? 0;
    if (v.capacity < taken + checked) return { ok: false, message: `Kapasite, onaylı katılımcı sayısının (${taken + checked}) altına düşürülemez.` };

    // Oturumlu istemci + RLS: yalnızca admin güncelleyebilir.
    const { data, error } = await admin.supabase
      .from("event_settings")
      .update({ ...v, updated_by: admin.userId })
      .eq("id", 1)
      .select("id");
    if (error || !data?.length) return { ok: false, message: "Ayarlar kaydedilemedi." };

    await createAdminClient().from("admin_audit_logs").insert({
      admin_user_id: admin.userId,
      action: "update_settings",
      metadata: { capacity: v.capacity, applications_open: v.applications_open, date_confirmed: v.date_confirmed, venue_confirmed: v.venue_confirmed },
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Ayarlar kaydedildi. Ana sayfa güncellendi." };
  } catch (e) {
    return fail(e);
  }
}

/**
 * KVKK silme talebi: başvuruyu, davetiyesini ve e-posta kayıtlarını kalıcı siler.
 * Geri alınamaz; denetim kaydında yalnızca kayıt kimliği kalır.
 */
export async function deleteApplicationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = uuid.safeParse(formData.get("id"));
    if (!id.success) return { ok: false, message: "Geçersiz istek." };
    if (formData.get("confirm") !== "SIL") return { ok: false, message: "Silmeyi onaylamak için kutuya SIL yaz." };
    const { error } = await admin.supabase.rpc("admin_delete_application", { p_application_id: id.data });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    revalidatePath("/admin", "layout");
  } catch (e) {
    return fail(e);
  }
  redirect("/admin?silindi=1");
}

const UPDATE_BATCH = 25;
const RESEND_SPACING_MS = 550; // Resend'in varsayılan hız sınırının (saniyede ~2 istek) altında kalmak için

/**
 * Tarih/mekân kesinleşince onaylı katılımcılara güncel bilgiyi (ve davetiyelerini)
 * gönderir. Her çağrıda en fazla 25 kişi işlenir; kalan varsa admin tekrar basar.
 * Aynı bilgi sürümü için kimseye iki kez gönderilmez.
 */
export async function sendEventUpdatesAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const settings = await getEventSettings();
    if (!settings.date_confirmed && !settings.venue_confirmed) {
      return { ok: false, message: "Önce tarihi veya mekânı kesinleşmiş olarak kaydet." };
    }
    const { total, pending, version } = await pendingUpdateTargets(admin.supabase, settings);
    if (total === 0) return { ok: false, message: "Henüz onaylı katılımcı yok." };
    if (pending.length === 0) return { ok: true, message: `Güncel bilgi ${total} katılımcının tamamına gönderildi.` };

    const db = createAdminClient();
    const batch = pending.slice(0, UPDATE_BATCH);
    const { data: apps } = await db
      .from("applications")
      .select("id, first_name, email")
      .in("id", batch.map((b) => b.applicationId))
      .returns<Pick<Application, "id" | "first_name" | "email">[]>();
    const byId = new Map((apps ?? []).map((a) => [a.id, a]));

    let sent = 0;
    let failed = 0;
    for (const [i, t] of batch.entries()) {
      const app = byId.get(t.applicationId);
      if (!app) continue;
      if (i > 0) await new Promise((r) => setTimeout(r, RESEND_SPACING_MS));
      const outcome = await sendEventUpdate(app, t.invitationId, version);
      if (outcome.status === "sent" || outcome.status === "duplicate") sent += 1;
      else failed += 1;
    }

    await db.from("admin_audit_logs").insert({
      admin_user_id: admin.userId,
      action: "send_event_update",
      metadata: { version, sent, failed, remaining: pending.length - batch.length },
    });
    revalidatePath("/admin", "layout");

    const remaining = pending.length - sent;
    const parts = [`${sent} katılımcıya gönderildi.`];
    if (failed) parts.push(`${failed} gönderim başarısız (başvuru detaylarından tekrar denenebilir).`);
    parts.push(remaining > 0 ? `Kalan: ${remaining}. Devam etmek için tekrar bas.` : "Tüm onaylı katılımcılar bilgilendirildi.");
    return { ok: failed === 0, message: parts.join(" ") };
  } catch (e) {
    return fail(e);
  }
}
