'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Weekday } from '@/types/database'

export async function setMealPlan(params: {
  weekday: Weekday
  week_number: number
  year: number
  recipe_id: string | null
  is_special_day?: boolean
  note?: string
}) {
  const supabase = await createClient()

  const { data: householdId, error } = await supabase.rpc('my_household_id')
  if (error || !householdId) throw new Error('Fant ikke husstand')

  await supabase.from('meal_plans').upsert(
    {
      household_id: householdId,
      weekday: params.weekday,
      week_number: params.week_number,
      year: params.year,
      recipe_id: params.recipe_id,
      is_special_day: params.is_special_day ?? false,
      note: params.note ?? null,
    },
    { onConflict: 'household_id,week_number,year,weekday' }
  )

  revalidatePath('/planlegger')
}

export async function removeMealPlan(id: string) {
  const supabase = await createClient()
  await supabase.from('meal_plans').delete().eq('id', id)
  revalidatePath('/planlegger')
}
