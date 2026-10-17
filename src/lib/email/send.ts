import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, siteUrl } from "@/lib/env";
import type { EmailType } from "@/lib/types";
import type { EmailContent } from "./templates";

export type SendOutcome =
  | { status: "sent"; providerId: string }
  | { status: "failed"; error: string }
  | { status: "not_configured" }
  | { status: "duplicate" }; // daha önce gönderilmiş veya şu an gönderiliyor

export interface InlineAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  contentId: string;
}

interface SendArgs {
  applicationId: string;
  invitationId?: string | null;
  type: EmailType;
  dedupeKey: string;
  to: string;
  content: EmailContent;
  attachments?: InlineAttachment[];
}

/**
 * Yerel geliştirme/test için e-postayı diske yazan taşıyıcı.
 * YALNIZCA site localhost iken etkinleşir; canlıda asla "gönderildi" saymaz.
 */
function testSinkDir(): string | null {
  const dir = process.env.EMAIL_TEST_SINK_DIR;
  if (!dir) return null;
  const host = new URL(siteUrl()).hostname;
  return host === "localhost" || host === "127.0.0.1" ? dir : null;
}

/**
 * Tek bir işlem e-postasını gönderir.
 *  1. email_logs'ta dedupe_key ile kaydı sahiplenir (claim_email) → çift gönderim yok.
 *  2. Sağlayıcıya gönderir; yalnızca sağlayıcı başarı döndürürse 'sent' kaydedilir.
 *  3. Hata başvuruyu ASLA etkilemez; 'failed' olarak loglanır ve adminden tekrar denenebilir.
 * Loglara alıcı adresi veya içerik yazılmaz.
 */
export async function sendTransactional(args: SendArgs): Promise<SendOutcome> {
  const db = createAdminClient();
  const { data: claimed, error: claimError } = await db
    .rpc("claim_email", {
      p_application_id: args.applicationId,
      p_email_type: args.type,
      p_dedupe_key: args.dedupeKey,
      p_invitation_id: args.invitationId ?? null,
    })
    .single<{ id: string | null; attempt_count: number | null }>();

  if (claimError) {
    console.error("[email] kayıt sahiplenilemedi:", claimError.code, args.type);
    return { status: "failed", error: "E-posta kaydı oluşturulamadı." };
  }
  if (!claimed?.id) return { status: "duplicate" };
  const logId = claimed.id;

  const finish = async (success: boolean, providerId: string | null, err: string | null) => {
    const { error } = await db.rpc("finish_email", {
      p_log_id: logId,
      p_success: success,
      p_provider_message_id: providerId,
      p_error: err,
    });
    if (error) console.error("[email] sonuç kaydedilemedi:", error.code);
  };

  const sink = testSinkDir();
  if (sink) {
    const id = `test-sink:${randomUUID()}`;
    try {
      await mkdir(sink, { recursive: true });
      await writeFile(
      path.join(sink, `${Date.now()}-${args.type}-${logId}.json`),
      JSON.stringify({
        id,
        to: args.to,
        type: args.type,
        subject: args.content.subject,
        text: args.content.text,
        attachments: (args.attachments ?? []).map((a) => ({ filename: a.filename, contentId: a.contentId, bytes: a.content.length })),
      }),
      );
    } catch {
      await finish(false, null, "Test e-posta dizinine yazılamadı.");
      return { status: "failed", error: "Test e-posta dizinine yazılamadı." };
    }
    await finish(true, id, null);
    return { status: "sent", providerId: id };
  }

  if (!isEmailConfigured()) {
    const msg = "E-posta servisi yapılandırılmamış (RESEND_API_KEY / EMAIL_FROM).";
    await finish(false, null, msg);
    return { status: "not_configured" };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send(
      {
        from: process.env.EMAIL_FROM as string,
        to: args.to,
        replyTo: process.env.EMAIL_REPLY_TO || undefined,
        subject: args.content.subject,
        html: args.content.html,
        text: args.content.text,
        attachments: args.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
          contentId: a.contentId,
        })),
        tags: [{ name: "type", value: args.type }],
      },
      // Ağ tekrarlarında Resend tarafında da çift gönderimi önler.
      { idempotencyKey: `${logId}:${claimed.attempt_count ?? 1}` },
    );
    if (error || !data?.id) {
      const msg = `${error?.name ?? "unknown"}: ${error?.message ?? "Sağlayıcı yanıtı boş"}`.slice(0, 900);
      await finish(false, null, msg);
      console.error("[email] gönderim başarısız:", args.type, error?.name);
      return { status: "failed", error: msg };
    }
    await finish(true, data.id, null);
    return { status: "sent", providerId: data.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 900) : "Bilinmeyen hata";
    await finish(false, null, msg);
    console.error("[email] gönderim istisnası:", args.type);
    return { status: "failed", error: msg };
  }
}

export function describeOutcome(o: SendOutcome): string {
  switch (o.status) {
    case "sent":
      return "E-posta gönderildi.";
    case "duplicate":
      return "Bu e-posta daha önce gönderilmiş; tekrar gönderilmedi.";
    case "not_configured":
      return "E-posta servisi yapılandırılmadığı için gönderilemedi (log kaydedildi).";
    case "failed":
      return "E-posta gönderilemedi; başvurunun detayından tekrar deneyebilirsin.";
  }
}
