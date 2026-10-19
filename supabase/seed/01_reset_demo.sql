-- Resets the two demo tenants only. Destructive for demo data; never run against
-- an organization that contains work you want to keep.
-- Usage: psql "$DATABASE_URL" -f supabase/seed/01_reset_demo.sql

do $$
declare
  demo_orgs uuid[] := array[
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  ];
begin
  delete from public.case_alerts where case_id in (select id from public.cases where organization_id = any(demo_orgs));
  delete from public.case_entities where case_id in (select id from public.cases where organization_id = any(demo_orgs));
  delete from public.cases where organization_id = any(demo_orgs);
  delete from public.alerts where organization_id = any(demo_orgs);
  delete from public.rules where organization_id = any(demo_orgs);
  delete from public.transactions where organization_id = any(demo_orgs);
  delete from public.accounts where organization_id = any(demo_orgs);
  delete from public.entities where organization_id = any(demo_orgs);
  delete from public.notifications where organization_id = any(demo_orgs);
  delete from public.report_schedules where organization_id = any(demo_orgs);
  delete from public.reports where organization_id = any(demo_orgs);
  delete from public.audit_log where organization_id = any(demo_orgs);
end;
$$;
