-- ── 009: Legg til shopping_after_dinner i household_settings ────────────────
-- Brukes til å avgjøre om neste handledag er i dag (false) eller
-- neste forekomst (true, dvs. man handler etter middagen og trenger
-- ingrediensene fra neste dag).

ALTER TABLE household_settings
  ADD COLUMN IF NOT EXISTS shopping_after_dinner boolean NOT NULL DEFAULT false;
