import type { Metadata } from "next";
import QRCode from "qrcode";
import { siteUrl } from "@/lib/env";
import { loadLeaderboard } from "@/lib/server/quiz";
import { QuizShell } from "../quiz-shell";
import { LiveLeaderboard } from "./live-leaderboard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quiz liderlik tablosu", robots: { index: false, follow: false } };

export default async function LeaderboardPage() {
  const data = await loadLeaderboard(100);
  const quizUrl = `${siteUrl()}/quiz`;
  const qr = await QRCode.toString(quizUrl, { type: "svg", errorCorrectionLevel: "M", margin: 0, color: { dark: "#efe9e0", light: "#00000000" } });
  return (
    <QuizShell active="liderlik">
      <LiveLeaderboard initial={{ ...data, updatedAt: new Date().toISOString() }} qrSvg={qr} quizUrl={quizUrl.replace(/^https?:\/\//, "")} />
    </QuizShell>
  );
}
