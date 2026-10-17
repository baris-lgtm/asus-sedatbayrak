"use client";

import { useActionState, useId } from "react";
import { deleteApplicationAction, type ActionState } from "@/app/admin/actions";

/** KVKK silme talebi için kalıcı silme. Yanlışlıkla tıklamaya karşı "SIL" yazılması istenir. */
export function DeleteApplicationForm({ id }: { id: string }) {
  const uid = useId();
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteApplicationAction, {});
  return (
    <form action={action} className="space-y-2 border-t border-rule pt-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm font-semibold">Kalıcı olarak sil</p>
      <p className="text-xs leading-relaxed text-graphite">
        KVKK silme talebi için. Başvuru, davetiye ve e-posta kayıtları geri alınamaz şekilde silinir; davetiye QR&apos;ı geçersiz olur.
      </p>
      <label htmlFor={`${uid}-onay`} className="block text-xs">
        Onaylamak için <strong>SIL</strong> yaz
      </label>
      <input id={`${uid}-onay`} name="confirm" autoComplete="off" className="field-input text-sm" />
      <button type="submit" className="btn w-full min-h-11 border-err bg-paper text-sm text-err hover:bg-err hover:text-paper" disabled={pending}>
        {pending ? "Siliniyor…" : "Başvuruyu kalıcı olarak sil"}
      </button>
      {state.message && (
        <p role="alert" className="text-sm font-medium text-err">
          {state.message}
        </p>
      )}
    </form>
  );
}
