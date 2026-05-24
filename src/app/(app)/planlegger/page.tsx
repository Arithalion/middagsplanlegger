import { createClient } from '@/lib/supabase/server'
import { getWeekNumber, offsetWeek, getWeekDates } from '@/lib/utils'
import PlanleggerKlient from './PlanleggerKlient'
import type { RecipeCategory, Weekday } from '@/types/database'

type RawMealPlan = {
  id: string
  week_number: number
  year: number
  weekday: string
  is_special_day: boolean
  note: string | null
  recipe: { id: string; name: string; category: string } | null
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

  const [{ data: rawSettings }, { data: rawMealPlans }, { data: rawRecipes }] = await Promise.all([
    supabase
      .from('household_settings')
      .select('special_days, fish_days_per_week, always_vegetables')
      .maybeSingle(),
    supabase
      .from('meal_plans')
      .select('id, week_number, year, weekday, is_special_day, note, recipe:recipes(id, name, category)')
      .or(
        `and(week_number.eq.${thisWeek},year.eq.${thisYear}),and(week_number.eq.${nextWeek},year.eq.${nextYear})`
      ),
    supabase
      .from('recipes')
      .select('id, name, category, recipe_ratings(score)')
      .order('name'),
  ])

  const settings = rawSettings as { special_days: string[]; fish_days_per_week: number } | null
  const allPlans = (rawMealPlans ?? []) as unknown as RawMealPlan[]
  const allRecipes = (rawRecipes ?? []) as unknown as RawRecipe[]

  function buildPlanMap(week: number, year: number) {
    const map: Record<string, { id: string; weekday: Weekday; is_special_day: boolean; note: string | null; recipe: { id: string; name: string; category: RecipeCategory } | null }> = {}
    for (const p of allPlans.filter(p => p.week_number === week && p.year === year)) {
      map[p.weekday] = {
        id: p.id,
        weekday: p.weekday as Weekday,
        is_special_day: p.is_special_day,
        note: p.note,
        recipe: p.recipe ? { id: p.recipe.id, name: p.recipe.name, category: p.recipe.category as RecipeCategory } : null,
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
    />
  )
}
