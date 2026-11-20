import { expect, test } from "./fixtures";
import { USERS, invitationFromMail, mailsTo, seedApplication, service, setCapacity, uiLogin, uniqueEmail } from "./helpers";

test.describe("Yanlış e-postayı düzeltip yeniden gönderme", () => {
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await uiLogin(page, USERS.admin);
  });

  test("onaylı kişinin e-postası düzeltilir ve davetiye yeni adrese gider (aynı QR)", async ({ page }) => {
    await setCapacity(1000);
    const app = await seedApplication({ first_name: "Düzelt" });
    await page.goto(`/admin/basvurular/${app.id}`);
    await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
    await expect(page.getByRole("button", { name: "Davetiyeyi tekrar gönder" })).toBeVisible({ timeout: 20_000 });
    const firstCode = invitationFromMail(mailsTo(app.email, "invitation")[0]).code;

    const fixed = uniqueEmail("dogru");
    await page.getByRole("button", { name: "Bilgileri düzenle" }).click();
    await page.getByLabel("E-posta", { exact: true }).fill(fixed.toUpperCase());
    await page.getByLabel("Telefon").fill("0555 111 22 33");
    await expect(page.getByLabel(/QR davetiyesini bu adrese tekrar gönder/)).toBeChecked();
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText(new RegExp(`Bilgiler güncellendi. Davetiye .* adresine gönderildi`, "i"))).toBeVisible({ timeout: 20_000 });

    const { data } = await service().from("applications").select("email_normalized, phone").eq("id", app.id).single();
    expect(data!.email_normalized).toBe(fixed);
    expect(data!.phone).toBe("+905551112233");
    const resent = mailsTo(fixed.toUpperCase(), "invitation_resend").concat(mailsTo(fixed, "invitation_resend"));
    expect(resent).toHaveLength(1);
    expect(invitationFromMail(resent[0]).code).toBe(firstCode);
    await expect(page.getByText("İletişim bilgileri düzeltildi")).toBeVisible();
  });

  test("reddedilmiş kişinin e-postası düzeltilir ve bilgilendirme yeniden gider", async ({ page }) => {
    const app = await seedApplication({ first_name: "RetDuzelt" });
    await service().from("applications").update({ status: "rejected" }).eq("id", app.id);
    const fixed = uniqueEmail("retdogru");
    await page.goto(`/admin/basvurular/${app.id}`);
    await page.getByRole("button", { name: "Bilgileri düzenle" }).click();
    await page.getByLabel("E-posta", { exact: true }).fill(fixed);
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText(/Bilgilendirme e-postası .* adresine gönderildi/)).toBeVisible({ timeout: 20_000 });
    const m = mailsTo(fixed, "rejected");
    expect(m).toHaveLength(1);
    expect(m[0].subject).toContain("Başvurunuz için teşekkür ederiz");
  });

  test("başka bir başvurunun e-postası verilemez", async ({ page }) => {
    const a = await seedApplication({ first_name: "Birinci" });
    const b = await seedApplication({ first_name: "Ikinci" });
    await page.goto(`/admin/basvurular/${a.id}`);
    await page.getByRole("button", { name: "Bilgileri düzenle" }).click();
    await page.getByLabel("E-posta", { exact: true }).fill(b.email);
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("Bu e-posta adresiyle başka bir aktif başvuru var.")).toBeVisible();
  });
});
