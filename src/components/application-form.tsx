"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  applicationSchema,
  MOTIVATION_MAX,
  type ApplicationData,
  type ApplicationInput,
  type FieldErrors,
} from "@/lib/validation/application";
import { PARTICIPANT_LABELS, PARTICIPANT_TYPES } from "@/lib/types";
import { track } from "@/components/analytics";
import { Turnstile } from "@/components/turnstile";
import { ArrowRight } from "@/components/brand";

type Phase =
  | { kind: "idle" }
  | { kind: "success" }
  | { kind: "error"; message: string; retryable: boolean };

function Field({
  label,
  hint,
  error,
  children,
  id,
}: {
  label: string;
  hint?: string;
  error?: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink/80">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-graphite">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-err">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function ApplicationForm({
  kvkkApproved,
  additionalQuestion,
  turnstileSiteKey,
}: {
  kvkkApproved: boolean;
  additionalQuestion: { id: string; label: string; maxLength: number } | null;
  turnstileSiteKey: string | null;
}) {
  const uid = useId();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const successRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationInput, unknown, ApplicationData>({
    resolver: zodResolver(applicationSchema),
    mode: "onTouched",
    defaultValues: { marketingConsent: false, website: "" },
  });

  useEffect(() => {
    if (phase.kind === "success") successRef.current?.focus();
    if (phase.kind === "error") errorRef.current?.focus();
  }, [phase]);

  const onSubmit = async (data: ApplicationData) => {
    setPhase({ kind: "idle" });
    if (turnstileSiteKey && !turnstileToken) {
      setPhase({ kind: "error", message: "Güvenlik doğrulamasının tamamlanmasını bekle ve tekrar dene.", retryable: true });
      return;
    }
    let res: Response;
    try {
      res = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, turnstileToken }),
      });
    } catch {
      setPhase({
        kind: "error",
        message: "Bağlantı kurulamadı. İnternet bağlantını kontrol edip tekrar gönder; girdiğin bilgiler korunuyor.",
        retryable: true,
      });
      track("application_error", { reason: "network" });
      return;
    }

    if (res.ok) {
      setPhase({ kind: "success" });
      track("application_submitted");
      return;
    }

    const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string; fieldErrors?: FieldErrors };
    if (body.fieldErrors) {
      for (const [field, message] of Object.entries(body.fieldErrors)) {
        if (message) setError(field as keyof ApplicationInput, { type: "server", message }, { shouldFocus: true });
      }
    }
    setPhase({
      kind: "error",
      message: body.message || "Başvurun gönderilemedi. Lütfen tekrar dene.",
      retryable: !["duplicate", "closed"].includes(body.code ?? ""),
    });
    track("application_error", { reason: body.code ?? String(res.status) });
  };

  if (phase.kind === "success") {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="rounded-[3px] border border-rule bg-surface p-8 outline-none sm:p-10">
        <div className="mb-6 h-px w-14 bg-blue" aria-hidden />
        <h3 className="display text-4xl">Başvurun başarıyla alındı.</h3>
        <p className="mt-4 max-w-xl leading-relaxed text-graphite">
          Başvurun ekip tarafından incelendikten sonra sonucunu e-posta yoluyla öğreneceksin.
        </p>
        <p className="mt-6 max-w-xl rounded-[3px] border border-rule bg-surface px-4 py-3 text-sm font-medium leading-relaxed">
          Bu ekran başvurunun kabul edildiği anlamına gelmez. Katılımın yalnızca onay e-postası ve QR kodlu davetiye ile
          kesinleşir.
        </p>
      </div>
    );
  }

  const ids = {
    firstName: `${uid}-ad`,
    lastName: `${uid}-soyad`,
    email: `${uid}-eposta`,
    phone: `${uid}-telefon`,
    participantType: `${uid}-durum`,
    institution: `${uid}-kurum`,
    department: `${uid}-bolum`,
    motivation: `${uid}-ek`,
    kvkk: `${uid}-kvkk`,
    marketing: `${uid}-pazarlama`,
  };

  const input = (
    name: keyof typeof ids,
    reg: UseFormRegisterReturn,
    props: React.InputHTMLAttributes<HTMLInputElement>,
    hint?: string,
  ) => {
    const err = errors[name as keyof ApplicationInput]?.message;
    return (
      <input
        id={ids[name]}
        className="field-input"
        aria-invalid={err ? true : undefined}
        aria-describedby={describedBy(ids[name], err, hint)}
        {...props}
        {...reg}
      />
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-describedby={`${uid}-zorunlu`}>
      <p id={`${uid}-zorunlu`} className="mb-6 text-xs text-graphite">
        Ek soru ve pazarlama izni dışındaki tüm alanlar zorunludur.
      </p>

      <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
        <Field id={ids.firstName} label="Ad" error={errors.firstName?.message}>
          {input("firstName", register("firstName"), { autoComplete: "given-name", maxLength: 80 })}
        </Field>
        <Field id={ids.lastName} label="Soyad" error={errors.lastName?.message}>
          {input("lastName", register("lastName"), { autoComplete: "family-name", maxLength: 80 })}
        </Field>
        <Field id={ids.email} label="E-posta" error={errors.email?.message} hint="Başvuru sonucun ve davetiyen bu adrese gönderilir.">
          {input(
            "email",
            register("email"),
            { type: "email", autoComplete: "email", inputMode: "email", maxLength: 254 },
            "Başvuru sonucun ve davetiyen bu adrese gönderilir.",
          )}
        </Field>
        <Field id={ids.phone} label="Telefon" error={errors.phone?.message} hint="Ör. 0555 111 22 33">
          {input("phone", register("phone"), { type: "tel", autoComplete: "tel", inputMode: "tel", maxLength: 20 }, "Ör. 0555 111 22 33")}
        </Field>

        <fieldset className="sm:col-span-2" aria-describedby={errors.participantType ? `${ids.participantType}-error` : undefined}>
          <legend className="text-[13px] font-medium text-ink/80">Meslek veya öğrenci durumu</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {PARTICIPANT_TYPES.map((t) => (
              <label key={t} className="cursor-pointer">
                <input type="radio" value={t} className="peer sr-only" {...register("participantType")} />
                <span className="inline-flex min-h-11 items-center rounded-[6px] border border-rule bg-surface px-4 text-sm transition-colors hover:border-[#cbc4b8] peer-checked:border-blue peer-checked:bg-blue peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue">
                  {PARTICIPANT_LABELS[t]}
                </span>
              </label>
            ))}
          </div>
          {errors.participantType && (
            <p id={`${ids.participantType}-error`} className="mt-1.5 text-xs font-medium text-err">
              {errors.participantType.message}
            </p>
          )}
        </fieldset>

        <Field id={ids.institution} label="Kurum / üniversite" error={errors.institution?.message} hint="Serbest çalışıyorsan “Serbest” yazabilirsin.">
          {input("institution", register("institution"), { autoComplete: "organization", maxLength: 160 }, "Serbest çalışıyorsan “Serbest” yazabilirsin.")}
        </Field>
        <Field id={ids.department} label="Bölüm / uzmanlık alanı" error={errors.department?.message}>
          {input("department", register("department"), { maxLength: 160 })}
        </Field>

        {additionalQuestion && (
          <div className="sm:col-span-2">
            <label htmlFor={ids.motivation} className="mb-1.5 block text-[13px] font-medium text-ink/80">
              {additionalQuestion.label}
            </label>
            <textarea
              id={ids.motivation}
              rows={4}
              maxLength={MOTIVATION_MAX}
              className="field-input resize-y"
              aria-invalid={errors.motivation ? true : undefined}
              aria-describedby={errors.motivation ? `${ids.motivation}-error` : undefined}
              {...register("motivation")}
            />
            {errors.motivation && (
              <p id={`${ids.motivation}-error`} className="mt-1.5 text-xs font-medium text-err">
                {errors.motivation.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Honeypot — ekran okuyuculardan ve klavyeden gizli */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Web sitesi
          <input type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>

      <div className="mt-8 space-y-4 border-t border-rule pt-6 text-sm">
        {!kvkkApproved && (
          <p className="rounded-[3px] border border-dashed border-warn/60 bg-amber-50/60 px-4 py-3 text-xs leading-relaxed text-warn">
            Taslak: KVKK aydınlatma ve açık rıza metinleri hukuki onay sürecindedir; canlıya almadan önce onaylı metinlerle
            değiştirilmelidir.
          </p>
        )}

        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              id={ids.kvkk}
              type="checkbox"
              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-blue"
              aria-invalid={errors.kvkkAcknowledged ? true : undefined}
              aria-describedby={errors.kvkkAcknowledged ? `${ids.kvkk}-error` : undefined}
              {...register("kvkkAcknowledged")}
            />
            <span className="leading-relaxed">
              <Link href="/kvkk" target="_blank" className="font-medium text-blue underline underline-offset-4">
                KVKK aydınlatma metnini
              </Link>{" "}
              okudum; başvurumun değerlendirilmesi için kişisel verilerimin bu metin kapsamında işleneceği konusunda
              bilgilendirildim. <span className="text-graphite">(Zorunlu)</span>
            </span>
          </label>
          {errors.kvkkAcknowledged && (
            <p id={`${ids.kvkk}-error`} className="mt-1.5 pl-[30px] text-xs font-medium text-err">
              {errors.kvkkAcknowledged.message}
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input id={ids.marketing} type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-blue" {...register("marketingConsent")} />
          <span className="leading-relaxed">
            ASUS&apos;un etkinlik, ürün ve kampanyalarıyla ilgili bana e-posta ve SMS ile ticari ileti göndermesine izin
            veriyorum. <span className="text-graphite">(İsteğe bağlı — başvurunun değerlendirilmesini etkilemez.)</span>
          </span>
        </label>
      </div>

      {turnstileSiteKey && (
        <div className="mt-6">
          <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
        </div>
      )}

      {phase.kind === "error" && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="mt-6 rounded-[3px] border border-err/30 bg-red-50 px-4 py-3 outline-none">
          <p className="text-sm font-medium text-err">{phase.message}</p>
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary arrow-nudge w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Gönderiliyor…" : phase.kind === "error" && phase.retryable ? "Tekrar gönder" : "Başvuruyu gönder"}
          {!isSubmitting && <ArrowRight />}
        </button>
        {isSubmitting ? (
          <span role="status" className="text-xs text-graphite">
            Başvurun gönderiliyor, lütfen bekle.
          </span>
        ) : (
          <span className="text-xs text-graphite">Başvurular değerlendirilerek katılım onayı e-posta ile iletilecek.</span>
        )}
      </div>
    </form>
  );
}
