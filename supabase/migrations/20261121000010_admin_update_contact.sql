-- Admin, katılımcının yanlış girdiği iletişim bilgilerini (ad, soyad, e-posta, telefon) düzeltir.
-- Kullanıcının kendi oturumuyla çağrılır; yetki burada da kontrol edilir.
-- Denetim kaydına yalnızca değişen ALAN ADLARI yazılır (eski/yeni değer, yani kişisel veri yazılmaz).

create or replace function public.admin_update_contact(
  p_application_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public._require_admin();
  v_old public.applications;
  v_first text := btrim(regexp_replace(coalesce(p_first_name, ''), '\s+', ' ', 'g'));
  v_last  text := btrim(regexp_replace(coalesce(p_last_name, ''), '\s+', ' ', 'g'));
  v_email text := btrim(coalesce(p_email, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_changed text[] := '{}';
begin
  select * into v_old from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'ERR_NOT_FOUND' using errcode = 'P0001';
  end if;

  if char_length(v_first) not between 1 and 80 or char_length(v_last) not between 1 and 80
     or char_length(v_email) not between 3 and 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or v_phone !~ '^\+?[0-9]{10,15}$' then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;

  if v_old.status <> 'cancelled' and exists (
    select 1 from public.applications a
     where a.email_normalized = lower(v_email) and a.id <> p_application_id and a.status <> 'cancelled'
  ) then
    raise exception 'ERR_EMAIL_TAKEN' using errcode = 'P0001';
  end if;

  if v_first is distinct from v_old.first_name then v_changed := array_append(v_changed, 'first_name'); end if;
  if v_last  is distinct from v_old.last_name  then v_changed := array_append(v_changed, 'last_name');  end if;
  if lower(v_email) is distinct from v_old.email_normalized or v_email is distinct from v_old.email then
    v_changed := array_append(v_changed, 'email');
  end if;
  if v_phone is distinct from v_old.phone then v_changed := array_append(v_changed, 'phone'); end if;

  if cardinality(v_changed) > 0 then
    update public.applications
       set first_name = v_first, last_name = v_last, email = v_email, phone = v_phone
     where id = p_application_id;
    insert into public.admin_audit_logs (admin_user_id, action, application_id, metadata)
    values (v_uid, 'update_contact', p_application_id, jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;

  return jsonb_build_object(
    'changed', to_jsonb(v_changed),
    'email_changed', 'email' = any (v_changed),
    'status', v_old.status
  );
end;
$$;

revoke execute on function public.admin_update_contact(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_update_contact(uuid, text, text, text, text) to authenticated, service_role;
