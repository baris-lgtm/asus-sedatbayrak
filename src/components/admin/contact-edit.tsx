"use client";

import { useActionState, useState } from "react";
import { updateContactAction, type ActionState } from "@/app/admin/actions";
import { useActionLock } from "./action-form";

/** Yanlış girilmiş ad / e-posta / telefonu düzeltir; istenirse son e-postayı yeni adrese gönderir. */
export function ContactEdit({
  id,
  firstName,
  lastName,
  email,
  phone,
  status,
}: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    try {
      const r = await updateContactAction(prev, fd);
      if (r.ok) setOpen(false);
      return r;
    } catch {
      return { ok: false, message: "Sunucuya ulaşılamadı. Sayfayı yenileyip kontrol et." };
    }
  }, {});
  const locked = useActionLock(pending);
  const resendLabel =
    status === "approved"
      ? "Kaydettikten sonra QR davetiyesini bu adrese tekrar gönder"
      : status === "rejected"
        ? "Kaydettikten sonra bilgilendirme (indirim) e-postasını bu adrese tekrar gönder"
        : null;

  return (
    <div className="mt-4 border-t border-rule pt-4">
      {state.message && (
        <p className={`mb-3 border-l-4 px-3 py-2 text-sm ${state.ok === false ? "border-err bg-red-50 font-medium text-err" : "border-ok bg-green-50 text-ok"}`} role="status">
          {state.message}
        </p>
      )}
      {!open ? (
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)} disabled={locked}>
          Bilgileri düzenle
        </button>
      ) : (
        <form action={action} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={id} />
          <label className="text-sm">
            <span className="font-semibold">Ad</span>
            <input name="first_name" defaultValue={firstName} required maxLength={80} className="field-input mt-1" />
          </label>
          <label className="text-sm">
            <span className="font-semibold">Soyad</span>
            <input name="last_name" defaultValue={lastName} required maxLength={80} className="field-input mt-1" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-semibold">E-posta</span>
            <input name="email" type="email" defaultValue={email} required maxLength={254} className="field-input mt-1" autoComplete="off" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="font-semibold">Telefon</span>
            <input name="phone" type="tel" defaultValue={phone} required className="field-input mt-1" autoComplete="off" />
          </label>
          {resendLabel && (
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="resend" defaultChecked className="mt-1 h-4 w-4" />
              <span>{resendLabel}</span>
            </label>
          )}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="submit" className="btn btn-primary" disabled={locked}>
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={pending}>
              Vazgeç
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
