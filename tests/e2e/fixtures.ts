import { test as base, expect } from "@playwright/test";
import { service } from "./helpers";

/**
 * Her testten önce rate limit sayaçlarını sıfırlar: testler aynı IP'den
 * gerçek kullanıcıdan çok daha fazla istek yapar. (Rate limit'in kendisi
 * DB testlerinde ve "rate limit" e2e testinde ayrıca doğrulanır.)
 */
export const test = base.extend<{ resetRateLimits: void }>({
  resetRateLimits: [
    async ({}, use) => {
      await service().from("rate_limits").delete().not("key", "is", null);
      await use();
    },
    { auto: true },
  ],
});
export { expect };
