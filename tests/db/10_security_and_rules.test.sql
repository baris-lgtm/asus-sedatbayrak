-- =============================================================================
-- Veritabanı güvenlik ve iş kuralı testleri (gerçek PostgreSQL üzerinde).
-- Çalıştırma: tests/db/run.sh
-- Her başarısız beklenti bir exception fırlatır; psql ON_ERROR_STOP ile durur.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

-- SQL'i çalıştırır, hata bekler; mesaj/SQLSTATE desenle eşleşmezse test düşer.
create function tests.expect_error(p_sql text, p_pattern text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ~* p_pattern or sqlstate ~* p_pattern then
      raise notice 'PASS  %', p_label;
      return;
    end if;
    raise exception 'FAIL  % — beklenmeyen hata: % (%)', p_label, sqlerrm, sqlstate;
  end;
  raise exception 'FAIL  % — hata bekleniyordu ama SQL başarılı oldu', p_label;
end $$;

create function tests.ok(p_cond boolean, p_label text)
returns void language plpgsql as $$
begin
  if coalesce(p_cond, false) then raise notice 'PASS  %', p_label;
  else raise exception 'FAIL  %', p_label; end if;
end $$;

create function tests.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
$$;
create function tests.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', false);
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Sabit test kullanıcıları
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'kapi@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'random@test.local');
insert into public.staff_members (user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin'),
  ('00000000-0000-0000-0000-00000000000c', 'checkin');

-- Yardımcı: geçerli başvuru (service_role olarak)
create function tests.apply(p_email text, p_status text default null) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.applications (first_name, last_name, email, phone, participant_type,
                                   kvkk_notice_version, marketing_consent)
  values ('Test', 'Kişi', p_email, '+905551112233', 'student', 'TASLAK-v0', false)
  returning id into v_id;
  return v_id;
end $$;
grant execute on function tests.apply(text, text) to service_role;

-- Test hash'leri (gerçekte sunucu HMAC + SHA-256 üretir)
create function tests.h(p text) returns text language sql immutable as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex')
$$;
grant execute on function tests.h(text) to anon, authenticated, service_role;

\echo '--- 1. Başvuru kaydı ve varsayılanlar'
set role service_role;
select tests.apply('ayse@example.com');
select tests.ok((select status = 'pending' from public.applications where email = 'ayse@example.com'),
                'T04 yeni başvuru pending durumunda');

-- İstemci 'approved' göndermeye çalışsa bile tetikleyici pending yapar.
insert into public.applications (first_name, last_name, email, phone, participant_type,
                                 kvkk_notice_version, status, reviewed_at)
values ('Hile', 'Deneme', 'hile@example.com', '+905551112233', 'other', 'TASLAK-v0', 'approved', now());
select tests.ok((select status = 'pending' and reviewed_at is null
                   from public.applications where email = 'hile@example.com'),
                'T04 status=approved gönderilse bile otomatik onay YOK');

-- Pazarlama izni zaman damgası
insert into public.applications (first_name, last_name, email, phone, participant_type,
                                 kvkk_notice_version, marketing_consent, marketing_consent_version)
values ('Pazar', 'Lama', 'pazar@example.com', '+905551112233', 'professional', 'TASLAK-v0', true, 'TASLAK-v0');
select tests.ok((select marketing_consent_at is not null and kvkk_notice_version = 'TASLAK-v0'
                   from public.applications where email = 'pazar@example.com'),
                'KVKK sürümü ve pazarlama izni zamanı kaydediliyor');

\echo '--- 2. Doğrulama kısıtları'
select tests.expect_error($$select tests.apply('gecersiz-eposta')$$, 'check', 'T02 geçersiz e-posta reddedildi');
select tests.expect_error($$insert into public.applications (first_name, last_name, email, phone, participant_type, kvkk_notice_version)
                            values ('A','B','tel@example.com','123','student','v')$$, 'check', 'T02 geçersiz telefon reddedildi');
select tests.expect_error($$insert into public.applications (first_name, last_name, email, phone, participant_type, kvkk_notice_version)
                            values ('  ','B','bos@example.com','+905551112233','student','v')$$, 'check', 'T02 boş ad reddedildi');
select tests.expect_error($$insert into public.applications (last_name, email, phone, participant_type, kvkk_notice_version)
                            values ('B','eksik@example.com','+905551112233','student','v')$$, 'not-null|23502', 'T02 eksik zorunlu alan reddedildi');

\echo '--- 3. Mükerrer başvuru'
select tests.expect_error($$select tests.apply('  AYSE@Example.COM ')$$, '23505', 'T15 aynı e-posta (farklı harf/boşluk) reddedildi');

\echo '--- 4. Anonim erişim (RLS + yetkiler)'
reset role;
set role anon;
select tests.logout();
select tests.expect_error($$select * from public.applications$$, 'permission denied', 'T18 anon başvuruları okuyamaz');
select tests.expect_error($$insert into public.applications (first_name, last_name, email, phone, participant_type, kvkk_notice_version)
                            values ('A','B','anon@example.com','+905551112233','student','v')$$,
                          'permission denied', 'anon public anahtarla doğrudan başvuru yazamaz (rate limit atlatılamaz)');
select tests.expect_error($$select * from public.invitations$$, 'permission denied', 'T18 anon davetiyeleri okuyamaz');
select tests.expect_error($$select * from public.email_logs$$, 'permission denied', 'anon e-posta loglarını okuyamaz');
select tests.expect_error($$select public.admin_stats()$$, 'permission denied', 'T06 anon admin fonksiyonu çağıramaz');
select tests.expect_error($$select public.check_rate_limit('x', 1, 60)$$, 'permission denied', 'anon rate limit tablosunu manipüle edemez');
select tests.ok((select count(*) = 1 from public.event_settings), 'anon etkinlik ayarlarını okuyabilir');
select tests.expect_error($$update public.event_settings set capacity = 9999$$, 'permission denied', 'anon etkinlik ayarlarını değiştiremez');

\echo '--- 5. Yetkisiz giriş yapmış kullanıcı'
reset role;
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.ok((select count(*) = 0 from public.applications), 'T18 admin olmayan kullanıcı hiçbir başvuruyu göremez');
select tests.ok((select count(*) = 0 from public.staff_members), 'admin olmayan personel listesini göremez');
select tests.ok(not public.is_admin(), 'is_admin() = false');
select tests.expect_error($$select public.admin_stats()$$, 'ERR_FORBIDDEN', 'T06 yetkisiz kullanıcı admin_stats çağıramaz');
select tests.expect_error(format($$select public.admin_approve(%L, gen_random_uuid(), tests.h('x1'), tests.h('y1'))$$,
                                 (select id from public.applications limit 1)),
                          'ERR_FORBIDDEN', 'T06 yetkisiz kullanıcı onay veremez');
select tests.expect_error($$select public.check_in(tests.h('x'), null)$$, 'ERR_FORBIDDEN', 'yetkisiz kullanıcı check-in yapamaz');
select tests.expect_error($$insert into public.staff_members (user_id, role) values ('00000000-0000-0000-0000-00000000000b', 'admin')$$,
                          'permission denied', 'kullanıcı kendini admin yapamaz');
select tests.expect_error($$update public.applications set status = 'approved'$$, 'permission denied', 'doğrudan UPDATE ile onay verilemez');
-- RLS update politikası: admin olmayan için 0 satır
update public.event_settings set capacity = 1;
reset role;
select tests.ok((select capacity = 300 from public.event_settings), 'admin olmayanın ayar güncellemesi etkisiz (RLS)');

\echo '--- 6. Check-in rolündeki personel (kapı ekibi)'
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.ok((select count(*) = 0 from public.applications), 'check-in personeli başvuru listesini göremez');
select tests.expect_error(format($$select public.admin_set_status(%L, 'rejected')$$,
                                 (select id from public.applications limit 1)),
                          'ERR_FORBIDDEN|permission denied', 'check-in personeli durum değiştiremez');
reset role;

\echo '--- 7. Admin: listeleme, durum geçişleri'
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.ok((select count(*) = 3 from public.applications), 'admin tüm başvuruları görür');
select tests.ok(public.is_admin(), 'is_admin() = true');

select tests.ok((public.admin_set_status((select id from public.applications where email='hile@example.com'), 'reviewing')->>'changed')::boolean,
                'admin başvuruyu incelemeye aldı');
select tests.ok(not (public.admin_set_status((select id from public.applications where email='hile@example.com'), 'reviewing')->>'changed')::boolean,
                'aynı duruma tekrar geçiş no-op (tekrar e-posta yok)');
select tests.ok((public.admin_set_status((select id from public.applications where email='hile@example.com'), 'rejected')->>'changed')::boolean,
                'admin başvuruyu reddetti');
select tests.ok((public.admin_set_status((select id from public.applications where email='pazar@example.com'), 'waitlisted')->>'changed')::boolean,
                'admin başvuruyu yedek listeye aldı');
select tests.expect_error(format($$select public.admin_set_status(%L, 'approved')$$,
                                 (select id from public.applications where email='ayse@example.com')),
                          'ERR_INVALID_TRANSITION', 'onay admin_set_status ile verilemez (davetiyesiz onay yok)');
select tests.expect_error(format($$select public.admin_set_status(%L, 'checked_in')$$,
                                 (select id from public.applications where email='ayse@example.com')),
                          'ERR_INVALID_TRANSITION', 'checked_in elle atanamaz');
select tests.ok((select count(*) >= 3 from public.admin_audit_logs where action = 'status_change'), 'durum değişiklikleri denetim kaydına yazıldı');

\echo '--- 8. Onay + davetiye (idempotent)'
select tests.ok((public.admin_approve((select id from public.applications where email='ayse@example.com'),
                 '11111111-1111-1111-1111-111111111111', tests.h('qr-ayse'), tests.h('code-ayse'))->>'created')::boolean,
                'T07/T08 admin onayladı ve davetiye oluştu');
-- Aynı onay tekrar (farklı token'larla) → mevcut davetiye döner, yeni QR yok
select tests.ok((select (r->>'created')::boolean = false and r->>'invitation_id' = '11111111-1111-1111-1111-111111111111'
                   from (select public.admin_approve((select id from public.applications where email='ayse@example.com'),
                         gen_random_uuid(), tests.h('qr-ayse-2'), tests.h('code-ayse-2')) r) x),
                'onay tekrarı idempotent: aynı davetiye, yeni QR üretilmedi');
select tests.ok((select count(*) = 1 from public.invitations
                  where application_id = (select id from public.applications where email='ayse@example.com')),
                'başvuru başına tek davetiye');
select tests.expect_error(format($$select public.admin_approve(%L, gen_random_uuid(), tests.h('q'), tests.h('c'))$$,
                                 (select id from public.applications where email='hile@example.com')),
                          'ERR_INVALID_TRANSITION', 'reddedilmiş başvuru doğrudan onaylanamaz (önce incelemeye alınmalı)');
select tests.ok((public.admin_approve((select id from public.applications where email='pazar@example.com'),
                 '22222222-2222-2222-2222-222222222222', tests.h('qr-pazar'), tests.h('code-pazar'))->>'created')::boolean,
                'yedek listeden onay');

\echo '--- 9. Kapasite'
reset role;
update public.event_settings set capacity = 2;
set role service_role;
select tests.apply('fazla@example.com');
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.expect_error(format($$select public.admin_approve(%L, gen_random_uuid(), tests.h('q3'), tests.h('c3'))$$,
                                 (select id from public.applications where email='fazla@example.com')),
                          'ERR_CAPACITY_FULL', 'kapasite dolunca onay sunucuda engellendi');
select tests.ok((public.admin_set_status((select id from public.applications where email='fazla@example.com'), 'waitlisted')->>'changed')::boolean,
                'kapasite doluyken yedek listeye alınabildi');
-- Admin ayarı RLS altında güncelleyebiliyor
update public.event_settings set capacity = 300;
select tests.ok((select capacity = 300 from public.event_settings), 'admin etkinlik ayarlarını güncelleyebiliyor');

\echo '--- 10. Check-in (tek kullanım)'
select tests.login('00000000-0000-0000-0000-00000000000c'); -- kapı ekibi
select tests.ok((select public.check_in(tests.h('qr-ayse'), null)->>'result' = 'ok'), 'T11 geçerli QR ile giriş başarılı');
select tests.ok((select r->>'result' = 'already' and r->>'checked_in_at' is not null
                   from (select public.check_in(tests.h('qr-ayse'), null) r) x),
                'T12 aynı QR tekrar okutulunca "daha önce giriş yapılmış"');
select tests.ok((select public.check_in(null, tests.h('code-ayse'))->>'result' = 'already'),
                'manuel kodla ikinci giriş de engellendi');
select tests.ok((select public.check_in(tests.h('uydurma'), null)->>'result' = 'invalid'), 'T13 geçersiz token reddedildi');
select tests.ok((select public.check_in(null, tests.h('code-pazar'))->>'result' = 'ok'), 'manuel kod ile giriş başarılı');
select tests.expect_error($$select public.check_in(tests.h('a'), tests.h('b'))$$, 'ERR_BAD_REQUEST', 'aynı anda iki tür kod gönderilemez');
reset role;
select tests.ok((select checked_in_by = '00000000-0000-0000-0000-00000000000c'
                   from public.invitations where id = '11111111-1111-1111-1111-111111111111'),
                'ilk girişi yapan personel kaydedildi ve değişmedi');
select tests.ok((select status = 'checked_in' from public.applications where email='ayse@example.com'),
                'başvuru durumu checked_in oldu');

\echo '--- 11. İptal ve yeniden üretme'
set role service_role;
select tests.apply('iptal@example.com');
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000a');
select public.admin_approve((select id from public.applications where email='iptal@example.com'),
       '33333333-3333-3333-3333-333333333333', tests.h('qr-iptal'), tests.h('code-iptal'));
-- Yeniden üret: eski QR geçersiz olmalı
select public.admin_reissue_invitation((select id from public.applications where email='iptal@example.com'),
       '44444444-4444-4444-4444-444444444444', tests.h('qr-iptal-2'), tests.h('code-iptal-2'));
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.ok((select public.check_in(tests.h('qr-iptal'), null)->>'result' = 'revoked'), 'T13 yeniden üretilen davetiyenin eski QR''ı reddedildi');
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.ok((public.admin_set_status((select id from public.applications where email='iptal@example.com'), 'cancelled')->>'changed')::boolean,
                'onaylı başvuru iptal edildi');
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.ok((select public.check_in(tests.h('qr-iptal-2'), null)->>'result' = 'revoked'), 'T13 iptal edilen başvurunun QR''ı reddedildi');
reset role;
set role service_role;
select tests.apply('IPTAL@example.com');
select tests.ok(true, 'iptal eden kişi aynı e-postayla yeniden başvurabildi (politika)');

\echo '--- 12. E-posta gönderim kilidi'
select tests.ok((select (public.claim_email((select id from public.applications where email='pazar@example.com'),
                   'invitation', 'invitation:22222222-2222-2222-2222-222222222222')).id is not null),
                'ilk e-posta gönderimi sahiplenildi');
select tests.ok((select (public.claim_email((select id from public.applications where email='pazar@example.com'),
                   'invitation', 'invitation:22222222-2222-2222-2222-222222222222')).id is null),
                'eş zamanlı ikinci gönderim engellendi (çift davetiye yok)');
select public.finish_email((select id from public.email_logs where dedupe_key='invitation:22222222-2222-2222-2222-222222222222'),
                           false, null, 'Resend 500');
select tests.ok((select status = 'failed' and attempt_count = 1 and sent_at is null
                   from public.email_logs where dedupe_key='invitation:22222222-2222-2222-2222-222222222222'),
                'T10 başarısız gönderim loglandı');
select tests.ok((select count(*) = 1 from public.applications where email='pazar@example.com'),
                'T10 e-posta başarısız olsa da başvuru korundu');
select tests.ok((select (public.claim_email((select id from public.applications where email='pazar@example.com'),
                   'invitation', 'invitation:22222222-2222-2222-2222-222222222222')).attempt_count = 2),
                'başarısız gönderim tekrar denenebiliyor');
select public.finish_email((select id from public.email_logs where dedupe_key='invitation:22222222-2222-2222-2222-222222222222'),
                           true, 'msg_123', null);
select tests.ok((select status = 'sent' and provider_message_id = 'msg_123' and sent_at is not null
                   from public.email_logs where dedupe_key='invitation:22222222-2222-2222-2222-222222222222'),
                'T09 başarılı gönderim sağlayıcı ID ile kaydedildi');
select tests.ok((select (public.claim_email((select id from public.applications where email='pazar@example.com'),
                   'invitation', 'invitation:22222222-2222-2222-2222-222222222222')).id is null),
                'gönderilmiş davetiye tekrar gönderilmez');

\echo '--- 13. Rate limit'
select tests.ok((select bool_and(public.check_rate_limit('test:ip1', 3, 60)) from generate_series(1,3)), 'limit içi istekler geçti');
select tests.ok(not public.check_rate_limit('test:ip1', 3, 60), 'limit aşımı engellendi');
select tests.ok(public.check_rate_limit('test:ip2', 3, 60), 'farklı anahtar etkilenmedi');

\echo '--- 14. Başvurular kapalıyken'
update public.event_settings set applications_open = false;
select tests.expect_error($$select tests.apply('kapali@example.com')$$, 'ERR_APPLICATIONS_CLOSED', 'başvurular kapalıyken kayıt reddedildi');
update public.event_settings set applications_open = true;

\echo '--- 15. Veri saklama'
update public.applications set created_at = now() - interval '400 days' where email = 'hile@example.com';
-- created_at tetikleyicide sadece INSERT'te zorlanır; UPDATE testi için doğrudan yazıldı.
select tests.ok((select public.purge_expired_applications() = 1), 'saklama süresi geçen başvuru silindi');
reset role;

\echo 'TÜM DB TESTLERİ GEÇTİ'
