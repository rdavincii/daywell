-- Optional cloud save for Daywell: one private row per signed-in user holding their whole app state.
-- Run once in the Supabase SQL editor of the project you point the app at. Row Level Security means
-- each user can only ever read or change their own row.
create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "own state: read" on public.user_state for select to authenticated using (auth.uid() = user_id);
create policy "own state: insert" on public.user_state for insert to authenticated with check (auth.uid() = user_id);
create policy "own state: update" on public.user_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own state: delete" on public.user_state for delete to authenticated using (auth.uid() = user_id);
