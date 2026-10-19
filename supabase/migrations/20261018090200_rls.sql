-- Every table in public must have RLS enabled. See scripts/db-test.ts for the check.
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_invites enable row level security;
alter table public.entities enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;
alter table public.cases enable row level security;
alter table public.case_alerts enable row level security;
alter table public.case_entities enable row level security;
alter table public.case_notes enable row level security;
alter table public.case_attachments enable row level security;
alter table public.rules enable row level security;
alter table public.rule_versions enable row level security;
alter table public.reports enable row level security;
alter table public.report_schedules enable row level security;
alter table public.api_keys enable row level security;
alter table public.notifications enable row level security;
alter table public.contact_requests enable row level security;
alter table public.audit_log enable row level security;
alter table public.api_idempotency enable row level security;

-- Self-service profile updates are column-restricted through a definer function so
-- a viewer cannot escalate their own role or move themselves between tenants.
create or replace function public.update_own_profile(
  p_full_name text,
  p_timezone text,
  p_language text,
  p_notification_prefs jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_full_name is not null and length(trim(p_full_name)) < 1 then
    raise exception 'Name cannot be empty' using errcode = '22023';
  end if;

  update public.profiles
  set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      timezone = coalesce(nullif(p_timezone, ''), timezone),
      language = coalesce(nullif(p_language, ''), language),
      notification_prefs = coalesce(p_notification_prefs, notification_prefs)
  where id = auth.uid();
end;
$$;

grant execute on function public.update_own_profile(text, text, text, jsonb) to authenticated;

-- Organizations -----------------------------------------------------------------
create policy "members read their organization"
  on public.organizations for select to authenticated
  using (id = public.current_org_id());

create policy "admins update their organization"
  on public.organizations for update to authenticated
  using (id = public.current_org_id() and public.current_role() = 'admin')
  with check (id = public.current_org_id());

-- Profiles ----------------------------------------------------------------------
create policy "members read profiles in their organization"
  on public.profiles for select to authenticated
  using (id = auth.uid() or organization_id = public.current_org_id());

create policy "admins update member roles"
  on public.profiles for update to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin')
  with check (organization_id = public.current_org_id());

-- Invites -----------------------------------------------------------------------
create policy "admins read invites"
  on public.organization_invites for select to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin');

create policy "admins create invites"
  on public.organization_invites for insert to authenticated
  with check (organization_id = public.current_org_id() and public.current_role() = 'admin');

create policy "admins update invites"
  on public.organization_invites for update to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin')
  with check (organization_id = public.current_org_id());

create policy "admins delete invites"
  on public.organization_invites for delete to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin');

-- Entities and accounts ---------------------------------------------------------
create policy "members read entities"
  on public.entities for select to authenticated
  using (organization_id = public.current_org_id());

create policy "analysts create entities"
  on public.entities for insert to authenticated
  with check (organization_id = public.current_org_id() and public.current_role() in ('admin', 'analyst'));

create policy "analysts update entities"
  on public.entities for update to authenticated
  using (organization_id = public.current_org_id() and public.current_role() in ('admin', 'analyst'))
  with check (organization_id = public.current_org_id());

create policy "admins delete entities"
  on public.entities for delete to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin');

create policy "members read accounts"
  on public.accounts for select to authenticated
  using (organization_id = public.current_org_id());

create policy "analysts create accounts"
  on public.accounts for insert to authenticated
  with check (organization_id = public.current_org_id() and public.current_role() in ('admin', 'analyst'));

create policy "analysts update accounts"
  on public.accounts for update to authenticated
  using (organization_id = public.current_org_id() and public.current_role() in ('admin', 'analyst'))
  with check (organization_id = public.current_org_id());

create policy "admins delete accounts"
  on public.accounts for delete to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin');

-- Transactions ------------------------------------------------------------------
create policy "members read transactions"
  on public.transactions for select to authenticated
  using (organization_id = public.current_org_id());

create policy "analysts ingest transactions"
  on public.transactions for insert to authenticated
  with check (organization_id = public.current_org_id() and public.current_role() in ('admin', 'analyst'));

create policy "analysts score transactions"
  on public.transactions for update to authenticated
  using (organization_id = public.current_org_id() and public.current_role() in ('admin', 'analyst'))
  with check (organization_id = public.current_org_id());

-- Alerts ------------------------------------------------------------------------
create policy "members read alerts"
  on public.alerts for select to authenticated
  using (organization_id = public.current_org_id());

create policy "analysts create alerts"
  on public.alerts for insert to authenticated
  with check (organization_id = public.current_org_id() and public.current_role() in ('admin', 'analyst'));

create policy "analysts update alerts"
  on public.alerts for update to authenticated
  using (organization_id = public.current_org_id() and public.current_role() in ('admin', 'analyst'))
  with check (organization_id = public.current_org_id());

-- Alert events are append-only and readable to the whole organization.
create policy "members read alert events"
  on public.alert_events for select to authenticated
  using (exists (
    select 1 from public.alerts a
    where a.id = alert_events.alert_id and a.organization_id = public.current_org_id()
  ));

create policy "analysts append alert events"
  on public.alert_events for insert to authenticated
  with check (
    exists (
      select 1 from public.alerts a
      where a.id = alert_events.alert_id and a.organization_id = public.current_org_id()
    )
    and public.current_role() in ('admin', 'analyst')
  );

-- Cases -------------------------------------------------------------------------
create policy "members read cases"
  on public.cases for select to authenticated
  using (organization_id = public.current_org_id());

create policy "analysts create cases"
  on public.cases for insert to authenticated
  with check (organization_id = public.current_org_id() and public.current_role() in ('admin', 'analyst'));

create policy "analysts update cases"
  on public.cases for update to authenticated
  using (organization_id = public.current_org_id() and public.current_role() in ('admin', 'analyst'))
  with check (organization_id = public.current_org_id());

create policy "admins delete cases"
  on public.cases for delete to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin');

create policy "members read case links"
  on public.case_alerts for select to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_alerts.case_id and c.organization_id = public.current_org_id()
  ));

create policy "analysts create case links"
  on public.case_alerts for insert to authenticated
  with check (
    exists (
      select 1 from public.cases c
      where c.id = case_alerts.case_id and c.organization_id = public.current_org_id()
    )
    and public.current_role() in ('admin', 'analyst')
  );

create policy "analysts delete case links"
  on public.case_alerts for delete to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_alerts.case_id and c.organization_id = public.current_org_id()
    )
    and public.current_role() in ('admin', 'analyst')
  );

create policy "members read case entities"
  on public.case_entities for select to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_entities.case_id and c.organization_id = public.current_org_id()
  ));

create policy "analysts create case entities"
  on public.case_entities for insert to authenticated
  with check (
    exists (
      select 1 from public.cases c
      where c.id = case_entities.case_id and c.organization_id = public.current_org_id()
    )
    and public.current_role() in ('admin', 'analyst')
  );

create policy "analysts delete case entities"
  on public.case_entities for delete to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_entities.case_id and c.organization_id = public.current_org_id()
    )
    and public.current_role() in ('admin', 'analyst')
  );

create policy "members read case notes"
  on public.case_notes for select to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_notes.case_id and c.organization_id = public.current_org_id()
  ));

create policy "analysts add case notes"
  on public.case_notes for insert to authenticated
  with check (
    exists (
      select 1 from public.cases c
      where c.id = case_notes.case_id and c.organization_id = public.current_org_id()
    )
    and author_id = auth.uid()
    and public.current_role() in ('admin', 'analyst')
  );

create policy "members read case attachments"
  on public.case_attachments for select to authenticated
  using (exists (
    select 1 from public.cases c
    where c.id = case_attachments.case_id and c.organization_id = public.current_org_id()
  ));

create policy "analysts add case attachments"
  on public.case_attachments for insert to authenticated
  with check (
    exists (
      select 1 from public.cases c
      where c.id = case_attachments.case_id and c.organization_id = public.current_org_id()
    )
    and public.current_role() in ('admin', 'analyst')
  );

create policy "admins delete case attachments"
  on public.case_attachments for delete to authenticated
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_attachments.case_id and c.organization_id = public.current_org_id()
    )
    and public.current_role() = 'admin'
  );

-- Rules -------------------------------------------------------------------------
create policy "members read rules"
  on public.rules for select to authenticated
  using (organization_id = public.current_org_id());

create policy "analysts create draft rules"
  on public.rules for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.current_role() in ('admin', 'analyst')
    and status = 'draft'
  );

create policy "analysts edit rules"
  on public.rules for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.current_role() = 'admin' or (public.current_role() = 'analyst' and status = 'draft'))
  )
  with check (organization_id = public.current_org_id());

create policy "admins delete rules"
  on public.rules for delete to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin');

create policy "members read rule versions"
  on public.rule_versions for select to authenticated
  using (exists (
    select 1 from public.rules r
    where r.id = rule_versions.rule_id and r.organization_id = public.current_org_id()
  ));

create policy "analysts create rule versions"
  on public.rule_versions for insert to authenticated
  with check (
    exists (
      select 1 from public.rules r
      where r.id = rule_versions.rule_id and r.organization_id = public.current_org_id()
    )
    and public.current_role() in ('admin', 'analyst')
  );

create policy "analysts edit draft rule versions"
  on public.rule_versions for update to authenticated
  using (
    exists (
      select 1 from public.rules r
      where r.id = rule_versions.rule_id and r.organization_id = public.current_org_id()
    )
    and (public.current_role() = 'admin' or (public.current_role() = 'analyst' and is_draft))
  )
  with check (
    exists (
      select 1 from public.rules r
      where r.id = rule_versions.rule_id and r.organization_id = public.current_org_id()
    )
  );

-- Reports -----------------------------------------------------------------------
create policy "members read permitted reports"
  on public.reports for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.current_role() = 'admin' or requested_by = auth.uid())
  );

create policy "analysts request reports"
  on public.reports for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.current_role() in ('admin', 'analyst')
    and requested_by = auth.uid()
  );

create policy "requesters update their reports"
  on public.reports for update to authenticated
  using (
    organization_id = public.current_org_id()
    and (public.current_role() = 'admin' or requested_by = auth.uid())
  )
  with check (organization_id = public.current_org_id());

create policy "admins delete reports"
  on public.reports for delete to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin');

create policy "admins manage report schedules"
  on public.report_schedules for all to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin')
  with check (organization_id = public.current_org_id());

-- API keys ----------------------------------------------------------------------
create policy "admins read api keys"
  on public.api_keys for select to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin');

create policy "admins create api keys"
  on public.api_keys for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.current_role() = 'admin'
    and created_by = auth.uid()
  );

create policy "admins update api keys"
  on public.api_keys for update to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin')
  with check (organization_id = public.current_org_id());

create policy "admins delete api keys"
  on public.api_keys for delete to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin');

-- Notifications -----------------------------------------------------------------
create policy "users read their notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "users update their notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete their notifications"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy "analysts notify organization members"
  on public.notifications for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.current_role() in ('admin', 'analyst')
    and exists (
      select 1 from public.profiles p
      where p.id = notifications.user_id and p.organization_id = notifications.organization_id
    )
  );

-- Audit log ---------------------------------------------------------------------
create policy "admins read audit log"
  on public.audit_log for select to authenticated
  using (organization_id = public.current_org_id() and public.current_role() = 'admin');

create policy "members append audit log"
  on public.audit_log for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and actor_id = auth.uid()
    and public.current_role() in ('admin', 'analyst')
  );

-- Contact requests --------------------------------------------------------------
create policy "anyone can submit a contact request"
  on public.contact_requests for insert to anon, authenticated
  with check (
    length(trim(name)) between 2 and 120
    and position('@' in email) > 1
    and length(trim(message)) between 10 and 5000
  );

-- Idempotency cache -------------------------------------------------------------
create policy "users read their idempotent responses"
  on public.api_idempotency for select to authenticated
  using (organization_id = public.current_org_id() and created_by = auth.uid());

create policy "users store their idempotent responses"
  on public.api_idempotency for insert to authenticated
  with check (organization_id = public.current_org_id() and created_by = auth.uid());

create policy "users refresh their idempotent responses"
  on public.api_idempotency for update to authenticated
  using (organization_id = public.current_org_id() and created_by = auth.uid())
  with check (organization_id = public.current_org_id());

-- Append-only enforcement -------------------------------------------------------
revoke update, delete on public.alert_events from anon, authenticated;
revoke update, delete on public.audit_log from anon, authenticated;
revoke update, delete on public.case_notes from anon, authenticated;
revoke delete on public.transactions from anon, authenticated;
revoke delete on public.alerts from anon, authenticated;

-- API key hashes never leave the server. Metadata is available through a column
-- grant and the api_keys_safe view; the hash is only read by verify_api_key().
revoke all on public.api_keys from anon;
revoke select on public.api_keys from authenticated;
grant select (id, organization_id, name, prefix, scopes, created_by, last_used_at, revoked_at, created_at)
  on public.api_keys to authenticated;
grant insert, update, delete on public.api_keys to authenticated;
