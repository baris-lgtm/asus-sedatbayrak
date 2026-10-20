import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { USERS, service, uiLogin, uniqueEmail } from "./helpers";

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("T16: mobil görünüm", () => {
  test("landing ve form mobilde kullanılabilir", async ({ page }) => {
    await page.goto("/");
    await noHorizontalScroll(page);
    await page.getByRole("link", { name: "Katılım için başvur" }).first().click();
    await expect(page.getByRole("heading", { name: "Yerini ayır, yaratıcılığa katıl." })).toBeInViewport();

    const email = uniqueEmail("mobil");
    await page.getByLabel("Ad", { exact: true }).fill("Mobil");
    await page.getByLabel("Soyad").fill("Kullanıcı");
    await page.getByLabel("E-posta", { exact: true }).fill(email);
    await page.getByLabel("Telefon").fill("05559876543");
    await page.getByText("Profesyonel", { exact: true }).tap();
    await page.getByLabel("Kurum / üniversite").fill("Stüdyo");
    await page.getByLabel("Bölüm / uzmanlık alanı").fill("İç mimarlık");
    await page.getByRole("checkbox", { name: /KVKK aydınlatma metnini/ }).check();
    const submit = page.getByRole("button", { name: "Başvuruyu gönder" });
    const box = await submit.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44); // dokunma hedefi
    await submit.tap();
    await expect(page.getByText("Başvurun başarıyla alındı.")).toBeVisible();
    const { data } = await service().from("applications").select("status").eq("email_normalized", email).single();
    expect(data?.status).toBe("pending");
    await page.screenshot({ path: "test-results/mobil-basvuru-basarili.png" });
  });

  test("admin listesi mobilde kart görünümü; check-in ekranı kullanılabilir", async ({ page }) => {
    await uiLogin(page, USERS.admin);
    await expect(page).toHaveURL(/\/admin$/);
    await noHorizontalScroll(page);
    await expect(page.locator("table")).toBeHidden();
    await expect(page.locator("ul li a[href^='/admin/basvurular/']").first()).toBeVisible();
    await page.screenshot({ path: "test-results/mobil-admin.png", fullPage: false });

    await page.goto("/admin/check-in");
    await noHorizontalScroll(page);
    await expect(page.getByRole("button", { name: "Kamerayı aç" })).toBeVisible();
    await expect(page.getByLabel("Giriş kodu", { exact: true })).toBeVisible();
    await page.screenshot({ path: "test-results/mobil-checkin.png" });
  });
});
