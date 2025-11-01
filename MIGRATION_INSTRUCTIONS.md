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
alter table public.tasks add column if not exists generated_files_count integer default 0;
alter table public.tasks add column if not exists github_commit_sha text;
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

-- Add table for generated code
create table public.generated_code (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  file_path text not null,
  file_content text not null,
  language text not null,
  status text not null check (status in ('draft', 'reviewed', 'committed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.generated_code enable row level security;

create policy "Users can view own generated code"
  on public.generated_code for select
  using (auth.uid() = user_id);

create policy "Users can insert own generated code"
  on public.generated_code for insert
  with check (auth.uid() = user_id);

-- Add table for GitHub repositories
create table public.github_repos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  repo_name text not null,
  repo_url text not null,
  access_token text not null,
  default_branch text not null default 'main',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.github_repos enable row level security;

create policy "Users can view own github repos"
  on public.github_repos for select
  using (auth.uid() = user_id);

create policy "Users can manage own github repos"
  on public.github_repos for all
  using (auth.uid() = user_id);

-- Add indexes for faster queries
create index idx_api_usage_user_id on public.api_usage(user_id);
create index idx_api_usage_created_at on public.api_usage(created_at);
create index idx_tasks_user_id on public.tasks(user_id);
create index idx_agents_user_id on public.agents(user_id);
create index idx_generated_code_task_id on public.generated_code(task_id);
create index idx_generated_code_user_id on public.generated_code(user_id);
create index idx_github_repos_user_id on public.github_repos(user_id);

-- Enable realtime for tables
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.agents;
alter publication supabase_realtime add table public.execution_logs;
alter publication supabase_realtime add table public.api_usage;
alter publication supabase_realtime add table public.generated_code;
alter publication supabase_realtime add table public.github_repos;
```

After running this SQL:

1. Disable "Confirm email" in Supabase: Authentication > Providers > Email > Confirm email (turn OFF for faster testing)
2. The system is ready to use!

## What's Been Implemented:

✅ **Full Autonomous Coding System**
- AI generates complete, production-ready code files
- Not just suggestions - actual working code
- Multi-file generation (components, hooks, utils, types)

✅ **GitHub Auto-Sync**
- Connect your GitHub repository
- One-click commit of generated code
- Automatic push to your repo
- View commits directly in GitHub

✅ **In-App Code Preview**
- Live preview of all generated files
- Syntax highlighting by language
- Copy/download individual files
- File-by-file review before committing

✅ **Advanced AI Processing**
- Google Gemini 1.5 Flash for fast generation
- Structured output with proper formatting
- Error handling and validation
- Cost tracking per generation

✅ **Real-time Everything**
- Live code generation updates
- Task status changes in real-time
- Agent coordination
- Cost and usage tracking

## How to Use:

### 1. Setup (One-time)
- Sign up at `/auth`
- Create a GitHub Personal Access Token:
  - Go to https://github.com/settings/tokens/new
  - Select "classic token"
  - Grant **repo** permissions (full control)
  - Copy the token (starts with `ghp_`)
- In the dashboard, enter your repo name (e.g., `username/my-project`)
- Paste your access token
- Click "Connect Repository"

### 2. Generate Code
- Enter a coding task (e.g., "Create a user profile page with avatar upload")
- Click "Start" system
- Click "Send" to submit task
- Watch AI generate complete code files in real-time

### 3. Review & Commit
- Click on tasks in the queue to preview generated code
- Review each file (TypeScript, React, CSS, etc.)
- Click "Commit to GitHub" to push all files
- View your changes directly in GitHub

## Example Tasks to Try:

1. "Create a dashboard with charts using recharts"
2. "Build a todo list with local storage persistence"
3. "Create a contact form with email validation"
4. "Build a product card component with hover effects"
5. "Create a settings page with theme toggle"

The system will generate:
- Complete React components
- TypeScript types
- Styling (Tailwind CSS)
- Hooks and utilities
- All necessary imports

## Advanced Features:

**Multi-Agent Processing:**
- Code analyzer agent
- Code generator agent
- Code reviewer agent (coming soon)
- Test generator agent (coming soon)

**Self-Healing:**
- Error detection in generated code
- Automatic fix attempts
- Iterative improvement

**Cost Optimization:**
- Token usage tracking
- Cost estimation per task
- Usage analytics
