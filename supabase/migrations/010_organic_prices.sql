-- ── 010: Organisk prissupport — dual-kobling per ingrediens ─────────────────
-- Tillater at hver ingrediens kan ha én normal og én organisk Kassal-kobling,
-- med tilsvarende separate priser i ingredient_prices.
-- Eksisterende rader får is_organic = false (DEFAULT) — bakoverkompatibelt.

-- ── household_ingredient_products ────────────────────────────────────────────
ALTER TABLE household_ingredient_products
  ADD COLUMN IF NOT EXISTS is_organic boolean NOT NULL DEFAULT false;

-- Fjern gammel UNIQUE-constraint (household_id, ingredient_id)
ALTER TABLE household_ingredient_products
  DROP CONSTRAINT IF EXISTS household_ingredient_products_household_id_ingredient_id_key;

-- Legg til ny constraint som tillater én normal + én organisk per ingrediens
ALTER TABLE household_ingredient_products
  ADD CONSTRAINT hip_household_ingredient_organic
  UNIQUE (household_id, ingredient_id, is_organic);

-- ── ingredient_prices ─────────────────────────────────────────────────────────
ALTER TABLE ingredient_prices
  ADD COLUMN IF NOT EXISTS is_organic boolean NOT NULL DEFAULT false;

-- Fjern gammel UNIQUE-constraint (ingredient_id alene)
ALTER TABLE ingredient_prices
  DROP CONSTRAINT IF EXISTS ingredient_prices_ingredient_id_key;

-- Legg til ny constraint som tillater én normal + én organisk per ingrediens
ALTER TABLE ingredient_prices
  ADD CONSTRAINT ip_ingredient_organic
  UNIQUE (ingredient_id, is_organic);
