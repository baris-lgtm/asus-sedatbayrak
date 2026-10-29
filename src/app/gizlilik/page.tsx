import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { privacyPolicy } from "@/content/legal";

export const metadata: Metadata = { title: "Gizlilik Politikası" };

export default function PrivacyPage() {
  return (
    <LegalPage
      doc={privacyPolicy}
      related={{ href: "/kvkk", label: "Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni" }}
    />
  );
}
