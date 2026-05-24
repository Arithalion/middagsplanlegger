import { createClient } from '@/lib/supabase/server'
import OppskrifterKlient from './OppskrifterKlient'
import type { RecipeCategory } from '@/types/database'

type RawRecipe = {
  id: string
  name: string
  category: string
  prep_time_minutes: number | null
  servings: number
  recipe_ratings: { score: number }[]
}

export default async function OppskrifterPage() {
  const supabase = await createClient()

  const { data: rawOppskrifter } = await supabase
    .from('recipes')
    .select('id, name, category, prep_time_minutes, servings, recipe_ratings(score)')
    .order('name', { ascending: true })

  const oppskrifter = ((rawOppskrifter ?? []) as unknown as RawRecipe[]).map((r) => {
    const avg = r.recipe_ratings.length > 0
      ? r.recipe_ratings.reduce((s, x) => s + x.score, 0) / r.recipe_ratings.length
      : null
    return {
      id: r.id,
      name: r.name,
      category: r.category as RecipeCategory,
      prep_time_minutes: r.prep_time_minutes,
      servings: r.servings,
      avg_rating: avg,
      rating_count: r.recipe_ratings.length,
    }
  })

  return <OppskrifterKlient oppskrifter={oppskrifter} />
}
