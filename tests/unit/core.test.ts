// Çekirdek yardımcıların birim testleri. Çalıştırma: npm test
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  deriveManualCode,
  deriveQrToken,
  extractTokenFromScan,
  formatManualCode,
  invitationUrl,
  issueInvitation,
  materialFor,
  normalizeManualCode,
  sha256Hex,
} from "../../src/lib/server/invitation-token";
import { sanitizeCsvCell, toCsv } from "../../src/lib/csv";
import { normalizePhone } from "../../src/lib/phone";

const SECRET = "test-secret-test-secret-test-secret-123456";

test("QR token: 43 karakter base64url, deterministik, id'ye özgü", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const t1 = deriveQrToken(id, SECRET);
  assert.match(t1, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(t1, deriveQrToken(id, SECRET), "tekrar gönderimde aynı QR");
  assert.notEqual(t1, deriveQrToken("22222222-2222-2222-2222-222222222222", SECRET));
  assert.notEqual(t1, deriveQrToken(id, SECRET + "x"), "farklı sır → farklı token");
});

test("QR token kişisel veri içermez ve id'yi açığa çıkarmaz", () => {
  const { invitationId, qrToken } = issueInvitation(SECRET);
  assert.ok(!qrToken.includes(invitationId.slice(0, 8)));
  assert.ok(!Buffer.from(qrToken, "base64url").toString("latin1").includes(invitationId));
});

test("Sır eksik/kısaysa token üretilmez", () => {
  assert.throws(() => deriveQrToken("x", ""), /INVITATION_TOKEN_SECRET/);
  assert.throws(() => deriveQrToken("x", "kisa"), /INVITATION_TOKEN_SECRET/);
});

test("Hash'ler DB ile uyumlu (sha256 hex) ve tekrar türetilebilir", () => {
  const a = issueInvitation(SECRET);
  const b = materialFor(a.invitationId, SECRET);
  assert.equal(a.qrTokenHash, b.qrTokenHash);
  assert.equal(a.manualCodeHash, b.manualCodeHash);
  assert.equal(a.qrTokenHash, sha256Hex(a.qrToken));
  assert.match(a.qrTokenHash, /^[0-9a-f]{64}$/);
  // PostgreSQL: encode(sha256(convert_to('abc','UTF8')),'hex')
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("Manuel kod: 10 karakter Crockford, okunabilir biçim, hatalı yazıma toleranslı", () => {
  const code = deriveManualCode("33333333-3333-3333-3333-333333333333", SECRET);
  assert.match(code, /^[0-9A-HJKMNP-TV-Z]{10}$/);
  const pretty = formatManualCode(code);
  assert.match(pretty, /^.{4}-.{4}-.{2}$/);
  assert.equal(normalizeManualCode(pretty.toLowerCase()), code);
  assert.equal(normalizeManualCode(` ${pretty} `), code);
  assert.equal(normalizeManualCode("OIL0-0000-00"), "0110000000");
  assert.equal(normalizeManualCode("ABC"), null);
  assert.equal(normalizeManualCode("UUUU-UUUU-UU"), null, "U Crockford alfabesinde yok");
});

test("Okutulan QR'dan token çıkarma", () => {
  const token = deriveQrToken("44444444-4444-4444-4444-444444444444", SECRET);
  assert.equal(extractTokenFromScan(token), token);
  assert.equal(extractTokenFromScan(invitationUrl("https://ornek.com/", token)), token);
  assert.equal(extractTokenFromScan(`https://ornek.com/davetiye/${token}/`), token);
  assert.equal(extractTokenFromScan("https://ornek.com/baska/" + token), null);
  assert.equal(extractTokenFromScan("merhaba"), null);
  assert.equal(extractTokenFromScan(token + "x"), null);
});

test("CSV formül enjeksiyonu engelleniyor", () => {
  assert.equal(sanitizeCsvCell("=HYPERLINK(\"http://kotu\")"), `"'=HYPERLINK(""http://kotu"")"`);
  assert.equal(sanitizeCsvCell("+905551112233"), "'+905551112233");
  assert.equal(sanitizeCsvCell("-1+1"), "'-1+1");
  assert.equal(sanitizeCsvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(sanitizeCsvCell("\tcmd"), "'\tcmd");
  assert.equal(sanitizeCsvCell("Ayşe, Öğrenci"), `"Ayşe, Öğrenci"`);
  assert.equal(sanitizeCsvCell(null), "");
});

test("CSV çıktısı BOM + başlık + satırlar", () => {
  const csv = toCsv([{ ad: "Şule", not: "=1+1" }], [
    { header: "Ad", value: (r) => r.ad },
    { header: "Not", value: (r) => r.not },
  ]);
  assert.ok(csv.startsWith("﻿"));
  assert.equal(csv, "﻿Ad,Not\r\nŞule,'=1+1\r\n");
});

test("Telefon normalize", () => {
  assert.equal(normalizePhone("0555 111 22 33"), "+905551112233");
  assert.equal(normalizePhone("555 111 22 33"), "+905551112233");
  assert.equal(normalizePhone("+90 (555) 111-22-33"), "+905551112233");
  assert.equal(normalizePhone("0090 555 111 22 33"), "+905551112233");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(normalizePhone("+90 555 111 22"), null);
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("0555abc"), null);
  // DB kısıtı: ^\+?[0-9]{10,15}$
  assert.match(normalizePhone("05551112233")!, /^\+?[0-9]{10,15}$/);
});
