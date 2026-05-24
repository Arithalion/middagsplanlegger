import { createClient } from '@/lib/supabase/server'
import { getWeekNumber, offsetWeek, getWeekDates, beregnOppskriftKostnad } from '@/lib/utils'
import PlanleggerKlient from './PlanleggerKlient'
import type { RecipeCategory, Weekday } from '@/types/database'

type RawMealPlan = {
  id: string
  week_number: number
  year: number
  weekday: string
  is_special_day: boolean
  note: string | null
  servings: number | null
  recipe: { id: string; name: string; category: string; servings: number } | null
}

type RawRecipe = {
  id: string
  name: string
  category: string
  recipe_ratings: { score: number }[]
}

export default async function PlanleggerPage() {
  const supabase = await createClient()
  const now = new Date()
  const thisWeek = getWeekNumber(now)
  const thisYear = now.getFullYear()
  const { week: nextWeek, year: nextYear } = offsetWeek(thisYear, thisWeek, 1)

  const [{ data: rawSettings }, { data: rawMealPlans }, { data: rawRecipes }, { count: memberCount }, { data: rawPrices }, { data: rawRecipeIngredients }] = await Promise.all([
    supabase
      .from('household_settings')
      .select('special_days, fish_days_per_week, always_vegetables')
      .maybeSingle(),
    supabase
      .from('meal_plans')
      .select('id, week_number, year, weekday, is_special_day, note, servings, recipe:recipes(id, name, category, servings)')
      .or(
        `and(week_number.eq.${thisWeek},year.eq.${thisYear}),and(week_number.eq.${nextWeek},year.eq.${nextYear})`
      ),
    supabase
      .from('recipes')
      .select('id, name, category, recipe_ratings(score)')
      .order('name'),
    supabase
      .from('household_members')
      .select('id', { count: 'exact', head: true }),
    // Priser per ingrediens
    supabase
      .from('ingredient_prices')
      .select('ingredient_id, price_per_unit, unit'),
    // Ingredienser per oppskrift for planlagte uker
    supabase
      .from('recipe_ingredients')
      .select('recipe_id, ingredient_id, amount, unit'),
  ])

  const settings = rawSettings as { special_days: string[]; fish_days_per_week: number } | null
  const allPlans = (rawMealPlans ?? []) as unknown as RawMealPlan[]
  const allRecipes = (rawRecipes ?? []) as unknown as RawRecipe[]
  const defaultServings = memberCount ?? 4

  function buildPlanMap(week: number, year: number) {
    const map: Record<string, {
      id: string
      weekday: Weekday
      is_special_day: boolean
      note: string | null
      servings: number | null
      recipe: { id: string; name: string; category: RecipeCategory; servings: number } | null
    }> = {}
    for (const p of allPlans.filter(p => p.week_number === week && p.year === year)) {
      map[p.weekday] = {
        id: p.id,
        weekday: p.weekday as Weekday,
        is_special_day: p.is_special_day,
        note: p.note,
        servings: p.servings,
        recipe: p.recipe ? {
          id: p.recipe.id,
          name: p.recipe.name,
          category: p.recipe.category as RecipeCategory,
          servings: p.recipe.servings,
        } : null,
      }
    }
    return map
  }

  const oppskrifterMedRating = allRecipes.map((r) => {
    const avg = r.recipe_ratings.length > 0
      ? r.recipe_ratings.reduce((s, x) => s + x.score, 0) / r.recipe_ratings.length
      : null
    return { id: r.id, name: r.name, category: r.category as RecipeCategory, avg_rating: avg }
  })

  // ── Kostnad per oppskrift ─────────────────────────────────────────────────
  type RawPrice = { ingredient_id: string; price_per_unit: number; unit: string }
  type RawRI = { recipe_id: string; ingredient_id: string; amount: number; unit: string }

  const priceMap = new Map<string, { price_per_unit: number; unit: string }>(
    ((rawPrices ?? []) as unknown as RawPrice[]).map((p) => [
      p.ingredient_id,
      { price_per_unit: p.price_per_unit, unit: p.unit },
    ])
  )

  // Grupper recipe_ingredients per recipe_id
  const riByRecipe = new Map<string, { amount: number; unit: string; price_per_unit: number | null; price_unit: string | null }[]>()
  for (const ri of ((rawRecipeIngredients ?? []) as unknown as RawRI[])) {
    const price = priceMap.get(ri.ingredient_id)
    const entry = {
      amount: ri.amount,
      unit: ri.unit,
      price_per_unit: price?.price_per_unit ?? null,
      price_unit: price?.unit ?? null,
    }
    const existing = riByRecipe.get(ri.recipe_id)
    if (existing) existing.push(entry)
    else riByRecipe.set(ri.recipe_id, [entry])
  }

  // Beregn kostnad per recipe_id for de planlagte oppskriftene
  const costMap: Record<string, number> = {}
  for (const plan of allPlans) {
    if (!plan.recipe?.id) continue
    const recipeId = plan.recipe.id
    if (costMap[recipeId] !== undefined) continue // allerede beregnet

    const ris = riByRecipe.get(recipeId)
    if (!ris) continue

    const targetServings = plan.servings ?? defaultServings
    const cost = beregnOppskriftKostnad(ris, plan.recipe.servings, targetServings)
    if (cost !== null) costMap[recipeId] = cost
  }

  const defaultSpecialDays = (settings?.special_days ?? ['fredag', 'lørdag']) as Weekday[]
  const fishDaysPerWeek = settings?.fish_days_per_week ?? 2

  return (
    <PlanleggerKlient
      thisWeek={thisWeek}
      thisYear={thisYear}
      nextWeek={nextWeek}
      nextYear={nextYear}
      thisPlanMap={buildPlanMap(thisWeek, thisYear)}
      nextPlanMap={buildPlanMap(nextWeek, nextYear)}
      oppskrifter={oppskrifterMedRating}
      defaultSpecialDays={defaultSpecialDays}
      fishDaysPerWeek={fishDaysPerWeek}
      thisWeekDates={getWeekDates(thisYear, thisWeek).map(d => d.toISOString())}
      nextWeekDates={getWeekDates(nextYear, nextWeek).map(d => d.toISOString())}
      today={new Date().toISOString()}
      defaultServings={defaultServings}
      costMap={costMap}
    />
  )
}
