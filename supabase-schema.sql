-- Run this once in Supabase Dashboard -> SQL Editor.

create table if not exists public.planner_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.planner_states enable row level security;

drop policy if exists "planner_state_select_own" on public.planner_states;
create policy "planner_state_select_own"
on public.planner_states for select
using (auth.uid() = user_id);

drop policy if exists "planner_state_insert_own" on public.planner_states;
create policy "planner_state_insert_own"
on public.planner_states for insert
with check (auth.uid() = user_id);

drop policy if exists "planner_state_update_own" on public.planner_states;
create policy "planner_state_update_own"
on public.planner_states for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "planner_state_delete_own" on public.planner_states;
create policy "planner_state_delete_own"
on public.planner_states for delete
using (auth.uid() = user_id);
