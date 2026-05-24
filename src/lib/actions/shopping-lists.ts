'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Unit } from '@/types/database'

export async function generateShoppingList(week_number: number, year: number) {
  const supabase = await createClient()

  const { data: householdId, error } = await supabase.rpc('my_household_id')
  if (error || !householdId) throw new Error('Fant ikke husstand')

  const { data: plans } = await supabase
    .from('meal_plans')
    .select('recipe_id')
    .eq('household_id', householdId)
    .eq('week_number', week_number)
    .eq('year', year)
    .not('recipe_id', 'is', null)

  const recipeIds = (plans ?? []).map((p) => p.recipe_id).filter(Boolean) as string[]

  const ingredientMap = new Map<string, { amount: number; unit: Unit; ingredient_id: string }>()

  if (recipeIds.length > 0) {
    const { data: recipeIngredients } = await supabase
      .from('recipe_ingredients')
      .select('ingredient_id, amount, unit')
      .in('recipe_id', recipeIds)

    for (const ri of recipeIngredients ?? []) {
      const key = `${ri.ingredient_id}_${ri.unit}`
      const existing = ingredientMap.get(key)
      if (existing) {
        existing.amount += ri.amount
      } else {
        ingredientMap.set(key, {
          ingredient_id: ri.ingredient_id,
          amount: ri.amount,
          unit: ri.unit as Unit,
        })
      }
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: list, error: listErr } = await supabase
    .from('shopping_lists')
    .insert({
      household_id: householdId,
      list_date: today,
      list_type: 'hoved',
      week_number,
      year,
      status: 'aktiv',
    })
    .select()
    .single()

  if (listErr || !list) throw new Error('Kunne ikke opprette handleliste')

  const items = Array.from(ingredientMap.values()).map((v, i) => ({
    list_id: list.id,
    ingredient_id: v.ingredient_id,
    amount: v.amount,
    unit: v.unit,
    estimated_price: null,
    is_bought: false,
    sort_order: i,
  }))

  if (items.length > 0) {
    await supabase.from('shopping_list_items').insert(items)
  }

  revalidatePath('/handleliste')
  return list.id
}

export async function markItemBought(itemId: string, isBought: boolean) {
  const supabase = await createClient()
  await supabase.from('shopping_list_items').update({ is_bought: isBought }).eq('id', itemId)
  revalidatePath('/handleliste')
}

export async function markListBought(listId: string) {
  const supabase = await createClient()
  await supabase.from('shopping_list_items').update({ is_bought: true }).eq('list_id', listId)
  await supabase.from('shopping_lists').update({ status: 'kjøpt' }).eq('id', listId)
  revalidatePath('/handleliste')
}
