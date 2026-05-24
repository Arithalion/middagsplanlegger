-- =============================================================
-- 003: Auto-setup husstand ved registrering
-- =============================================================

-- Funksjon som kjøres etter ny bruker i auth.users
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_household_id uuid;
  v_member_id    uuid;
  v_mode         text;
  v_household_name text;
  v_full_name    text;
begin
  v_mode           := new.raw_user_meta_data ->> 'mode';
  v_household_name := new.raw_user_meta_data ->> 'household_name';
  v_full_name      := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));

  if v_mode = 'ny' or v_mode is null then
    -- Opprett ny husstand
    insert into households (name)
    values (coalesce(v_household_name, v_full_name || 's husstand'))
    returning id into v_household_id;

    -- Opprett standardinnstillinger
    insert into household_settings (household_id)
    values (v_household_id);

    -- Opprett husstandsmedlem for brukeren
    insert into household_members (household_id, name, role)
    values (v_household_id, v_full_name, 'voksen')
    returning id into v_member_id;

    -- Koble bruker til husstand som admin
    insert into user_households (user_id, household_id, member_id, is_admin)
    values (new.id, v_household_id, v_member_id, true);
  end if;

  return new;
end;
$$;

-- Trigger på auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
