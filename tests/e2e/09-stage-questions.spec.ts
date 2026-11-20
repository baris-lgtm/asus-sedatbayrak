import { expect, test } from "./fixtures";
import { USERS, anon, service, uiLogin } from "./helpers";

async function clear() {
  const db = service();
  await db.from("stage_questions").update({ status: "archived", merged_into: null }).not("id", "is", null);
  await db.from("stage_questions").delete().not("id", "is", null);
  await db.from("stage_settings").update({ is_open: true }).eq("id", 1);
}

test.describe("Sahneye soru sor", () => {
  test.beforeEach(clear);
  test.afterAll(clear);

  test("açılış sayfasındaki buton formu açar; ad isteğe bağlı, soru zorunlu", async ({ page }) => {
    await page.goto("/");
    const section = page.locator("#soru-sor");
    await expect(section.getByRole("heading", { name: "Sahneye Soru Sor" })).toBeVisible();
    await section.getByRole("link", { name: "Sorunu Gönder" }).click();
    await expect(page).toHaveURL(/\/soru$/);
    await expect(page.getByRole("heading", { name: "Sahneye Sorunu Gönder" })).toBeVisible();

    await page.getByRole("button", { name: "Sorumu Gönder" }).click();
    await expect(page.getByText("Lütfen sorunuzu yazın.")).toBeVisible();

    await page.getByLabel("Sorunuz").fill("Yapay zekâ mimari sunumları nasıl değiştirecek?");
    await page.getByRole("button", { name: "Sorumu Gönder" }).click();
    await expect(page.getByText("Sorunuz bize ulaştı. Teşekkür ederiz!")).toBeVisible();

    await page.getByRole("button", { name: "Yeni soru gönder" }).click();
    await page.getByLabel("Adınız").fill("Elif");
    await page.getByLabel("Sorunuz").fill("ProArt P16 hangi render motorlarıyla test edildi?");
    await page.getByRole("button", { name: "Sorumu Gönder" }).click();
    await expect(page.getByText("Sorunuz bize ulaştı. Teşekkür ederiz!")).toBeVisible();

    const { data } = await service().from("stage_questions").select("author_name, body, status").order("created_at");
    expect(data).toEqual([
      { author_name: null, body: "Yapay zekâ mimari sunumları nasıl değiştirecek?", status: "new" },
      { author_name: "Elif", body: "ProArt P16 hangi render motorlarıyla test edildi?", status: "new" },
    ]);
  });

  test("güvenlik: yabancı köken ve anonim doğrudan yazma reddedilir; kapalıyken form görünmez", async ({ page }) => {
    const bad = await page.request.post("/api/stage-questions", { data: { question: "Kötü niyetli soru" }, headers: { origin: "https://evil.example" } });
    expect(bad.status()).toBe(403);
    const { error } = await anon().from("stage_questions").insert({ body: "Sahte soru" });
    expect(error).not.toBeNull();

    await service().from("stage_settings").update({ is_open: false }).eq("id", 1);
    await page.goto("/soru");
    await expect(page.getByText("Soru alımı şu anda kapalı")).toBeVisible();
    const closed = await page.request.post("/api/stage-questions", { data: { question: "Kapalıyken soru" }, headers: { origin: "http://localhost:3000" } });
    expect(closed.status()).toBe(409);
  });

  test("ekip birleştirir ve moderatöre iletir; moderatör 'Soruldu' der", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    const db = service();
    for (const [name, body] of [
      ["Ayşe", "Yapay zekâ sunum sürecini nasıl değiştirecek?"],
      [null, "Yapay zeka sunumları nasıl değiştirir?"],
      ["Can", "Şantiyede tablet kullanımı yaygınlaşacak mı?"],
    ] as const) {
      await db.rpc("stage_submit", { p_name: name, p_body: body });
    }

    await uiLogin(page, USERS.admin);
    await page.goto("/admin/sorular");
    await expect(page.getByRole("tab", { name: /Gelen \(3\)/ })).toBeVisible();

    const card = (text: string) => page.getByRole("listitem").filter({ hasText: text }).first();
    await card("sunum sürecini").getByRole("checkbox").check();
    await card("sunumları nasıl").getByRole("checkbox").check();
    await page.getByRole("button", { name: /Birleştir/ }).click();
    await expect(page.getByText("1 soru birleştirildi.")).toBeVisible();
    await expect(card("sunum sürecini").getByRole("button", { name: "+1 benzer soru" })).toBeVisible();

    await card("sunum sürecini").getByRole("button", { name: "Moderatöre ilet" }).click();
    await card("Şantiyede").getByRole("button", { name: "Ele" }).click();
    await expect(page.getByRole("tab", { name: /Moderatöre iletilen \(1\)/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Elenen \(1\)/ })).toBeVisible();

    await page.goto("/admin/sorular/sahne");
    await expect(page.getByText("Yapay zekâ sunum sürecini nasıl değiştirecek?")).toBeVisible();
    await expect(page.getByText("+1 kişi benzerini sordu")).toBeVisible();
    await page.getByRole("button", { name: "Soruldu" }).click();
    await expect(page.getByText("Henüz iletilen soru yok")).toBeVisible();

    const { data } = await db.from("stage_questions").select("status").eq("author_name", "Ayşe").single();
    expect(data!.status).toBe("asked");
  });

  test("kapı ekibi sahne sorularını göremez", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await uiLogin(page, USERS.door);
    await page.goto("/admin/sorular");
    await expect(page).not.toHaveURL(/\/admin\/sorular$/);
    await ctx.close();
  });

  test("moderatör yalnızca sahne sorularını görür ve 'Soruldu' der; başka sayfalara giremez", async ({ browser }) => {
    await service().rpc("stage_submit", { p_name: "Deniz", p_body: "Moderatör ekranı testi sorusu" });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on("dialog", (d) => d.accept());
    await uiLogin(page, USERS.moderator);
    await expect(page).toHaveURL(/\/admin\/sorular\/sahne$/);
    await expect(page.getByRole("link", { name: "Başvurular" })).toHaveCount(0);

    await page.getByRole("link", { name: "Sahne soruları" }).click();
    await expect(page.getByRole("button", { name: /Soru alımını/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tüm soruları sil" })).toHaveCount(0);
    const card = page.getByRole("listitem").filter({ hasText: "Moderatör ekranı testi" }).first();
    await card.getByRole("button", { name: "Moderatöre ilet" }).click();
    await page.goto("/admin/sorular/sahne");
    await page.getByRole("button", { name: "Soruldu" }).click();
    await expect(page.getByText("Henüz iletilen soru yok")).toBeVisible();

    for (const path of ["/admin", "/admin/check-in", "/admin/quiz", "/admin/toplu-ret", "/admin/ayarlar"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/admin\/sorular\/sahne$/);
    }
    const res = await page.request.post("/api/admin/check-in", { data: { token: "x" }, headers: { origin: "http://localhost:3000" } });
    expect(res.status()).toBe(403);
    await ctx.close();
  });
});
