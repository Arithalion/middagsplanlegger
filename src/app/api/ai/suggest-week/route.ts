import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type RawRecipe = {
  id: string
  name: string
  category: string
  recipe_ratings: { score: number }[]
}

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { data: rawSettings } = await supabase
    .from('household_settings')
    .select('special_days, fish_days_per_week')
    .maybeSingle()

  const settings = rawSettings as { special_days: string[]; fish_days_per_week: number } | null

  const { data: rawRecipes } = await supabase
    .from('recipes')
    .select('id, name, category, recipe_ratings(score)')

  if (!rawRecipes || rawRecipes.length === 0) {
    return NextResponse.json({ error: 'Ingen oppskrifter å velge fra' }, { status: 400 })
  }

  const recipes = rawRecipes as unknown as RawRecipe[]

  const recipesWithRating = recipes.map((r) => {
    const avg = r.recipe_ratings.length > 0
      ? r.recipe_ratings.reduce((s, x) => s + x.score, 0) / r.recipe_ratings.length
      : 3
    return { ...r, avg_rating: avg }
  })

  const fishDays = settings?.fish_days_per_week ?? 2
  const specialDays = settings?.special_days ?? ['fredag', 'lørdag']

  const weekdays = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag']

  const fishRecipes = recipesWithRating.filter(r => r.category === 'fisk')
  const weekendRecipes = recipesWithRating.filter(r =>
    ['helgemat', 'søndagsmiddag', 'selskapsmat'].includes(r.category)
  )
  const weekdayRecipes = recipesWithRating.filter(r =>
    ['hverdagsmat', 'fisk', 'vegetar', 'kylling'].includes(r.category)
  )

  const plan: Record<string, string | null> = {}
  let fishCount = 0

  for (const day of weekdays) {
    const isSpecial = specialDays.includes(day)

    if (isSpecial && weekendRecipes.length > 0) {
      const sorted = [...weekendRecipes].sort((a, b) => b.avg_rating - a.avg_rating)
      plan[day] = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))]?.id ?? null
    } else {
      const remainingDays = weekdays.length - weekdays.indexOf(day)
      const remainingFish = fishDays - fishCount
      const mustFish = remainingFish >= remainingDays

      let pool = mustFish && fishRecipes.length > 0 ? fishRecipes : weekdayRecipes
      if (pool.length === 0) pool = recipesWithRating

      const sorted = [...pool].sort((a, b) => b.avg_rating - a.avg_rating)
      const chosen = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))]

      if (chosen) {
        plan[day] = chosen.id
        if (chosen.category === 'fisk') fishCount++
      } else {
        plan[day] = null
      }
    }
  }

  return NextResponse.json({ plan })
}
