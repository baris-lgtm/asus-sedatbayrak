import { expect, test } from "./fixtures";
import { anon, mailsTo, service, uniqueEmail } from "./helpers";

test.describe("Landing page ve başvuru formu", () => {
  test("ana sayfa tüm bölümleri gösterir ve placeholder'lar açıkça işaretli", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ASUS × Sedat Bayrak Workshop/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sedat Bayrak");
    for (const h of ["Workshop deneyimi", "Sedat Bayrak", "ASUS ile üretim", "Katılım nasıl kesinleşir", "Başvuru formu", "Mekân ve ulaşım", "Sık sorulanlar"]) {
      await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    }
    // Kesinleşmemiş bilgi gerçekmiş gibi gösterilmiyor
    await expect(page.getByText("Yakında duyurulacak").first()).toBeVisible();
    await expect(page.getByRole("img", { name: /görsel henüz eklenmedi/ }).first()).toBeVisible();
    // SSS — 6 soru
    await expect(page.locator("#sss details")).toHaveCount(6);
    // Meta: description + OG
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Workshop/);
  });

  test("T2: boş ve hatalı alanlar Türkçe hata mesajıyla reddedilir (istemci)", async ({ page }) => {
    await page.goto("/#basvuru");
    await page.getByRole("button", { name: "Başvuruyu gönder" }).click();
    await expect(page.getByText("Ad alanını doldurmalısın.", { exact: true })).toBeVisible();
    await expect(page.getByText("E-posta adresini yazmalısın.")).toBeVisible();
    await expect(page.getByText("Devam etmek için aydınlatma metnini okuduğunu onaylamalısın.")).toBeVisible();
    await page.getByLabel("E-posta", { exact: true }).fill("gecersiz-eposta");
    await page.getByLabel("Telefon").fill("123");
    await page.getByRole("button", { name: "Başvuruyu gönder" }).click();
    await expect(page.getByText("Geçerli bir e-posta adresi yaz (ör. ad@ornek.com).")).toBeVisible();
    await expect(page.getByText(/Geçerli bir telefon numarası yaz/)).toBeVisible();
    // İlk hatalı alana odaklanılır
    await expect(page.getByLabel("Ad", { exact: true })).toBeFocused();
  });

  test("T1/T3/T4/T9: geçerli başvuru kaydedilir, pending kalır, alındı e-postası loglanır", async ({ page }) => {
    const email = uniqueEmail("form");
    await page.goto("/#basvuru");
    await page.getByLabel("Ad", { exact: true }).fill("Elif");
    await page.getByLabel("Soyad").fill("Yılmaz");
    await page.getByLabel("E-posta", { exact: true }).fill(email.toUpperCase());
    await page.getByLabel("Telefon").fill("0532 123 45 67");
    await page.getByText("Öğrenci", { exact: true }).click();
    await page.getByLabel("Kurum / üniversite").fill("İTÜ");
    await page.getByLabel("Bölüm / uzmanlık alanı").fill("Mimarlık");
    await page.getByLabel(/neden katılmak/).fill("Dijital üretim araçlarını öğrenmek istiyorum.");
    await page.getByRole("checkbox", { name: /KVKK aydınlatma metnini/ }).check();
    await page.getByRole("button", { name: "Başvuruyu gönder" }).click();

    await expect(page.getByText("Başvurun başarıyla alındı.")).toBeVisible();
    await expect(page.getByText("Bu ekran başvurunun kabul edildiği anlamına gelmez.", { exact: false })).toBeVisible();

    const { data } = await service().from("applications").select("*").eq("email_normalized", email).single();
    expect(data.status).toBe("pending");
    expect(data.phone).toBe("+905321234567");
    expect(data.marketing_consent).toBe(false);
    expect(data.marketing_consent_at).toBeNull();
    expect(data.kvkk_notice_version).toBe("TASLAK-v0");
    expect(data.additional_answers.motivation).toContain("Dijital");

    const { data: logs } = await service().from("email_logs").select("email_type, status, provider_message_id").eq("application_id", data.id);
    expect(logs).toEqual([expect.objectContaining({ email_type: "application_received", status: "sent" })]);
    expect(mailsTo(email.toUpperCase(), "application_received")).toHaveLength(1);
  });

  test("pazarlama izni ayrı ve isteğe bağlı; işaretlenirse zaman damgası kaydedilir", async ({ request }) => {
    const email = uniqueEmail("izin");
    const res = await request.post("/api/applications", {
      headers: { origin: "http://localhost:3000" },
      data: {
        firstName: "Can", lastName: "Demir", email, phone: "05551234567", participantType: "professional",
        institution: "Serbest", department: "Tasarım", kvkkAcknowledged: true, marketingConsent: true,
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
      data: { firstName: "", email: "kotu", phone: "1", participantType: "hacker", kvkkAcknowledged: false },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.fieldErrors).toMatchObject({
      firstName: expect.any(String),
      email: "Geçerli bir e-posta adresi yaz (ör. ad@ornek.com).",
      participantType: expect.any(String),
      kvkkAcknowledged: expect.any(String),
    });
  });

  test("T15: aynı e-posta (farklı harf) ikinci kez başvuramaz", async ({ request, page }) => {
    const email = uniqueEmail("mukerrer");
    const payload = {
      firstName: "Ali", lastName: "Kaya", email, phone: "05551234567", participantType: "academic",
      institution: "ODTÜ", department: "Endüstriyel Tasarım", kvkkAcknowledged: true,
    };
    const h = { origin: "http://localhost:3000" };
    expect((await request.post("/api/applications", { headers: h, data: payload })).status()).toBe(201);
    const dup = await request.post("/api/applications", { headers: h, data: { ...payload, email: `  ${email.toUpperCase()} ` } });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).message).toContain("daha önce başvuru yapılmış");

    // UI'da da anlaşılır mesaj
    await page.goto("/#basvuru");
    await page.getByLabel("Ad", { exact: true }).fill("Ali");
    await page.getByLabel("Soyad").fill("Kaya");
    await page.getByLabel("E-posta", { exact: true }).fill(email);
    await page.getByLabel("Telefon").fill("05551234567");
    await page.getByText("Akademisyen", { exact: true }).click();
    await page.getByLabel("Kurum / üniversite").fill("ODTÜ");
    await page.getByLabel("Bölüm / uzmanlık alanı").fill("Tasarım");
    await page.getByRole("checkbox", { name: /KVKK aydınlatma metnini/ }).check();
    await page.getByRole("button", { name: "Başvuruyu gönder" }).click();
    await expect(page.locator("main [role=alert]")).toContainText("daha önce başvuru yapılmış");
  });

  test("ağ hatasında veriler korunur ve tekrar gönderilebilir", async ({ page }) => {
    const email = uniqueEmail("ag");
    await page.goto("/#basvuru");
    await page.route("/api/applications", (r) => r.abort("internetdisconnected"));
    await page.getByLabel("Ad", { exact: true }).fill("Deniz");
    await page.getByLabel("Soyad").fill("Ak");
    await page.getByLabel("E-posta", { exact: true }).fill(email);
    await page.getByLabel("Telefon").fill("05551234567");
    await page.getByText("Diğer", { exact: true }).click();
    await page.getByLabel("Kurum / üniversite").fill("Serbest");
    await page.getByLabel("Bölüm / uzmanlık alanı").fill("Fotoğraf");
    await page.getByRole("checkbox", { name: /KVKK aydınlatma metnini/ }).check();
    await page.getByRole("button", { name: "Başvuruyu gönder" }).click();
    await expect(page.locator("main [role=alert]")).toContainText("Bağlantı kurulamadı");
    await expect(page.getByLabel("E-posta", { exact: true })).toHaveValue(email);

    await page.unroute("/api/applications");
    await page.getByRole("button", { name: "Tekrar gönder" }).click();
    await expect(page.getByText("Başvurun başarıyla alındı.")).toBeVisible();
  });

  test("spam koruması: honeypot dolu ise kayıt yapılmaz; kökensiz istek reddedilir", async ({ request }) => {
    const email = uniqueEmail("bot");
    const data = {
      firstName: "Bot", lastName: "Bot", email, phone: "05551234567", participantType: "other",
      institution: "x", department: "x", kvkkAcknowledged: true, website: "http://spam.example",
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

  test("SEO: robots, sitemap; davetiye ve admin indekslenmez", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /davetiye");
    expect(await (await request.get("/sitemap.xml")).text()).toContain("<loc>http://localhost:3000/</loc>");
  });
});
