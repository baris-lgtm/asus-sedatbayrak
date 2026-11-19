import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { BulkRegret } from "./bulk-regret";

export const metadata: Metadata = { title: "Katılamayanlar" };
export const maxDuration = 60;

export default async function BulkRegretPage() {
  const admin = await requireAdminPage();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Katılamayanlara bilgilendirme</h1>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          Onaylanmamış başvuruları <b>reddedildi</b> yapar ve “Başvurunuz için teşekkür ederiz” e-postasını (ProArt %10 indirim) gönderir.
          Onaylı ve giriş yapmış kişilere <b>hiç dokunulmaz</b>. Daha önce reddedilmiş ama bu e-postayı almamış kişilere yalnızca
          e-posta gider. Her kişiye en fazla bir kez gönderilir; işlemi parça parça, istediğin kadar tekrar çalıştırabilirsin.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          Katılımcıların yanıtları (indirim kodu talepleri) gönderici e-postasındaki yanıt adresine gelir.
        </p>
      </div>
      <BulkRegret defaultTestEmail={admin.email ?? ""} />
    </div>
  );
}
