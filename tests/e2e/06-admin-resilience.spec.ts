/**
 * Admin paneli dayanıklılık testleri — bağımsız kod incelemesinde bulunan her
 * sorun için regresyon testi. Etkinlik günü koşullarını (kopan bağlantı, düşen
 * oturum, Supabase kesintisi, yüksek veri hacmi) gerçek yerel Supabase ile dener.
 */
import { execFileSync } from "node:child_process";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { USERS, invitationFromMail, mailsTo, seedApplication, service, uiLogin } from "./helpers";

async function openApplication(page: Page, id: string) {
  await page.goto(`/admin/basvurular/${id}`);
  await expect(page.getByRole("heading", { name: "İşlemler" })).toBeVisible();
}

function supabaseGateway(action: "pause" | "unpause") {
  // Yerel Supabase API ağ geçidi (Kong) — durdurulunca Auth ve veritabanı API'si yanıt vermez.
  const name = execFileSync("docker", ["ps", "--format", "{{.Names}}", "--filter", "name=supabase_kong"], { encoding: "utf8" }).trim();
  if (!name) throw new Error("supabase_kong konteyneri bulunamadı");
  execFileSync("docker", [action, name]);
}

test.describe("Admin paneli dayanıklılık", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await uiLogin(page, USERS.admin);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("Türkçe karakterli ve bölüm/telefon aramaları", async ({ page }) => {
    const tag = `Z${Date.now().toString(36)}`;
    await seedApplication({ first_name: "Işıl", last_name: `Çağlar${tag}`, department: "İç Mimarlık", phone: "+905321234567" });
    for (const q of [`IŞIL ${tag}`, `ışıl çağlar${tag}`, `isil caglar${tag}`, `iç mimarlık ${tag}`, `İÇ MİMARLIK ${tag}`]) {
      await page.goto(`/admin?q=${encodeURIComponent(q)}`);
      await expect(page.getByText("1 başvuru bulundu"), q).toBeVisible();
    }
    for (const q of ["0532 123 45 67", "+90 532 123 45 67", "5321234567"]) {
      await page.goto(`/admin?q=${encodeURIComponent(q)}`);
      await expect(page.getByRole("link", { name: `Işıl Çağlar${tag}` }).first(), q).toBeVisible();
    }
    // Filtre sözdizimi enjeksiyonu denemesi hata vermez
    await page.goto(`/admin?q=${encodeURIComponent("x),id.eq.1,(")}`);
    await expect(page.getByText(/başvuru bulundu/)).toBeVisible();
  });

  test("son sayfadan büyük sayfa numarası: hata yok, son sayfa gösterilir", async ({ page }) => {
    await page.goto("/admin?page=999");
    await expect(page.getByText(/başvuru bulundu/)).toBeVisible();
    await expect(page.getByText("Sayfa yüklenemedi")).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "Sayfalama" });
    if (await nav.count()) await expect(nav.getByText(/Sayfa (\d+) \/ \1$/)).toBeVisible();
  });

  test("listeye dönüş bağlantısı filtreyi korur", async ({ page }) => {
    const a = await seedApplication({ first_name: "Geri", last_name: `Donus${Date.now()}` });
    await page.goto(`/admin?q=${encodeURIComponent(a.email)}&status=pending`);
    await page.getByRole("link", { name: /Geri Donus/ }).first().click();
    await page.getByRole("link", { name: "Başvurulara dön" }).click();
    await expect(page).toHaveURL(/status=pending/);
    await expect(page).toHaveURL(/q=/);
  });

  test("oturum işlem sırasında düşerse: beyaz sayfa yok, anlaşılır mesaj + giriş bağlantısı", async ({ page, context }) => {
    const a = await seedApplication({ first_name: "Oturum" });
    await openApplication(page, a.id);
    await context.clearCookies();
    await page.getByRole("button", { name: "İncelemeye al" }).click();
    await expect(page.getByText("Oturumun sona ermiş. Sayfayı yenileyip tekrar giriş yap.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Giriş yap" })).toBeVisible();
    const { data } = await service().from("applications").select("status").eq("id", a.id).single();
    expect(data?.status).toBe("pending");
  });

  test("ağ kesintisinde işlem: beyaz sayfa yok, durumu kontrol et mesajı", async ({ page }) => {
    const a = await seedApplication({ first_name: "Ag" });
    await openApplication(page, a.id);
    await page.route(`**/admin/basvurular/${a.id}*`, (route) =>
      route.request().method() === "POST" ? route.abort("internetdisconnected") : route.continue(),
    );
    await page.getByRole("button", { name: "İncelemeye al" }).click();
    await expect(page.getByText(/Sunucuya ulaşılamadı/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "İşlemler" })).toBeVisible();
    await page.unroute(`**/admin/basvurular/${a.id}*`);
    await page.getByRole("button", { name: "İncelemeye al" }).click();
    await expect(page.getByText("Başvuru incelemeye alındı.")).toBeVisible();
  });

  test("bir işlem sürerken diğer işlem butonları kilitli", async ({ page }) => {
    const a = await seedApplication({ first_name: "Kilit" });
    await openApplication(page, a.id);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    await page.route(`**/admin/basvurular/${a.id}*`, async (route) => {
      if (route.request().method() === "POST") await gate;
      await route.continue();
    });
    await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(page.getByRole("button", { name: "Reddet" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Yedek listeye al" })).toBeDisabled();
    release();
    await expect(page.getByText(/onaylandı/).first()).toBeVisible();
    await page.unroute(`**/admin/basvurular/${a.id}*`);
  });

  test("Supabase geçici olarak erişilemezse: girişe atılmaz, tekrar dene çalışır", async ({ page }) => {
    test.setTimeout(120_000);
    const a = await seedApplication({ first_name: "Kesinti" });
    await openApplication(page, a.id);
    supabaseGateway("pause");
    try {
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Sayfa yüklenemedi" })).toBeVisible({ timeout: 30_000 });
      expect(page.url()).not.toContain("/admin/login");

      const r = await page.request.post("/api/admin/check-in", { data: { mode: "code", value: "ABCD-EFGH-JK" } });
      expect(r.status()).toBe(503);
      expect((await r.json()).code).toBe("transient");
    } finally {
      supabaseGateway("unpause");
    }
    await page.getByRole("button", { name: "Tekrar dene" }).click();
    await expect(page.getByText(/başvuru bulundu/)).toBeVisible({ timeout: 30_000 });
  });

  test("ayarlarda doğrulama hatası girilen değerleri silmez", async ({ page }) => {
    await page.goto("/admin/ayarlar");
    await page.getByLabel("Mekân adı").fill("Yarım Kalan Mekân");
    await page.getByLabel("Adres").fill("");
    await page.getByRole("checkbox", { name: /Mekân kesinleşti/ }).check();
    await page.getByRole("button", { name: "Ayarları kaydet" }).click();
    await expect(page.getByText("Mekânı kesinleşmiş olarak işaretlemek için ad ve adres gir.")).toBeVisible();
    await expect(page.getByLabel("Mekân adı")).toHaveValue("Yarım Kalan Mekân");
    await expect(page.getByRole("checkbox", { name: /Mekân kesinleşti/ })).toBeChecked();
  });

  test("yalnızca kapasite değişince yeni bilgilendirme turu açılmaz", async ({ page }) => {
    test.setTimeout(180_000);
    const a = await seedApplication({ first_name: "Tur" });
    await openApplication(page, a.id);
    await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(page.getByText(/onaylandı/).first()).toBeVisible();
    try {
      await page.goto("/admin/ayarlar");
      await page.getByLabel("Başlangıç (İstanbul saati)").fill("2026-10-30T13:00");
      await page.getByRole("checkbox", { name: /Tarih kesinleşti/ }).check();
      await page.getByRole("button", { name: "Ayarları kaydet" }).click();
      await expect(page.getByText("Ayarlar kaydedildi.")).toBeVisible();
      for (let round = 0; round < 30; round++) {
        await page.reload();
        await expect(page.getByText(/onaylı katılımcı bilgilendirildi/)).toBeVisible(); // akış (streaming) tamamlansın
        const button = page.getByRole("button", { name: /Bilgilendirme gönder/ });
        if ((await button.count()) === 0) break;
        await button.click();
        await expect(page.getByText(/katılımcıya gönderildi|tamamına gönderildi/)).toBeVisible({ timeout: 60_000 });
      }
      await page.reload();
      await expect(page.getByText(/onaylı katılımcı bilgilendirildi/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Bilgilendirme gönder/ })).toHaveCount(0);

      // Sadece kapasite değiştir → kimse yeniden "bekliyor" olmamalı
      const cap = page.getByLabel("Kapasite");
      await cap.fill(String(Number(await cap.inputValue()) + 1));
      await page.getByRole("button", { name: "Ayarları kaydet" }).click();
      await expect(page.getByText("Ayarlar kaydedildi.")).toBeVisible();
      await page.reload();
      await expect(page.getByText(/onaylı katılımcı bilgilendirildi/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Bilgilendirme gönder/ })).toHaveCount(0);
    } finally {
      await service().from("event_settings").update({ date_confirmed: false, starts_at: null, ends_at: null, capacity: 300 }).eq("id", 1);
    }
  });

  test("tekrar dene: durumu değişmiş başvuruya eski bildirim gitmez", async ({ page }) => {
    const a = await seedApplication({ first_name: "Eski" });
    // Başarısız "yedek liste" e-postası kaydı, ardından onay
    await service().from("email_logs").insert({ application_id: a.id, email_type: "waitlisted", dedupe_key: `waitlisted:${a.id}:test`, status: "failed", attempt_count: 1, last_error: "test" });
    await openApplication(page, a.id);
    await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(page.getByText(/onaylandı/).first()).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Tekrar dene" }).click();
    await expect(page.getByText("Başvurunun durumu bu e-postadan sonra değişti; eski bildirim gönderilmedi.")).toBeVisible();
    expect(mailsTo(a.email, "waitlisted")).toHaveLength(0);
  });

  test("onaylı ama davetiyesiz (beklenmeyen) kayıt panelden onarılabilir", async ({ page }) => {
    const a = await seedApplication({ first_name: "Onarim" });
    await openApplication(page, a.id);
    await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(page.getByText(/onaylandı/).first()).toBeVisible();
    // Davetiyeyi doğrudan geçersiz kıl (anomali)
    await service().from("invitations").update({ revoked_at: new Date().toISOString(), revoke_reason: "test" }).eq("application_id", a.id);
    await page.reload();
    await page.getByRole("button", { name: "Davetiye oluştur ve gönder" }).click();
    await expect(page.getByText(/Başvuru (onaylandı|zaten onaylı)/).first()).toBeVisible();
    const { data } = await service().from("invitations").select("id").eq("application_id", a.id).is("revoked_at", null);
    expect(data).toHaveLength(1);
    expect(mailsTo(a.email, "invitation").length).toBeGreaterThanOrEqual(2);
  });

  test("detay sayfası: etiketler ve işlem geçmişi okunaklı", async ({ page }) => {
    const a = await seedApplication({ first_name: "Etiket" });
    await openApplication(page, a.id);
    await page.getByRole("button", { name: "İncelemeye al" }).click();
    await expect(page.getByText("Başvuru incelemeye alındı.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Katılımcı tipi")).toBeVisible();
    await expect(page.getByText("(İnceleme bekliyor → İnceleniyor)")).toBeVisible();
  });
});

test.describe("Check-in dayanıklılık", () => {
  test("yanıt gelmezse 8 sn içinde serbest kalır; tekrar okutma çift giriş yapmaz", async ({ page, browser }) => {
    test.setTimeout(90_000);
    const a = await seedApplication({ first_name: "Askida" });
    const adminCtx = await browser.newContext({ baseURL: "http://localhost:3000" });
    const adminPage = await adminCtx.newPage();
    adminPage.on("dialog", (d) => d.accept());
    await uiLogin(adminPage, USERS.admin);
    await adminPage.goto(`/admin/basvurular/${a.id}`);
    await adminPage.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(adminPage.getByText(/onaylandı/).first()).toBeVisible();
    await adminCtx.close();
    const { code } = invitationFromMail(mailsTo(a.email, "invitation")[0]);

    await uiLogin(page, USERS.door);
    // İlk istek sunucuya ulaşır (giriş kaydedilir) ama yanıt hiç dönmez
    let first = true;
    await page.route("**/api/admin/check-in", async (route) => {
      if (first) {
        first = false;
        await route.fetch(); // istek işlenir
        await new Promise((r) => setTimeout(r, 15_000)); // yanıt "kaybolur"
        return route.abort();
      }
      return route.continue();
    });
    const input = page.getByLabel("Giriş kodu", { exact: true });
    await input.fill(code);
    await page.getByRole("button", { name: "Kontrol et" }).click();
    await expect(page.getByText(/Sunucudan yanıt gelmedi/)).toBeVisible({ timeout: 12_000 });

    // Tekrar dene → giriş zaten kaydedilmiş; alarm değil "az önce giriş yaptı"
    await input.fill(code);
    await page.getByRole("button", { name: "Kontrol et" }).click();
    await expect(page.getByText("Bu katılımcı az önce giriş yaptı")).toBeVisible();
    const { data } = await service().from("invitations").select("checked_in_at").eq("application_id", a.id).single();
    expect(data?.checked_in_at).not.toBeNull();
  });

  test("oturum düşerse check-in ekranı giriş bağlantısı gösterir", async ({ page, context }) => {
    await uiLogin(page, USERS.door);
    await context.clearCookies();
    await page.getByLabel("Giriş kodu", { exact: true }).fill("ABCD-EFGH-JK");
    await page.getByRole("button", { name: "Kontrol et" }).click();
    await expect(page.getByText("Oturumun sona ermiş. Tekrar giriş yapman gerekiyor.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Giriş yap" })).toBeVisible();
  });

  test("çevrimdışı uyarısı", async ({ page, context }) => {
    await uiLogin(page, USERS.door);
    await context.setOffline(true);
    await expect(page.getByText("İnternet bağlantısı yok. Bağlantı gelene kadar giriş kontrol edilemez.")).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText("İnternet bağlantısı yok. Bağlantı gelene kadar giriş kontrol edilemez.")).toHaveCount(0);
  });
});
