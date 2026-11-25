import { expect, test } from "./fixtures";
import { USERS, service, uiLogin } from "./helpers";

test("kapıda sayılan giriş toplam 'Giriş yapan'a eklenir, kişi kayıtlarına dokunulmaz", async ({ page }) => {
  const db = service();
  const { count: before } = await db.from("applications").select("id", { count: "exact", head: true }).eq("status", "checked_in");
  await uiLogin(page, USERS.admin);
  await page.goto("/admin");
  await page.getByText(/Kapıda sayılarak alınan giriş/).click();
  await page.getByLabel("Kişi sayısı").fill("85");
  await page.getByLabel("Not (isteğe bağlı)").fill("21 Kasım, kapıda sayıldı");
  await page.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.getByText("Kapıda sayılan giriş 85 olarak kaydedildi.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(`QR: ${before} · kapıda sayılan: 85`)).toBeVisible();
  await expect(page.getByText(String((before ?? 0) + 85), { exact: true })).toBeVisible();
  const { count: after } = await db.from("applications").select("id", { count: "exact", head: true }).eq("status", "checked_in");
  expect(after).toBe(before);
  await db.from("event_settings").update({ manual_checkins: 0, manual_checkins_note: null }).eq("id", 1);
});
