import { expect, test } from "./fixtures";
import { USERS, mailsTo, seedApplication, service, uiLogin, uniqueEmail } from "./helpers";

test.describe("Katılamayanlara toplu ret + indirim e-postası", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await uiLogin(page, USERS.admin);
  });

  test("test e-postası başvurulara dokunmadan gider", async ({ page }) => {
    await page.goto("/admin/toplu-ret");
    await page.getByLabel("Test e-postası adresi").fill("deneme@mimarliginevrimi.com");
    await page.getByRole("button", { name: "Test e-postası gönder" }).click();
    await expect(page.getByText(/Test e-postası deneme@mimarliginevrimi.com adresine gönderildi/)).toBeVisible();
    const m = mailsTo("deneme@mimarliginevrimi.com", "preview");
    expect(m).toHaveLength(1);
    expect(m[0].subject).toBe("[TEST] ASUS ProArt Mimarlığın Evrimi — Başvurunuz için teşekkür ederiz");
    expect(m[0].text).toContain("%10 İNDİRİM");
    expect(m[0].attachments).toHaveLength(3);
  });

  test("listedekiler parça parça reddedilir; onaylılara dokunulmaz; tekrar e-posta gitmez", async ({ page }) => {
    test.setTimeout(180_000);
    const pend = [];
    for (let i = 0; i < 5; i++) pend.push(await seedApplication({ first_name: `Ret${i}` }));
    const wait = await seedApplication({ first_name: "Yedek" });
    await service().from("applications").update({ status: "waitlisted" }).eq("id", wait.id);
    const oldRejected = await seedApplication({ first_name: "EskiRet" });
    await service().from("applications").update({ status: "rejected" }).eq("id", oldRejected.id);
    const approved = await seedApplication({ first_name: "Onayli" });
    await service().from("applications").update({ status: "approved" }).eq("id", approved.id);
    const missing = uniqueEmail("yok");

    const list = [...pend, wait, oldRejected, approved].map((a) => a.email).concat(missing).join("\n");
    await page.goto("/admin/toplu-ret");
    await page.getByLabel("E-posta listesi").fill(list);
    await page.getByRole("button", { name: "Kontrol et" }).click();
    await expect(page.getByText("Reddedilip e-posta alacak:")).toContainText("6");
    await expect(page.getByText("Zaten reddedilmiş, yalnızca e-posta alacak:")).toContainText("1");
    await expect(page.getByText("Onaylı / giriş yapmış:")).toContainText("1");
    await expect(page.getByText(/Listede 1 onaylı kişi var/)).toBeVisible();
    await expect(page.getByText(/1 adres başvurularda bulunamadı/)).toBeVisible();

    // 1. parça: 3 kişi
    await page.getByLabel("Bu seferde en fazla kaç kişi").fill("3");
    await page.getByRole("button", { name: "3 kişiye gönder" }).click();
    await expect(page.getByText(/Bu parça tamamlandı: \d ret, 3 e-posta gönderildi/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Bu e-postayı zaten almış:")).toContainText("3");

    // 2. parça: kalanların hepsi
    await page.getByLabel("Bu seferde en fazla kaç kişi").fill("50");
    await page.getByRole("button", { name: "4 kişiye gönder" }).click();
    await expect(page.getByText(/Tamamlandı: \d ret, 4 e-posta gönderildi/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Gönderilecek kimse kalmadı.")).toBeVisible();

    const db = service();
    for (const a of [...pend, wait, oldRejected]) {
      const { data } = await db.from("applications").select("status").eq("id", a.id).single();
      expect(data!.status, a.email).toBe("rejected");
      const m = mailsTo(a.email, "rejected");
      expect(m, a.email).toHaveLength(1);
      expect(m[0].subject).toBe("ASUS ProArt Mimarlığın Evrimi — Başvurunuz için teşekkür ederiz");
      expect(m[0].attachments).toHaveLength(3);
    }
    const { data: ok } = await db.from("applications").select("status").eq("id", approved.id).single();
    expect(ok!.status).toBe("approved");
    expect(mailsTo(approved.email, "rejected")).toHaveLength(0);

    // Tekrar kontrol: herkes almış
    await page.getByRole("button", { name: "Kontrol et" }).click();
    await expect(page.getByText("Bu e-postayı zaten almış:")).toContainText("7");
  });

  test("kapı ekibi bu sayfaya giremez", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await uiLogin(page, USERS.door);
    await page.goto("/admin/toplu-ret");
    await expect(page).not.toHaveURL(/toplu-ret$/);
    await ctx.close();
  });
});
