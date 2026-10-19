-- Shared helpers -----------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'profiles', 'organization_invites', 'entities', 'accounts', 'rules',
    'rule_versions', 'transactions', 'alerts', 'cases', 'reports', 'report_schedules',
    'api_keys'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.touch_updated_at()',
      t
    );
  end loop;
end;
$$;

create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Kept for the documented helper name used by policies and clients.
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and organization_id = p_org
  );
$$;

-- New auth user -> profile, optionally consuming an invite ----------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invite public.organization_invites%rowtype;
  v_token text;
  v_hash text;
begin
  v_token := nullif(new.raw_user_meta_data ->> 'invite_token', '');
  if v_token is not null then
    v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
    select * into v_invite
    from public.organization_invites
    where token_hash = v_hash
      and accepted_at is null
      and expires_at > now()
      and lower(email) = lower(new.email)
    limit 1;
  end if;

  if v_invite.id is not null then
    insert into public.profiles (id, email, full_name, role, organization_id)
    values (
      new.id,
      coalesce(new.email, ''),
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      v_invite.role,
      v_invite.organization_id
    );
    update public.organization_invites set accepted_at = now() where id = v_invite.id;
  else
    insert into public.profiles (id, email, full_name)
    values (
      new.id,
      coalesce(new.email, ''),
      coalesce(new.raw_user_meta_data ->> 'full_name', '')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guard the last admin of an organization --------------------------------------
create or replace function public.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.organization_id is not null
     and old.role = 'admin'
     and (new.role <> 'admin' or new.organization_id is distinct from old.organization_id) then
    if not exists (
      select 1 from public.profiles
      where organization_id = old.organization_id and role = 'admin' and id <> old.id
    ) then
      raise exception 'The last admin cannot be removed or demoted' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_last_admin on public.profiles;
create trigger guard_last_admin
  before update of role, organization_id on public.profiles
  for each row execute function public.guard_last_admin();

-- Alert lifecycle --------------------------------------------------------------
create or replace function public.alert_status_transition_allowed(
  p_from public.alert_status,
  p_to public.alert_status
)
returns boolean
language sql
immutable
as $$
  select case
    when p_from = p_to then true
    when p_from = 'new' and p_to = 'investigating' then true
    when p_from = 'investigating' and p_to in ('escalated', 'resolved', 'false_positive') then true
    when p_from = 'escalated' and p_to in ('resolved', 'investigating') then true
    else false
  end;
$$;

create or replace function public.before_alert_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.first_seen_at := coalesce(new.first_seen_at, now());
    new.due_at := coalesce(
      new.due_at,
      now() + make_interval(hours => case new.severity
        when 'critical' then 4
        when 'high' then 12
        when 'medium' then 24
        else 48
      end)
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    if not public.alert_status_transition_allowed(old.status, new.status) then
      raise exception 'Invalid status transition from % to %', old.status, new.status
        using errcode = '23514';
    end if;
    if new.status in ('resolved', 'false_positive') then
      new.resolved_at := coalesce(new.resolved_at, now());
    else
      new.resolved_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists before_alert_write on public.alerts;
create trigger before_alert_write
  before insert or update on public.alerts
  for each row execute function public.before_alert_write();

create or replace function public.after_alert_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.alert_events (alert_id, actor_id, event_type, payload)
  values (
    new.id,
    auth.uid(),
    'created',
    jsonb_build_object('severity', new.severity, 'status', new.status, 'score', new.score_snapshot -> 'score')
  );
  return new;
end;
$$;

drop trigger if exists after_alert_insert on public.alerts;
create trigger after_alert_insert
  after insert on public.alerts
  for each row execute function public.after_alert_insert();

create or replace function public.after_alert_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.alert_events (alert_id, actor_id, event_type, payload)
    values (
      new.id,
      auth.uid(),
      case when new.status = 'escalated' then 'escalated'::public.alert_event_type else 'status_changed'::public.alert_event_type end,
      jsonb_build_object('from', old.status, 'to', new.status)
    );

    if new.status = 'escalated' then
      insert into public.notifications (organization_id, user_id, type, title, body, link)
      select new.organization_id, p.id, 'alert_escalated', 'Alert escalated',
             new.title, '/app/alerts/' || new.id
      from public.profiles p
      where p.organization_id = new.organization_id and p.role = 'admin';
    end if;
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.alert_events (alert_id, actor_id, event_type, payload)
    values (
      new.id,
      auth.uid(),
      'assigned',
      jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id)
    );

    if new.assignee_id is not null then
      insert into public.notifications (organization_id, user_id, type, title, body, link)
      values (
        new.organization_id,
        new.assignee_id,
        'alert_assigned',
        'Alert assigned to you',
        new.title,
        '/app/alerts/' || new.id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists after_alert_update on public.alerts;
create trigger after_alert_update
  after update on public.alerts
  for each row execute function public.after_alert_update();

-- Append-only audit log --------------------------------------------------------
create or replace function public.write_audit(
  p_action text,
  p_target_type text,
  p_target_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ip inet;
  v_forwarded text;
  v_user uuid := auth.uid();
  v_org uuid;
begin
  select organization_id into v_org from public.profiles where id = v_user;
  if v_org is null then
    raise exception 'No organization for actor' using errcode = '42501';
  end if;

  begin
    v_forwarded := current_setting('request.headers', true)::json ->> 'x-forwarded-for';
    if v_forwarded is not null and v_forwarded <> '' then
      v_ip := split_part(v_forwarded, ',', 1)::inet;
    end if;
  exception when others then
    v_ip := null;
  end;

  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata, ip)
  values (v_org, v_user, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb), v_ip)
  returning id into v_id;

  return v_id;
end;
$$;

-- Onboarding and invitations ---------------------------------------------------
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_timezone text default 'UTC',
  p_base_currency text default 'USD'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_user uuid := auth.uid();
  v_existing uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select organization_id into v_existing from public.profiles where id = v_user;
  if v_existing is not null then
    raise exception 'You already belong to an organization' using errcode = '23505';
  end if;

  if p_name is null or length(trim(p_name)) < 2 then
    raise exception 'Organization name must be at least 2 characters' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9](-?[a-z0-9])*$' or length(p_slug) < 2 then
    raise exception 'Invalid slug' using errcode = '22023';
  end if;
  if exists (select 1 from public.organizations where slug = p_slug) then
    raise exception 'That slug is already taken' using errcode = '23505';
  end if;

  insert into public.organizations (name, slug, timezone, base_currency)
  values (trim(p_name), p_slug, coalesce(nullif(p_timezone, ''), 'UTC'), upper(coalesce(nullif(p_base_currency, ''), 'USD')))
  returning id into v_org;

  update public.profiles
  set organization_id = v_org, role = 'admin'
  where id = v_user;

  insert into public.audit_log (organization_id, actor_id, action, target_type, target_id, metadata)
  values (v_org, v_user, 'organization.created', 'organization', v_org::text, jsonb_build_object('name', p_name));

  return v_org;
end;
$$;

create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_invite public.organization_invites%rowtype;
  v_user uuid := auth.uid();
  v_email text;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select email into v_email from public.profiles where id = v_user;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select * into v_invite
  from public.organization_invites
  where token_hash = v_hash
    and accepted_at is null
    and expires_at > now()
  limit 1;

  if v_invite.id is null then
    raise exception 'Invite is invalid or has expired' using errcode = '22023';
  end if;
  if lower(v_invite.email) <> lower(coalesce(v_email, '')) then
    raise exception 'Invite was issued to a different email address' using errcode = '42501';
  end if;

  update public.profiles
  set organization_id = v_invite.organization_id, role = v_invite.role
  where id = v_user;

  update public.organization_invites set accepted_at = now() where id = v_invite.id;

  return v_invite.organization_id;
end;
$$;

-- Rule publishing --------------------------------------------------------------
create or replace function public.publish_rule(p_rule_id uuid, p_change_note text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_draft public.rule_versions%rowtype;
  v_published uuid;
  v_next integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if public.current_role() is distinct from 'admin' then
    raise exception 'Only admins can publish rules' using errcode = '42501';
  end if;

  select organization_id into v_org from public.rules where id = p_rule_id;
  if v_org is null or v_org is distinct from public.current_org_id() then
    raise exception 'Rule not found' using errcode = 'P0002';
  end if;

  select * into v_draft
  from public.rule_versions
  where rule_id = p_rule_id and is_draft = true
  for update;

  if v_draft.id is null then
    raise exception 'Rule has no draft version' using errcode = 'P0002';
  end if;

  update public.rule_versions
  set is_draft = false,
      published_at = now(),
      published_by = auth.uid(),
      change_note = coalesce(nullif(trim(p_change_note), ''), change_note)
  where id = v_draft.id
  returning id into v_published;

  select coalesce(max(version), 0) + 1 into v_next from public.rule_versions where rule_id = p_rule_id;

  insert into public.rule_versions (rule_id, version, definition, definition_hash, is_draft, created_by)
  values (p_rule_id, v_next, v_draft.definition, v_draft.definition_hash, true, auth.uid());

  update public.rules
  set status = 'active'::public.rule_status, current_version_id = v_published
  where id = p_rule_id;

  perform public.write_audit('rule.published', 'rule', p_rule_id::text, jsonb_build_object('version_id', v_published));

  return v_published;
end;
$$;

create or replace function public.restore_rule_version(p_version_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version public.rule_versions%rowtype;
  v_rule public.rules%rowtype;
  v_draft public.rule_versions%rowtype;
begin
  if public.current_role() not in ('admin', 'analyst') then
    raise exception 'Insufficient privileges' using errcode = '42501';
  end if;

  select * into v_version from public.rule_versions where id = p_version_id;
  if v_version.id is null then
    raise exception 'Version not found' using errcode = 'P0002';
  end if;
  select * into v_rule from public.rules where id = v_version.rule_id;
  if v_rule.organization_id is distinct from public.current_org_id() then
    raise exception 'Version not found' using errcode = 'P0002';
  end if;

  select * into v_draft from public.rule_versions
  where rule_id = v_version.rule_id and is_draft = true
  for update;

  if v_draft.id is null then
    raise exception 'Rule has no draft to restore into' using errcode = 'P0002';
  end if;

  update public.rule_versions
  set definition = v_version.definition,
      definition_hash = v_version.definition_hash,
      change_note = format('Restored from version %s', v_version.version)
  where id = v_draft.id;

  perform public.write_audit('rule.version_restored', 'rule', v_rule.id::text,
    jsonb_build_object('source_version', v_version.version));

  return v_draft.id;
end;
$$;

-- API key authentication -------------------------------------------------------
create or replace function public.verify_api_key(p_hash text)
returns table (key_id uuid, organization_id uuid, created_by uuid, scopes text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key public.api_keys%rowtype;
begin
  update public.api_keys k
  set last_used_at = now()
  where k.key_hash = p_hash and k.revoked_at is null
  returning * into v_key;

  if v_key.id is null then
    return;
  end if;

  key_id := v_key.id;
  organization_id := v_key.organization_id;
  created_by := v_key.created_by;
  scopes := v_key.scopes;
  return next;
end;
$$;

-- Notification helpers ---------------------------------------------------------
create or replace function public.notify_case_mention(p_case_id uuid, p_user_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.cases%rowtype;
begin
  select * into v_case from public.cases where id = p_case_id;
  if v_case.id is null or v_case.organization_id is distinct from public.current_org_id() then
    raise exception 'Case not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.profiles where id = p_user_id and organization_id = v_case.organization_id
  ) then
    raise exception 'User is not a member of this organization' using errcode = '42501';
  end if;

  insert into public.notifications (organization_id, user_id, type, title, body, link)
  values (
    v_case.organization_id,
    p_user_id,
    'case_mention',
    'You were mentioned in a case',
    left(coalesce(p_body, ''), 280),
    '/app/cases/' || p_case_id
  );
end;
$$;

-- Grants -----------------------------------------------------------------------
revoke all on function public.write_audit(text, text, text, jsonb) from public;
grant execute on function public.write_audit(text, text, text, jsonb) to authenticated;
grant execute on function public.create_organization(text, text, text, text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.publish_rule(uuid, text) to authenticated;
grant execute on function public.restore_rule_version(uuid) to authenticated;
grant execute on function public.notify_case_mention(uuid, uuid, text) to authenticated;
grant execute on function public.verify_api_key(text) to anon, authenticated;
