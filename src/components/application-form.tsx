"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  applicationSchema,
  MOTIVATION_MAX,
  TOOLS_MAX,
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

/** Koyu zeminli başvuru formu (landing). */
function Field({
  label,
  required,
  hint,
  error,
  children,
  id,
  className = "",
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] text-white/85">
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-copper">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-fog">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-[#ff8d84]">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export interface FormCopy {
  fullName: string;
  email: string;
  phone: string;
  participantType: string;
  institution: string;
  tools: string;
  toolsPlaceholder: string;
  motivation: string;
  motivationPlaceholder: string;
  note: string;
}

export function ApplicationForm({
  kvkkApproved,
  copy,
  turnstileSiteKey,
}: {
  kvkkApproved: boolean;
  copy: FormCopy;
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
      setPhase({ kind: "error", message: "Güvenlik doğrulamasının tamamlanmasını bekleyip tekrar deneyin.", retryable: true });
      return;
    }
    let res: Response;
    try {
      res = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          participantType: data.participantType,
          institution: data.institution,
          tools: data.tools,
          motivation: data.motivation,
          kvkkAcknowledged: data.kvkkAcknowledged,
          marketingConsent: data.marketingConsent,
          website: data.website,
          turnstileToken,
        }),
      });
    } catch {
      setPhase({
        kind: "error",
        message: "Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar gönderin; girdiğiniz bilgiler korunuyor.",
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
      message: body.message || "Başvurunuz gönderilemedi. Lütfen tekrar deneyin.",
      retryable: !["duplicate", "closed"].includes(body.code ?? ""),
    });
    track("application_error", { reason: body.code ?? String(res.status) });
  };

  if (phase.kind === "success") {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="rounded-[4px] border border-white/12 bg-white/[0.03] p-8 outline-none sm:p-10">
        <div className="mb-6 h-px w-14 bg-copper" aria-hidden />
        <h3 className="headline text-3xl text-white">Başvurunuz başarıyla alındı.</h3>
        <p className="mt-4 max-w-xl leading-relaxed text-fog">
          Başvurunuz ekip tarafından değerlendirildikten sonra sonucu e-posta ile bildirilecek.
        </p>
        <p className="mt-6 max-w-xl rounded-[4px] border border-white/12 px-4 py-3 text-sm leading-relaxed text-white/90">
          Bu ekran başvurunuzun kabul edildiği anlamına gelmez. Katılımınız yalnızca onay e-postası ve QR kodlu davetiye
          ile kesinleşir.
        </p>
      </div>
    );
  }

  const ids = {
    fullName: `${uid}-adsoyad`,
    email: `${uid}-eposta`,
    phone: `${uid}-telefon`,
    participantType: `${uid}-durum`,
    institution: `${uid}-kurum`,
    tools: `${uid}-araclar`,
    motivation: `${uid}-motivasyon`,
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
        className="field-dark"
        aria-invalid={err ? true : undefined}
        aria-describedby={describedBy(ids[name], err, hint)}
        {...props}
        {...reg}
      />
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-describedby={`${uid}-zorunlu`}>
      <p id={`${uid}-zorunlu`} className="sr-only">
        Yıldızlı alanlar zorunludur.
      </p>

      <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
        <Field id={ids.fullName} label={copy.fullName} required error={errors.fullName?.message}>
          {input("fullName", register("fullName"), { autoComplete: "name", maxLength: 161, placeholder: "Adınız ve soyadınız" })}
        </Field>
        <Field id={ids.email} label={copy.email} required error={errors.email?.message}>
          {input("email", register("email"), {
            type: "email",
            autoComplete: "email",
            inputMode: "email",
            maxLength: 254,
            placeholder: "ornek@eposta.com",
          })}
        </Field>
        <Field id={ids.phone} label={copy.phone} required error={errors.phone?.message}>
          {input("phone", register("phone"), {
            type: "tel",
            autoComplete: "tel",
            inputMode: "tel",
            maxLength: 20,
            placeholder: "05XX XXX XX XX",
          })}
        </Field>
        <Field id={ids.participantType} label={copy.participantType} required error={errors.participantType?.message}>
          <select
            id={ids.participantType}
            className="field-dark field-select"
            defaultValue=""
            aria-invalid={errors.participantType ? true : undefined}
            aria-describedby={describedBy(ids.participantType, errors.participantType?.message)}
            {...register("participantType")}
          >
            <option value="" disabled>
              Seçiniz
            </option>
            {PARTICIPANT_TYPES.map((t) => (
              <option key={t} value={t}>
                {PARTICIPANT_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field id={ids.institution} label={copy.institution} required error={errors.institution?.message}>
          {input("institution", register("institution"), {
            autoComplete: "organization",
            maxLength: 160,
            placeholder: "Kurum veya okul adınız",
          })}
        </Field>
        <Field id={ids.tools} label={copy.tools} error={errors.tools?.message}>
          {input("tools", register("tools"), { maxLength: TOOLS_MAX, placeholder: copy.toolsPlaceholder })}
        </Field>
        <Field id={ids.motivation} label={copy.motivation} required error={errors.motivation?.message} className="sm:col-span-2">
          <textarea
            id={ids.motivation}
            rows={4}
            maxLength={MOTIVATION_MAX}
            placeholder={copy.motivationPlaceholder}
            className="field-dark resize-y"
            aria-invalid={errors.motivation ? true : undefined}
            aria-describedby={describedBy(ids.motivation, errors.motivation?.message)}
            {...register("motivation")}
          />
        </Field>
      </div>

      {/* Honeypot — ekran okuyuculardan ve klavyeden gizli */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Web sitesi
          <input type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>

      <div className="mt-6 space-y-3.5 text-[13px] leading-relaxed text-white/85">
        {!kvkkApproved && (
          <p className="rounded-[4px] border border-dashed border-copper/50 px-4 py-3 text-xs text-copper">
            Taslak: KVKK aydınlatma ve açık rıza metinleri hukuki onay sürecindedir; canlıya almadan önce onaylı metinlerle
            değiştirilmelidir.
          </p>
        )}
        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              id={ids.kvkk}
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-copper"
              aria-invalid={errors.kvkkAcknowledged ? true : undefined}
              aria-describedby={errors.kvkkAcknowledged ? `${ids.kvkk}-error` : undefined}
              {...register("kvkkAcknowledged")}
            />
            <span>
              <Link href="/kvkk" target="_blank" className="text-copper underline underline-offset-4">
                KVKK aydınlatma metnini
              </Link>{" "}
              okudum; başvurumun değerlendirilmesi için kişisel verilerimin bu metin kapsamında işleneceği konusunda
              bilgilendirildim. <span className="text-fog">(Zorunlu)</span>
            </span>
          </label>
          {errors.kvkkAcknowledged && (
            <p id={`${ids.kvkk}-error`} className="mt-1.5 pl-7 text-xs font-medium text-[#ff8d84]">
              {errors.kvkkAcknowledged.message}
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input id={ids.marketing} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-copper" {...register("marketingConsent")} />
          <span>
            ASUS&apos;un etkinlik, ürün ve kampanyalarıyla ilgili bana e-posta ve SMS ile ticari ileti göndermesine izin
            veriyorum. <span className="text-fog">(İsteğe bağlı — başvurunun değerlendirilmesini etkilemez.)</span>
          </span>
        </label>
      </div>

      {turnstileSiteKey && (
        <div className="mt-6">
          <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
        </div>
      )}

      {phase.kind === "error" && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="mt-6 rounded-[4px] border border-[#ff8d84]/40 bg-[#ff8d84]/10 px-4 py-3 outline-none">
          <p className="text-sm font-medium text-[#ffb3ad]">{phase.message}</p>
        </div>
      )}

      <button type="submit" className="btn-copper arrow-nudge mt-7 w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? "Gönderiliyor…" : phase.kind === "error" && phase.retryable ? "Tekrar gönder" : "Başvuruyu gönder"}
        {!isSubmitting && <ArrowRight />}
      </button>
      <p role={isSubmitting ? "status" : undefined} className="mt-3 text-xs leading-relaxed text-fog">
        {isSubmitting ? "Başvurunuz gönderiliyor, lütfen bekleyin." : copy.note}
      </p>
    </form>
  );
}
