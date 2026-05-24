import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type PantryUpdate = {
  ingredient_id: string
  amount: number
  unit: string
}

// POST — fullfør handleliste, oppdater beholdning, logg priser
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { listId, pantryUpdates } = await request.json() as {
    listId: string
    pantryUpdates: PantryUpdate[]
  }

  if (!listId) return NextResponse.json({ error: 'Mangler listId' }, { status: 400 })

  // Merk alt kjøpt og sett liste til 'ferdig'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('shopping_list_items')
    .update({ is_bought: true })
    .eq('list_id', listId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('shopping_lists')
    .update({ status: 'ferdig' })
    .eq('id', listId)

  // Logg actual_price = estimated_price for hvert element
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: listItems } = await (supabase as any)
    .from('shopping_list_items')
    .select('id, estimated_price')
    .eq('list_id', listId)
    .not('estimated_price', 'is', null)

  if (listItems && listItems.length > 0) {
    await Promise.all(
      (listItems as { id: string; estimated_price: number }[]).map((item) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('shopping_list_items')
          .update({ actual_price: item.estimated_price })
          .eq('id', item.id)
      )
    )
  }

  // Oppdater pantry
  if (pantryUpdates && pantryUpdates.length > 0) {
    const { data: householdId } = await supabase.rpc('my_household_id')

    // Hent eksisterende pantry for å addere
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: eksisterende } = await (supabase as any)
      .from('pantry_items')
      .select('ingredient_id, amount, unit, id')

    const eksMap = new Map<string, { id: string; amount: number; unit: string }>(
      (eksisterende ?? []).map((e: { ingredient_id: string; id: string; amount: number; unit: string }) => [
        e.ingredient_id,
        { id: e.id, amount: e.amount, unit: e.unit },
      ])
    )

    for (const update of pantryUpdates) {
      if (update.amount <= 0) continue

      const existing = eksMap.get(update.ingredient_id)
      if (existing) {
        // Legg til eksisterende mengde
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('pantry_items')
          .update({ amount: existing.amount + update.amount, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        // Ny pantry-rad
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('pantry_items')
          .insert({
            household_id: householdId,
            ingredient_id: update.ingredient_id,
            amount: update.amount,
            unit: update.unit,
          })
      }
    }
  }

  return NextResponse.json({ success: true })
}
