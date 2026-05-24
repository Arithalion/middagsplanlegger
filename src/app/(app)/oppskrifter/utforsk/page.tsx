import { createClient } from '@/lib/supabase/server'
import UtforskKlient from './UtforskKlient'
import type { RecipeCategory } from '@/types/database'

type RawRecipe = {
  id: string
  name: string
  category: string
  prep_time_minutes: number | null
  servings: number
  household: { name: string } | null
  recipe_ratings: { score: number }[]
}

export default async function UtforskPage() {
  const supabase = await createClient()

  const { data: householdId } = await supabase.rpc('my_household_id')

  // Hent alle recipe_id-er som allerede er i husstandens samling
  const { data: minSamling } = await supabase
    .from('household_recipes')
    .select('recipe_id')
    .eq('household_id', householdId ?? '')

  const mineSamlingIds = (minSamling ?? []).map((r: { recipe_id: string }) => r.recipe_id)

  // Hent offentlige oppskrifter som ikke er eid av husstanden
  // (egne er alltid i samlingen allerede, og vi vil unngå å vise dem i Utforsk)
  let query = supabase
    .from('recipes')
    .select(`
      id, name, category, prep_time_minutes, servings,
      household:households(name),
      recipe_ratings(score)
    `)
    .eq('is_public', true)
    .neq('household_id', householdId ?? '')
    .order('name', { ascending: true })

  // Filtrer ut oppskrifter allerede i samlingen
  if (mineSamlingIds.length > 0) {
    query = query.not('id', 'in', `(${mineSamlingIds.join(',')})`)
  }

  const { data: rawOppskrifter } = await query

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
      husstandNavn: r.household?.name ?? 'Ukjent husstand',
      avg_rating: avg,
      rating_count: r.recipe_ratings.length,
    }
  })

  return <UtforskKlient oppskrifter={oppskrifter} />
}
