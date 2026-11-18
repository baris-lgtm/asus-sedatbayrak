import { describe, expect, it } from "vitest";
import { formatDuration, maskName, normalizeQuizName } from "@/lib/quiz-format";
import { publicQuestions, quizQuestions } from "@/content/quiz";
import { attemptToken, scoreAnswers, verifyAttemptToken } from "@/lib/server/quiz";

describe("quiz", () => {
  it("adları maskeler ve normalleştirir", () => {
    expect(maskName("Ömer Faruk yılmaz")).toBe("Ömer Faruk Y.");
    expect(maskName("Sedat Bayrak")).toBe("Sedat B.");
    expect(normalizeQuizName("  Ayşe   Yılmaz ")).toBe("Ayşe Yılmaz");
    expect(normalizeQuizName("Ayşe")).toBeNull();
    expect(normalizeQuizName("<script> x")).toBeNull();
  });

  it("süreyi biçimlendirir", () => {
    expect(formatDuration(83_450)).toBe("1:23,4");
    expect(formatDuration(5_000)).toBe("0:05,0");
  });

  it("cevaplar istemciye gitmez, puanlama sunucuda yapılır", () => {
    expect(quizQuestions).toHaveLength(26);
    expect(new Set(quizQuestions.map((q) => q.id)).size).toBe(26);
    for (const q of publicQuestions()) expect(q).not.toHaveProperty("answer");
    const perfect = quizQuestions.map((q) => q.answer);
    expect(scoreAnswers(perfect)?.correct).toBe(26);
    const blank = quizQuestions.map(() => null);
    expect(scoreAnswers(blank)?.correct).toBe(0);
    expect(scoreAnswers([1, 2])).toBeNull();
    expect(scoreAnswers(quizQuestions.map(() => 7))).toBeNull();
  });

  it("deneme token'ı imzalı", () => {
    process.env.INVITATION_TOKEN_SECRET ||= "x".repeat(40);
    const id = "3f2b8c1e-2a4d-4e6f-8a1b-9c0d1e2f3a4b";
    const t = attemptToken(id);
    expect(verifyAttemptToken(t)).toBe(id);
    expect(verifyAttemptToken(t.slice(0, -2) + "aa")).toBeNull();
    expect(verifyAttemptToken(`${id}.`)).toBeNull();
    expect(verifyAttemptToken("başka")).toBeNull();
  });
});
