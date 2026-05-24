-- =============================================================
-- 007: Porsjoner per planlagt dag
--   - servings på meal_plans (NULL = bruk oppskriftens standard)
-- =============================================================

alter table meal_plans
  add column if not exists servings integer;
