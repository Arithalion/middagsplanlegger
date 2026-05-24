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

// ─── Opprett ─────────────────────────────────────────────────

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

  // Auto-legg til i husstandens samling
  await supabase
    .from('household_recipes')
    .insert({ household_id: householdId, recipe_id: recipe.id })

  await lagreIngredienser(supabase, householdId, recipe.id, data.ingredients)

  revalidatePath('/oppskrifter')
  redirect(`/oppskrifter/${recipe.id}`)
}

// ─── Rediger / Slett ──────────────────────────────────────────

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

// ─── Del / Avdel ──────────────────────────────────────────────

export async function shareRecipe(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('recipes')
    .update({ is_public: true })
    .eq('id', id)
  if (error) throw new Error('Kunne ikke dele oppskrift')
  revalidatePath(`/oppskrifter/${id}`)
  revalidatePath('/oppskrifter')
}

export async function unshareRecipe(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('recipes')
    .update({ is_public: false })
    .eq('id', id)
  if (error) throw new Error('Kunne ikke avdele oppskrift')
  revalidatePath(`/oppskrifter/${id}`)
  revalidatePath('/oppskrifter')
}

// ─── Samling (bookmarks) ──────────────────────────────────────

export async function addToCollection(recipeId: string) {
  const supabase = await createClient()
  const { data: householdId, error: hErr } = await supabase.rpc('my_household_id')
  if (hErr || !householdId) throw new Error('Fant ikke husstand')

  const { error } = await supabase
    .from('household_recipes')
    .insert({ household_id: householdId, recipe_id: recipeId })

  if (error && error.code !== '23505') throw new Error('Kunne ikke legge til i samlingen')
  revalidatePath('/oppskrifter')
  revalidatePath('/oppskrifter/utforsk')
  revalidatePath(`/oppskrifter/${recipeId}`)
}

export async function removeFromCollection(recipeId: string) {
  const supabase = await createClient()
  const { data: householdId, error: hErr } = await supabase.rpc('my_household_id')
  if (hErr || !householdId) throw new Error('Fant ikke husstand')

  await supabase
    .from('household_recipes')
    .delete()
    .eq('household_id', householdId)
    .eq('recipe_id', recipeId)

  revalidatePath('/oppskrifter')
  revalidatePath('/oppskrifter/utforsk')
  revalidatePath(`/oppskrifter/${recipeId}`)
}

// ─── Fork ─────────────────────────────────────────────────────

export async function forkRecipe(recipeId: string) {
  const supabase = await createClient()
  const { data: householdId, error: hErr } = await supabase.rpc('my_household_id')
  if (hErr || !householdId) throw new Error('Fant ikke husstand')

  // Hent original
  const { data: original, error: rErr } = await supabase
    .from('recipes')
    .select('name, description, category, servings, prep_time_minutes, source_url')
    .eq('id', recipeId)
    .single()
  if (rErr || !original) throw new Error('Fant ikke oppskrift')

  // Kopier oppskrift
  const { data: fork, error: fErr } = await supabase
    .from('recipes')
    .insert({
      household_id: householdId,
      name: (original as { name: string }).name + ' (kopi)',
      description: (original as { description: string | null }).description,
      category: (original as { category: RecipeCategory }).category,
      servings: (original as { servings: number }).servings,
      prep_time_minutes: (original as { prep_time_minutes: number | null }).prep_time_minutes,
      source_url: (original as { source_url: string | null }).source_url,
    })
    .select()
    .single()
  if (fErr || !fork) throw new Error('Kunne ikke opprette kopi')

  // Legg til i samlingen
  await supabase
    .from('household_recipes')
    .insert({ household_id: householdId, recipe_id: (fork as { id: string }).id })

  // Kopier ingredienser
  const { data: ingredients } = await supabase
    .from('recipe_ingredients')
    .select('ingredient_id, amount, unit, note, sort_order')
    .eq('recipe_id', recipeId)

  if (ingredients && ingredients.length > 0) {
    await supabase.from('recipe_ingredients').insert(
      (ingredients as { ingredient_id: string; amount: number; unit: string; note: string | null; sort_order: number }[])
        .map((ing) => ({
          recipe_id: (fork as { id: string }).id,
          ingredient_id: ing.ingredient_id,
          amount: ing.amount,
          unit: ing.unit,
          note: ing.note,
          sort_order: ing.sort_order,
        }))
    )
  }

  revalidatePath('/oppskrifter')
  redirect(`/oppskrifter/${(fork as { id: string }).id}`)
}

// ─── Rapporter ────────────────────────────────────────────────

export async function reportRecipe(recipeId: string, reason: string) {
  const supabase = await createClient()
  const { data: householdId, error: hErr } = await supabase.rpc('my_household_id')
  if (hErr || !householdId) throw new Error('Fant ikke husstand')

  const { error } = await supabase.from('recipe_reports').insert({
    recipe_id: recipeId,
    reported_by_household: householdId,
    reason: reason || null,
  })
  if (error) throw new Error('Kunne ikke sende rapport')
}

// ─── Admin: slett globalt ─────────────────────────────────────

export async function adminDeleteRecipe(recipeId: string) {
  const supabase = await createClient()

  // Sjekk global admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Ikke innlogget')

  const { data: uh } = await supabase
    .from('user_households')
    .select('is_global_admin')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!(uh as { is_global_admin: boolean } | null)?.is_global_admin) {
    throw new Error('Ikke global admin')
  }

  await supabase.from('recipes').delete().eq('id', recipeId)
  revalidatePath('/admin')
  revalidatePath('/oppskrifter')
  revalidatePath('/oppskrifter/utforsk')
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
