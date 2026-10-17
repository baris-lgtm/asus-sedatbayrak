import { defineConfig, devices } from "@playwright/test";
import { loadLocalEnv } from "./tests/e2e/env";

/**
 * Uçtan uca testler — GERÇEK yerel Supabase (supabase start) + üretim derlemesi
 * (next build && next start) üzerinde çalışır. Ayrıntılar: tests/e2e/README.md
 */
const env = loadLocalEnv();

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npx next start -p 3000",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      env: { ...env },
    },
    {
      // E-posta hatası senaryosu: gerçek Resend API'sine GEÇERSİZ anahtarla bağlanan ikinci örnek.
      command: "npx next start -p 3001",
      url: "http://localhost:3001",
      reuseExistingServer: true,
      env: {
        ...env,
        NEXT_PUBLIC_SITE_URL: "http://localhost:3001",
        EMAIL_TEST_SINK_DIR: "",
        RESEND_API_KEY: "re_invalid_test_key",
        EMAIL_FROM: "Workshop <workshop@example.com>",
      },
    },
  ],
  projects: [
    { name: "masaustu", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobil", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
});
