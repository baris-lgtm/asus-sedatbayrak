import { expect, test } from "./fixtures";
import { anon, mailsTo, service, uniqueEmail } from "./helpers";

test.describe("Landing page ve başvuru formu", () => {
  test("ana sayfa tüm bölümleri gösterir ve placeholder'lar açıkça işaretli", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ASUS × Sedat Bayrak Workshop/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Mimarlığın");
    for (const h of ["Mimarlığın bugününü ve geleceğini birlikte konuşalım.", "Önerilen oturum temaları", "Alanında uzman isimlerle ilham verici bir buluşma.", "ProArt P16 (H7607)", "Katılım için başvurun.", "Merak edilenler."]) {
      await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    }
    // Kesinleşmemiş bilgi gerçekmiş gibi gösterilmiyor
    // (Tarih kesinleşme gösterimi 03-admin-flow "ayarlar" testinde doğrulanır; ana sayfa 60 sn önbellekli.)
    // Program: 3 oturum, konuşmacılar
    await expect(page.locator("#program ol > li")).toHaveCount(3);
    await expect(page.locator("#konusmacilar li")).toHaveCount(4);
    // Ürün bağlantısı tanımlanmadıkça düğme gösterilmez
    await expect(page.getByRole("link", { name: /ProArt P16'yı keşfet/ })).toHaveCount(0);
    // Görseller yerinde; açılış videosu sessiz, döngüsüz ve duraklatılabilir
    await expect(page.locator("#konusmacilar img")).toHaveCount(4);
    const video = page.locator("section[aria-labelledby=hero-baslik] video");
    await expect(video).toHaveAttribute("src", "/media/hero-eskizden-mimariye.mp4");
    expect(await video.evaluate((v: HTMLVideoElement) => v.muted && !v.loop)).toBe(true);
    await expect(page.locator("section[aria-labelledby=hero-baslik]").getByRole("button", { name: /Videoyu (oynat|duraklat|tekrar oynat)/ })).toBeVisible();
    // Ürün videosu: sessiz başlar, döngüde; ses ve oynat düğmeleri var
    const pv = page.locator("#proart video");
    await expect(pv).toHaveAttribute("src", "/media/proart-p16-tanitim.mp4");
    expect(await pv.evaluate((v: HTMLVideoElement) => v.muted && v.loop)).toBe(true);
    await expect(page.locator("#proart").getByRole("button", { name: "Sesi aç" })).toBeVisible();
    // SSS — 6 soru
    await expect(page.locator("#sss details")).toHaveCount(6);
    // Meta: description + OG
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Workshop/);
  });

  test("T2: boş ve hatalı alanlar Türkçe hata mesajıyla reddedilir (istemci)", async ({ page }) => {
    await page.goto("/#basvuru");
    await page.getByRole("button", { name: "Başvuruyu gönder" }).click();
    await expect(page.getByText("Adınızı ve soyadınızı yazın.", { exact: true })).toBeVisible();
    await expect(page.getByText("E-posta adresinizi yazın.")).toBeVisible();
    await expect(page.getByText("Katılım motivasyonunuzu kısaca yazın.")).toBeVisible();
    await expect(page.getByText("Devam etmek için aydınlatma metnini okuduğunuzu onaylayın.")).toBeVisible();
    await page.getByLabel("Ad Soyad").fill("Tekkelime");
    await page.getByRole("textbox", { name: /^E-posta/ }).fill("gecersiz-eposta");
    await page.getByLabel("Telefon").fill("123");
    await page.getByRole("button", { name: "Başvuruyu gönder" }).click();
    await expect(page.getByText("Geçerli bir e-posta adresi yazın (ör. ad@ornek.com).")).toBeVisible();
    await expect(page.getByText(/Adınızı ve soyadınızı birlikte yazın/)).toBeVisible();
    await expect(page.getByText(/Geçerli bir telefon numarası yazın/)).toBeVisible();
    // İlk hatalı alana odaklanılır
    await expect(page.getByLabel("Ad Soyad")).toBeFocused();
  });

  test("T1/T3/T4/T9: geçerli başvuru kaydedilir, pending kalır, alındı e-postası loglanır", async ({ page }) => {
    const email = uniqueEmail("form");
    await page.goto("/#basvuru");
    await page.getByLabel("Ad Soyad").fill("Elif Su Yılmaz");
    await page.getByRole("textbox", { name: /^E-posta/ }).fill(email.toUpperCase());
    await page.getByLabel("Telefon").fill("0532 123 45 67");
    await page.getByLabel("Profesyonel / Öğrenci").selectOption({ label: "Öğrenci" });
    await page.getByLabel("Kurum / Okul").fill("İTÜ");
    await page.getByLabel("Kullandığınız tasarım araçları").fill("Revit, Blender");
    await page.getByLabel(/Portfolyo bağlantısı/).fill("https://ornek.com/elif");
    await page.getByLabel("Katılım motivasyonunuz").fill("Dijital üretim araçlarını öğrenmek istiyorum.");
    await page.getByRole("checkbox", { name: /KVKK aydınlatma metnini/ }).check();
    await page.getByRole("button", { name: "Başvuruyu gönder" }).click();

    await expect(page.getByText("Başvurunuz başarıyla alındı.")).toBeVisible();
    await expect(page.getByText("Bu ekran başvurunuzun kabul edildiği anlamına gelmez.", { exact: false })).toBeVisible();

    const { data } = await service().from("applications").select("*").eq("email_normalized", email).single();
    expect(data.status).toBe("pending");
    expect(data.phone).toBe("+905321234567");
    expect(data.marketing_consent).toBe(false);
    expect(data.marketing_consent_at).toBeNull();
    expect(data.kvkk_notice_version).toBe("TASLAK-v0");
    expect(data.additional_answers.motivation).toContain("Dijital");
    expect(data.additional_answers.tools).toBe("Revit, Blender");
    expect(data.additional_answers.portfolio).toBe("https://ornek.com/elif");
    expect(data).toMatchObject({ first_name: "Elif Su", last_name: "Yılmaz", participant_type: "student", institution: "İTÜ", department: null });

    const { data: logs } = await service().from("email_logs").select("email_type, status, provider_message_id").eq("application_id", data.id);
    expect(logs).toEqual([expect.objectContaining({ email_type: "application_received", status: "sent" })]);
    expect(mailsTo(email.toUpperCase(), "application_received")).toHaveLength(1);
  });

  test("pazarlama izni ayrı ve isteğe bağlı; işaretlenirse zaman damgası kaydedilir", async ({ request }) => {
    const email = uniqueEmail("izin");
    const res = await request.post("/api/applications", {
      headers: { origin: "http://localhost:3000" },
      data: {
        fullName: "Can Demir", email, phone: "05551234567", participantType: "professional",
        institution: "Serbest", motivation: "Test motivasyonu", kvkkAcknowledged: true, marketingConsent: true,
      },
    });
    expect(res.status()).toBe(201);
    const { data } = await service().from("applications").select("marketing_consent, marketing_consent_at, marketing_consent_version").eq("email_normalized", email).single();
    expect(data).toMatchObject({ marketing_consent: true, marketing_consent_version: "TASLAK-v0" });
    expect(data?.marketing_consent_at).not.toBeNull();
  });

  test("T2 (sunucu): istemci atlatılsa da sunucu doğrular", async ({ request }) => {
    const res = await request.post("/api/applications", {
      headers: { origin: "http://localhost:3000" },
      data: { fullName: "", email: "kotu", phone: "1", participantType: "hacker", kvkkAcknowledged: false },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.fieldErrors).toMatchObject({
      fullName: expect.any(String),
      motivation: expect.any(String),
      email: "Geçerli bir e-posta adresi yazın (ör. ad@ornek.com).",
      participantType: expect.any(String),
      kvkkAcknowledged: expect.any(String),
    });
  });

  test("T15: aynı e-posta (farklı harf) ikinci kez başvuramaz", async ({ request, page }) => {
    const email = uniqueEmail("mukerrer");
    const payload = {
      fullName: "Ali Kaya", email, phone: "05551234567", participantType: "academic",
      institution: "ODTÜ", motivation: "Test motivasyonu", kvkkAcknowledged: true,
    };
    const h = { origin: "http://localhost:3000" };
    expect((await request.post("/api/applications", { headers: h, data: payload })).status()).toBe(201);
    const dup = await request.post("/api/applications", { headers: h, data: { ...payload, email: `  ${email.toUpperCase()} ` } });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).message).toContain("daha önce başvuru yapılmış");

    // UI'da da anlaşılır mesaj
    await page.goto("/#basvuru");
    await page.getByLabel("Ad Soyad").fill("Ali Kaya");
    await page.getByRole("textbox", { name: /^E-posta/ }).fill(email);
    await page.getByLabel("Telefon").fill("05551234567");
    await page.getByLabel("Profesyonel / Öğrenci").selectOption({ label: "Akademisyen" });
    await page.getByLabel("Kurum / Okul").fill("ODTÜ");
    await page.getByLabel("Katılım motivasyonunuz").fill("Merak ediyorum.");
    await page.getByRole("checkbox", { name: /KVKK aydınlatma metnini/ }).check();
    await page.getByRole("button", { name: "Başvuruyu gönder" }).click();
    await expect(page.locator("main [role=alert]")).toContainText("daha önce başvuru yapılmış");
  });

  test("ağ hatasında veriler korunur ve tekrar gönderilebilir", async ({ page }) => {
    const email = uniqueEmail("ag");
    await page.goto("/#basvuru");
    await page.route("/api/applications", (r) => r.abort("internetdisconnected"));
    await page.getByLabel("Ad Soyad").fill("Deniz Ak");
    await page.getByRole("textbox", { name: /^E-posta/ }).fill(email);
    await page.getByLabel("Telefon").fill("05551234567");
    await page.getByLabel("Profesyonel / Öğrenci").selectOption({ label: "Diğer" });
    await page.getByLabel("Kurum / Okul").fill("Serbest");
    await page.getByLabel("Katılım motivasyonunuz").fill("Fotoğraf ve mimari.");
    await page.getByRole("checkbox", { name: /KVKK aydınlatma metnini/ }).check();
    await page.getByRole("button", { name: "Başvuruyu gönder" }).click();
    await expect(page.locator("main [role=alert]")).toContainText("Bağlantı kurulamadı");
    await expect(page.getByRole("textbox", { name: /^E-posta/ })).toHaveValue(email);

    await page.unroute("/api/applications");
    await page.getByRole("button", { name: "Tekrar gönder" }).click();
    await expect(page.getByText("Başvurunuz başarıyla alındı.")).toBeVisible();
  });

  test("spam koruması: honeypot dolu ise kayıt yapılmaz; kökensiz istek reddedilir", async ({ request }) => {
    const email = uniqueEmail("bot");
    const data = {
      fullName: "Bot Bot", email, phone: "05551234567", participantType: "other",
      institution: "x", motivation: "Test motivasyonu", kvkkAcknowledged: true, website: "http://spam.example",
    };
    expect((await request.post("/api/applications", { headers: { origin: "http://localhost:3000" }, data })).status()).toBe(201);
    const { count } = await service().from("applications").select("id", { count: "exact", head: true }).eq("email_normalized", email);
    expect(count).toBe(0);

    const noOrigin = await request.post("/api/applications", { data: { ...data, website: "" } });
    expect(noOrigin.status()).toBe(403);
    const evil = await request.post("/api/applications", { headers: { origin: "https://kotu-site.example" }, data: { ...data, website: "" } });
    expect(evil.status()).toBe(403);
  });

  test("T18: anonim kullanıcı public anahtarla başvuruları okuyamaz ve yazamaz", async () => {
    const a = anon();
    const read = await a.from("applications").select("id, email").limit(5);
    expect(read.error?.code).toBe("42501");
    const write = await a.from("applications").insert({ first_name: "x" });
    expect(write.error?.code).toBe("42501");
    for (const t of ["invitations", "email_logs", "admin_audit_logs", "staff_members", "rate_limits"]) {
      const r = await a.from(t).select("*").limit(1);
      expect(r.error?.code, t).toBe("42501");
    }
    const rpc = await a.rpc("admin_approve", { p_application_id: crypto.randomUUID(), p_invitation_id: crypto.randomUUID(), p_qr_token_hash: "0".repeat(64), p_manual_code_hash: "0".repeat(64) });
    expect(rpc.error).not.toBeNull();
  });

  test("hukuki metinler yayında; taslak uyarısı yok", async ({ page }) => {
    await page.goto("/kvkk");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(8);
    await expect(page.getByRole("link", { name: "LegalCompliance@asus.com" }).first()).toHaveAttribute("href", "mailto:LegalCompliance@asus.com");
    await page.goto("/gizlilik");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gizlilik Politikası");
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(12);
    await page.goto("/#basvuru");
    await expect(page.getByText(/Taslak: KVKK/)).toHaveCount(0);
  });

  test("SEO: robots, sitemap; davetiye ve admin indekslenmez", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /davetiye");
    expect(await (await request.get("/sitemap.xml")).text()).toContain("<loc>http://localhost:3000/</loc>");
  });
});
