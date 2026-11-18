import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { BulkApprove } from "./bulk-approve";

export const metadata: Metadata = { title: "Toplu onay" };
export const maxDuration = 60;

export default async function BulkApprovePage() {
  await requireAdminPage();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Toplu onay ve davetiye</h1>
        <p className="mt-2 text-sm leading-relaxed text-graphite">
          Excel&apos;den e-posta sütununu kopyalayıp aşağıya yapıştır. Önce kaç kişinin onaylanacağını gösteririz; sen
          onaylayınca başvurular onaylanır ve her birine QR kodlu davetiye e-postası gider. Daha önce onaylanmış ve
          davetiyesi gitmiş kişilere tekrar e-posta gitmez; işlem yarıda kalırsa aynı listeyle tekrar başlatman güvenlidir.
        </p>
      </div>
      <BulkApprove />
    </div>
  );
}
