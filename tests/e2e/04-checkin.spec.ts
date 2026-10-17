import { expect, test } from "./fixtures";
import { USERS, cookieHeader, invitationFromMail, mailsTo, seedApplication, service, sessionCookies, uiLogin } from "./helpers";

async function approved(firstName: string) {
  return { app: await seedApplication({ first_name: firstName, last_name: "Katılımcı" }) };
}

test.describe("Check-in", () => {
  test("T11/T12/T13: manuel kodla tek giriş; ikinci deneme engellenir; geçersiz kod reddedilir", async ({ page, browser }) => {
    // Kurulum: admin onaylar
    const { app } = await approved("Kapi");
    const adminCtx = await browser.newContext({ baseURL: "http://localhost:3000" });
    const adminPage = await adminCtx.newPage();
    adminPage.on("dialog", (d) => d.accept());
    await uiLogin(adminPage, USERS.admin);
    await adminPage.goto(`/admin/basvurular/${app.id}`);
    await adminPage.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(adminPage.getByText(/onaylandı/)).toBeVisible();
    await adminCtx.close();
    const { code } = invitationFromMail(mailsTo(app.email, "invitation")[0]);

    await uiLogin(page, USERS.door);
    await expect(page).toHaveURL(/check-in/);
    const input = page.getByLabel("Giriş kodu", { exact: true });

    await input.fill(code.toLowerCase().replace(/-/g, " "));
    await page.getByRole("button", { name: "Kontrol et" }).click();
    await expect(page.getByText("Giriş onaylandı")).toBeVisible();
    await expect(page.getByText("Kapi Katılımcı — Öğrenci")).toBeVisible();

    const { data: first } = await service().from("invitations").select("checked_in_at, checked_in_by").eq("application_id", app.id).single();
    expect(first?.checked_in_at).not.toBeNull();

    await page.waitForTimeout(1600);
    await input.fill(code);
    await page.getByRole("button", { name: "Kontrol et" }).click();
    await expect(page.getByText("Bu katılımcının girişi daha önce yapılmış")).toBeVisible();

    const { data: second } = await service().from("invitations").select("checked_in_at, checked_in_by").eq("application_id", app.id).single();
    expect(second).toEqual(first); // ilk kayıt değişmedi
    const { data: a2 } = await service().from("applications").select("status").eq("id", app.id).single();
    expect(a2?.status).toBe("checked_in");

    await page.waitForTimeout(1600);
    await input.fill("ZZZZ-ZZZZ-ZZ");
    await page.getByRole("button", { name: "Kontrol et" }).click();
    await expect(page.getByText("Geçersiz kod")).toBeVisible();
  });

  test("T11/T12: aynı QR'a 15 eş zamanlı istek → yalnızca bir başarılı giriş", async ({ request, browser }) => {
    const a = await seedApplication({ first_name: "Paralel" });
    const ctx = await browser.newContext({ baseURL: "http://localhost:3000" });
    const p = await ctx.newPage();
    p.on("dialog", (d) => d.accept());
    await uiLogin(p, USERS.admin);
    await p.goto(`/admin/basvurular/${a.id}`);
    await p.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(p.getByText(/onaylandı/)).toBeVisible();
    await ctx.close();
    const { url } = invitationFromMail(mailsTo(a.email, "invitation")[0]);

    const cookie = cookieHeader(await sessionCookies(USERS.door));
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        request.post("/api/admin/check-in", { headers: { cookie }, data: { mode: "qr", value: url } }).then((r) => r.json()),
      ),
    );
    expect(results.filter((r) => r.result === "ok")).toHaveLength(1);
    expect(results.filter((r) => r.result === "already")).toHaveLength(14);
  });

  test("kamera izni reddedilirse anlaşılır hata ve manuel giriş çalışır durumda kalır", async ({ page }) => {
    await uiLogin(page, USERS.door);
    await expect(page).toHaveURL(/check-in/);
    await page.getByRole("button", { name: "Kamerayı aç" }).click();
    await expect(page.locator("main [role=alert]")).toContainText(/Kamera (izni reddedildi|başlatılamadı|bulunamadı)|bu cihazda kamera/i);
    await expect(page.getByLabel("Giriş kodu", { exact: true })).toBeEnabled();
  });
});
