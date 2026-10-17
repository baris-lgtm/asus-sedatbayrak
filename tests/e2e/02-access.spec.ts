import { expect, test } from "./fixtures";
import { USERS, cookieHeader, seedApplication, sessionCookies, uiLogin } from "./helpers";

test.describe("Yetkilendirme", () => {
  test("T5: oturumsuz ziyaretçi admin sayfalarına erişemez", async ({ page }) => {
    for (const path of ["/admin", "/admin/ayarlar", "/admin/check-in", `/admin/basvurular/${crypto.randomUUID()}`]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/login$/);
    }
  });

  test("T6/T14: oturumsuz istek admin API'lerini kullanamaz", async ({ request }) => {
    expect((await request.get("/api/admin/export")).status()).toBe(401);
    expect((await request.post("/api/admin/check-in", { data: { mode: "code", value: "ABCD-EFGH-JK" } })).status()).toBe(401);
    expect((await request.get("/api/cron/purge")).status()).toBe(401);
  });

  test("hatalı parola reddedilir", async ({ page }) => {
    await uiLogin(page, { email: USERS.admin.email, password: "yanlis-parola" });
    await expect(page.locator("main [role=alert]")).toHaveText("E-posta veya parola hatalı.");
  });

  test("T5/T6: giriş yapmış ama yetkisiz kullanıcı panele ve API'lere erişemez", async ({ page, request }) => {
    await uiLogin(page, USERS.outsider);
    await expect(page.locator("main [role=alert]")).toHaveText("Bu hesabın yönetim paneline erişim yetkisi yok.");

    // Oturum çerezleriyle doğrudan denense bile
    const cookie = cookieHeader(await sessionCookies(USERS.outsider));
    const app = await seedApplication();
    const exp = await request.get("/api/admin/export", { headers: { cookie } });
    expect(exp.status()).toBe(401);
    expect(await exp.text()).not.toContain(app.email);
    const ci = await request.post("/api/admin/check-in", { headers: { cookie }, data: { mode: "code", value: "ABCD-EFGH-JK" } });
    expect(ci.status()).toBe(401);
    const adminPage = await request.get("/admin", { headers: { cookie }, maxRedirects: 0 });
    expect(adminPage.status()).toBe(307);
    expect(adminPage.headers().location).toContain("/admin/login");
  });

  test("T14: kapı ekibi (checkin rolü) yalnızca check-in ekranını kullanabilir", async ({ page, request }) => {
    await uiLogin(page, USERS.door);
    await expect(page).toHaveURL(/\/admin\/check-in$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/check-in$/);
    await page.goto("/admin/ayarlar");
    await expect(page).toHaveURL(/\/admin\/check-in$/);
    await expect(page.getByRole("link", { name: "Başvurular" })).toHaveCount(0);

    const cookie = cookieHeader(await sessionCookies(USERS.door));
    expect((await request.get("/api/admin/export", { headers: { cookie } })).status()).toBe(403);
  });

  test("T14: admin CSV indirebilir; hücreler formül enjeksiyonuna karşı korunur", async ({ request }) => {
    await seedApplication({ first_name: "=HYPERLINK(\"http://kotu.example\",\"tikla\")", last_name: "+Enjeksiyon" });
    const cookie = cookieHeader(await sessionCookies(USERS.admin));
    const res = await request.get("/api/admin/export", { headers: { cookie } });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = await res.text();
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body).toContain("Ad,Soyad,E-posta,Telefon");
    expect(body).toContain(`"'=HYPERLINK(""http://kotu.example"",""tikla"")"`);
    expect(body).toContain("'+Enjeksiyon");
    expect(body).not.toMatch(/(^|,)=HYPERLINK/m);
  });
});

test("rate limit: aynı IP'den kısa sürede çok sayıda başvuru denemesi engellenir", async ({ request }) => {
  const statuses: number[] = [];
  for (let i = 0; i < 22; i++) {
    const r = await request.post("/api/applications", { headers: { origin: "http://localhost:3000" }, data: { firstName: "" } });
    statuses.push(r.status());
  }
  expect(statuses.slice(0, 20).every((s) => s === 422)).toBe(true);
  expect(statuses.slice(20)).toEqual([429, 429]);
});

test("herkese açık kayıt (sign-up) kapalı: kimse kendine hesap açamaz", async () => {
  const { anon } = await import("./helpers");
  const { error } = await anon().auth.signUp({ email: `saldirgan.${Date.now()}@example.com`, password: "Guclu-Parola-123!" });
  expect(error?.message ?? "").toMatch(/signups? not allowed|disabled/i);
});

test("ekip ekleme komutu: kullanıcı oluşturur, rol verir, verilen parolayla giriş yapılır", async ({ page }) => {
  const { execFileSync } = await import("node:child_process");
  const email = `yeni.ekip.${Date.now()}@test.local`;
  const out = execFileSync("node", ["scripts/add-staff.mjs", email, "checkin"], { encoding: "utf8" });
  expect(out).toContain(`${email} → checkin`);
  const password = out.match(/Geçici parola[^:]*: (\S+)/)?.[1];
  expect(password).toBeTruthy();
  await uiLogin(page, { email, password: password! });
  await expect(page).toHaveURL(/\/admin\/check-in$/);
  // Tekrar çalıştırmak rolü günceller, yeni kullanıcı açmaz
  const again = execFileSync("node", ["scripts/add-staff.mjs", email, "admin"], { encoding: "utf8" });
  expect(again).toContain("yalnızca rolü güncellendi");
});

test("paylaşım görseli ve site ikonu", async ({ request, page }) => {
  const og = await request.get("/opengraph-image");
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /icon/);
});
