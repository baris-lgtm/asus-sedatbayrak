import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { expect, test } from "./fixtures";
import QRCode from "qrcode";
import { USERS, invitationFromMail, mailsTo, seedApplication, service, uiLogin } from "./helpers";

/**
 * Gerçek kamera akışı: davetiye QR'ı ffmpeg ile sahte kamera görüntüsüne
 * dönüştürülür ve Chromium'a kamera olarak verilir (--use-file-for-fake-video-capture).
 */
test("kamerayla QR okutma: giriş kaydedilir, aynı QR ikinci kez engellenir", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  const a = await seedApplication({ first_name: "Kamera", last_name: "Testi" });
  await uiLogin(page, USERS.admin);
  await page.goto(`/admin/basvurular/${a.id}`);
  await page.getByRole("button", { name: "Onayla ve davetiye gönder" }).click();
  await expect(page.getByText(/onaylandı/)).toBeVisible();
  const { url } = invitationFromMail(mailsTo(a.email, "invitation")[0]);

  const dir = mkdtempSync(path.join(os.tmpdir(), "qr-cam-"));
  const png = path.join(dir, "qr.png");
  const y4m = path.join(dir, "qr.y4m");
  writeFileSync(png, await QRCode.toBuffer(url, { width: 480, margin: 4 }));
  execFileSync("ffmpeg", ["-loglevel", "error", "-loop", "1", "-i", png, "-vf", "scale=320:320,pad=640:480:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p", "-t", "3", "-r", "10", y4m]);

  const browser = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${y4m}`],
  });
  try {
    const ctx = await browser.newContext({ baseURL: "http://localhost:3000", permissions: ["camera"] });
    const door = await ctx.newPage();
    await uiLogin(door, USERS.door);
    await expect(door).toHaveURL(/check-in/);
    await door.getByRole("button", { name: "Kamerayı aç" }).click();
    await expect(door.getByText("Giriş onaylandı")).toBeVisible({ timeout: 20_000 });
    await expect(door.getByText("Kamera Testi — Öğrenci")).toBeVisible();

    // Kamera aynı QR'ı görmeye devam eder → sonraki okutmalar "daha önce" der
    await door.getByRole("button", { name: "Sonraki katılımcı" }).click();
    await expect(door.getByText("Bu katılımcının girişi daha önce yapılmış")).toBeVisible({ timeout: 20_000 });

    const { data } = await service().from("invitations").select("checked_in_at").eq("application_id", a.id);
    expect(data).toHaveLength(1);
    expect(data![0].checked_in_at).not.toBeNull();
  } finally {
    await browser.close();
  }
});
