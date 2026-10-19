import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { USERS, countTaken, invitationFromMail, mailsTo, seedApplication, service, setCapacity, uiLogin, uniqueEmail } from "./helpers";

async function openApplication(page: Page, id: string) {
  await page.goto(`/admin/basvurular/${id}`);
  await expect(page.getByRole("heading", { name: "İşlemler" })).toBeVisible();
}

test.describe("Admin paneli", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await uiLogin(page, USERS.admin);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("dashboard, arama, filtre ve detay", async ({ page }) => {
    const a = await seedApplication({ first_name: "Zeynep", last_name: "Aranabilir", institution: "Mimar Sinan GSÜ" });
    await page.reload();
    await expect(page.getByText("Toplam başvuru")).toBeVisible();
    await expect(page.getByText(/Kapasite: \d+ \/ 300 dolu/)).toBeVisible();

    await page.getByLabel("Ara").fill("aranabilir");
    await page.getByRole("button", { name: "Filtrele" }).click();
    await expect(page).toHaveURL(/q=aranabilir/);
    await expect(page.getByText("1 başvuru bulundu")).toBeVisible();
    await page.getByRole("link", { name: "Zeynep Aranabilir" }).click();
    await expect(page).toHaveURL(new RegExp(a.id));
    await expect(page.getByText("Mimar Sinan GSÜ")).toBeVisible();

    await page.goto("/admin?status=checked_in&q=aranabilir");
    await expect(page.getByText("Bu filtrelerle eşleşen başvuru yok.")).toBeVisible();
  });

  test("T7/T8/T9: onay → QR davetiyesi oluşur, e-posta loglanır, davetiye sayfası çalışır", async ({ page }) => {
    const a = await seedApplication({ first_name: "Onay", last_name: "Bekleyen" });
    await openApplication(page, a.id);
    await page.getByRole("button", { name: "İncelemeye al" }).click();
    await expect(page.getByText("Başvuru incelemeye alındı.")).toBeVisible();

    await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(page.getByText("Başvuru onaylandı ve QR davetiyesi oluşturuldu. E-posta gönderildi.")).toBeVisible();

    const { data: inv } = await service().from("invitations").select("*").eq("application_id", a.id);
    expect(inv).toHaveLength(1);
    expect(inv![0].qr_token_hash).toMatch(/^[0-9a-f]{64}$/);
    const { data: app } = await service().from("applications").select("status, reviewed_by").eq("id", a.id).single();
    expect(app).toMatchObject({ status: "approved" });
    expect(app?.reviewed_by).not.toBeNull();

    const sent = mailsTo(a.email, "invitation");
    expect(sent).toHaveLength(1);
    expect(sent[0].attachments[0]).toMatchObject({ filename: "davetiye-qr.png", contentId: "davetiye-qr" });
    const { url, code, token } = invitationFromMail(sent[0]);
    // QR/URL kişisel veri içermez
    expect(url).not.toContain(a.email);
    expect(url).not.toContain("Onay");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{2}$/);
    // Tarih/mekân kesinleşmediği için kesin bilgi gönderilmedi
    expect(sent[0].text).toContain("Tarih: Kesinleştiğinde e-posta ile bildirilecek");

    await page.goto(new URL(url).pathname);
    await expect(page.getByRole("heading", { name: "Davetiye" })).toBeVisible();
    await expect(page.getByText(code)).toBeVisible();
    await expect(page.getByRole("img", { name: "Giriş QR kodu" })).toBeVisible();

    // Detayda e-posta sonucu görünüyor
    await openApplication(page, a.id);
    await expect(page.getByText("Davetiye").first()).toBeVisible();
    await expect(page.locator("#epostalar ~ ul, section:has(#epostalar)").getByText("Gönderildi").first()).toBeVisible();
  });

  test("idempotent onay: iki sekmeden aynı anda onay → tek davetiye, tek e-posta", async ({ page, context }) => {
    const a = await seedApplication({ first_name: "Cift", last_name: "Tik" });
    const page2 = await context.newPage();
    page2.on("dialog", (d) => d.accept());
    await openApplication(page, a.id);
    await openApplication(page2, a.id);
    await Promise.all([
      page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click(),
      page2.getByRole("button", { name: "Onayla ve davetiye gönder" }).click(),
    ]);
    await expect(page.getByText(/Başvuru (onaylandı|zaten onaylı)/)).toBeVisible();
    await expect(page2.getByText(/Başvuru (onaylandı|zaten onaylı)/)).toBeVisible();
    const { data: inv } = await service().from("invitations").select("id").eq("application_id", a.id);
    expect(inv).toHaveLength(1);
    expect(mailsTo(a.email, "invitation")).toHaveLength(1);
  });

  test("ret ve yedek liste e-postayla bildirilir; iptal davetiyeyi geçersiz kılar", async ({ page }) => {
    const r = await seedApplication({ first_name: "Ret" });
    await openApplication(page, r.id);
    await page.getByRole("button", { name: "Reddet" }).click();
    await expect(page.getByText("Başvuru reddedildi. E-posta gönderildi.")).toBeVisible();
    expect(mailsTo(r.email, "rejected")).toHaveLength(1);

    const w = await seedApplication({ first_name: "Yedek" });
    await openApplication(page, w.id);
    await page.getByRole("checkbox", { name: "Katılımcıya e-posta gönder" }).first().uncheck();
    await page.getByRole("button", { name: "Yedek listeye al" }).click();
    await expect(page.getByText("Başvuru yedek listeye alındı.")).toBeVisible();
    expect(mailsTo(w.email, "waitlisted")).toHaveLength(0);

    const c = await seedApplication({ first_name: "Iptal" });
    await openApplication(page, c.id);
    await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(page.getByText(/onaylandı/)).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Katılımı iptal et" }).click();
    await expect(page.getByText("Katılım iptal edildi; davetiye geçersiz kılındı.")).toBeVisible();
    const { data: inv } = await service().from("invitations").select("revoked_at").eq("application_id", c.id).single();
    expect(inv?.revoked_at).not.toBeNull();
    const { url } = invitationFromMail(mailsTo(c.email, "invitation")[0]);
    await page.goto(new URL(url).pathname);
    await expect(page.getByRole("heading", { name: "Bu davetiye geçerli değil" })).toBeVisible();
  });

  test("davetiye tekrar gönderimi aynı QR'ı kullanır; yeni QR eski QR'ı geçersiz kılar", async ({ page }) => {
    const a = await seedApplication({ first_name: "Kayip" });
    await openApplication(page, a.id);
    await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(page.getByText(/onaylandı/)).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Davetiyeyi tekrar gönder" }).click();
    await expect(page.getByText("E-posta gönderildi.")).toBeVisible();
    const first = invitationFromMail(mailsTo(a.email, "invitation")[0]);
    const again = invitationFromMail(mailsTo(a.email, "invitation_resend")[0]);
    expect(again.token).toBe(first.token);

    await page.getByRole("button", { name: "Yeni QR oluştur" }).click();
    await expect(page.getByText(/Yeni davetiye oluşturuldu/)).toBeVisible();
    const fresh = invitationFromMail(mailsTo(a.email, "invitation").at(-1)!);
    expect(fresh.token).not.toBe(first.token);
    await page.goto(new URL(first.url).pathname);
    await expect(page.getByRole("heading", { name: "Bu davetiye geçerli değil" })).toBeVisible();
  });

  test("kapasite: dolunca onay sunucuda engellenir, yedek listeye alınabilir", async ({ page }) => {
    const a = await seedApplication({ first_name: "Kapasite" });
    await setCapacity(await countTaken());
    try {
      await openApplication(page, a.id);
      await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
      await expect(page.getByText(/Kapasite dolu/)).toBeVisible();
      const { data } = await service().from("applications").select("status").eq("id", a.id).single();
      expect(data?.status).toBe("pending");
      await page.getByRole("button", { name: "Yedek listeye al" }).click();
      await expect(page.getByText(/Başvuru yedek listeye alındı/)).toBeVisible();
    } finally {
      await setCapacity(300);
    }
  });

  test("T17: eş zamanlı onaylarda kapasite aşılmaz (HTTP, 6 sekme)", async ({ page, context }) => {
    const apps = await Promise.all(Array.from({ length: 6 }, (_, i) => seedApplication({ first_name: `Eszamanli${i}` })));
    const taken = await countTaken();
    await setCapacity(taken + 2);
    try {
      const extra = await Promise.all(Array.from({ length: 5 }, () => context.newPage()));
      for (const p of extra) p.on("dialog", (d) => d.accept());
      const pages = [page, ...extra];
      await Promise.all(pages.map((p, i) => openApplication(p, apps[i].id)));
      await Promise.all(pages.map((p) => p.getByRole("button", { name: "Onayla ve davetiye gönder" }).click()));
      for (const p of pages) await expect(p.getByText(/onaylandı|Kapasite dolu/)).toBeVisible();
      expect(await countTaken()).toBe(taken + 2);
      const { data } = await service().from("applications").select("status").in("id", apps.map((x) => x.id));
      expect(data!.filter((x) => x.status === "approved")).toHaveLength(2);
    } finally {
      await setCapacity(300);
    }
  });

  test("ayarlar: tarih/mekân kesinleşince ana sayfa ve e-postalar güncellenir", async ({ page }) => {
    await page.goto("/admin/ayarlar");
    await page.getByLabel("Başlangıç (İstanbul saati)").fill("2026-10-31T12:00");
    await page.getByLabel("Bitiş (İstanbul saati)").fill("2026-10-31T17:00");
    await page.getByRole("checkbox", { name: /Tarih kesinleşti/ }).check();
    await page.getByLabel("Mekân adı").fill("Test Sanat Merkezi");
    await page.getByLabel("Adres").fill("Örnek Mah. Test Sok. No:1, İstanbul");
    await page.getByRole("checkbox", { name: /Mekân kesinleşti/ }).check();
    await page.getByRole("button", { name: "Ayarları kaydet" }).click();
    await expect(page.getByText("Ayarlar kaydedildi.")).toBeVisible();

    await page.goto("/");
    await expect(page.getByText("31 Ekim 2026 Cumartesi").first()).toBeVisible();
    await expect(page.getByText("12:00 – 17:00").first()).toBeVisible();
    await expect(page.getByText("Test Sanat Merkezi").first()).toBeVisible();

    // Doğrulama: mekân adresi olmadan "kesinleşti" işaretlenemez
    await page.goto("/admin/ayarlar");
    await page.getByLabel("Adres").fill("");
    await page.getByRole("button", { name: "Ayarları kaydet" }).click();
    await expect(page.getByText("Mekânı kesinleşmiş olarak işaretlemek için ad ve adres gir.")).toBeVisible();

    await service().from("event_settings").update({ date_confirmed: false, venue_confirmed: false, starts_at: null, ends_at: null, venue_name: null, venue_address: null }).eq("id", 1);
  });
});

test("T10: e-posta sağlayıcısı hata verirse başvuru korunur, hata loglanır ve admin görür", async ({ request, page }) => {
  // 3001 portundaki örnek gerçek Resend API'sine GEÇERSİZ anahtarla bağlanır.
  const email = uniqueEmail("resendhata");
  const res = await request.post("http://localhost:3001/api/applications", {
    headers: { origin: "http://localhost:3001" },
    data: {
      firstName: "Hata", lastName: "Senaryosu", email, phone: "05551234567", participantType: "student",
      institution: "Test", department: "Test", kvkkAcknowledged: true,
    },
  });
  expect(res.status()).toBe(201);
  const { data: app } = await service().from("applications").select("id, status").eq("email_normalized", email).single();
  expect(app?.status).toBe("pending");
  const { data: log } = await service().from("email_logs").select("status, last_error, sent_at, provider_message_id").eq("application_id", app!.id).single();
  expect(log).toMatchObject({ status: "failed", sent_at: null, provider_message_id: null });
  expect(log?.last_error).toBeTruthy();

  page.on("dialog", (d) => d.accept());
  await uiLogin(page, USERS.admin);
  await page.goto(`/admin/basvurular/${app!.id}`);
  await expect(page.getByText("Başarısız").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Tekrar dene" })).toBeVisible();
  // 3000'deki örnekten tekrar dene → (test e-posta dizini) başarılı
  await page.getByRole("button", { name: "Tekrar dene" }).click();
  await expect(page.getByText("E-posta gönderildi.")).toBeVisible();
  const { data: after } = await service().from("email_logs").select("status, attempt_count").eq("application_id", app!.id).single();
  expect(after).toMatchObject({ status: "sent", attempt_count: 2 });
});

test.describe("KVKK silme ve katılımcı bilgilendirme", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await uiLogin(page, USERS.admin);
  });

  test("admin başvuruyu KVKK talebiyle kalıcı silebilir; davetiye QR'ı geçersizleşir", async ({ page }) => {
    const a = await seedApplication({ first_name: "Silinecek" });
    await openApplication(page, a.id);
    await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(page.getByText(/onaylandı/).first()).toBeVisible();
    const { url } = invitationFromMail(mailsTo(a.email, "invitation")[0]);

    await page.reload();
    await page.getByRole("button", { name: "Başvuruyu kalıcı olarak sil" }).click();
    await expect(page.getByText("Silmeyi onaylamak için kutuya SİL yaz.")).toBeVisible();
    await page.getByLabel(/Onaylamak için/).fill("sil");
    await page.getByRole("button", { name: "Başvuruyu kalıcı olarak sil" }).click();
    await expect(page).toHaveURL(/\/admin\?silindi=1$/);
    await expect(page.getByText("Başvuru ve ilişkili tüm kayıtlar kalıcı olarak silindi.")).toBeVisible();

    for (const table of ["applications", "invitations", "email_logs"]) {
      const col = table === "applications" ? "id" : "application_id";
      const { count } = await service().from(table).select("*", { count: "exact", head: true }).eq(col, a.id);
      expect(count, table).toBe(0);
    }
    const res = await page.goto(new URL(url).pathname);
    expect(res?.status()).toBe(404);
  });

  test("tarih/mekân kesinleşince onaylı katılımcılar bir kez bilgilendirilir", async ({ page }) => {
    test.setTimeout(240_000);
    const early = await seedApplication({ first_name: "Erken" });
    await openApplication(page, early.id);
    await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(page.getByText(/onaylandı/).first()).toBeVisible();
    expect(mailsTo(early.email, "invitation")[0].text).toContain("Tarih: Kesinleştiğinde e-posta ile bildirilecek");

    // Henüz kesinleşmemişken gönderim yapılamaz
    await page.goto("/admin/ayarlar");
    await expect(page.getByText("Önce tarihi veya mekânı yukarıdan kesinleşmiş olarak kaydet.")).toBeVisible();

    await page.getByLabel("Başlangıç (İstanbul saati)").fill("2026-10-31T12:00");
    await page.getByLabel("Bitiş (İstanbul saati)").fill("2026-10-31T17:00");
    await page.getByRole("checkbox", { name: /Tarih kesinleşti/ }).check();
    await page.getByRole("button", { name: "Ayarları kaydet" }).click();
    await expect(page.getByText("Ayarlar kaydedildi.")).toBeVisible();
    await page.reload();

    try {
      // Bütün onaylı katılımcılar bilgilenene kadar (25'erli turlar)
      for (let round = 0; round < 10; round++) {
        await expect(page.getByText(/onaylı katılımcı bilgilendirildi/)).toBeVisible(); // akış (streaming) tamamlansın
        const button = page.getByRole("button", { name: /Bilgilendirme gönder/ });
        if ((await button.count()) === 0) break;
        await button.click();
        await expect(page.getByText(/katılımcıya gönderildi|tamamına gönderildi/)).toBeVisible({ timeout: 60_000 });
        await page.reload();
      }
      await expect(page.getByText(/onaylı katılımcı bilgilendirildi/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Bilgilendirme gönder/ })).toHaveCount(0);

      const updates = mailsTo(early.email, "event_update");
      expect(updates).toHaveLength(1);
      expect(updates[0].text).toContain("31 Ekim 2026 Cumartesi");
      expect(updates[0].attachments[0]).toMatchObject({ contentId: "davetiye-qr" });
      // QR değişmedi
      expect(invitationFromMail(updates[0]).token).toBe(invitationFromMail(mailsTo(early.email, "invitation")[0]).token);

      // Kesinleşmeden SONRA onaylanan kişi zaten güncel bilgiyle davetiye aldığı için bekleyen sayılmaz
      const late = await seedApplication({ first_name: "Gec" });
      await openApplication(page, late.id);
      await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
      await expect(page.getByText(/onaylandı/).first()).toBeVisible();
      expect(mailsTo(late.email, "invitation")[0].text).toContain("31 Ekim 2026 Cumartesi");
      await page.goto("/admin/ayarlar");
      await expect(page.getByText(/onaylı katılımcı bilgilendirildi/)).toBeVisible();
      await expect(page.getByRole("button", { name: /Bilgilendirme gönder/ })).toHaveCount(0);
      expect(mailsTo(late.email, "event_update")).toHaveLength(0);
    } finally {
      await service().from("event_settings").update({ date_confirmed: false, starts_at: null, ends_at: null }).eq("id", 1);
    }
  });
});
