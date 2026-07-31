begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(30);

create temporary table test_results (
  result text not null
);
grant insert, select on test_results to authenticated;

insert into test_results (result) select has_table(
  'public',
  'categories',
  'The categories table is created by migrations'
);
insert into test_results (result) select has_table(
  'public',
  'transactions',
  'The transactions table is created by migrations'
);
insert into test_results (result) select has_table(
  'public',
  'budgets',
  'The budgets table is created by migrations'
);

insert into test_results (result) select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.categories'::regclass
  ),
  'Categories have RLS enabled'
);
insert into test_results (result) select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.transactions'::regclass
  ),
  'Transactions have RLS enabled'
);
insert into test_results (result) select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.budgets'::regclass
  ),
  'Budgets have RLS enabled'
);

insert into test_results (result) select ok(
  not has_table_privilege('anon', 'public.categories', 'select'),
  'Unauthenticated requests cannot read categories'
);
insert into test_results (result) select ok(
  not has_table_privilege('anon', 'public.transactions', 'select'),
  'Unauthenticated requests cannot read transactions'
);
insert into test_results (result) select ok(
  not has_table_privilege('anon', 'public.budgets', 'select'),
  'Unauthenticated requests cannot read budgets'
);

insert into test_results (result) select ok(
  has_table_privilege('authenticated', 'public.categories', 'select')
  and has_table_privilege('authenticated', 'public.categories', 'insert')
  and not has_table_privilege('authenticated', 'public.categories', 'update')
  and not has_table_privilege('authenticated', 'public.categories', 'delete'),
  'Authenticated category privileges are least-privilege'
);
insert into test_results (result) select ok(
  has_table_privilege('authenticated', 'public.transactions', 'select')
  and has_table_privilege('authenticated', 'public.transactions', 'insert')
  and has_table_privilege('authenticated', 'public.transactions', 'delete')
  and not has_table_privilege('authenticated', 'public.transactions', 'update'),
  'Authenticated transaction privileges are least-privilege'
);
insert into test_results (result) select ok(
  has_table_privilege('authenticated', 'public.budgets', 'select')
  and has_table_privilege('authenticated', 'public.budgets', 'insert')
  and has_table_privilege('authenticated', 'public.budgets', 'update')
  and not has_table_privilege('authenticated', 'public.budgets', 'delete'),
  'Authenticated budget privileges are least-privilege'
);

insert into auth.users (id, email)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'coin-test-user-a@example.invalid'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'coin-test-user-b@example.invalid'
  );

insert into public.categories (id, user_id, name, type, is_custom)
values
  (
    'test-user-a-category',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'User A expense',
    'expense',
    true
  ),
  (
    'test-user-b-category',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'User B expense',
    'expense',
    true
  );

insert into public.transactions (user_id, type, amount, category_id, date, note)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'expense',
    10000,
    'test-user-a-category',
    '2026-07-01',
    'Synthetic User A row'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'expense',
    20000,
    'test-user-b-category',
    '2026-07-02',
    'Synthetic User B row'
  );

insert into public.budgets (user_id, category_id, month, amount)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'test-user-a-category',
    '2026-07-01',
    100000
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'test-user-b-category',
    '2026-07-01',
    200000
  );

set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

insert into test_results (result) select is(
  (select count(*) from public.transactions),
  1::bigint,
  'User A reads only their transaction'
);
insert into test_results (result) select is(
  (
    select count(*)
    from public.transactions
    where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  0::bigint,
  'User A cannot read User B transactions'
);
insert into test_results (result) select is(
  (select count(*) from public.budgets),
  1::bigint,
  'User A reads only their budget'
);
insert into test_results (result) select is(
  (
    select count(*)
    from public.budgets
    where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  0::bigint,
  'User A cannot read User B budgets'
);
insert into test_results (result) select is(
  (
    select count(*)
    from public.categories
    where id = 'test-user-a-category'
  ),
  1::bigint,
  'User A can read their custom category'
);
insert into test_results (result) select is(
  (
    select count(*)
    from public.categories
    where id = 'test-user-b-category'
  ),
  0::bigint,
  'User A cannot read User B custom categories'
);

with attempted_delete as (
  delete from public.transactions
  where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  returning id
)
insert into test_results (result) select is(
  (select count(*) from attempted_delete),
  0::bigint,
  'User A cannot delete User B transactions'
);
with attempted_update as (
  update public.budgets
  set amount = 1
  where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  returning id
)
insert into test_results (result) select is(
  (select count(*) from attempted_update),
  0::bigint,
  'User A cannot update User B budgets'
);

insert into test_results (result) select throws_ok(
  $$
    insert into public.transactions
      (user_id, type, amount, category_id, date, note)
    values
      (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'expense',
        1000,
        'food',
        '2026-07-03',
        'Forged transaction'
      )
  $$,
  '42501',
  null,
  'User A cannot create a transaction owned by User B'
);
insert into test_results (result) select throws_ok(
  $$
    insert into public.categories (id, user_id, name, type, is_custom)
    values (
      'forged-user-b-category',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'Forged category',
      'expense',
      true
    )
  $$,
  '42501',
  null,
  'User A cannot create a category owned by User B'
);
insert into test_results (result) select throws_ok(
  $$
    insert into public.budgets (user_id, category_id, month, amount)
    values (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'food',
      '2026-08-01',
      1000
    )
  $$,
  '42501',
  null,
  'User A cannot create a budget owned by User B'
);
insert into test_results (result) select throws_ok(
  $$
    insert into public.transactions
      (user_id, type, amount, category_id, date, note)
    values
      (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'expense',
        0,
        'test-user-a-category',
        '2026-07-03',
        'Invalid amount'
      )
  $$,
  '23514',
  null,
  'Non-positive transaction amounts are rejected'
);
insert into test_results (result) select throws_ok(
  $$
    insert into public.budgets (user_id, category_id, month, amount)
    values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'test-user-a-category',
      '2026-07-01',
      100000
    )
  $$,
  '23505',
  null,
  'Duplicate monthly category budgets are rejected'
);
insert into test_results (result) select throws_ok(
  $$update public.categories set name = 'Changed' where id = 'food'$$,
  '42501',
  null,
  'Built-in categories are immutable to authenticated users'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

insert into test_results (result) select is(
  (
    select count(*)
    from public.transactions
    where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  ),
  1::bigint,
  'User B still reads their transaction after User A mutation attempts'
);
insert into test_results (result) select is(
  (
    select count(*)
    from public.transactions
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  0::bigint,
  'User B cannot read User A transactions'
);
insert into test_results (result) select is(
  (
    select count(*)
    from public.categories
    where id = 'test-user-b-category'
  ),
  1::bigint,
  'User B reads their custom category'
);
insert into test_results (result) select is(
  (
    select count(*)
    from public.budgets
    where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and amount = 200000
  ),
  1::bigint,
  'User B budget was not changed by User A'
);

insert into test_results (result)
select * from finish();

select result
from test_results
order by
  substring(result from '^(?:not )?ok ([0-9]+)')::integer nulls last;
rollback;
