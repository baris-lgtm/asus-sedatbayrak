import type { Metadata } from "next";
import { requireStageStaffPage } from "@/lib/auth";
import { listStageQuestions } from "@/app/admin/stage-actions";
import { ModeratorView } from "./moderator-view";

export const metadata: Metadata = { title: "Moderatör ekranı" };
export const dynamic = "force-dynamic";

export default async function ModeratorPage() {
  await requireStageStaffPage();
  return <ModeratorView initial={await listStageQuestions()} />;
}
