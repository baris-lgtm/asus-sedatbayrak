"use client";

import { useRef, useState } from "react";
import { ArrowRight } from "@/components/brand";
import { STAGE_NAME_MAX, STAGE_QUESTION_MAX } from "@/lib/validation/stage-question";

export function StageQuestionForm() {
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 3) {
      setError("Lütfen sorunuzu yazın.");
      questionRef.current?.focus();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/stage-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, question, website: honeypot.current?.value ?? "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message || "Sorunuz gönderilemedi. Lütfen tekrar deneyin.");
        return;
      }
      setSent(true);
      setQuestion("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Bağlantı kurulamadı. İnternetinizi kontrol edip tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="rounded-[4px] border border-copper/50 bg-copper/10 p-7 sm:p-9">
        <p className="headline text-[1.75rem] leading-tight sm:text-4xl">Sorunuz bize ulaştı. Teşekkür ederiz!</p>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            requestAnimationFrame(() => questionRef.current?.focus());
          }}
          className="btn-ghost-light arrow-nudge mt-7"
        >
          Yeni soru gönder
          <ArrowRight />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <div>
        <label htmlFor="soru-ad" className="flex items-baseline justify-between text-sm font-medium">
          <span>Adınız</span>
          <span className="text-xs font-normal text-white/45">isteğe bağlı</span>
        </label>
        <input
          id="soru-ad"
          name="name"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={STAGE_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field-dark mt-2 !min-h-12 !text-base"
          placeholder="Adınız"
        />
      </div>
      <div>
        <label htmlFor="soru-metin" className="flex items-baseline justify-between text-sm font-medium">
          <span>Sorunuz</span>
          <span className="text-xs font-normal text-white/45">zorunlu</span>
        </label>
        <textarea
          id="soru-metin"
          ref={questionRef}
          name="question"
          required
          rows={5}
          maxLength={STAGE_QUESTION_MAX}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby="soru-sayac"
          className="field-dark mt-2 !min-h-36 resize-y !text-base leading-relaxed"
          placeholder="Konuşmacılara sormak istediğiniz soru"
        />
        <p id="soru-sayac" className="mt-1.5 text-right text-xs tabular-nums text-white/40">
          {question.length}/{STAGE_QUESTION_MAX}
        </p>
      </div>
      {/* Bot tuzağı: insanlar görmez */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Web sitesi
          <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#ff8d84]">
          {error}
        </p>
      )}
      <div>
        <button type="submit" disabled={pending} className="btn-copper arrow-nudge w-full !min-h-12 sm:w-auto sm:min-w-60">
          {pending ? "Gönderiliyor…" : "Sorumu Gönder"}
          <ArrowRight />
        </button>
        <p className="mt-3 text-xs leading-relaxed text-white/45">
          Adınızı yazarsanız sorunuz sahnede adınızla okunabilir.
        </p>
      </div>
    </form>
  );
}
