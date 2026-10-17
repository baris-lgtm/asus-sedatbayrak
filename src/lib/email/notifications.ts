import "server-only";
import QRCode from "qrcode";
import { requireEnv, siteUrl } from "@/lib/env";
import { getEventSettings } from "@/lib/event-settings";
import { formatManualCode, invitationUrl, materialFor } from "@/lib/server/invitation-token";
import type { Application, EmailType } from "@/lib/types";
import { sendTransactional, type InlineAttachment, type SendOutcome } from "./send";
import type { EmailContent } from "./templates";
import { applicationReceivedEmail, invitationEmail, statusEmail } from "./templates";

type Recipient = Pick<Application, "id" | "first_name" | "email">;

export async function sendApplicationReceived(app: Recipient): Promise<SendOutcome> {
  const settings = await getEventSettings();
  return sendTransactional({
    applicationId: app.id,
    type: "application_received",
    dedupeKey: `received:${app.id}`,
    to: app.email,
    content: applicationReceivedEmail(app.first_name, settings),
  });
}

export async function qrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { errorCorrectionLevel: "M", margin: 2, width: 480, type: "png" });
}

/**
 * Davetiye e-postası. Token'lar davetiye id'sinden yeniden türetilir; DB'de
 * yalnızca hash'leri vardır.
 *  - İlk gönderim: dedupe "invitation:<id>" → aynı onay tekrar çalışsa bile tek e-posta.
 *  - Tekrar gönderim: dedupe "invitation_resend:<id>:<dakika>" → çift tıklamaya karşı dakikada en fazla bir.
 */
export async function sendInvitation(
  app: Recipient,
  invitationId: string,
  mode: "initial" | "resend" = "initial",
): Promise<SendOutcome> {
  const settings = await getEventSettings();
  const secret = requireEnv("INVITATION_TOKEN_SECRET");
  const { qrToken, manualCode } = materialFor(invitationId, secret);
  const url = invitationUrl(siteUrl(), qrToken);
  const contentId = "davetiye-qr";
  const minute = new Date().toISOString().slice(0, 16);

  return sendTransactional({
    applicationId: app.id,
    invitationId,
    type: mode === "initial" ? "invitation" : "invitation_resend",
    dedupeKey: mode === "initial" ? `invitation:${invitationId}` : `invitation_resend:${invitationId}:${minute}`,
    to: app.email,
    content: invitationEmail({
      firstName: app.first_name,
      settings,
      invitationUrl: url,
      manualCode: formatManualCode(manualCode),
      qrContentId: contentId,
      mode,
    }),
    attachments: [{ filename: "davetiye-qr.png", content: await qrPng(url), contentType: "image/png", contentId }],
  });
}

export async function sendStatusNotice(
  app: Recipient,
  kind: "waitlisted" | "rejected" | "cancelled",
  dedupeSuffix: string,
): Promise<SendOutcome> {
  const settings = await getEventSettings();
  return sendTransactional({
    applicationId: app.id,
    type: kind,
    dedupeKey: `${kind}:${app.id}:${dedupeSuffix}`,
    to: app.email,
    content: statusEmail(kind, app.first_name, settings),
  });
}

/** Başarısız bir e-postayı tekrar denemek için içeriği yeniden oluşturur. */
export async function buildEmail(
  type: EmailType,
  app: Recipient,
  invitationId: string | null,
): Promise<{ content: EmailContent; attachments?: InlineAttachment[] }> {
  const settings = await getEventSettings();
  switch (type) {
    case "application_received":
      return { content: applicationReceivedEmail(app.first_name, settings) };
    case "waitlisted":
    case "rejected":
    case "cancelled":
      return { content: statusEmail(type, app.first_name, settings) };
    case "invitation":
    case "invitation_resend":
    case "event_update": {
      if (!invitationId) throw new Error("Davetiye kimliği eksik");
      const { qrToken, manualCode } = materialFor(invitationId, requireEnv("INVITATION_TOKEN_SECRET"));
      const url = invitationUrl(siteUrl(), qrToken);
      const contentId = "davetiye-qr";
      return {
        content: invitationEmail({
          firstName: app.first_name,
          settings,
          invitationUrl: url,
          manualCode: formatManualCode(manualCode),
          qrContentId: contentId,
          mode: type === "invitation_resend" ? "resend" : type === "event_update" ? "update" : "initial",
        }),
        attachments: [{ filename: "davetiye-qr.png", content: await qrPng(url), contentType: "image/png", contentId }],
      };
    }
  }
}

/**
 * Tarih/mekân bilgisi değiştiğinde onaylı katılımcıya bilgilendirme (davetiye QR'ı dahil).
 * dedupe: "event_update:<başvuru>:<ayar sürümü>" → aynı sürüm için kişi başı tek e-posta.
 */
export async function sendEventUpdate(app: Recipient, invitationId: string, version: string): Promise<SendOutcome> {
  const built = await buildEmail("event_update", app, invitationId);
  return sendTransactional({
    applicationId: app.id,
    invitationId,
    type: "event_update",
    dedupeKey: `event_update:${app.id}:${version}`,
    to: app.email,
    content: built.content,
    attachments: built.attachments,
  });
}
