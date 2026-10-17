import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getEventSettings } from "@/lib/event-settings";

export const metadata: Metadata = { title: "KVKK aydınlatma metni" };
export const revalidate = 60;

export default async function KvkkPage() {
  const s = await getEventSettings();
  return (
    <LegalPage
      title="KVKK aydınlatma metni"
      version={s.kvkk_notice_version}
      sections={[
        "Veri sorumlusunun kimliği ve iletişim bilgileri",
        "İşlenen kişisel veri kategorileri (kimlik, iletişim, mesleki bilgiler, başvuru yanıtları, etkinlik giriş kaydı)",
        "Kişisel verilerin işlenme amaçları (başvuru değerlendirme, davetiye gönderimi, etkinlik girişi)",
        "Hukuki sebepler",
        "Kişisel verilerin aktarıldığı alıcı grupları ve yurt dışı aktarım (barındırma ve e-posta hizmet sağlayıcıları dahil)",
        `Saklama süresi (sistemde yapılandırılan süre: ${s.retention_days} gün) ve imha yöntemi`,
        "İlgili kişinin KVKK madde 11 kapsamındaki hakları ve başvuru yöntemi",
      ]}
    />
  );
}
