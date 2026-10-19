-- Newsletter subscribers captured by the marketing footer.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'footer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;

create policy "anyone can subscribe"
  on public.newsletter_subscribers for insert to anon, authenticated
  with check (true);

create policy "members read subscribers"
  on public.newsletter_subscribers for select to authenticated
  using (public.current_role() in ('admin', 'analyst'));

create trigger newsletter_subscribers_touch
  before update on public.newsletter_subscribers
  for each row execute function public.touch_updated_at();
