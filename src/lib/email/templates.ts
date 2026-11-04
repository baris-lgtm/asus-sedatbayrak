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
Bu e-postayı ${escapeHtml(opts.eventName)} başvurunuz nedeniyle aldınız. Kişisel verileriniz KVKK Aydınlatma Metni kapsamında işlenir.
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
  const title = "Başvurunuz alındı";
  const lines = [
    `Merhaba ${firstName},`,
    `${s.event_name} etkinliği için başvurunuz bize ulaştı. İlginiz için teşekkür ederiz.`,
    "Başvurular meslek dağılımı ve başvuru sırasına göre değerlendirilir. Değerlendirme sonucu, bu e-posta adresine iletilecektir; katılımınız onaylanırsa etkinlik adresi ve kişisel QR kodlu davetiyeniz de aynı e-postayla gönderilecektir.",
    "Bu e-posta yalnızca başvurunuzun alındığını bildirir; katılımınız onay e-postasıyla kesinleşir.",
  ];
  return {
    subject: `${s.event_name} — Başvurunuz alındı`,
    html: layout({
      preheader: "Başvurunuz alındı. Değerlendirme sonucu e-posta ile iletilecektir.",
      title,
      eventName: s.event_name,
      bodyHtml: lines.map((l) => p(escapeHtml(l))).join("") + p("Saygılarımızla,<br>ASUS Türkiye"),
    }),
    text: [...lines, "Saygılarımızla,\nASUS Türkiye"].join("\n\n"),
  };
}

export function invitationEmail(opts: {
  firstName: string;
  settings: EventSettings;
  invitationUrl: string;
  manualCode: string;
  qrContentId: string;
  /** initial: onay · resend: tekrar gönderim · update: tarih/mekân bilgisi güncellendi · reminder: hatırlatma */
  mode: "initial" | "resend" | "update" | "reminder";
}): EmailContent {
  const { firstName, settings: s, invitationUrl, manualCode, qrContentId, mode } = opts;
  const details = eventDetails(s);
  const title = {
    initial: "Katılımınız onaylandı!",
    resend: "Davetiyeniz",
    update: "Etkinlik bilgileri güncellendi",
    reminder: "Etkinlik yaklaşıyor!",
  }[mode];
  const intro = {
    initial: `${s.event_name} etkinliğine katılımınız onaylandı. Sizi aramızda görmekten mutluluk duyacağız!`,
    resend: "Talebiniz üzerine davetiyenizi yeniden gönderiyoruz. QR kodunuz ve giriş kodunuz değişmedi.",
    update: `${s.event_name} etkinliğine ait güncel bilgiler aşağıda yer alıyor. Davetiyeniz ve QR kodunuz değişmedi; girişte aynı kodu kullanabilirsiniz.`,
    reminder: `${s.event_name} etkinliği yaklaşıyor. Sizi aramızda görmekten mutluluk duyacağız!`,
  }[mode];
  const lead = "Etkinlik girişinde kullanabileceğiniz kişisel QR kodunuz ve etkinlik detayları aşağıda yer alıyor.";
  const codeLabel = "QR kodunuzun okunamaması durumunda kullanabileceğiniz giriş kodu:";
  const personal = "Davetiyeniz size özeldir ve tek giriş hakkı sağlar. Lütfen QR kodunuzu ve giriş kodunuzu başkalarıyla paylaşmayın.";
  const cancel =
    "Etkinliğe katılım sağlayamayacak olmanız durumunda, bu e-postayı yanıtlayarak bizi bilgilendirmenizi rica ederiz. Böylece kontenjanınızı yedek listede bekleyen bir katılımcıya sunabiliriz.";

  const html = layout({
    preheader: "Kişisel QR kodunuz ve etkinlik detayları bu e-postada.",
    title,
    eventName: s.event_name,
    bodyHtml: `${p(`Merhaba ${escapeHtml(firstName)},`)}${p(escapeHtml(intro))}${p(escapeHtml(lead))}
${details.html}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;">
<tr><td align="center" style="padding:24px;border:2px solid ${INK};">
<img src="cid:${qrContentId}" width="240" height="240" alt="Giriş QR kodu" style="display:block;width:240px;height:240px;margin:0 auto 16px;">
<div style="font-size:13px;color:${GRAPHITE};margin-bottom:4px;">${escapeHtml(codeLabel)}</div>
<div style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:700;letter-spacing:0.08em;">${escapeHtml(manualCode)}</div>
</td></tr></table>
${p(`QR kodunuzu görüntüleyemiyorsanız <a href="${escapeHtml(invitationUrl)}" style="color:${BLUE};">“Davetiyemi aç”</a> bağlantısından kişisel davetiyenize ulaşabilirsiniz.`)}
${p(escapeHtml(personal))}
${p(escapeHtml(cancel))}
${p("Etkinlikte görüşmek üzere!<br>ASUS Türkiye")}`,
  });
  const text = [
    `Merhaba ${firstName},`,
    intro,
    lead,
    details.text,
    `${codeLabel}\n${manualCode}`,
    `QR kodunuzu görüntüleyemiyorsanız “Davetiyemi aç” bağlantısından kişisel davetiyenize ulaşabilirsiniz: ${invitationUrl}`,
    personal,
    cancel,
    "Etkinlikte görüşmek üzere!\nASUS Türkiye",
  ].join("\n\n");
  const subject = {
    initial: `${s.event_name} — Katılımınız onaylandı`,
    resend: `${s.event_name} — Davetiyeniz`,
    update: `${s.event_name} — Güncel etkinlik bilgileri`,
    reminder: `${s.event_name} — Hatırlatma: davetiyeniz`,
  }[mode];
  return { subject, html, text };
}

export function statusEmail(kind: "waitlisted" | "rejected" | "cancelled", firstName: string, s: EventSettings): EmailContent {
  const copy = {
    waitlisted: {
      subject: `${s.event_name} — Yedek listedesiniz`,
      title: "Yedek listeye alındınız",
      body: "Etkinlik kontenjanı şu an dolu olduğu için başvurunuzu yedek listeye aldık. Yer açılması durumunda sizi e-posta ile bilgilendireceğiz. Bu aşamada katılımınız kesinleşmiş değildir; lütfen onay e-postası almadan etkinlik alanına gelmeyiniz.",
    },
    rejected: {
      subject: `${s.event_name} — Başvurunuz hakkında`,
      title: "Başvurunuz hakkında",
      body: "Başvurunuzu dikkatle inceledik. Sınırlı kontenjan nedeniyle bu etkinlik için size yer ayıramıyoruz. Gösterdiğiniz ilgi için teşekkür eder, gelecek etkinliklerimizde görüşmeyi dileriz.",
    },
    cancelled: {
      subject: `${s.event_name} — Katılımınız iptal edildi`,
      title: "Katılımınız iptal edildi",
      body: "Etkinlik katılımınız iptal edildi ve daha önce gönderilen davetiye artık geçerli değildir. Bunun bir hata olduğunu düşünüyorsanız bu e-postayı yanıtlayarak bize ulaşabilirsiniz.",
    },
  }[kind];
  return {
    subject: copy.subject,
    html: layout({
      preheader: copy.title,
      title: copy.title,
      eventName: s.event_name,
      bodyHtml: p(`Merhaba ${escapeHtml(firstName)},`) + p(escapeHtml(copy.body)) + p("Saygılarımızla,<br>ASUS Türkiye"),
    }),
    text: `Merhaba ${firstName},\n\n${copy.body}\n\nSaygılarımızla,\nASUS Türkiye`,
  };
}
