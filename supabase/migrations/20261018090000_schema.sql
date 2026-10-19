-- SentinelFlow schema. All timestamps are timestamptz (UTC). Money is numeric(18,2).

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.user_role as enum ('admin', 'analyst', 'viewer');
create type public.risk_level as enum ('low', 'medium', 'high', 'critical');
create type public.account_status as enum ('active', 'frozen', 'closed');
create type public.entity_kind as enum ('individual', 'company', 'intermediary');
create type public.transaction_status as enum ('settled', 'pending', 'blocked', 'review');
create type public.alert_status as enum ('new', 'investigating', 'escalated', 'resolved', 'false_positive');
create type public.alert_event_type as enum ('created', 'assigned', 'status_changed', 'note_added', 'escalated', 'exported');
create type public.case_status as enum ('open', 'in_review', 'closed');
create type public.case_priority as enum ('low', 'medium', 'high', 'critical');
create type public.rule_status as enum ('draft', 'active', 'disabled');
create type public.report_kind as enum ('sar_summary', 'daily_digest', 'audit_log');
create type public.report_status as enum ('queued', 'running', 'ready', 'failed');
create type public.report_format as enum ('csv', 'pdf');
create type public.notification_type as enum (
  'alert_assigned', 'alert_escalated', 'case_mention', 'case_assigned', 'report_ready', 'digest', 'system'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  slug citext not null unique check (slug ~ '^[a-z0-9](-?[a-z0-9])*$'),
  timezone text not null default 'UTC',
  base_currency char(3) not null default 'USD',
  require_mfa boolean not null default false,
  plan text not null default 'growth' check (plan in ('starter', 'growth', 'enterprise')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  email text not null,
  role public.user_role not null default 'viewer',
  full_name text not null default '',
  avatar_url text,
  timezone text not null default 'UTC',
  language text not null default 'en',
  notification_prefs jsonb not null default '{
    "in_app": {"alert_assigned": true, "alert_escalated": true, "case_mention": true, "case_assigned": true, "report_ready": true, "digest": true, "system": true},
    "email": {"alert_assigned": false, "alert_escalated": true, "case_mention": true, "case_assigned": false, "report_ready": true, "digest": true, "system": false}
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.user_role not null default 'analyst',
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind public.entity_kind not null,
  legal_name text not null,
  country char(2) not null,
  incorporated_on date,
  registration_number text,
  pep_flag boolean not null default false,
  nominee_director_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index entities_org_registration_key
  on public.entities (organization_id, registration_number)
  where registration_number is not null;
create index entities_org_country_idx on public.entities (organization_id, country);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  external_ref text not null,
  entity_id uuid not null references public.entities (id) on delete restrict,
  country char(2) not null,
  currency char(3) not null,
  status public.account_status not null default 'active',
  opened_at timestamptz not null default now(),
  risk_tier public.risk_level not null default 'low',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_ref)
);
create index accounts_org_entity_idx on public.accounts (organization_id, entity_id);

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) between 3 and 120),
  description text not null default '',
  status public.rule_status not null default 'draft',
  current_version_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rules_org_status_idx on public.rules (organization_id, status);

create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.rules (id) on delete cascade,
  version integer not null check (version > 0),
  definition jsonb not null,
  definition_hash text not null,
  is_draft boolean not null default true,
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  change_note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_id, version)
);
create unique index rule_versions_one_draft_idx on public.rule_versions (rule_id) where is_draft;
create index rule_versions_rule_idx on public.rule_versions (rule_id, version desc);

alter table public.rules
  add constraint rules_current_version_fk
  foreign key (current_version_id) references public.rule_versions (id) on delete set null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  external_id text not null,
  sender_account_id uuid not null references public.accounts (id) on delete restrict,
  receiver_account_id uuid not null references public.accounts (id) on delete restrict,
  sender_name text not null default '',
  receiver_name text not null default '',
  amount numeric(18, 2) not null check (amount > 0),
  currency char(3) not null,
  amount_base numeric(18, 2) not null check (amount_base > 0),
  sender_country char(2) not null,
  receiver_country char(2) not null,
  corridor text generated always as (sender_country || '-' || receiver_country) stored,
  channel text not null default 'SWIFT',
  purpose_code text,
  status public.transaction_status not null default 'settled',
  risk_score smallint check (risk_score between 0 and 100),
  risk_level public.risk_level,
  risk_factors jsonb not null default '[]'::jsonb,
  scored_at timestamptz,
  model_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, external_id)
);

create index transactions_org_created_idx on public.transactions (organization_id, created_at desc);
create index transactions_org_corridor_created_idx on public.transactions (organization_id, corridor, created_at desc);
create index transactions_org_sender_created_idx on public.transactions (organization_id, sender_account_id, created_at);
create index transactions_org_receiver_created_idx on public.transactions (organization_id, receiver_account_id, created_at);
create index transactions_org_risk_idx on public.transactions (organization_id, risk_score desc) where risk_score >= 60;

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  rule_id uuid references public.rules (id) on delete set null,
  title text not null,
  severity public.risk_level not null,
  status public.alert_status not null default 'new',
  assignee_id uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  first_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text,
  summary text not null default '',
  score_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index alerts_org_status_severity_idx on public.alerts (organization_id, status, severity);
create index alerts_org_assignee_open_idx
  on public.alerts (organization_id, assignee_id)
  where status in ('new', 'investigating', 'escalated');
create index alerts_org_created_idx on public.alerts (organization_id, created_at desc);
create unique index alerts_transaction_rule_key on public.alerts (transaction_id, coalesce(rule_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type public.alert_event_type not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index alert_events_alert_idx on public.alert_events (alert_id, created_at desc);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (length(trim(title)) between 3 and 160),
  status public.case_status not null default 'open',
  priority public.case_priority not null default 'medium',
  owner_id uuid references public.profiles (id) on delete set null,
  summary text not null default '',
  created_from_alert_id uuid references public.alerts (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cases_org_status_idx on public.cases (organization_id, status, updated_at desc);

create table public.case_alerts (
  case_id uuid not null references public.cases (id) on delete cascade,
  alert_id uuid not null references public.alerts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, alert_id)
);

create table public.case_entities (
  case_id uuid not null references public.cases (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (case_id, entity_id)
);

create table public.case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default now()
);
create index case_notes_case_idx on public.case_notes (case_id, created_at desc);

create table public.case_attachments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  storage_path text not null,
  filename text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 26214400),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index case_attachments_case_idx on public.case_attachments (case_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind public.report_kind not null,
  date_from date not null,
  date_to date not null,
  status public.report_status not null default 'queued',
  storage_path text,
  format public.report_format not null default 'pdf',
  requested_by uuid references public.profiles (id) on delete set null,
  params jsonb not null default '{}'::jsonb,
  row_count integer,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_to >= date_from)
);
create index reports_org_created_idx on public.reports (organization_id, created_at desc);

create table public.report_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind public.report_kind not null default 'daily_digest',
  format public.report_format not null default 'pdf',
  send_at time not null default '08:00',
  timezone text not null default 'UTC',
  recipients text[] not null default '{}',
  enabled boolean not null default false,
  last_run_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, kind)
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default array['score', 'ingest', 'read'],
  created_by uuid references public.profiles (id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index api_keys_org_idx on public.api_keys (organization_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_read_idx on public.notifications (user_id, read_at);

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  email text not null,
  company text not null default '',
  message text not null check (length(trim(message)) between 10 and 5000),
  intent text not null default 'general',
  source text not null default 'website',
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index audit_log_org_created_idx on public.audit_log (organization_id, created_at desc);

create table public.api_idempotency (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  idempotency_key text not null,
  endpoint text not null,
  created_by uuid references public.profiles (id) on delete set null,
  response jsonb not null,
  status_code integer not null default 200,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  primary key (organization_id, idempotency_key)
);

-- key_hash is excluded from browser access through column-level grants applied in
-- the RLS migration, so no view can accidentally run without row-level security.
