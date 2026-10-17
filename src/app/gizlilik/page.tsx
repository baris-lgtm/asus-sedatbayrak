import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Gizlilik ve çerezler" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Gizlilik ve çerezler"
      version="TASLAK"
      sections={[
        "Zorunlu çerezler: yalnızca yetkili ekip girişinde oturum çerezi kullanılır; başvuru formu çerez gerektirmez.",
        "Analitik çerezler: yalnızca açık izin verilirse etkinleşir; izin tarayıcıdan silinerek geri alınabilir.",
        "Pazarlama iletişimi izni: başvurudan bağımsızdır, isteğe bağlıdır ve her zaman geri alınabilir.",
        "İletişim ve başvuru kanalları",
      ]}
    />
  );
}
