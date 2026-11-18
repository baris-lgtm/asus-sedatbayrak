import type { Metadata } from "next";
import { loadLeaderboard } from "@/lib/server/quiz";
import { QuizShell } from "../quiz-shell";
import { LiveLeaderboard } from "./live-leaderboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quiz liderlik tablosu", robots: { index: false, follow: false } };

export default async function LeaderboardPage() {
  const data = await loadLeaderboard(100);
  return (
    <QuizShell active="liderlik">
      <LiveLeaderboard initial={{ ...data, updatedAt: new Date().toISOString() }} />
    </QuizShell>
  );
}
