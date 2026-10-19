"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useId } from "react";
import { deleteApplicationAction, type ActionState } from "@/app/admin/actions";
import { useActionLock } from "@/components/admin/action-form";

/** KVKK silme talebi için kalıcı silme. Yanlışlıkla tıklamaya karşı "SİL" yazılması istenir. */
export function DeleteApplicationForm({ id }: { id: string }) {
  const uid = useId();
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    let result: ActionState;
    try {
      result = await deleteApplicationAction(prev, fd);
    } catch {
      return { ok: false, message: "Sunucuya ulaşılamadı. Sayfayı yenileyip başvurunun silinip silinmediğini kontrol et." };
    }
    // Silinen başvurunun sayfası artık yok: yönlendirmeyi aynı geçişte başlat.
    if (result.ok && result.redirectTo) router.replace(result.redirectTo);
    return result;
  }, {});

  const locked = useActionLock(pending);

  return (
    <form action={action} onSubmit={(e) => locked && e.preventDefault()} className="space-y-2 border-t border-rule pt-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm font-semibold">Kalıcı olarak sil</p>
      <p className="text-xs leading-relaxed text-graphite">
        KVKK silme talebi için. Başvuru, davetiye ve e-posta kayıtları geri alınamaz şekilde silinir; davetiye QR&apos;ı geçersiz olur.
      </p>
      <label htmlFor={`${uid}-onay`} className="block text-xs">
        Onaylamak için <strong>SİL</strong> yaz
      </label>
      <input id={`${uid}-onay`} name="confirm" autoComplete="off" autoCapitalize="characters" className="field-input text-sm" />
      <button
        type="submit"
        className="btn w-full min-h-11 border-err bg-paper text-sm text-err hover:bg-err hover:text-paper"
        disabled={locked || Boolean(state.ok)}
      >
        {pending ? "Siliniyor…" : state.ok ? "Silindi" : "Başvuruyu kalıcı olarak sil"}
      </button>
      {state.message && (
        <p role={state.ok ? "status" : "alert"} className={`text-sm font-medium ${state.ok ? "text-ok" : "text-err"}`}>
          {state.message}
          {state.sessionExpired && (
            <>
              {" "}
              <Link href="/admin/login" className="underline">Giriş yap</Link>
            </>
          )}
        </p>
      )}
    </form>
  );
}
