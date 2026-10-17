-- =============================================================================
-- 0004: Etkinlik bilgisi güncelleme e-postaları + KVKK kapsamında kalıcı silme
-- =============================================================================

-- Tarih/mekân kesinleştiğinde onaylı katılımcılara gönderilen bilgilendirme.
alter type public.email_type add value if not exists 'event_update';

-- KVKK silme talebi: başvuruyu ve ona bağlı davetiye / e-posta kayıtlarını
-- kalıcı olarak siler (cascade). Denetim kaydında kişisel veri tutulmaz;
-- yalnızca silinen kaydın kimliği ve durumu saklanır.
create or replace function public.admin_delete_application(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin  uuid := public._require_admin();
  v_status public.application_status;
begin
  select status into v_status from public.applications where id = p_application_id for update;
  if not found then
    raise exception 'ERR_NOT_FOUND' using errcode = 'P0001';
  end if;

  delete from public.applications where id = p_application_id;

  insert into public.admin_audit_logs (admin_user_id, action, application_id, metadata)
  values (v_admin, 'delete_application', null,
          jsonb_build_object('deleted_application_id', p_application_id, 'status', v_status));

  return jsonb_build_object('deleted', true, 'application_id', p_application_id);
end;
$$;

revoke execute on function public.admin_delete_application(uuid) from public, anon;
grant execute on function public.admin_delete_application(uuid) to authenticated, service_role;
