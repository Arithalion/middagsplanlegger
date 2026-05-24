-- =============================================================
-- 002: Row Level Security — alle tabeller
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- Aktiver RLS
-- ─────────────────────────────────────────────────────────────

alter table households           enable row level security;
alter table household_members    enable row level security;
alter table household_settings   enable row level security;
alter table user_households      enable row level security;
alter table ingredients          enable row level security;
alter table ingredient_prices    enable row level security;
alter table recipes              enable row level security;
alter table recipe_ingredients   enable row level security;
alter table recipe_ratings       enable row level security;
alter table meal_plans           enable row level security;
alter table lunchbox_plans       enable row level security;
alter table pantry_items         enable row level security;
alter table shopping_lists       enable row level security;
alter table shopping_list_items  enable row level security;
alter table budgets              enable row level security;

-- ─────────────────────────────────────────────────────────────
-- households
-- ─────────────────────────────────────────────────────────────

create policy "Bruker ser sin husstand"
  on households for select
  using (id = my_household_id());

create policy "Bruker kan oppdatere sin husstand"
  on households for update
  using (id = my_household_id());

-- ─────────────────────────────────────────────────────────────
-- household_members
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser egne medlemmer"
  on household_members for select
  using (household_id = my_household_id());

create policy "Husstand kan legge til medlemmer"
  on household_members for insert
  with check (household_id = my_household_id());

create policy "Husstand kan oppdatere medlemmer"
  on household_members for update
  using (household_id = my_household_id());

create policy "Husstand kan slette medlemmer"
  on household_members for delete
  using (household_id = my_household_id());

-- ─────────────────────────────────────────────────────────────
-- household_settings
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser egne innstillinger"
  on household_settings for select
  using (household_id = my_household_id());

create policy "Husstand kan opprette innstillinger"
  on household_settings for insert
  with check (household_id = my_household_id());

create policy "Husstand kan oppdatere innstillinger"
  on household_settings for update
  using (household_id = my_household_id());

-- ─────────────────────────────────────────────────────────────
-- user_households
-- ─────────────────────────────────────────────────────────────

create policy "Bruker ser egne koblinger"
  on user_households for select
  using (user_id = auth.uid());

create policy "Bruker kan opprette kobling"
  on user_households for insert
  with check (user_id = auth.uid());

create policy "Bruker kan oppdatere kobling"
  on user_households for update
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- ingredients
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser egne ingredienser"
  on ingredients for select
  using (household_id = my_household_id());

create policy "Husstand kan opprette ingredienser"
  on ingredients for insert
  with check (household_id = my_household_id());

create policy "Husstand kan oppdatere ingredienser"
  on ingredients for update
  using (household_id = my_household_id());

create policy "Husstand kan slette ingredienser"
  on ingredients for delete
  using (household_id = my_household_id());

-- ─────────────────────────────────────────────────────────────
-- ingredient_prices
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser egne priser"
  on ingredient_prices for select
  using (
    ingredient_id in (
      select id from ingredients where household_id = my_household_id()
    )
  );

create policy "Husstand kan sette priser"
  on ingredient_prices for insert
  with check (
    ingredient_id in (
      select id from ingredients where household_id = my_household_id()
    )
  );

create policy "Husstand kan oppdatere priser"
  on ingredient_prices for update
  using (
    ingredient_id in (
      select id from ingredients where household_id = my_household_id()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- recipes
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser egne oppskrifter"
  on recipes for select
  using (household_id = my_household_id());

create policy "Husstand kan opprette oppskrifter"
  on recipes for insert
  with check (household_id = my_household_id());

create policy "Husstand kan oppdatere oppskrifter"
  on recipes for update
  using (household_id = my_household_id());

create policy "Husstand kan slette oppskrifter"
  on recipes for delete
  using (household_id = my_household_id());

-- ─────────────────────────────────────────────────────────────
-- recipe_ingredients
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser oppskriftsingrediensnser"
  on recipe_ingredients for select
  using (
    recipe_id in (
      select id from recipes where household_id = my_household_id()
    )
  );

create policy "Husstand kan opprette oppskriftsingredienser"
  on recipe_ingredients for insert
  with check (
    recipe_id in (
      select id from recipes where household_id = my_household_id()
    )
  );

create policy "Husstand kan oppdatere oppskriftsingredienser"
  on recipe_ingredients for update
  using (
    recipe_id in (
      select id from recipes where household_id = my_household_id()
    )
  );

create policy "Husstand kan slette oppskriftsingredienser"
  on recipe_ingredients for delete
  using (
    recipe_id in (
      select id from recipes where household_id = my_household_id()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- recipe_ratings
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser oppskriftsvurderinger"
  on recipe_ratings for select
  using (
    recipe_id in (
      select id from recipes where household_id = my_household_id()
    )
  );

create policy "Husstand kan gi vurderinger"
  on recipe_ratings for insert
  with check (
    recipe_id in (
      select id from recipes where household_id = my_household_id()
    )
  );

create policy "Husstand kan oppdatere vurderinger"
  on recipe_ratings for update
  using (
    recipe_id in (
      select id from recipes where household_id = my_household_id()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- meal_plans
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser ukesplaner"
  on meal_plans for select
  using (household_id = my_household_id());

create policy "Husstand kan opprette ukesplaner"
  on meal_plans for insert
  with check (household_id = my_household_id());

create policy "Husstand kan oppdatere ukesplaner"
  on meal_plans for update
  using (household_id = my_household_id());

create policy "Husstand kan slette ukesplaner"
  on meal_plans for delete
  using (household_id = my_household_id());

-- ─────────────────────────────────────────────────────────────
-- lunchbox_plans
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser matpakkeplaner"
  on lunchbox_plans for select
  using (household_id = my_household_id());

create policy "Husstand kan opprette matpakkeplaner"
  on lunchbox_plans for insert
  with check (household_id = my_household_id());

create policy "Husstand kan oppdatere matpakkeplaner"
  on lunchbox_plans for update
  using (household_id = my_household_id());

create policy "Husstand kan slette matpakkeplaner"
  on lunchbox_plans for delete
  using (household_id = my_household_id());

-- ─────────────────────────────────────────────────────────────
-- pantry_items
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser beholdning"
  on pantry_items for select
  using (household_id = my_household_id());

create policy "Husstand kan legge til varer"
  on pantry_items for insert
  with check (household_id = my_household_id());

create policy "Husstand kan oppdatere varer"
  on pantry_items for update
  using (household_id = my_household_id());

create policy "Husstand kan slette varer"
  on pantry_items for delete
  using (household_id = my_household_id());

-- ─────────────────────────────────────────────────────────────
-- shopping_lists
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser handlelister"
  on shopping_lists for select
  using (household_id = my_household_id());

create policy "Husstand kan opprette handlelister"
  on shopping_lists for insert
  with check (household_id = my_household_id());

create policy "Husstand kan oppdatere handlelister"
  on shopping_lists for update
  using (household_id = my_household_id());

create policy "Husstand kan slette handlelister"
  on shopping_lists for delete
  using (household_id = my_household_id());

-- ─────────────────────────────────────────────────────────────
-- shopping_list_items
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser handleliste-varer"
  on shopping_list_items for select
  using (
    list_id in (
      select id from shopping_lists where household_id = my_household_id()
    )
  );

create policy "Husstand kan legge til handleliste-varer"
  on shopping_list_items for insert
  with check (
    list_id in (
      select id from shopping_lists where household_id = my_household_id()
    )
  );

create policy "Husstand kan oppdatere handleliste-varer"
  on shopping_list_items for update
  using (
    list_id in (
      select id from shopping_lists where household_id = my_household_id()
    )
  );

create policy "Husstand kan slette handleliste-varer"
  on shopping_list_items for delete
  using (
    list_id in (
      select id from shopping_lists where household_id = my_household_id()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- budgets
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser budsjett"
  on budgets for select
  using (household_id = my_household_id());

create policy "Husstand kan opprette budsjett"
  on budgets for insert
  with check (household_id = my_household_id());

create policy "Husstand kan oppdatere budsjett"
  on budgets for update
  using (household_id = my_household_id());

create policy "Husstand kan slette budsjett"
  on budgets for delete
  using (household_id = my_household_id());
