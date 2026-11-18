import type { Metadata } from "next";
import { publicQuestions } from "@/content/quiz";
import { loadQuizState } from "@/lib/server/quiz";
import { QuizShell } from "./quiz-shell";
import { QuizApp } from "./quiz-app";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Quiz", robots: { index: false, follow: false } };

export default async function QuizPage() {
  const state = await loadQuizState();
  return (
    <QuizShell active="quiz">
      <QuizApp
        initial={state}
        questions={state.kind === "in_progress" ? publicQuestions() : null}
        totalQuestions={publicQuestions().length}
      />
    </QuizShell>
  );
}
