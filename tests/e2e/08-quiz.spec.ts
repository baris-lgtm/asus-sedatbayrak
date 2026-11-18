import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { USERS, anon, service, uiLogin } from "./helpers";

// Doğru cevap anahtarı sunucu modülünde (server-only); testte kaynak dosyadan okunur.
const KEY = [...readFileSync(path.join(process.cwd(), "src/content/quiz.ts"), "utf8").matchAll(/answer: (\d),/g)].map((m) => Number(m[1]));
const N = KEY.length;

async function setOpen(open: boolean) {
  const { error } = await service().from("quiz_settings").update({ is_open: open }).eq("id", 1);
  if (error) throw error;
}

async function clearAttempts() {
  await service().from("quiz_attempts").delete().not("id", "is", null);
}

async function answer(page: Page, qIndex: number, opt: number) {
  await expect(page.getByText(`Soru ${qIndex + 1} / ${N}`)).toBeVisible();
  await page.getByRole("radio").nth(opt).click();
}

test.describe("Quiz", () => {
  test.beforeEach(async () => {
    await clearAttempts();
    await setOpen(true);
  });
  test.afterAll(async () => {
    await setOpen(false);
    await clearAttempts();
  });

  test("kapalıyken giriş ekranı yerine bilgi gösterilir", async ({ page }) => {
    await setOpen(false);
    await page.goto("/quiz");
    await expect(page.getByRole("heading", { name: "Quiz şu anda kapalı" })).toBeVisible();
  });

  test("ad soyadla başlar, yenilemede ilerleme korunur, sunucu puanlar ve liderliğe girer", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/quiz");
    await page.getByRole("button", { name: "Quize başla" }).click();
    await expect(page.getByText("Lütfen adınızı ve soyadınızı yazın.")).toBeVisible();
    await page.getByLabel("Ad Soyad").fill("Deniz Kaya");
    await page.getByRole("button", { name: "Quize başla" }).click();

    for (let i = 0; i < 5; i++) await answer(page, i, KEY[i]);
    await expect(page.getByText(`Soru 6 / ${N}`)).toBeVisible();

    // Yenileme: aynı deneme, cevaplar korunur
    await page.reload();
    await expect(page.getByText(`Soru 6 / ${N}`)).toBeVisible();
    await page.getByRole("button", { name: "Geri" }).click();
    await expect(page.getByRole("radio").nth(KEY[4])).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "İleri" }).click();

    // Kalanlar: biri bilerek yanlış, biri boş
    for (let i = 5; i < N; i++) {
      if (i === 7) {
        await expect(page.getByText(`Soru ${i + 1} / ${N}`)).toBeVisible();
        await page.getByRole("button", { name: "Boş geç" }).click();
        continue;
      }
      await answer(page, i, i === 6 ? (KEY[i] + 1) % 4 : KEY[i]);
    }
    await expect(page.getByRole("heading", { name: "1 soru boş" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Soru 8, boş" })).toBeVisible();
    await page.getByRole("button", { name: "Cevapları gönder" }).click();

    await expect(page.getByRole("heading", { name: new RegExp(`${N - 2}\\s*/ ${N}`) })).toBeVisible();
    await expect(page.getByText("Şu an ilk 15'tesiniz")).toBeVisible();

    const { data } = await service().from("quiz_attempts").select("full_name, correct_count, duration_ms, answers").single();
    expect(data!.full_name).toBe("Deniz Kaya");
    expect(data!.correct_count).toBe(N - 2);
    expect(data!.duration_ms).toBeGreaterThan(0);
    expect((data!.answers as { chosen: number | null }[])[7].chosen).toBeNull();

    // Aynı cihazdan yeniden: yeni deneme açılmaz, sonuç görünür
    await page.goto("/quiz");
    await expect(page.getByText("Teşekkürler, Deniz")).toBeVisible();

    // Tamamlanmış deneme ikinci kez puanlanamaz
    const again = await page.request.post("/api/quiz/submit", {
      data: { answers: KEY },
      headers: { origin: "http://localhost:3000" },
    });
    expect((await again.json()).result.correct).toBe(N - 2);

    // Liderlik: maskeli ad
    await page.goto("/quiz/liderlik");
    await expect(page.getByRole("heading", { name: "Liderlik tablosu" })).toBeVisible();
    await expect(page.getByText("Deniz K.")).toBeVisible();
    await expect(page.getByText("Deniz Kaya")).toHaveCount(0);
  });

  test("liderlik: önce doğru sayısı, sonra süre; ilk 15 hediye bölümünde, canlı güncellenir", async ({ page }) => {
    const db = service();
    const now = Date.now();
    const rows = Array.from({ length: 18 }, (_, i) => ({
      full_name: `Katılımcı${String(i).padStart(2, "0")} Soyad`,
      started_at: new Date(now - 600_000).toISOString(),
      finished_at: new Date(now - 1000).toISOString(),
      duration_ms: 100_000 + i * 1000,
      correct_count: i < 2 ? 20 : 15,
      total_questions: N,
      answers: [],
    }));
    rows[1].duration_ms = 90_000; // eşit doğruda kısa süren önde
    await db.from("quiz_attempts").insert(rows);

    await page.goto("/quiz/liderlik");
    const prize = page.getByRole("list", { name: "İlk 15" });
    await expect(prize.getByRole("listitem")).toHaveCount(15);
    await expect(prize.getByRole("listitem").first()).toContainText("Katılımcı01 S.");
    await expect(prize.getByRole("listitem").nth(1)).toContainText("Katılımcı00 S.");
    await expect(page.getByRole("list", { name: "Diğer katılımcılar" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("18 katılımcı")).toBeVisible();

    await db.from("quiz_attempts").insert({ ...rows[0], full_name: "Yeni Lider", correct_count: 26, duration_ms: 50_000 });
    await expect(prize.getByRole("listitem").first()).toContainText("Yeni L.", { timeout: 20_000 });
  });

  test("API güvenliği: yabancı köken, anonim yazma, sahte çerez reddedilir", async ({ page }) => {
    const bad = await page.request.post("/api/quiz/start", { data: { fullName: "Kötü Niyet" }, headers: { origin: "https://evil.example" } });
    expect(bad.status()).toBe(403);
    const { error } = await anon().from("quiz_attempts").insert({ full_name: "Sahte Kişi" });
    expect(error).not.toBeNull();
    const { error: rpcErr } = await anon().rpc("quiz_finish", { p_attempt: crypto.randomUUID(), p_correct: 26, p_total: 26, p_answers: [] });
    expect(rpcErr).not.toBeNull();
    await page.context().addCookies([{ name: "quiz_attempt", value: `${crypto.randomUUID()}.sahte`, url: "http://localhost:3000" }]);
    const forged = await page.request.post("/api/quiz/submit", { data: { answers: KEY }, headers: { origin: "http://localhost:3000" } });
    expect(forged.status()).toBe(404);
  });

  test("admin: tam adları görür, quizi kapatır, deneme siler ve sıfırlar", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await service()
      .from("quiz_attempts")
      .insert([
        { full_name: "Selin Aksoy", finished_at: new Date().toISOString(), duration_ms: 70_000, correct_count: 22, total_questions: N, answers: [] },
        { full_name: "Burak Demir", finished_at: new Date().toISOString(), duration_ms: 80_000, correct_count: 21, total_questions: N, answers: [] },
      ]);
    await uiLogin(page, USERS.admin);
    await page.goto("/admin/quiz");
    await expect(page.getByRole("cell", { name: "Selin Aksoy", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Quizi kapat" }).click();
    await expect(page.getByText("Quiz kapatıldı")).toBeVisible();
    const { data: s } = await service().from("quiz_settings").select("is_open").single();
    expect(s!.is_open).toBe(false);

    await page.getByRole("button", { name: "Burak Demir denemesini sil" }).click();
    await expect(page.getByRole("cell", { name: "Burak Demir", exact: true })).toHaveCount(0);

    await page.getByLabel("Onaylamak için SIFIRLA yaz").fill("sıfırla");
    await page.getByRole("button", { name: "Tüm denemeleri sil" }).click();
    await expect(page.getByText(/Quiz sıfırlandı: 1 deneme silindi/)).toBeVisible();
    const { count } = await service().from("quiz_attempts").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  test("kapı ekibi quiz yönetimine giremez", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await uiLogin(page, USERS.door);
    await page.goto("/admin/quiz");
    await expect(page).not.toHaveURL(/\/admin\/quiz$/);
    await ctx.close();
  });
});

