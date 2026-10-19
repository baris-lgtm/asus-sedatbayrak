import "server-only";
import QRCode from "qrcode";
import { requireEnv, siteUrl } from "@/lib/env";
import { getEventSettingsStrict } from "@/lib/event-settings";
import { formatManualCode, invitationUrl, materialFor } from "@/lib/server/invitation-token";
import type { Application, EmailType } from "@/lib/types";
import { sendTransactional, type InlineAttachment, type SendOutcome } from "./send";
import type { EmailContent } from "./templates";
import { applicationReceivedEmail, invitationEmail, statusEmail } from "./templates";

type Recipient = Pick<Application, "id" | "first_name" | "email">;

export async function qrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { errorCorrectionLevel: "M", margin: 2, width: 480, type: "png" });
}

/**
 * Bir e-posta türünün içeriğini GÜNCEL ayarlarla üretir. Ayarlar okunamazsa
 * hata fırlatır (gönderim 'failed' loglanır; yanlış/eksik bilgi gitmez).
 */
export async function buildEmail(
  type: EmailType,
  app: Recipient,
  invitationId: string | null,
): Promise<{ content: EmailContent; attachments?: InlineAttachment[] }> {
  const settings = await getEventSettingsStrict();
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

function send(app: Recipient, type: EmailType, dedupeKey: string, invitationId: string | null = null) {
  return sendTransactional({
    applicationId: app.id,
    invitationId,
    type,
    dedupeKey,
    to: app.email,
    build: () => buildEmail(type, app, invitationId),
  });
}

export function sendApplicationReceived(app: Recipient): Promise<SendOutcome> {
  return send(app, "application_received", `received:${app.id}`);
}

/**
 * Davetiye e-postası. Token'lar davetiye id'sinden yeniden türetilir; DB'de
 * yalnızca hash'leri vardır.
 *  - İlk gönderim: dedupe "invitation:<id>" → aynı onay tekrar çalışsa bile tek e-posta.
 *  - Tekrar gönderim: dedupe "invitation_resend:<id>:<dakika>" → çift tıklamaya karşı dakikada en fazla bir.
 */
export function sendInvitation(app: Recipient, invitationId: string, mode: "initial" | "resend" = "initial"): Promise<SendOutcome> {
  const minute = new Date().toISOString().slice(0, 16);
  return mode === "initial"
    ? send(app, "invitation", `invitation:${invitationId}`, invitationId)
    : send(app, "invitation_resend", `invitation_resend:${invitationId}:${minute}`, invitationId);
}

export function sendStatusNotice(
  app: Recipient,
  kind: "waitlisted" | "rejected" | "cancelled",
  dedupeSuffix: string,
): Promise<SendOutcome> {
  return send(app, kind, `${kind}:${app.id}:${dedupeSuffix}`);
}

/**
 * Tarih/mekân bilgisi değiştiğinde onaylı katılımcıya bilgilendirme (davetiye QR'ı dahil).
 * dedupe: "event_update:<başvuru>:<bilgi sürümü>" → aynı sürüm için kişi başı tek e-posta.
 */
export function sendEventUpdate(app: Recipient, invitationId: string, version: string): Promise<SendOutcome> {
  return send(app, "event_update", `event_update:${app.id}:${version}`, invitationId);
}

/** Başarısız bir kaydı aynı dedupe anahtarıyla, güncel içerikle yeniden dener. */
export function retryLoggedEmail(app: Recipient, type: EmailType, dedupeKey: string, invitationId: string | null) {
  return send(app, type, dedupeKey, invitationId);
}
