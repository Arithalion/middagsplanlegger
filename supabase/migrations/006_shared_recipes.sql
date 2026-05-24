-- =============================================================
-- 006: Delt oppskriftsdatabase
--   - is_public på recipes
--   - household_recipes (bookmark-tabell)
--   - recipe_reports (rapportering)
--   - is_global_admin på user_households
--   - Backfill + oppdatert RLS
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Nye kolonner
-- ─────────────────────────────────────────────────────────────

alter table recipes
  add column if not exists is_public boolean not null default false;

alter table user_households
  add column if not exists is_global_admin boolean not null default false;

-- ─────────────────────────────────────────────────────────────
-- 2. Nye tabeller
-- ─────────────────────────────────────────────────────────────

create table if not exists household_recipes (
  household_id  uuid not null references households(id) on delete cascade,
  recipe_id     uuid not null references recipes(id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (household_id, recipe_id)
);

create index if not exists household_recipes_household_id_idx on household_recipes (household_id);
create index if not exists household_recipes_recipe_id_idx    on household_recipes (recipe_id);

create table if not exists recipe_reports (
  id                    uuid primary key default uuid_generate_v4(),
  recipe_id             uuid not null references recipes(id) on delete cascade,
  reported_by_household uuid references households(id) on delete set null,
  reason                text,
  reported_at           timestamptz not null default now()
);

create index if not exists recipe_reports_recipe_id_idx on recipe_reports (recipe_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Backfill: alle eksisterende oppskrifter → husstandens samling
-- ─────────────────────────────────────────────────────────────

insert into household_recipes (household_id, recipe_id)
select household_id, id
from   recipes
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────
-- 4. RLS — aktiver på nye tabeller
-- ─────────────────────────────────────────────────────────────

alter table household_recipes enable row level security;
alter table recipe_reports     enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 5. Oppdater RLS for recipes (tillat offentlige)
-- ─────────────────────────────────────────────────────────────

drop policy if exists "Husstand ser egne oppskrifter" on recipes;

create policy "Husstand ser egne eller offentlige oppskrifter"
  on recipes for select
  using (
    household_id = my_household_id()
    or (is_public = true and my_household_id() is not null)
  );

-- ─────────────────────────────────────────────────────────────
-- 6. RLS — household_recipes
-- ─────────────────────────────────────────────────────────────

create policy "Husstand ser egne bookmarks"
  on household_recipes for select
  using (household_id = my_household_id());

create policy "Husstand kan legge til bookmarks"
  on household_recipes for insert
  with check (household_id = my_household_id());

create policy "Husstand kan slette bookmarks"
  on household_recipes for delete
  using (household_id = my_household_id());

-- ─────────────────────────────────────────────────────────────
-- 7. RLS — recipe_reports
-- ─────────────────────────────────────────────────────────────

create policy "Global admin ser alle rapporter"
  on recipe_reports for select
  using (
    exists (
      select 1 from user_households
      where user_id = auth.uid()
        and is_global_admin = true
    )
  );

create policy "Innloggede kan rapportere oppskrifter"
  on recipe_reports for insert
  with check (
    my_household_id() is not null
    and reported_by_household = my_household_id()
  );

-- ─────────────────────────────────────────────────────────────
-- 8. RLS — recipe_ingredients: tillat offentlige oppskrifter
-- ─────────────────────────────────────────────────────────────

drop policy if exists "Husstand ser oppskriftsingrediensnser" on recipe_ingredients;

create policy "Husstand ser oppskriftsingredienser"
  on recipe_ingredients for select
  using (
    recipe_id in (
      select id from recipes
      where household_id = my_household_id()
         or (is_public = true and my_household_id() is not null)
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 9. RLS — recipe_ratings: tillat offentlige oppskrifters ratings
-- ─────────────────────────────────────────────────────────────

drop policy if exists "Husstand ser oppskriftsvurderinger" on recipe_ratings;

create policy "Husstand ser oppskriftsvurderinger"
  on recipe_ratings for select
  using (
    recipe_id in (
      select id from recipes
      where household_id = my_household_id()
         or (is_public = true and my_household_id() is not null)
    )
  );
