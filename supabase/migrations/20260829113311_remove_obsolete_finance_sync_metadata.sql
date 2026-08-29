-- Account finance now writes directly to Supabase. Remove the tombstones and
-- revision metadata that existed only for the former offline synchronization
-- protocol before exposing physical deletes to authenticated clients.
delete from public.transactions where deleted_at is not null;
delete from public.budgets where deleted_at is not null;
delete from public.categories
where deleted_at is not null and is_custom;

drop trigger if exists prevent_in_use_category_deletion_before_update
  on public.categories;
drop function if exists private.prevent_in_use_category_deletion();

drop trigger if exists bump_category_revision_before_update
  on public.categories;
drop trigger if exists bump_transaction_revision_before_update
  on public.transactions;
drop trigger if exists bump_budget_revision_before_update
  on public.budgets;
drop function if exists private.bump_finance_record_revision();

alter table public.categories
  drop constraint categories_revision_positive,
  drop constraint categories_built_in_not_deleted,
  drop column revision,
  drop column deleted_at,
  drop column updated_at;

alter table public.transactions
  drop constraint transactions_revision_positive,
  drop column revision,
  drop column deleted_at,
  drop column updated_at;

alter table public.budgets
  drop constraint budgets_revision_positive,
  drop column revision,
  drop column deleted_at;

create or replace function private.validate_transaction_category()
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

create or replace function private.validate_budget_category()
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

grant delete on table public.categories to authenticated;
grant delete on table public.transactions to authenticated;
grant delete on table public.budgets to authenticated;

drop policy if exists "Users can delete their own custom categories"
  on public.categories;
create policy "Users can delete their own custom categories"
on public.categories
for delete
to authenticated
using (
  is_custom
  and user_id = (select auth.uid())
);

drop policy if exists "Users can delete their own transactions"
  on public.transactions;
create policy "Users can delete their own transactions"
on public.transactions
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Users can delete their own budgets"
  on public.budgets;
create policy "Users can delete their own budgets"
on public.budgets
for delete
to authenticated
using (user_id = (select auth.uid()));
