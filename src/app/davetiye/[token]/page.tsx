import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEnv, siteUrl } from "@/lib/env";
import { getEventSettings } from "@/lib/event-settings";
import { formatEventDate, formatEventTimeRange } from "@/lib/format";
import { deriveManualCode, formatManualCode, invitationUrl, isWellFormedToken, sha256Hex } from "@/lib/server/invitation-token";
import { clientIp, hashKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Davetiye", robots: { index: false, follow: false } };

/**
 * Katılımcının davetiye sayfası (QR'ı kaybedenler için). URL'deki token
 * tahmin edilemez (256 bit); DB'de yalnızca hash'i aranır. Sayfada yalnızca
 * katılımcının adı gösterilir — e-posta/telefon gösterilmez.
 */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isWellFormedToken(token)) notFound();
  if (!(await rateLimit(hashKey("invite-view", await clientIp()), 60, 60))) {
    return <Message title="Çok fazla istek" body="Lütfen bir dakika sonra tekrar dene." />;
  }

  const { data: inv } = await createAdminClient()
    .from("invitations")
    .select("id, revoked_at, checked_in_at, applications!inner(first_name, status)")
    .eq("qr_token_hash", sha256Hex(token))
    .maybeSingle<{
      id: string;
      revoked_at: string | null;
      checked_in_at: string | null;
      applications: { first_name: string; status: string };
    }>();
  if (!inv) notFound();

  if (inv.revoked_at || inv.applications.status === "cancelled") {
    return <Message title="Bu davetiye geçerli değil" body="Davetiye iptal edilmiş veya yenisiyle değiştirilmiş. Güncel davetiyen için e-postanı kontrol et." />;
  }

  const settings = await getEventSettings();
  const date = formatEventDate(settings);
  const time = formatEventTimeRange(settings);
  const url = invitationUrl(siteUrl(), token);
  const qr = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  const code = formatManualCode(deriveManualCode(inv.id, requireEnv("INVITATION_TOKEN_SECRET")));

  return (
    <main id="icerik" className="min-h-dvh bg-ink px-4 py-10 text-paper">
      <div className="mx-auto max-w-md">
        <p className="condensed text-lg font-bold">{settings.event_name}</p>
        <h1 className="display mt-6 text-5xl">Davetiye</h1>
        <p className="mt-3 text-lg">{inv.applications.first_name}, girişte bu QR kodu okut.</p>

        <div className="mt-8 bg-paper p-6 text-ink">
          {inv.checked_in_at ? (
            <p className="py-10 text-center text-xl font-bold">Bu davetiyeyle giriş yapıldı.</p>
          ) : (
            <>
              <div className="mx-auto w-full max-w-[280px]" role="img" aria-label="Giriş QR kodu" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="mt-5 text-center text-sm text-graphite">QR okutulamazsa giriş kodun</p>
              <p className="text-center font-mono text-2xl font-bold tracking-widest">{code}</p>
            </>
          )}
        </div>

        <dl className="mt-8 space-y-3">
          <div>
            <dt className="text-sm text-neutral-400">Tarih</dt>
            <dd className="font-semibold">{date ? `${date}${time ? `, ${time}` : ""}` : "Kesinleştiğinde e-postayla bildirilecek"}</dd>
          </div>
          <div>
            <dt className="text-sm text-neutral-400">Mekân</dt>
            <dd className="font-semibold">
              {settings.venue_confirmed && settings.venue_name ? `${settings.venue_name}${settings.venue_address ? `, ${settings.venue_address}` : ""}` : "Kesinleştiğinde e-postayla bildirilecek"}
            </dd>
          </div>
        </dl>
        <p className="mt-8 text-sm text-neutral-400">Bu davetiye kişiye özeldir ve tek girişliktir. Bağlantıyı başkalarıyla paylaşma.</p>
      </div>
    </main>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main id="icerik" className="grid min-h-dvh place-items-center bg-ink px-4 text-paper">
      <div className="max-w-md">
        <h1 className="display text-4xl">{title}</h1>
        <p className="mt-4 text-lg text-neutral-300">{body}</p>
      </div>
    </main>
  );
}
