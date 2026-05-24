'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { RecipeCategory, Unit } from '@/types/database'

export interface OppskriftData {
  name: string
  description: string
  category: RecipeCategory
  servings: number
  prep_time_minutes: number
  source_url: string
  ingredients: {
    ingredient_name: string
    amount: number
    unit: Unit
    note: string
  }[]
}

// Beholdt for bakoverkompatibilitet
export type NyOppskriftData = OppskriftData

export async function createRecipe(data: OppskriftData) {
  const supabase = await createClient()

  const { data: householdId, error: hErr } = await supabase.rpc('my_household_id')
  if (hErr || !householdId) throw new Error('Fant ikke husstand')

  const { data: recipe, error: rErr } = await supabase
    .from('recipes')
    .insert({
      household_id: householdId,
      name: data.name,
      description: data.description || null,
      category: data.category,
      servings: data.servings,
      prep_time_minutes: data.prep_time_minutes || null,
      source_url: data.source_url || null,
    })
    .select()
    .single()

  if (rErr || !recipe) throw new Error('Kunne ikke opprette oppskrift')

  await lagreIngredienser(supabase, householdId, recipe.id, data.ingredients)

  revalidatePath('/oppskrifter')
  redirect(`/oppskrifter/${recipe.id}`)
}

export async function updateRecipe(id: string, data: OppskriftData) {
  const supabase = await createClient()

  const { data: householdId, error: hErr } = await supabase.rpc('my_household_id')
  if (hErr || !householdId) throw new Error('Fant ikke husstand')

  const { error: rErr } = await supabase
    .from('recipes')
    .update({
      name: data.name,
      description: data.description || null,
      category: data.category,
      servings: data.servings,
      prep_time_minutes: data.prep_time_minutes || null,
      source_url: data.source_url || null,
    })
    .eq('id', id)

  if (rErr) throw new Error('Kunne ikke oppdatere oppskrift')

  // Erstatt alle ingredienser
  await supabase.from('recipe_ingredients').delete().eq('recipe_id', id)
  await lagreIngredienser(supabase, householdId, id, data.ingredients)

  revalidatePath('/oppskrifter')
  revalidatePath(`/oppskrifter/${id}`)
  redirect(`/oppskrifter/${id}`)
}

export async function deleteRecipe(id: string) {
  const supabase = await createClient()
  await supabase.from('recipes').delete().eq('id', id)
  revalidatePath('/oppskrifter')
  redirect('/oppskrifter')
}

// ─── Hjelpefunksjon ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lagreIngredienser(supabase: any, householdId: string, recipeId: string, ingredients: OppskriftData['ingredients']) {
  for (const ing of ingredients) {
    if (!ing.ingredient_name.trim()) continue

    const { data: ingredient } = await supabase
      .from('ingredients')
      .upsert(
        { household_id: householdId, name: ing.ingredient_name.trim(), default_unit: ing.unit },
        { onConflict: 'household_id,name' }
      )
      .select()
      .single()

    if (ingredient) {
      await supabase.from('recipe_ingredients').insert({
        recipe_id: recipeId,
        ingredient_id: ingredient.id,
        amount: ing.amount,
        unit: ing.unit,
        note: ing.note || null,
      })
    }
  }
}
