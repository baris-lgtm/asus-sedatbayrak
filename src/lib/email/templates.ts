/**
 * Türkçe, responsive e-posta şablonları (tablo tabanlı, e-posta istemcisi uyumlu).
 * Kullanıcı girdileri her zaman HTML-escape edilir.
 * Tarih/mekân kesinleşmediyse KESİN bilgi yazılmaz.
 */
import { formatEventDate, formatEventTimeRange } from "@/lib/format";
import type { EventSettings } from "@/lib/types";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const INK = "#000000";
const BLUE = "#1F44FF";
const GRAPHITE = "#4A4A4A";
const RULE = "#DADADA";

function layout(opts: { preheader: string; title: string; bodyHtml: string; eventName: string }): string {
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#F2F2F2;">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F2F2;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;">
<tr><td style="background:${INK};padding:28px 32px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:1.15;font-weight:700;color:#FFFFFF;letter-spacing:-0.01em;">${escapeHtml(opts.eventName)}</div>
</td></tr>
<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:${INK};">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:700;">${escapeHtml(opts.title)}</h1>
${opts.bodyHtml}
</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid ${RULE};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${GRAPHITE};">
Bu e-postayı ${escapeHtml(opts.eventName)} başvurun nedeniyle aldın. Kişisel verilerin KVKK aydınlatma metni kapsamında işlenir.
</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 16px;">${html}</p>`;

function eventDetails(s: EventSettings): { html: string; text: string } {
  const date = formatEventDate(s);
  const time = formatEventTimeRange(s);
  const venue = s.venue_confirmed && s.venue_name ? `${s.venue_name}${s.venue_address ? `, ${s.venue_address}` : ""}` : null;
  const rows: [string, string][] = [
    ["Tarih", date ?? "Kesinleştiğinde e-posta ile bildirilecek"],
    ["Saat", time ?? "Kesinleştiğinde e-posta ile bildirilecek"],
    ["Mekân", venue ?? "Kesinleştiğinde e-posta ile bildirilecek"],
  ];
  const html = `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;border-top:1px solid ${RULE};">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid ${RULE};font-size:14px;color:${GRAPHITE};width:80px;vertical-align:top;">${k}</td><td style="padding:10px 0;border-bottom:1px solid ${RULE};font-size:15px;">${escapeHtml(v)}</td></tr>`,
  )
  .join("")}
</table>`;
  return { html, text: rows.map(([k, v]) => `${k}: ${v}`).join("\n") };
}

export function applicationReceivedEmail(firstName: string, s: EventSettings): EmailContent {
  const title = "Başvurun alındı";
  const lines = [
    `Merhaba ${firstName},`,
    `${s.event_name} için başvurun bize ulaştı.`,
    "Başvurun ekip tarafından incelenecek ve sonucu bu e-posta adresine bildirilecek. Bu e-posta başvurunun kabul edildiği anlamına gelmez; katılımın yalnızca onay e-postası ve QR kodlu davetiye ile kesinleşir.",
  ];
  return {
    subject: `${s.event_name} — başvurun alındı`,
    html: layout({
      preheader: "Başvurun incelemeye alındı. Sonucu e-postayla bildireceğiz.",
      title,
      eventName: s.event_name,
      bodyHtml: lines.map((l) => p(escapeHtml(l))).join(""),
    }),
    text: lines.join("\n\n"),
  };
}

export function invitationEmail(opts: {
  firstName: string;
  settings: EventSettings;
  invitationUrl: string;
  manualCode: string;
  qrContentId: string;
  /** initial: onay · resend: tekrar gönderim · update: tarih/mekân bilgisi güncellendi */
  mode: "initial" | "resend" | "update";
}): EmailContent {
  const { firstName, settings: s, invitationUrl, manualCode, qrContentId, mode } = opts;
  const details = eventDetails(s);
  const title = { initial: "Başvurun onaylandı", resend: "Davetiyen (yeniden gönderim)", update: "Etkinlik bilgileri güncellendi" }[mode];
  const intro = {
    initial: `${s.event_name} için başvurun onaylandı. Katılımın kesinleşti; aşağıdaki QR kod senin kişisel davetiyendir.`,
    resend: "İsteğin üzerine davetiyeni yeniden gönderiyoruz. QR kodun ve giriş kodun değişmedi.",
    update: `${s.event_name} için güncel tarih ve mekân bilgileri aşağıda. Davetiyen ve QR kodun değişmedi; girişte aynı kodu okutman yeterli.`,
  }[mode];
  const html = layout({
    preheader: "QR kodlu davetiyen ekte. Girişte bu kodu okutman yeterli.",
    title,
    eventName: s.event_name,
    bodyHtml: `${p(`Merhaba ${escapeHtml(firstName)},`)}${p(escapeHtml(intro))}
${details.html}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;">
<tr><td align="center" style="padding:24px;border:2px solid ${INK};">
<img src="cid:${qrContentId}" width="240" height="240" alt="Giriş QR kodu" style="display:block;width:240px;height:240px;margin:0 auto 16px;">
<div style="font-size:13px;color:${GRAPHITE};margin-bottom:4px;">QR okutulamazsa giriş kodun</div>
<div style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:700;letter-spacing:0.08em;">${escapeHtml(manualCode)}</div>
</td></tr></table>
${p(`QR kodu görünmüyorsa davetiyeni buradan açabilirsin: <a href="${escapeHtml(invitationUrl)}" style="color:${BLUE};">Davetiyemi aç</a>`)}
${p("Bu davetiye kişiye özeldir ve yalnızca bir kez giriş için kullanılabilir. Lütfen başkalarıyla paylaşma.")}
${p("Katılamayacaksan bu e-postayı yanıtlayarak bize haber ver; yerin yedek listedeki bir katılımcıya verilebilsin.")}`,
  });
  const text = [
    `Merhaba ${firstName},`,
    intro,
    details.text,
    `Davetiyen: ${invitationUrl}`,
    `Giriş kodun (QR okutulamazsa): ${manualCode}`,
    "Bu davetiye kişiye özeldir ve yalnızca bir kez giriş için kullanılabilir.",
  ].join("\n\n");
  const subject = mode === "update" ? `${s.event_name} — tarih ve mekân bilgisi` : `${s.event_name} — davetiyen`;
  return { subject, html, text };
}

export function statusEmail(kind: "waitlisted" | "rejected" | "cancelled", firstName: string, s: EventSettings): EmailContent {
  const copy = {
    waitlisted: {
      subject: `${s.event_name} — yedek listedesin`,
      title: "Yedek listeye alındın",
      body: "Workshop kapasitesi şu an dolu olduğu için başvurunu yedek listeye aldık. Yer açılırsa seni e-postayla bilgilendireceğiz. Bu aşamada katılımın kesinleşmiş değildir; lütfen onay e-postası almadan etkinlik alanına gelme.",
    },
    rejected: {
      subject: `${s.event_name} — başvurunla ilgili`,
      title: "Başvurun hakkında",
      body: "Başvurunu dikkatle inceledik. Sınırlı kapasite nedeniyle bu workshop için sana yer ayıramıyoruz. İlgin için teşekkür ederiz.",
    },
    cancelled: {
      subject: `${s.event_name} — katılımın iptal edildi`,
      title: "Katılımın iptal edildi",
      body: "Workshop katılımın iptal edildi ve daha önce gönderilen davetiye artık geçerli değil. Bunun bir hata olduğunu düşünüyorsan bu e-postayı yanıtlayarak bize ulaşabilirsin.",
    },
  }[kind];
  return {
    subject: copy.subject,
    html: layout({
      preheader: copy.title,
      title: copy.title,
      eventName: s.event_name,
      bodyHtml: p(`Merhaba ${escapeHtml(firstName)},`) + p(escapeHtml(copy.body)),
    }),
    text: `Merhaba ${firstName},\n\n${copy.body}`,
  };
}
