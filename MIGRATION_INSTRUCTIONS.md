# Database Migration Instructions

Please run the following SQL in your Supabase SQL Editor:

```sql
-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

-- Trigger for new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Add user_id to existing tables
alter table public.tasks add column if not exists user_id uuid references public.profiles(id) on delete cascade;
alter table public.tasks add column if not exists result text;
alter table public.agents add column if not exists user_id uuid references public.profiles(id) on delete cascade;

-- Update RLS policies for tasks
drop policy if exists "Users can view own tasks" on public.tasks;
drop policy if exists "Users can create own tasks" on public.tasks;
drop policy if exists "Users can update own tasks" on public.tasks;

create policy "Users can view own tasks"
  on public.tasks for select
  using (auth.uid() = user_id);

create policy "Users can create own tasks"
  on public.tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on public.tasks for update
  using (auth.uid() = user_id);

-- Update RLS policies for agents
drop policy if exists "Users can view own agents" on public.agents;
drop policy if exists "Users can create own agents" on public.agents;
drop policy if exists "Users can update own agents" on public.agents;

create policy "Users can view own agents"
  on public.agents for select
  using (auth.uid() = user_id);

create policy "Users can create own agents"
  on public.agents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own agents"
  on public.agents for update
  using (auth.uid() = user_id);

-- Update RLS policies for execution_logs
drop policy if exists "Users can view own logs" on public.execution_logs;

create policy "Users can view own logs"
  on public.execution_logs for select
  using (
    exists (
      select 1 from public.tasks
      where tasks.id = execution_logs.task_id
      and tasks.user_id = auth.uid()
    )
  );

-- Add cost tracking table
create table public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete set null,
  model text not null,
  tokens_used integer not null default 0,
  estimated_cost numeric(10, 6) not null default 0,
  created_at timestamptz default now()
);

alter table public.api_usage enable row level security;

create policy "Users can view own usage"
  on public.api_usage for select
  using (auth.uid() = user_id);

-- Add indexes for faster queries
create index idx_api_usage_user_id on public.api_usage(user_id);
create index idx_api_usage_created_at on public.api_usage(created_at);
create index idx_tasks_user_id on public.tasks(user_id);
create index idx_agents_user_id on public.agents(user_id);

-- Enable realtime for tables
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.agents;
alter publication supabase_realtime add table public.execution_logs;
alter publication supabase_realtime add table public.api_usage;
```

After running this SQL:

1. Disable "Confirm email" in Supabase: Authentication > Providers > Email > Confirm email (turn OFF for faster testing)
2. The system is ready to use!

## What's Been Implemented:

✅ **Authentication System**
- Login/signup pages
- User profiles table
- Protected routes

✅ **Real Database Integration**
- Live data from Supabase
- Real-time updates
- User-specific data isolation

✅ **AI-Powered Processing**
- Google Gemini integration
- Code analysis and generation
- Autonomous task processing

✅ **Real-time Monitoring**
- Live agent status
- Task queue updates
- Statistics tracking

✅ **Cost Tracking**
- API usage logging
- Cost estimation
- Per-user tracking

## How to Use:

1. Sign up at `/auth`
2. Submit a coding task
3. Click "Start" to begin autonomous processing
4. Watch agents process tasks in real-time
5. View results and costs in the dashboard
