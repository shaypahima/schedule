-- Profiles table (extends Supabase auth.users)
create type user_role as enum ('admin', 'trainee');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique not null,
  name text not null,
  role user_role not null default 'trainee',
  is_recurring boolean not null default false,
  preferred_day smallint check (preferred_day between 0 and 5), -- 0=Sun..5=Fri
  preferred_time time,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Slots table
create table slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time not null,
  capacity smallint not null default 2 check (capacity between 2 and 3),
  lockout_override boolean not null default false,
  created_at timestamptz not null default now(),
  unique (date, start_time)
);

-- Bookings table
create type booking_status as enum ('confirmed', 'cancelled');

create table bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references slots(id) on delete cascade,
  trainee_id uuid not null references profiles(id) on delete cascade,
  google_event_id text,
  is_auto_booked boolean not null default false,
  status booking_status not null default 'confirmed',
  created_at timestamptz not null default now()
);

-- Prevent same trainee from having multiple confirmed bookings in same slot
create unique index bookings_unique_confirmed
  on bookings (slot_id, trainee_id)
  where status = 'confirmed';

-- Edit log (tracks cancel/reschedule per trainee per week)
create table edit_log (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references profiles(id) on delete cascade,
  week_start date not null, -- Sunday of the week
  edit_count smallint not null default 0,
  unique (trainee_id, week_start)
);

-- Coach settings (single row)
create table coach_settings (
  id uuid primary key default gen_random_uuid(),
  google_access_token text,
  google_refresh_token text,
  google_token_expiry timestamptz,
  notification_email text,
  notification_push_endpoint text
);

-- Row Level Security
alter table profiles enable row level security;
alter table slots enable row level security;
alter table bookings enable row level security;
alter table edit_log enable row level security;
alter table coach_settings enable row level security;

-- Profiles: users can read own profile, admin can read all
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Admin can read all profiles"
  on profiles for select
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admin can manage profiles"
  on profiles for all
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Slots: anyone authenticated can read
create policy "Authenticated users can read slots"
  on slots for select
  using (auth.role() = 'authenticated');

create policy "Admin can manage slots"
  on slots for all
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Bookings: trainees can read own, admin can read all
create policy "Users can read own bookings"
  on bookings for select
  using (trainee_id = auth.uid());

create policy "Users can create own bookings"
  on bookings for insert
  with check (trainee_id = auth.uid());

create policy "Users can update own bookings"
  on bookings for update
  using (trainee_id = auth.uid());

create policy "Admin can manage all bookings"
  on bookings for all
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Edit log: trainees can read own, admin can read all
create policy "Users can read own edit log"
  on edit_log for select
  using (trainee_id = auth.uid());

create policy "Admin can manage edit log"
  on edit_log for all
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Coach settings: admin only
create policy "Admin can manage coach settings"
  on coach_settings for all
  using (
    exists (
      select 1 from profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Index for fast booking lookups
create index bookings_slot_status on bookings (slot_id) where status = 'confirmed';
create index bookings_trainee_status on bookings (trainee_id) where status = 'confirmed';
create index edit_log_trainee_week on edit_log (trainee_id, week_start);
