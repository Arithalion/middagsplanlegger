import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import RedigerOppskrift from './RedigerOppskrift'
import type { RecipeCategory, Unit } from '@/types/database'

type RawRecipe = {
  id: string
  name: string
  description: string | null
  category: string
  servings: number
  prep_time_minutes: number | null
  source_url: string | null
  recipe_ingredients: {
    amount: number
    unit: string
    note: string | null
    ingredient: { name: string }
  }[]
}

export default async function RedigerOppskriftPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('recipes')
    .select(`
      id, name, description, category, servings, prep_time_minutes, source_url,
      recipe_ingredients(
        amount, unit, note, sort_order,
        ingredient:ingredients(name)
      )
    `)
    .eq('id', id)
    .single()

  if (!raw) notFound()

  const recipe = raw as unknown as RawRecipe

  return (
    <RedigerOppskrift
      id={recipe.id}
      initial={{
        name: recipe.name,
        description: recipe.description ?? '',
        category: recipe.category as RecipeCategory,
        servings: recipe.servings,
        prep_time_minutes: recipe.prep_time_minutes ?? 0,
        source_url: recipe.source_url ?? '',
        ingredients: recipe.recipe_ingredients.map((ri) => ({
          ingredientNavn: ri.ingredient.name,
          amount: String(ri.amount),
          unit: ri.unit as Unit,
          note: ri.note ?? '',
        })),
      }}
    />
  )
}
