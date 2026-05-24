-- Migrasjon 008: Kassal-integrasjon
-- Kobler ingredienser til Kassal-produkter per husstand,
-- og legger til pakke/pris-kolonner i handleliste.

-- ── 1. Kobling mellom ingrediens og Kassal-produkt ───────────────────────
CREATE TABLE IF NOT EXISTS household_ingredient_products (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id      uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  ingredient_id     uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  kassal_ean        text NOT NULL,
  kassal_product_id bigint,
  product_name      text NOT NULL,
  package_size      numeric(10,3) NOT NULL,
  package_unit      text NOT NULL,
  price_per_package numeric(10,2),
  last_synced_at    timestamptz,
  UNIQUE (household_id, ingredient_id)
);

-- RLS: kun husstandsmedlemmer kan se/endre sine egne koblinger
ALTER TABLE household_ingredient_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hip_select" ON household_ingredient_products
  FOR SELECT USING (
    household_id = (SELECT my_household_id())
  );

CREATE POLICY "hip_insert" ON household_ingredient_products
  FOR INSERT WITH CHECK (
    household_id = (SELECT my_household_id())
  );

CREATE POLICY "hip_update" ON household_ingredient_products
  FOR UPDATE USING (
    household_id = (SELECT my_household_id())
  );

CREATE POLICY "hip_delete" ON household_ingredient_products
  FOR DELETE USING (
    household_id = (SELECT my_household_id())
  );

-- ── 2. Organisk-preferanse i household_settings ───────────────────────────
ALTER TABLE household_settings
  ADD COLUMN IF NOT EXISTS prefer_organic boolean NOT NULL DEFAULT false;

-- ── 3. Pris- og pakkekolonner i shopping_list_items ──────────────────────
ALTER TABLE shopping_list_items
  ADD COLUMN IF NOT EXISTS actual_price    numeric(10,2),
  ADD COLUMN IF NOT EXISTS packages_needed int,
  ADD COLUMN IF NOT EXISTS is_manual       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_name     text;

-- ingredient_id kan nå være NULL (for manuelle varer)
ALTER TABLE shopping_list_items
  ALTER COLUMN ingredient_id DROP NOT NULL;
