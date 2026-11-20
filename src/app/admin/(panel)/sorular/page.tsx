import type { Metadata } from "next";
import QRCode from "qrcode";
import { requireStageStaffPage } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { listStageQuestions } from "@/app/admin/stage-actions";
import { StageBoard } from "./stage-board";

export const metadata: Metadata = { title: "Sahne soruları" };
export const dynamic = "force-dynamic";

export default async function StageQuestionsPage() {
  const staff = await requireStageStaffPage();
  const initial = await listStageQuestions();
  const url = `${siteUrl()}/soru`;
  // LED/sunum ekibi için yüksek çözünürlüklü QR (beyaz zemin, siyah kod; okunurluk için kenar boşluklu)
  const [qrSvg, qrPng] = await Promise.all([
    QRCode.toString(url, { type: "svg", errorCorrectionLevel: "Q", margin: 2 }),
    QRCode.toDataURL(url, { errorCorrectionLevel: "Q", margin: 2, width: 2048 }),
  ]);
  return (
    <StageBoard
      initial={initial}
      formUrl={url}
      qrSvgHref={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
      qrPngHref={qrPng}
      isAdmin={staff.role === "admin"}
    />
  );
}
