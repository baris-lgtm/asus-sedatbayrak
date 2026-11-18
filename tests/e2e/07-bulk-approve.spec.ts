import { expect, test } from "./fixtures";
import { USERS, countTaken, invitationFromMail, mailsTo, seedApplication, service, setCapacity, uiLogin, uniqueEmail } from "./helpers";

test.describe("Toplu onay", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await uiLogin(page, USERS.admin);
  });

  test("e-posta listesinden onaylar ve davetiye gönderir; tekrar çalıştırmak çift e-posta göndermez", async ({ page }) => {
    test.setTimeout(240_000);
    await setCapacity(1000);
    const apps = [];
    for (let i = 0; i < 18; i++) apps.push(await seedApplication({ first_name: `Toplu${i}` }));
    const rejected = await seedApplication({ first_name: "Reddedilen" });
    await service().from("applications").update({ status: "rejected" }).eq("id", rejected.id);
    const missing = uniqueEmail("yok");

    // Excel'den kopyalanmış gibi: sekmeli satırlar, büyük harf, tekrar eden adres
    const pasted = [
      ...apps.map((a, i) => `${i + 1}\tToplu ${i}\t${i === 0 ? a.email.toUpperCase() : a.email}\tKurum`),
      apps[1].email,
      rejected.email,
      missing,
    ].join("\n");

    await page.goto("/admin/toplu-onay");
    await page.getByLabel("E-posta listesi").fill(pasted);
    await page.getByRole("button", { name: "Listeyi kontrol et" }).click();
    await expect(page.getByText("Listedeki adres:")).toContainText("20");
    await expect(page.getByText("Onaylanacak:")).toContainText("18");
    await expect(page.getByText(/1 adres başvurularda bulunamadı/)).toBeVisible();
    await expect(page.getByText(/1 kişi reddedilmiş/)).toBeVisible();

    const before = await countTaken();
    await page.getByRole("button", { name: "18 kişiyi onayla ve davetiye gönder" }).click();
    await expect(page.getByText("Tamamlandı: 18 onay, 18 davetiye gönderildi.")).toBeVisible({ timeout: 180_000 });
    expect(await countTaken()).toBe(before + 18);

    for (const a of apps) {
      const sent = mailsTo(a.email, "invitation");
      expect(sent, a.email).toHaveLength(1);
      expect(invitationFromMail(sent[0]).code).toMatch(/^.{4}-.{4}-.{2}$/);
    }
    expect(mailsTo(rejected.email, "invitation")).toHaveLength(0);
    const { data: rej } = await service().from("applications").select("status").eq("id", rejected.id).single();
    expect(rej!.status).toBe("rejected");

    // Aynı listeyle tekrar: kimse yeniden onaylanmaz, e-posta gitmez
    await expect(page.getByText(/Listedeki herkes zaten onaylı/)).toBeVisible();
    await page.getByRole("button", { name: "Listeyi kontrol et" }).click();
    await expect(page.getByText("Zaten onaylı ve davetiyesi gitmiş:")).toContainText("18");
    for (const a of apps) expect(mailsTo(a.email, "invitation")).toHaveLength(1);
  });

  test("kapasite yetmezse gönderim başlatılmaz", async ({ page }) => {
    const a = await seedApplication({ first_name: "Kapasite" });
    const b = await seedApplication({ first_name: "Kapasite2" });
    await setCapacity((await countTaken()) + 1);
    await page.goto("/admin/toplu-onay");
    await page.getByLabel("E-posta listesi").fill(`${a.email}\n${b.email}`);
    await page.getByRole("button", { name: "Listeyi kontrol et" }).click();
    await expect(page.getByText(/Kapasite yetmiyor: 1 kişi fazla/)).toBeVisible();
    await expect(page.getByRole("button", { name: /onayla ve davetiye gönder/ })).toBeDisabled();
    await setCapacity(300);
  });

  test("kapı ekibi toplu onay sayfasına giremez", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await uiLogin(page, USERS.door);
    await page.goto("/admin/toplu-onay");
    await expect(page).not.toHaveURL(/toplu-onay$/);
    await ctx.close();
  });
});
