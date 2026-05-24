import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import OppskriftDetalj from './OppskriftDetalj'
import type { RecipeCategory, Unit } from '@/types/database'

type RawRecipe = {
  id: string
  name: string
  description: string | null
  category: string
  servings: number
  prep_time_minutes: number | null
  source_url: string | null
  is_public: boolean
  household_id: string
  created_at: string
  recipe_ingredients: {
    id: string
    amount: number
    unit: string
    note: string | null
    sort_order: number
    ingredient: { id: string; name: string }
  }[]
  recipe_ratings: {
    id: string
    score: number
    rated_at: string
    member: { id: string; name: string } | null
  }[]
}

type RawHR = { recipe_id: string } | null

export default async function OppskriftDetaljPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: rawRecipe },
    { data: rawUserHousehold },
    { data: householdId },
  ] = await Promise.all([
    supabase
      .from('recipes')
      .select(`
        id, name, description, category, servings, prep_time_minutes, source_url,
        is_public, household_id, created_at,
        recipe_ingredients(
          id, amount, unit, note, sort_order,
          ingredient:ingredients(id, name)
        ),
        recipe_ratings(
          id, score, rated_at,
          member:household_members(id, name)
        )
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('user_households')
      .select('member_id')
      .eq('user_id', user?.id ?? '')
      .maybeSingle(),
    supabase.rpc('my_household_id'),
  ])

  if (!rawRecipe) notFound()

  const recipe = rawRecipe as unknown as RawRecipe
  const avgRating = recipe.recipe_ratings.length > 0
    ? recipe.recipe_ratings.reduce((s, r) => s + r.score, 0) / recipe.recipe_ratings.length
    : null

  const userHousehold = rawUserHousehold as { member_id: string | null } | null
  const erEgen = recipe.household_id === householdId

  // Sjekk om denne oppskriften er i husstandens samling
  let erISamlingen = false
  if (householdId) {
    const { data: hr } = await supabase
      .from('household_recipes')
      .select('recipe_id')
      .eq('household_id', householdId)
      .eq('recipe_id', id)
      .maybeSingle()
    erISamlingen = !!(hr as RawHR)
  }

  return (
    <OppskriftDetalj
      recipe={{
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        category: recipe.category as RecipeCategory,
        servings: recipe.servings,
        prep_time_minutes: recipe.prep_time_minutes,
        source_url: recipe.source_url,
        is_public: recipe.is_public,
      }}
      ingredients={recipe.recipe_ingredients.map((ri) => ({
        id: ri.id,
        amount: ri.amount,
        unit: ri.unit as Unit,
        note: ri.note,
        ingredient: ri.ingredient,
      }))}
      ratings={recipe.recipe_ratings}
      avgRating={avgRating}
      currentMemberId={userHousehold?.member_id ?? null}
      erEgen={erEgen}
      erISamlingen={erISamlingen}
    />
  )
}
