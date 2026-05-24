'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Unit } from '@/types/database'

export async function addPantryItem(data: {
  ingredient_id?: string
  ingredient_name?: string
  amount: number
  unit: Unit
  expiry_date: string | null
}) {
  const supabase = await createClient()

  const { data: householdId, error } = await supabase.rpc('my_household_id')
  if (error || !householdId) throw new Error('Fant ikke husstand')

  let ingredientId = data.ingredient_id

  if (!ingredientId && data.ingredient_name) {
    const { data: ingredient } = await supabase
      .from('ingredients')
      .upsert(
        {
          household_id: householdId,
          name: data.ingredient_name.trim(),
          default_unit: data.unit,
        },
        { onConflict: 'household_id,name' }
      )
      .select()
      .single()

    if (!ingredient) throw new Error('Kunne ikke opprette ingrediens')
    ingredientId = ingredient.id
  }

  if (!ingredientId) throw new Error('Mangler ingrediens')

  await supabase.from('pantry_items').insert({
    household_id: householdId,
    ingredient_id: ingredientId,
    amount: data.amount,
    unit: data.unit,
    expiry_date: data.expiry_date,
  })

  revalidatePath('/beholdning')
}

export async function updatePantryItem(
  id: string,
  data: { amount?: number; unit?: Unit; expiry_date?: string | null }
) {
  const supabase = await createClient()
  await supabase.from('pantry_items').update(data).eq('id', id)
  revalidatePath('/beholdning')
}

export async function deletePantryItem(id: string) {
  const supabase = await createClient()
  await supabase.from('pantry_items').delete().eq('id', id)
  revalidatePath('/beholdning')
}
