'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateBudget(data: {
  week_number: number
  year: number
  planned_amount?: number | null
  actual_amount?: number | null
}) {
  const supabase = await createClient()

  const { data: householdId, error } = await supabase.rpc('my_household_id')
  if (error || !householdId) throw new Error('Fant ikke husstand')

  await supabase.from('budgets').upsert(
    {
      household_id: householdId,
      week_number: data.week_number,
      year: data.year,
      planned_amount: data.planned_amount ?? null,
      actual_amount: data.actual_amount ?? null,
    },
    { onConflict: 'household_id,week_number,year' }
  )

  revalidatePath('/budsjett')
}
