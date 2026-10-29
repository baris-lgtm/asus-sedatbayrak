-- Saklama süresi artık ETKİNLİK TARİHİNDEN itibaren sayılır
-- (aydınlatma metni: "etkinlik tarihinden itibaren 1 yıl süreyle saklanır").
-- Etkinlik tarihi kesinleşmemişse (date_confirmed = false veya starts_at boş) hiçbir başvuru silinmez.

alter table public.event_settings alter column retention_days set default 365;
-- Hiç değiştirilmemiş eski varsayılanı (180) metindeki 1 yıla çek.
update public.event_settings set retention_days = 365 where id = 1 and retention_days = 180;

create or replace function public.purge_expired_applications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days      integer;
  v_starts    timestamptz;
  v_confirmed boolean;
  v_deleted   integer := 0;
begin
  select retention_days, starts_at, date_confirmed
    into v_days, v_starts, v_confirmed
    from public.event_settings where id = 1;

  if v_confirmed and v_starts is not null and now() >= v_starts + make_interval(days => v_days) then
    delete from public.applications;
    get diagnostics v_deleted = row_count;
  end if;

  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_deleted;
end;
$$;
