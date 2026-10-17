#!/usr/bin/env bash
# Migration'ları temiz bir veritabanına uygular ve DB testlerini çalıştırır.
# Gerekli: PostgreSQL 15+ (psql). Bağlantı: PGHOST / PGPORT / PGUSER ortam değişkenleri.
# Kullanım: PGHOST=localhost PGPORT=5432 PGUSER=postgres tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

DB=workshop_test_$$
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

cleanup() { "${PSQL[@]}" -d postgres -c "drop database if exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" >/dev/null
"${PSQL[@]}" -d postgres -c "create database $DB" >/dev/null

echo "== Supabase shim"
# Roller zaten varsa hatayı yok say.
"${PSQL[@]}" -d "$DB" -v ON_ERROR_STOP=0 -f tests/db/00_supabase_shim.sql 2>&1 | grep -v 'already exists' || true

echo "== Migration'lar"
for f in supabase/migrations/*.sql; do
  echo "   $f"
  "${PSQL[@]}" -d "$DB" -f "$f"
done

echo "== Güvenlik ve iş kuralı testleri"
"${PSQL[@]}" -d "$DB" -f tests/db/10_security_and_rules.test.sql 2>&1 \
  | sed -n 's/^psql:.*NOTICE:  //p; s/^NOTICE:  //p; /^--- [0-9]/p; /FAIL/p; /ERROR/p; /TÜM DB/p'
echo "== Eş zamanlılık testleri"
DB="$DB" bash tests/db/concurrency.sh
