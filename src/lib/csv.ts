/**
 * Güvenli CSV üretimi.
 *  - RFC 4180 tırnaklama.
 *  - CSV/formül enjeksiyonuna karşı: = + - @ TAB CR ile başlayan hücrelerin başına ' eklenir
 *    (Excel/Sheets bu hücreleri formül olarak çalıştırmaz).
 *  - Excel'in Türkçe karakterleri doğru açması için UTF-8 BOM eklenir.
 *  - Ayraç ";" — Türkçe bölgesel ayarlı Excel virgülü ondalık ayırıcı sayar ve
 *    virgüllü dosyayı tek sütunda açar; ";" ile doğrudan sütunlara ayrılır.
 */
export const CSV_SEPARATOR = ";";
const DANGEROUS_PREFIX = /^[=+\-@\t\r]/;

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (DANGEROUS_PREFIX.test(text)) text = `'${text}`;
  if (/[",\n\r;]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => sanitizeCsvCell(c.header)).join(CSV_SEPARATOR)];
  for (const row of rows) {
    lines.push(columns.map((c) => sanitizeCsvCell(c.value(row))).join(CSV_SEPARATOR));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}
