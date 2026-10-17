#!/usr/bin/env bash
# Eş zamanlı onay (kapasite) ve eş zamanlı check-in (tek giriş) testleri.
# run.sh tarafından $DB ile çağrılır.
set -euo pipefail
PSQL=(psql -X -q -tA -d "$DB")
ADMIN='{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}'
DOOR='{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}'
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# --- Hazırlık: kapasite = mevcut onaylı + 10, 30 yeni başvuru
"${PSQL[@]}" <<SQL >/dev/null
update public.event_settings set capacity = (select count(*) from public.applications where status in ('approved','checked_in')) + 10;
set role service_role;
select tests.apply('conc' || g || '@example.com') from generate_series(1,30) g;
SQL

# --- T17: 30 eş zamanlı onay, yalnızca 10'u geçmeli
for i in $(seq 1 30); do
  ( "${PSQL[@]}" 2>&1 <<SQL
set role authenticated;
select set_config('request.jwt.claims', '$ADMIN', false);
begin;
select public.admin_approve((select id from public.applications where email='conc$i@example.com'),
       gen_random_uuid(), tests.h('cq$i'), tests.h('cc$i'))->>'created';
select pg_sleep(0.05);
commit;
SQL
  ) > "$TMP/approve_$i.out" &
done
wait
ok=$(grep -l '^true$' "$TMP"/approve_*.out | wc -l)
full=$(grep -l 'ERR_CAPACITY_FULL' "$TMP"/approve_*.out | wc -l)
approved=$("${PSQL[@]}" -c "select count(*) from public.applications where email like 'conc%' and status='approved'")
over=$("${PSQL[@]}" -c "select count(*) > capacity from public.applications, public.event_settings where status in ('approved','checked_in') group by capacity")
if [[ "$ok" == 10 && "$full" == 20 && "$approved" == 10 && "$over" == f ]]; then
  echo "PASS  T17 30 eş zamanlı onayda tam 10 onay, 20 kapasite reddi (kapasite aşılmadı)"
else
  echo "FAIL  T17 ok=$ok full=$full approved=$approved over=$over"; cat "$TMP"/approve_1.out; exit 1
fi

# --- T11/T12: aynı QR 20 kez eş zamanlı okutulur, yalnızca 1 giriş
TOKEN_SRC=$("${PSQL[@]}" -c "select g from generate_series(1,30) g join public.invitations i on i.qr_token_hash = tests.h('cq'||g) where i.revoked_at is null limit 1")
for i in $(seq 1 20); do
  ( "${PSQL[@]}" 2>&1 <<SQL
set role authenticated;
select set_config('request.jwt.claims', '$DOOR', false);
select public.check_in(tests.h('cq$TOKEN_SRC'), null)->>'result';
SQL
  ) > "$TMP/checkin_$i.out" &
done
wait
oks=$(grep -l '^ok$' "$TMP"/checkin_*.out | wc -l)
already=$(grep -l '^already$' "$TMP"/checkin_*.out | wc -l)
if [[ "$oks" == 1 && "$already" == 19 ]]; then
  echo "PASS  T11/T12 aynı QR 20 eş zamanlı okutmada yalnızca 1 giriş, 19 'daha önce giriş yapılmış'"
else
  echo "FAIL  check-in ok=$oks already=$already"; cat "$TMP"/checkin_1.out; exit 1
fi
