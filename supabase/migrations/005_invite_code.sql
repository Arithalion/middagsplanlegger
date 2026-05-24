-- 005: Invitasjonskode på husstanden

-- Legg til invite_code-kolonne
ALTER TABLE households ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;

-- Generer kode for alle eksisterende husstander
UPDATE households
SET invite_code = upper(substring(md5(random()::text), 1, 8))
WHERE invite_code IS NULL;

-- Sett NOT NULL etter backfill
ALTER TABLE households ALTER COLUMN invite_code SET NOT NULL;

-- Oppdater auto-setup-trigger til å generere kode ved opprettelse
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_household_id uuid;
  v_member_id    uuid;
  v_mode         text;
  v_household_name text;
  v_full_name    text;
  v_invite_code  text;
  v_target_household uuid;
BEGIN
  v_mode           := new.raw_user_meta_data ->> 'mode';
  v_household_name := new.raw_user_meta_data ->> 'household_name';
  v_full_name      := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));

  IF v_mode = 'bli-med' THEN
    -- Finn husstand via invitasjonskode
    v_invite_code := upper(trim(new.raw_user_meta_data ->> 'invite_code'));
    SELECT id INTO v_target_household
    FROM households
    WHERE upper(invite_code) = v_invite_code
    LIMIT 1;

    IF v_target_household IS NULL THEN
      -- Ugyldig kode — opprett egen husstand som fallback
      v_mode := 'ny';
    ELSE
      -- Opprett husstandsmedlem og koble bruker
      INSERT INTO household_members (household_id, name, role)
      VALUES (v_target_household, v_full_name, 'voksen')
      RETURNING id INTO v_member_id;

      INSERT INTO user_households (user_id, household_id, member_id, is_admin)
      VALUES (new.id, v_target_household, v_member_id, false);

      RETURN new;
    END IF;
  END IF;

  IF v_mode = 'ny' OR v_mode IS NULL THEN
    -- Generer unik invitasjonskode
    LOOP
      v_invite_code := upper(substring(md5(random()::text || clock_timestamp()::text), 1, 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM households WHERE invite_code = v_invite_code);
    END LOOP;

    INSERT INTO households (name, invite_code)
    VALUES (coalesce(v_household_name, v_full_name || 's husstand'), v_invite_code)
    RETURNING id INTO v_household_id;

    INSERT INTO household_settings (household_id)
    VALUES (v_household_id);

    INSERT INTO household_members (household_id, name, role)
    VALUES (v_household_id, v_full_name, 'voksen')
    RETURNING id INTO v_member_id;

    INSERT INTO user_households (user_id, household_id, member_id, is_admin)
    VALUES (new.id, v_household_id, v_member_id, true);
  END IF;

  RETURN new;
END;
$$;
