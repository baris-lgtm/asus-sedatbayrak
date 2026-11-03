-- Hatırlatma e-postaları: onaylı katılımcılara davetiyeleriyle birlikte tekrar tekrar
-- gönderilebilen hatırlatma. Her "tur" (p_round, admin panelinde gün bazlı: YYYYMMDD)
-- için kişi başı en fazla bir e-posta (dedupe: reminder:<başvuru>:<tur>).

alter type public.email_type add value if not exists 'reminder';

create or replace function public.admin_reminder_targets(p_round text)
returns table (application_id uuid, invitation_id uuid, informed boolean, last_status public.email_status, attempts integer, last_attempt_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._require_admin();
  if p_round is null or p_round !~ '^[0-9a-z]{4,40}$' then
    raise exception 'ERR_BAD_REQUEST' using errcode = 'P0001';
  end if;

  return query
  select i.application_id,
         i.id,
         coalesce(u.status = 'sent', false),
         u.status,
         coalesce(u.attempt_count, 0),
         u.updated_at
    from public.invitations i
    join public.applications a on a.id = i.application_id
    left join public.email_logs u
           on u.dedupe_key = 'reminder:' || i.application_id::text || ':' || p_round
   where i.revoked_at is null
     and a.status = 'approved'
   order by i.issued_at, i.id;
end;
$$;
revoke execute on function public.admin_reminder_targets(text) from public, anon;
grant execute on function public.admin_reminder_targets(text) to authenticated, service_role;
