-- Add version column for optimistic locking on slots
alter table slots add column version integer not null default 1;

-- Add a view that includes current_bookings count for convenience
create or replace view slots_with_bookings as
select
  s.*,
  coalesce(b.cnt, 0)::smallint as current_bookings
from slots s
left join (
  select slot_id, count(*)::smallint as cnt
  from bookings
  where status = 'confirmed'
  group by slot_id
) b on b.slot_id = s.id;

-- Function to atomically book a slot (check capacity + insert booking)
create or replace function book_slot(
  p_slot_id uuid,
  p_trainee_id uuid,
  p_google_event_id text default null,
  p_is_auto_booked boolean default false,
  p_expected_version integer default null
)
returns uuid
language plpgsql
as $$
declare
  v_capacity smallint;
  v_current smallint;
  v_version integer;
  v_booking_id uuid;
begin
  -- Lock the slot row
  select capacity, version into v_capacity, v_version
  from slots where id = p_slot_id for update;

  if not found then
    raise exception 'Slot not found';
  end if;

  -- Optimistic lock check
  if p_expected_version is not null and v_version != p_expected_version then
    raise exception 'Slot was modified by another request';
  end if;

  -- Count current confirmed bookings
  select count(*) into v_current
  from bookings
  where slot_id = p_slot_id and status = 'confirmed';

  if v_current >= v_capacity then
    raise exception 'Slot is full';
  end if;

  -- Insert booking
  insert into bookings (slot_id, trainee_id, google_event_id, is_auto_booked, status)
  values (p_slot_id, p_trainee_id, p_google_event_id, p_is_auto_booked, 'confirmed')
  returning id into v_booking_id;

  -- Bump version
  update slots set version = version + 1 where id = p_slot_id;

  return v_booking_id;
end;
$$;
