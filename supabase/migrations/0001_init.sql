-- Daywell cloud schema (Supabase / PostgreSQL).
-- STATUS: reference design, NOT yet wired into the app and NOT yet run against a real database.
-- The current app stores data in the browser (localStorage). Use this when you add accounts + sync.
-- Money is integer sen. Timestamps are timestamptz; "which day" is computed in the user's timezone.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency text not null default 'MYR',
  timezone text not null default 'Asia/Kuala_Lumpur',
  kcal_target int not null default 2000 check (kcal_target >= 0),
  protein_target int not null default 75 check (protein_target >= 0),
  carbs_target int not null default 250 check (carbs_target >= 0),
  fat_target int not null default 65 check (fat_target >= 0),
  daily_budget_sen bigint not null default 4000 check (daily_budget_sen >= 0),
  monthly_budget_sen bigint not null default 100000 check (monthly_budget_sen >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null,
  item text not null,
  merchant text,
  category text not null,
  amount_sen bigint not null check (amount_sen > 0),
  currency text not null default 'MYR',
  notes text,
  source text not null default 'manual',
  transcript text,
  receipt_path text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists expenses_user_time on public.expenses (user_id, occurred_at desc);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consumed_at timestamptz not null,
  meal_type text not null check (meal_type in ('Breakfast','Lunch','Dinner','Snack')),
  food_name text not null,
  serving_label text,
  quantity numeric not null default 1 check (quantity > 0),
  portion text not null default 'regular',
  kcal int check (kcal >= 0),             -- null = unknown, never invented
  protein_g numeric check (protein_g >= 0),
  carbs_g numeric check (carbs_g >= 0),
  fat_g numeric check (fat_g >= 0),
  nutrition_source text not null default 'unknown',
  confidence text not null default 'none',
  note text,
  -- optional link; deleting the expense keeps the meal and clears the link
  expense_id uuid references public.expenses(id) on delete set null,
  source text not null default 'manual',
  transcript text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists meals_user_time on public.meals (user_id, consumed_at desc);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  period text not null default 'monthly' check (period in ('daily','weekly','monthly')),
  limit_sen bigint not null check (limit_sen > 0),
  currency text not null default 'MYR',
  unique (user_id, category, period)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.ai_processing_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_type text not null check (input_type in ('text','voice','image','receipt')),
  status text not null check (status in ('pending','done','failed')),
  extracted jsonb,
  confidence text,
  error text,
  created_at timestamptz not null default now()
);

-- Row Level Security: every row is private to its owner.
do $$
declare t text;
begin
  foreach t in array array['profiles','expenses','meals','budgets','notifications','ai_processing_records'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner access" on public.%I', t);
    execute format('create policy "owner access" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
