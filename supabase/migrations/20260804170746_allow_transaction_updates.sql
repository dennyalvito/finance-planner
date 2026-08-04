grant update on table public.transactions to authenticated;

create policy "Users can update their own transactions"
on public.transactions
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
