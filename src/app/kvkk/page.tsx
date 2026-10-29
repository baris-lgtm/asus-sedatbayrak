import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { getEventSettings } from "@/lib/event-settings";
import { kvkkNotice } from "@/content/legal";

export const metadata: Metadata = { title: "KVKK Aydınlatma Metni" };
export const revalidate = 60;

export default async function KvkkPage() {
  const s = await getEventSettings();
  return (
    <LegalPage doc={kvkkNotice} version={s.kvkk_notice_version} related={{ href: "/gizlilik", label: "Gizlilik Politikası" }} />
  );
}
