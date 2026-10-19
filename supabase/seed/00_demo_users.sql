-- Demo tenants and confirmed email/password users.
-- The password for every demo account is: Sentinel-Demo-2026!
-- Applied once per environment: `psql "$DATABASE_URL" -f supabase/seed/00_demo_users.sql`
-- or through the Supabase MCP `execute_sql` tool.

insert into public.organizations (id, name, slug, timezone, base_currency, plan, require_mfa)
values
  ('11111111-1111-4111-8111-111111111111', 'Northwind Payments', 'northwind-payments', 'Europe/London', 'USD', 'growth', false),
  ('22222222-2222-4222-8222-222222222222', 'Meridian Trust Bank', 'meridian-trust', 'Asia/Singapore', 'SGD', 'enterprise', false)
on conflict (id) do update
set name = excluded.name,
    timezone = excluded.timezone,
    base_currency = excluded.base_currency,
    plan = excluded.plan;

do $$
declare
  demo record;
  v_password text := 'Sentinel-Demo-2026!';
begin
  for demo in
    select * from (values
      ('00000000-0000-4000-8000-000000000101'::uuid, 'admin@northwind.example', 'Priya Raman', 'admin'::public.user_role, '11111111-1111-4111-8111-111111111111'::uuid),
      ('00000000-0000-4000-8000-000000000102'::uuid, 'analyst1@northwind.example', 'Daniel Okafor', 'analyst'::public.user_role, '11111111-1111-4111-8111-111111111111'::uuid),
      ('00000000-0000-4000-8000-000000000103'::uuid, 'analyst2@northwind.example', 'Mei Lin Tan', 'analyst'::public.user_role, '11111111-1111-4111-8111-111111111111'::uuid),
      ('00000000-0000-4000-8000-000000000104'::uuid, 'viewer@northwind.example', 'Tomas Weber', 'viewer'::public.user_role, '11111111-1111-4111-8111-111111111111'::uuid),
      ('00000000-0000-4000-8000-000000000201'::uuid, 'admin@meridian.example', 'Sofia Alvarez', 'admin'::public.user_role, '22222222-2222-4222-8222-222222222222'::uuid),
      ('00000000-0000-4000-8000-000000000202'::uuid, 'analyst1@meridian.example', 'Hiroshi Sato', 'analyst'::public.user_role, '22222222-2222-4222-8222-222222222222'::uuid),
      ('00000000-0000-4000-8000-000000000203'::uuid, 'analyst2@meridian.example', 'Aisha Rahman', 'analyst'::public.user_role, '22222222-2222-4222-8222-222222222222'::uuid),
      ('00000000-0000-4000-8000-000000000204'::uuid, 'viewer@meridian.example', 'Lucas Meyer', 'viewer'::public.user_role, '22222222-2222-4222-8222-222222222222'::uuid)
    ) as t(id, email, full_name, role, organization_id)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, reauthentication_token, is_sso_user, is_anonymous
    )
    values (
      '00000000-0000-0000-0000-000000000000', demo.id, 'authenticated', 'authenticated', demo.email,
      crypt(v_password, gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', array['email']),
      jsonb_build_object('full_name', demo.full_name),
      now(), now(), '', '', '', '', '', '', false, false
    )
    on conflict (id) do update
    set encrypted_password = excluded.encrypted_password,
        email_confirmed_at = coalesce(auth.users.email_confirmed_at, now());

    insert into auth.identities (
      user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    )
    values (
      demo.id,
      demo.id::text,
      jsonb_build_object('sub', demo.id::text, 'email', demo.email, 'email_verified', true, 'phone_verified', false),
      'email',
      now(), now(), now()
    )
    on conflict (provider_id, provider) do nothing;

    update public.profiles
    set organization_id = demo.organization_id,
        role = demo.role,
        full_name = demo.full_name,
        email = demo.email
    where id = demo.id;
  end loop;
end;
$$;
