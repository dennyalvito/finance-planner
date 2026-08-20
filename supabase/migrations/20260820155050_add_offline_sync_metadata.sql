alter table public.categories
  add column revision bigint not null default 1,
  add column updated_at timestamptz,
  add column deleted_at timestamptz,
  add constraint categories_revision_positive check (revision > 0),
  add constraint categories_built_in_not_deleted check (
    is_custom or deleted_at is null
  );

update public.categories
set updated_at = created_at
where updated_at is null;

alter table public.categories
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.transactions
  add column revision bigint not null default 1,
  add column updated_at timestamptz,
  add column deleted_at timestamptz,
  add constraint transactions_revision_positive check (revision > 0);

update public.transactions
set updated_at = created_at
where updated_at is null;

alter table public.transactions
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.budgets
  add column revision bigint not null default 1,
  add column deleted_at timestamptz,
  add constraint budgets_revision_positive check (revision > 0);

create function private.bump_finance_record_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.revision = old.revision + 1;
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create trigger bump_category_revision_before_update
before update on public.categories
for each row
execute function private.bump_finance_record_revision();

create trigger bump_transaction_revision_before_update
before update on public.transactions
for each row
execute function private.bump_finance_record_revision();

create trigger bump_budget_revision_before_update
before update on public.budgets
for each row
execute function private.bump_finance_record_revision();

create function private.prevent_in_use_category_deletion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null and (
    exists (
      select 1
      from public.transactions as transaction
      where transaction.category_id = old.id
        and transaction.deleted_at is null
    )
    or exists (
      select 1
      from public.budgets as budget
      where budget.category_id = old.id
        and budget.deleted_at is null
    )
  ) then
    raise exception 'Category is still used by transactions or budgets.'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger prevent_in_use_category_deletion_before_update
before update of deleted_at on public.categories
for each row
execute function private.prevent_in_use_category_deletion();

create function private.prevent_category_identity_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.type is distinct from old.type
    or new.is_custom is distinct from old.is_custom
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Category identity and type cannot be changed.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger prevent_category_identity_changes_before_update
before update on public.categories
for each row
execute function private.prevent_category_identity_changes();

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
      and category.deleted_at is null
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
      and category.deleted_at is null
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

revoke execute on function private.bump_finance_record_revision()
  from public, anon, authenticated;
revoke execute on function private.prevent_in_use_category_deletion()
  from public, anon, authenticated;
revoke execute on function private.prevent_category_identity_changes()
  from public, anon, authenticated;

grant update on table public.categories to authenticated;

create policy "Users can update their own custom categories"
on public.categories
for update
to authenticated
using (
  is_custom
  and user_id = (select auth.uid())
)
with check (
  is_custom
  and user_id = (select auth.uid())
);

-- Cloud deletes are logical deletes so another device can detect and resolve
-- edit-versus-delete conflicts. Physical cleanup is deliberately not exposed
-- to browser clients.
revoke delete on table public.transactions from authenticated;
drop policy "Users can delete their own transactions"
  on public.transactions;
