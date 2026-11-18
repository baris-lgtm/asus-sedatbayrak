"use server";

/**
 * Quiz yönetimi: aç/kapat, tek denemeyi sil, tümünü sıfırla.
 * requireAdmin() + kullanıcının kendi oturumuyla DB fonksiyonu (yetki orada da kontrol edilir).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AuthorizationError, TransientAuthError, requireAdmin } from "@/lib/auth";
import { dbErrorCode, dbErrorMessage } from "@/lib/db-errors";

export interface QuizActionResult {
  ok: boolean;
  message: string;
  sessionExpired?: boolean;
}

function fail(e: unknown): QuizActionResult {
  if (e instanceof AuthorizationError) return { ok: false, message: e.message, sessionExpired: e.status === 401 };
  if (e instanceof TransientAuthError) return { ok: false, message: e.message };
  console.error("[quiz-admin] beklenmeyen hata");
  return { ok: false, message: "İşlem tamamlanamadı. Lütfen tekrar dene." };
}

function done(message: string): QuizActionResult {
  revalidatePath("/admin/quiz");
  revalidatePath("/quiz/liderlik");
  return { ok: true, message };
}

export async function setQuizOpenAction(open: boolean): Promise<QuizActionResult> {
  try {
    const admin = await requireAdmin();
    const { error } = await admin.supabase.rpc("admin_quiz_set_open", { p_open: open === true });
    if (error) return { ok: false, message: dbErrorMessage(error) };
    return done(open ? "Quiz açıldı. Katılımcılar başlayabilir." : "Quiz kapatıldı. Yeni giriş ve cevap gönderimi durdu.");
  } catch (e) {
    return fail(e);
  }
}

export async function deleteQuizAttemptAction(id: string): Promise<QuizActionResult> {
  try {
    const admin = await requireAdmin();
    if (!z.uuid().safeParse(id).success) return { ok: false, message: "Geçersiz istek." };
    const { error } = await admin.supabase.rpc("admin_quiz_delete_attempt", { p_attempt: id });
    if (error && dbErrorCode(error) === "ERR_NOT_FOUND") return { ok: false, message: "Deneme bulunamadı; zaten silinmiş olabilir." };
    if (error) return { ok: false, message: dbErrorMessage(error) };
    return done("Deneme silindi.");
  } catch (e) {
    return fail(e);
  }
}

export async function resetQuizAction(confirmText: string): Promise<QuizActionResult> {
  try {
    const admin = await requireAdmin();
    if (confirmText.trim().toLocaleUpperCase("tr-TR") !== "SIFIRLA") {
      return { ok: false, message: "Onay için kutuya SIFIRLA yaz." };
    }
    const { data, error } = await admin.supabase.rpc("admin_quiz_reset");
    if (error) return { ok: false, message: dbErrorMessage(error) };
    return done(`Quiz sıfırlandı: ${Number(data)} deneme silindi.`);
  } catch (e) {
    return fail(e);
  }
}
