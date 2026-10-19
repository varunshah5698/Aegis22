-- Admins may create rules in any state (for example when importing a reviewed
-- rule set); analysts can only create drafts. Replaces the original insert policy
-- so the seed and migrations can publish rules without weakening analyst limits.

drop policy if exists "analysts create draft rules" on public.rules;

create policy "analysts create draft rules"
  on public.rules for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.current_role() in ('admin', 'analyst')
    and (public.current_role() = 'admin' or status = 'draft')
  );
