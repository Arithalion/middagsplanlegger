-- Del av migrasjon 005 — legg til i SQL Editor etter den andre kjøringen

-- Offentlig funksjon for å validere invitasjonskode (kan kalles uten innlogging)
CREATE OR REPLACE FUNCTION validate_invite_code(code text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM households WHERE upper(invite_code) = upper(trim(code))
  );
$$;

GRANT EXECUTE ON FUNCTION validate_invite_code(text) TO anon, authenticated;
