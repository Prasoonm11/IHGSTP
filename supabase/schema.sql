-- AtomQuest Hackathon schema
create extension if not exists pgcrypto;

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists thrust_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text not null,
  last_name text not null,
  role text not null check (role in ('employee', 'manager', 'admin')),
  department_id uuid references departments(id),
  manager_id uuid references profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  thrust_area_id uuid not null references thrust_areas(id),
  title text not null,
  description text,
  uom_type text not null check (uom_type in (
    'numeric_min',
    'numeric_max',
    'percent_min',
    'percent_max',
    'timeline',
    'zero'
  )),
  target_value numeric,
  target_date date,
  weightage numeric(5,2) not null check (weightage >= 10 and weightage <= 100),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rework')),
  cycle_year int not null,
  locked boolean not null default false,
  is_shared boolean not null default false,
  primary_goal_id uuid references goals(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists goal_updates (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  quarter text not null check (quarter in ('Q1', 'Q2', 'Q3', 'Q4')),
  planned_value numeric,
  actual_value numeric,
  status text not null check (status in ('not_started', 'on_track', 'completed')),
  completion_percent numeric(5,2) not null default 0,
  comment text,
  updated_by uuid not null references profiles(id),
  updated_at timestamptz not null default now(),
  unique(goal_id, quarter)
);

create table if not exists checkin_comments (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  quarter text not null check (quarter in ('Q1', 'Q2', 'Q3', 'Q4')),
  manager_id uuid not null references profiles(id),
  employee_id uuid not null references profiles(id),
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles
for each row execute function set_updated_at();

drop trigger if exists trg_goals_updated_at on goals;
create trigger trg_goals_updated_at before update on goals
for each row execute function set_updated_at();

create or replace function log_goal_changes()
returns trigger as $$
begin
  if old.locked = true then
    insert into audit_logs(actor_id, entity_type, entity_id, action, old_values, new_values)
    values (auth.uid(), 'goal', old.id, 'UPDATED_AFTER_LOCK', to_jsonb(old), to_jsonb(new));
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_audit_locked_goal on goals;
create trigger trg_audit_locked_goal
after update on goals
for each row execute function log_goal_changes();

alter table departments enable row level security;
alter table thrust_areas enable row level security;
alter table profiles enable row level security;
alter table goals enable row level security;
alter table goal_updates enable row level security;
alter table checkin_comments enable row level security;
alter table audit_logs enable row level security;

-- =========================
-- RLS Policies (conditional)
-- =========================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='departments' AND policyname='departments_read_all'
  ) THEN
    CREATE POLICY departments_read_all
    ON public.departments
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- =========================
-- Column descriptions for user-entered fields
-- =========================

comment on column departments.name is 'Department name displayed in forms and dropdowns (e.g. Engineering, Sales).';
comment on column thrust_areas.name is 'Strategic thrust/priority name used when categorising goals (e.g. Revenue Growth).';

comment on column profiles.email is 'User email address; should match the auth.users email and is used for login and notifications.';
comment on column profiles.first_name is 'User given name as entered during registration or profile edit.';
comment on column profiles.last_name is 'User family name as entered during registration or profile edit.';
comment on column profiles.role is 'Assigned role for the user: employee, manager, or admin. Controls application permissions.';
comment on column profiles.department_id is 'Reference to the user''s department (optional for admins). Shown in registration and profile screens.';
comment on column profiles.manager_id is 'Reference to the user''s direct manager (another profiles.id). Used for approval routing and team views.';
comment on column profiles.is_active is 'Flag indicating whether the user account is active; admins can deactivate to prevent access.';

comment on column goals.title is 'One-line descriptive title of the goal entered by the employee.';
comment on column goals.description is 'Long-form description and context for the goal; include success criteria and notes.';
comment on column goals.uom_type is 'Unit-of-measure for the goal; choose from supported types (percent_min, percent_max, numeric_min, numeric_max, timeline, zero).';
comment on column goals.target_value is 'Numeric target value for the goal. Leave null for timeline or zero-type goals.';
comment on column goals.target_date is 'Target completion date for timeline goals; optional for numeric goals.';
comment on column goals.weightage is 'Percentage weight assigned to this goal (10-100). Used to compute weighted scores. Values are whole or fractional percentages.';
comment on column goals.status is 'Workflow state of the goal (draft, submitted, approved, rework). Managed by the UI during submission and approvals.';
comment on column goals.cycle_year is 'The calendar year (e.g. 2026) that this goal belongs to; used to group goal sheets and cycles.';
comment on column goals.locked is 'If true the goal is locked from regular edits — changes after locking are recorded in audit logs.';
comment on column goals.is_shared is 'If true the goal is a shared/department-level KPI; affects whether it can be edited by individual employees.';

comment on column goal_updates.quarter is 'Quarter for the update (Q1, Q2, Q3, Q4) to indicate which check-in this update belongs to.';
comment on column goal_updates.planned_value is 'Planned/expected value for the quarter as entered by the employee or manager.';
comment on column goal_updates.actual_value is 'Actual achieved value for the quarter; used to calculate completion percent.';
comment on column goal_updates.completion_percent is 'Computed or entered percent complete (0-100) for the quarter; used in reporting.';
comment on column goal_updates.comment is 'Optional free-text comment describing progress, blockers, or context for the update.';
comment on column goal_updates.updated_by is 'Profile id of the person who submitted this update (employee or manager).';

comment on column checkin_comments.comment is 'Manager feedback or coaching notes entered when reviewing an employee''s check-in.';

comment on column goal_sheets.cycle_year is 'The year for the employee''s goal sheet; same semantics as goals.cycle_year.';
comment on column goal_sheets.status is 'Status of the goal sheet (draft, submitted, approved, rework). Controlled via the submission/approval workflow.';

comment on column shared_goals.title is 'Title for the shared (department-level) KPI presented to teams.';
comment on column shared_goals.description is 'Optional longer description or guidance for the shared KPI.';
comment on column shared_goals.uom_type is 'Unit-of-measure for the shared KPI; same choices as individual goals.';
comment on column shared_goals.target_value is 'Numeric target for the shared KPI (if applicable).';
comment on column shared_goals.weightage is 'Suggested weight (%) for the shared KPI when pushed to individuals.';
comment on column shared_goals.created_by is 'Profile id of the admin or user who created this shared KPI.';

comment on column notifications.type is 'Notification classification (e.g. reminder, approval_request, escalation). UI uses this to render templates.';
comment on column notifications.payload is 'JSON payload containing notification details: message, related_entity, links, and other metadata.';
comment on column notifications.is_read is 'Flag set when the user has read the in-app notification.';

comment on column notification_channels.name is 'Human-friendly name for the notification channel (e.g. Default Email, Teams Webhook).';
comment on column notification_channels.provider is 'Channel provider type: email, teams, in_app, or webhook.';
comment on column notification_channels.config is 'Provider-specific configuration stored as JSON (SMTP settings, webhook URL, templates, etc.).';

comment on column scheduled_jobs.job_type is 'Type of scheduled job (e.g. checkin_reminder, escalation_runner, nightly_sync).';
comment on column scheduled_jobs.payload is 'JSON payload for the job instructing the worker what to run/which entities to act on.';
comment on column scheduled_jobs.run_at is 'Planned execution time for the scheduled job (UTC).' ;

comment on column escalation_rules.name is 'Readable name for the escalation rule used in admin UI.';
comment on column escalation_rules.trigger_type is 'Type of trigger that fires the escalation (missed_checkin, overdue_approval, threshold_breach).';
comment on column escalation_rules.condition is 'JSON-encoded condition (thresholds, window definitions, target selectors) evaluated by the escalation engine.';
comment on column escalation_rules.actions is 'JSON array of actions to perform when the rule triggers (send notification, create job, escalate to manager).' ;

comment on column notification_logs.status is 'Delivery status for the notification log entry (queued, sent, failed).';
comment on column notification_logs.response is 'Provider response payload (success/failure details) kept for observability and debugging.';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='thrust_areas' AND policyname='thrust_areas_read_all'
  ) THEN
    CREATE POLICY thrust_areas_read_all
    ON public.thrust_areas
    FOR SELECT TO authenticated
    USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_read_authenticated'
  ) THEN
    CREATE POLICY profiles_read_authenticated
    ON public.profiles
    FOR SELECT TO authenticated
    USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_insert_own'
  ) THEN
    CREATE POLICY profiles_insert_own
    ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own
    ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goals' AND policyname='goals_read_all'
  ) THEN
    CREATE POLICY goals_read_all
    ON public.goals
    FOR SELECT TO authenticated
    USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goals' AND policyname='goals_employee_insert'
  ) THEN
    CREATE POLICY goals_employee_insert
    ON public.goals
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = employee_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goals' AND policyname='goals_employee_update'
  ) THEN
    CREATE POLICY goals_employee_update
    ON public.goals
    FOR UPDATE TO authenticated
    USING (
      auth.uid() = employee_id OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role in ('manager', 'admin')
      )
    )
    WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goal_updates' AND policyname='goal_updates_read_all'
  ) THEN
    CREATE POLICY goal_updates_read_all
    ON public.goal_updates
    FOR SELECT TO authenticated
    USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goal_updates' AND policyname='goal_updates_write'
  ) THEN
    CREATE POLICY goal_updates_write
    ON public.goal_updates
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = updated_by);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goal_updates' AND policyname='goal_updates_update'
  ) THEN
    CREATE POLICY goal_updates_update
    ON public.goal_updates
    FOR UPDATE TO authenticated
    USING (
      auth.uid() = updated_by OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role in ('manager', 'admin')
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='checkin_comments' AND policyname='checkin_comments_read_all'
  ) THEN
    CREATE POLICY checkin_comments_read_all
    ON public.checkin_comments
    FOR SELECT TO authenticated
    USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='checkin_comments' AND policyname='checkin_comments_insert_manager'
  ) THEN
    CREATE POLICY checkin_comments_insert_manager
    ON public.checkin_comments
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role in ('manager', 'admin')
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='audit_logs' AND policyname='audit_read_admin'
  ) THEN
    CREATE POLICY audit_read_admin
    ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );
  END IF;
END $$;

-- =========================
-- Seed data
-- =========================
insert into departments(name)
values ('Engineering'), ('Sales'), ('Operations'), ('HR')
on conflict do nothing;

insert into thrust_areas(name)
values ('Revenue Growth'), ('Customer Delight'), ('Operational Efficiency'), ('Quality & Compliance')
on conflict do nothing;

create or replace view report_goal_progress as
select
  p.email as employee_email,
  concat(p.first_name, ' ', p.last_name) as employee_name,
  p.role,
  d.name as department,
  ta.name as thrust_area,
  g.title,
  g.uom_type,
  g.target_value,
  g.target_date,
  g.weightage,
  g.status as goal_status,
  gu.quarter,
  gu.actual_value,
  gu.completion_percent,
  gu.status as progress_status,
  gu.updated_at
from goals g
join profiles p on p.id = g.employee_id
left join departments d on d.id = p.department_id
join thrust_areas ta on ta.id = g.thrust_area_id
left join goal_updates gu on gu.goal_id = g.id;

-- =========================
-- Additional tables for full feature set
-- =========================

create table if not exists goal_sheets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references profiles(id) on delete cascade,
  cycle_year int not null,
  status text not null default 'draft' check (status in ('draft','submitted','approved','rework')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, cycle_year)
);

create table if not exists shared_goals (
  id uuid primary key default gen_random_uuid(),
  origin_goal_id uuid references goals(id) on delete set null,
  department_id uuid references departments(id),
  title text not null,
  description text,
  uom_type text not null,
  target_value numeric,
  weightage numeric(5,2),
  read_only_fields text[] default array['title','target_value']::text[],
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  type text not null,
  payload jsonb,
  is_read boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- enable RLS on new tables
alter table goal_sheets enable row level security;
alter table shared_goals enable row level security;
alter table notifications enable row level security;

-- RLS policies for goal_sheets: owners can read/insert; managers/admins can read
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goal_sheets' AND policyname='goal_sheets_read_owner'
  ) THEN
    CREATE POLICY goal_sheets_read_owner
    ON public.goal_sheets
    FOR SELECT
    USING (auth.uid() = employee_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role in ('manager','admin')));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='goal_sheets' AND policyname='goal_sheets_insert_own'
  ) THEN
    CREATE POLICY goal_sheets_insert_own
    ON public.goal_sheets
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = employee_id);
  END IF;
END $$;

-- RLS policies for shared_goals: authenticated may select (departments/kpis), inserts/updates by admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='shared_goals' AND policyname='shared_goals_read_all'
  ) THEN
    CREATE POLICY shared_goals_read_all
    ON public.shared_goals
    FOR SELECT
    USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='shared_goals' AND policyname='shared_goals_admin_write'
  ) THEN
    CREATE POLICY shared_goals_admin_write
    ON public.shared_goals
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
  END IF;
END $$;

-- RLS for notifications: owner can select; system or admin can insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_read_owner'
  ) THEN
    CREATE POLICY notifications_read_owner
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_insert'
  ) THEN
    CREATE POLICY notifications_insert
    ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);
  END IF;
END $$;
