create type public.transaction_type as enum ('income', 'expense');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.categories (
  id text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  type public.transaction_type not null,
  is_custom boolean not null default true,
  created_at timestamptz not null default now(),
  constraint categories_id_length check (char_length(id) between 1 and 100),
  constraint categories_name_length check (
    char_length(btrim(name)) between 2 and 80
  ),
  constraint categories_ownership check (
    (is_custom and user_id is not null)
    or (not is_custom and user_id is null)
  )
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  amount bigint not null,
  category_id text not null references public.categories (id)
    on update cascade
    on delete restrict,
  date date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint transactions_positive_safe_amount check (
    amount > 0 and amount <= 9007199254740991
  ),
  constraint transactions_note_length check (char_length(note) <= 500)
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id text not null references public.categories (id)
    on update cascade
    on delete restrict,
  month date not null,
  amount bigint not null,
  updated_at timestamptz not null default now(),
  constraint budgets_month_is_first_day check (
    extract(day from month) = 1
  ),
  constraint budgets_positive_safe_amount check (
    amount > 0 and amount <= 9007199254740991
  ),
  constraint budgets_user_month_category_unique unique (
    user_id,
    month,
    category_id
  )
);

create index categories_user_id_idx on public.categories (user_id);
create index transactions_user_date_idx
  on public.transactions (user_id, date desc, created_at desc);
create index transactions_category_id_idx
  on public.transactions (category_id);
create index budgets_category_id_idx
  on public.budgets (category_id);

create function private.validate_transaction_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.categories as category
    where category.id = new.category_id
      and category.type = new.type
      and (
        category.user_id is null
        or category.user_id = new.user_id
      )
  ) then
    raise exception 'Transaction category is unavailable or has the wrong type.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_transaction_category_before_write
before insert or update of user_id, type, category_id
on public.transactions
for each row
execute function private.validate_transaction_category();

create function private.validate_budget_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.categories as category
    where category.id = new.category_id
      and category.type = 'expense'
      and (
        category.user_id is null
        or category.user_id = new.user_id
      )
  ) then
    raise exception 'Budget category is unavailable or is not an expense.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_budget_category_before_write
before insert or update of user_id, category_id
on public.budgets
for each row
execute function private.validate_budget_category();

revoke execute on function private.validate_transaction_category()
  from public, anon, authenticated;
revoke execute on function private.validate_budget_category()
  from public, anon, authenticated;

insert into public.categories (id, user_id, name, type, is_custom)
values
  ('salary', null, 'Salary', 'income', false),
  ('freelance', null, 'Freelance', 'income', false),
  ('gift', null, 'Gift', 'income', false),
  ('food', null, 'Food & dining', 'expense', false),
  ('transport', null, 'Transport', 'expense', false),
  ('housing', null, 'Housing', 'expense', false),
  ('shopping', null, 'Shopping', 'expense', false),
  ('health', null, 'Health', 'expense', false),
  ('leisure', null, 'Leisure', 'expense', false);

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

revoke all on table public.categories from public, anon, authenticated;
revoke all on table public.transactions from public, anon, authenticated;
revoke all on table public.budgets from public, anon, authenticated;

grant usage on schema public to authenticated;
grant usage on type public.transaction_type to authenticated;
grant select, insert on table public.categories to authenticated;
grant select, insert, delete on table public.transactions to authenticated;
grant select, insert, update on table public.budgets to authenticated;

create policy "Authenticated users can read available categories"
on public.categories
for select
to authenticated
using (
  user_id is null
  or user_id = (select auth.uid())
);

create policy "Authenticated users can create custom categories"
on public.categories
for insert
to authenticated
with check (
  is_custom
  and user_id = (select auth.uid())
);

create policy "Users can read their own transactions"
on public.transactions
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own transactions"
on public.transactions
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can delete their own transactions"
on public.transactions
for delete
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can read their own budgets"
on public.budgets
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own budgets"
on public.budgets
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own budgets"
on public.budgets
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

