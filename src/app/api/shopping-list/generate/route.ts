import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getWeekNumber } from '@/lib/utils'
import { beregnHandleliste } from '@/lib/utils/shopping'

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const now = new Date()
  const weekNumber = getWeekNumber(now)
  const year = now.getFullYear()

  const shoppingItems = await beregnHandleliste(supabase, weekNumber, year)

  if (shoppingItems.length === 0) {
    return NextResponse.json({ message: 'Alt er allerede på lager!', list_id: null })
  }

  const { data: householdId } = await supabase.rpc('my_household_id')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: list, error: listError } = await (supabase as any)
    .from('shopping_lists')
    .insert({
      household_id: householdId,
      list_date: now.toISOString().split('T')[0],
      list_type: 'hoved',
      week_number: weekNumber,
      year,
      status: 'aktiv',
    })
    .select('id')
    .single()

  if (listError || !list) {
    return NextResponse.json({ error: 'Klarte ikke opprette handleliste' }, { status: 500 })
  }

  const items = shoppingItems.map((item, i) => ({
    list_id: list.id,
    ingredient_id: item.ingredient_id,
    amount: item.amount,
    unit: item.unit,
    packages_needed: item.packages_needed,
    estimated_price: item.estimated_price,
    sort_order: i,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('shopping_list_items').insert(items)

  return NextResponse.json({ message: 'Handleliste generert!', list_id: list.id })
}
