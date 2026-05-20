-- Rename role enum value 'admin' → 'coach'. Postgres rewrites existing rows + RLS refs in place.
alter type user_role rename value 'admin' to 'coach';
