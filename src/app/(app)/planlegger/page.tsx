import { createClient } from '@/lib/supabase/server'
import { getWeekNumber, UKEDAGER } from '@/lib/utils'
import PlanleggerKlient from './PlanleggerKlient'
import type { RecipeCategory, Weekday } from '@/types/database'

type RawMealPlan = {
  id: string
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

export default async function PlanleggerPage({
  searchParams,
}: {
  searchParams: Promise<{ uke?: string; år?: string }>
}) {
  const { uke, år } = await searchParams
  const now = new Date()
  const weekNumber = uke ? parseInt(uke) : getWeekNumber(now)
  const year = år ? parseInt(år) : now.getFullYear()

  const supabase = await createClient()

  const [{ data: rawSettings }, { data: rawMealPlans }, { data: rawRecipes }] = await Promise.all([
    supabase
      .from('household_settings')
      .select('special_days, fish_days_per_week, always_vegetables')
      .maybeSingle(),
    supabase
      .from('meal_plans')
      .select(`
        id, weekday, is_special_day, note,
        recipe:recipes(id, name, category)
      `)
      .eq('week_number', weekNumber)
      .eq('year', year),
    supabase
      .from('recipes')
      .select('id, name, category, recipe_ratings(score)')
      .order('name'),
  ])

  const settings = rawSettings as { special_days: string[]; fish_days_per_week: number; always_vegetables: boolean } | null
  const mealPlans = (rawMealPlans ?? []) as unknown as RawMealPlan[]
  const allRecipes = (rawRecipes ?? []) as unknown as RawRecipe[]

  type DagPlan = {
    id: string
    weekday: Weekday
    is_special_day: boolean
    note: string | null
    recipe: { id: string; name: string; category: RecipeCategory } | null
  }

  const planMap: Record<string, DagPlan> = {}
  for (const plan of mealPlans) {
    planMap[plan.weekday] = {
      id: plan.id,
      weekday: plan.weekday as Weekday,
      is_special_day: plan.is_special_day,
      note: plan.note,
      recipe: plan.recipe ? {
        id: plan.recipe.id,
        name: plan.recipe.name,
        category: plan.recipe.category as RecipeCategory,
      } : null,
    }
  }

  const oppskrifterMedRating = allRecipes.map((r) => {
    const avg = r.recipe_ratings.length > 0
      ? r.recipe_ratings.reduce((s, x) => s + x.score, 0) / r.recipe_ratings.length
      : null
    return {
      id: r.id,
      name: r.name,
      category: r.category as RecipeCategory,
      avg_rating: avg,
    }
  })

  const defaultSpecialDays = (settings?.special_days ?? ['fredag', 'lørdag']) as Weekday[]
  const fishDaysPerWeek = settings?.fish_days_per_week ?? 2

  // Beregn ukedatoer for inneværende uke
  const isoWeekStart = getISOWeekStart(year, weekNumber)
  const ukedatoer = UKEDAGER.map((_, i) => {
    const d = new Date(isoWeekStart)
    d.setDate(d.getDate() + i)
    return d.toISOString()
  })

  return (
    <PlanleggerKlient
      weekNumber={weekNumber}
      year={year}
      planMap={planMap}
      oppskrifter={oppskrifterMedRating}
      defaultSpecialDays={defaultSpecialDays}
      fishDaysPerWeek={fishDaysPerWeek}
      ukedatoer={ukedatoer}
    />
  )
}

function getISOWeekStart(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dayOfWeek = simple.getDay()
  const isoWeekStart = simple
  if (dayOfWeek <= 4) {
    isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1)
  } else {
    isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay())
  }
  return isoWeekStart
}
