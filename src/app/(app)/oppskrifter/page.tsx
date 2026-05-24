import { createClient } from '@/lib/supabase/server'
import OppskrifterKlient from './OppskrifterKlient'
import type { RecipeCategory } from '@/types/database'

type RawRow = {
  added_at: string
  recipe: {
    id: string
    name: string
    category: string
    prep_time_minutes: number | null
    servings: number
    is_public: boolean
    household_id: string
    recipe_ratings: { score: number }[]
  }
}

export default async function OppskrifterPage() {
  const supabase = await createClient()

  const { data: householdId } = await supabase.rpc('my_household_id')

  const { data: rawRows } = await supabase
    .from('household_recipes')
    .select(`
      added_at,
      recipe:recipes(
        id, name, category, prep_time_minutes, servings, is_public, household_id,
        recipe_ratings(score)
      )
    `)
    .order('added_at', { ascending: false })

  const oppskrifter = ((rawRows ?? []) as unknown as RawRow[]).map((row) => {
    const r = row.recipe
    const avg = r.recipe_ratings.length > 0
      ? r.recipe_ratings.reduce((s, x) => s + x.score, 0) / r.recipe_ratings.length
      : null
    const erEgen = r.household_id === householdId
    return {
      id: r.id,
      name: r.name,
      category: r.category as RecipeCategory,
      prep_time_minutes: r.prep_time_minutes,
      servings: r.servings,
      avg_rating: avg,
      rating_count: r.recipe_ratings.length,
      is_public: r.is_public,
      er_egen: erEgen,
    }
  })

  return <OppskrifterKlient oppskrifter={oppskrifter} />
}
