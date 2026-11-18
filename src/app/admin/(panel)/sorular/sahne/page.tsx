import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { listStageQuestions } from "@/app/admin/stage-actions";
import { ModeratorView } from "./moderator-view";

export const metadata: Metadata = { title: "Moderatör ekranı" };
export const dynamic = "force-dynamic";

export default async function ModeratorPage() {
  await requireAdminPage();
  return <ModeratorView initial={await listStageQuestions()} />;
}
