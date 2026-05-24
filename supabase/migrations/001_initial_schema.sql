-- =============================================================
-- 001: Husholdningsapp — Komplett databaseskjema
-- =============================================================

-- Aktiver UUID-extensjon
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- ENUM-typer
-- ─────────────────────────────────────────────────────────────

create type unit_type as enum ('g','kg','ml','dl','l','stk','boks','pose','flaske','pk');
create type recipe_category as enum ('hverdagsmat','fisk','vegetar','kylling','helgemat','søndagsmiddag','selskapsmat');
create type weekday_type as enum ('mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag');
create type shopping_list_type as enum ('hoved','ekstra');
create type member_role as enum ('voksen','barn');
create type list_status as enum ('aktiv','kjøpt','arkivert');
create type price_source as enum ('manual','oda');

-- ─────────────────────────────────────────────────────────────
-- HOUSEHOLDS
-- ─────────────────────────────────────────────────────────────

create table households (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table household_members (
  id            uuid primary key default uuid_generate_v4(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  role          member_role not null default 'voksen',
  birth_year    int,
  gender        text check (gender in ('gutt','jente','mann','kvinne')),
  created_at    timestamptz not null default now()
);

create table household_settings (
  id                   uuid primary key default uuid_generate_v4(),
  household_id         uuid not null unique references households(id) on delete cascade,
  weekly_budget        numeric(10,2),
  fish_days_per_week   int not null default 2 check (fish_days_per_week between 0 and 7),
  always_vegetables    boolean not null default true,
  shopping_days        weekday_type[] not null default array['lørdag']::weekday_type[],
  special_days         weekday_type[] not null default array['fredag','lørdag']::weekday_type[],
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- USER–HOUSEHOLD LINK (auth.users ↔ households)
-- ─────────────────────────────────────────────────────────────

create table user_households (
  user_id       uuid not null references auth.users(id) on delete cascade,
  household_id  uuid not null references households(id) on delete cascade,
  member_id     uuid references household_members(id) on delete set null,
  is_admin      boolean not null default false,
  joined_at     timestamptz not null default now(),
  primary key (user_id, household_id)
);

-- ─────────────────────────────────────────────────────────────
-- INGREDIENTS
-- ─────────────────────────────────────────────────────────────

create table ingredients (
  id            uuid primary key default uuid_generate_v4(),
  household_id  uuid not null references households(id) on delete cascade,
  name          text not null,
  category      text,
  default_unit  unit_type not null default 'stk',
  created_at    timestamptz not null default now(),
  unique (household_id, name)
);

create table ingredient_prices (
  id              uuid primary key default uuid_generate_v4(),
  ingredient_id   uuid not null unique references ingredients(id) on delete cascade,
  price_per_unit  numeric(10,2) not null,
  unit            unit_type not null,
  source          price_source default 'manual',
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- RECIPES
-- ─────────────────────────────────────────────────────────────

create table recipes (
  id                  uuid primary key default uuid_generate_v4(),
  household_id        uuid not null references households(id) on delete cascade,
  name                text not null,
  description         text,
  source_url          text,
  servings            int not null default 4,
  prep_time_minutes   int,
  category            recipe_category not null default 'hverdagsmat',
  image_url           text,
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table recipe_ingredients (
  id             uuid primary key default uuid_generate_v4(),
  recipe_id      uuid not null references recipes(id) on delete cascade,
  ingredient_id  uuid not null references ingredients(id) on delete restrict,
  amount         numeric(10,3) not null,
  unit           unit_type not null,
  note           text,
  sort_order     int not null default 0
);

create table recipe_ratings (
  id         uuid primary key default uuid_generate_v4(),
  recipe_id  uuid not null references recipes(id) on delete cascade,
  member_id  uuid not null references household_members(id) on delete cascade,
  score      int not null check (score between 1 and 5),
  rated_at   timestamptz not null default now(),
  unique (recipe_id, member_id)
);

-- ─────────────────────────────────────────────────────────────
-- MEAL PLANS
-- ─────────────────────────────────────────────────────────────

create table meal_plans (
  id              uuid primary key default uuid_generate_v4(),
  household_id    uuid not null references households(id) on delete cascade,
  week_number     int not null check (week_number between 1 and 53),
  year            int not null,
  weekday         weekday_type not null,
  recipe_id       uuid references recipes(id) on delete set null,
  is_special_day  boolean not null default false,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (household_id, year, week_number, weekday)
);

-- ─────────────────────────────────────────────────────────────
-- LUNCHBOX PLANS
-- ─────────────────────────────────────────────────────────────

create table lunchbox_plans (
  id              uuid primary key default uuid_generate_v4(),
  household_id    uuid not null references households(id) on delete cascade,
  member_id       uuid not null references household_members(id) on delete cascade,
  week_number     int not null,
  year            int not null,
  weekday         weekday_type not null,
  num_lunchboxes  int not null default 1 check (num_lunchboxes >= 0),
  num_fruit       int not null default 1 check (num_fruit >= 0),
  unique (member_id, year, week_number, weekday)
);

-- ─────────────────────────────────────────────────────────────
-- PANTRY
-- ─────────────────────────────────────────────────────────────

create table pantry_items (
  id             uuid primary key default uuid_generate_v4(),
  household_id   uuid not null references households(id) on delete cascade,
  ingredient_id  uuid not null references ingredients(id) on delete cascade,
  amount         numeric(10,3) not null default 0,
  unit           unit_type not null,
  expiry_date    date,
  updated_at     timestamptz not null default now(),
  unique (household_id, ingredient_id)
);

-- ─────────────────────────────────────────────────────────────
-- SHOPPING LISTS
-- ─────────────────────────────────────────────────────────────

create table shopping_lists (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid not null references households(id) on delete cascade,
  list_date    date not null,
  list_type    shopping_list_type not null default 'hoved',
  week_number  int,
  year         int,
  status       list_status not null default 'aktiv',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table shopping_list_items (
  id               uuid primary key default uuid_generate_v4(),
  list_id          uuid not null references shopping_lists(id) on delete cascade,
  ingredient_id    uuid not null references ingredients(id) on delete restrict,
  amount           numeric(10,3) not null,
  unit             unit_type not null,
  estimated_price  numeric(10,2),
  is_bought        boolean not null default false,
  sort_order       int not null default 0
);

-- ─────────────────────────────────────────────────────────────
-- BUDGETS
-- ─────────────────────────────────────────────────────────────

create table budgets (
  id              uuid primary key default uuid_generate_v4(),
  household_id    uuid not null references households(id) on delete cascade,
  week_number     int not null,
  year            int not null,
  planned_amount  numeric(10,2),
  actual_amount   numeric(10,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (household_id, year, week_number)
);

-- ─────────────────────────────────────────────────────────────
-- INDEKSER
-- ─────────────────────────────────────────────────────────────

create index on household_members (household_id);
create index on user_households (household_id);
create index on ingredients (household_id);
create index on recipes (household_id, category);
create index on recipe_ingredients (recipe_id);
create index on recipe_ratings (recipe_id);
create index on meal_plans (household_id, year, week_number);
create index on lunchbox_plans (household_id, year, week_number);
create index on pantry_items (household_id);
create index on shopping_lists (household_id, status);
create index on shopping_list_items (list_id);
create index on budgets (household_id, year, week_number);

-- ─────────────────────────────────────────────────────────────
-- OPPDATER updated_at AUTOMATISK
-- ─────────────────────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_households_updated_at
  before update on households
  for each row execute function update_updated_at();

create trigger trg_household_settings_updated_at
  before update on household_settings
  for each row execute function update_updated_at();

create trigger trg_recipes_updated_at
  before update on recipes
  for each row execute function update_updated_at();

create trigger trg_meal_plans_updated_at
  before update on meal_plans
  for each row execute function update_updated_at();

create trigger trg_pantry_items_updated_at
  before update on pantry_items
  for each row execute function update_updated_at();

create trigger trg_shopping_lists_updated_at
  before update on shopping_lists
  for each row execute function update_updated_at();

create trigger trg_budgets_updated_at
  before update on budgets
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- HJELPEFUNKSJON: hent husholdnings-ID for innlogget bruker
-- (security definer for å unngå RLS-rekursjon)
-- ─────────────────────────────────────────────────────────────

create or replace function my_household_id()
returns uuid language sql security definer stable as $$
  select household_id
  from user_households
  where user_id = auth.uid()
  limit 1;
$$;
