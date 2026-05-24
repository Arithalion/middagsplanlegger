import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWeekNumber } from '@/lib/utils'
import { beregnHandleliste } from '@/lib/utils/shopping'

// Oppdaterer eksisterende handleliste med varer som mangler fra ukesmenyen
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { listId, weekNumber, year } = await request.json()
  if (!listId) return NextResponse.json({ error: 'Mangler listId' }, { status: 400 })

  const wk = weekNumber ?? getWeekNumber(new Date())
  const yr = year ?? new Date().getFullYear()

  // Hent hva som allerede er på listen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: eksisterende } = await (supabase as any)
    .from('shopping_list_items')
    .select('ingredient_id, amount, unit')
    .eq('list_id', listId)
    .eq('is_manual', false)

  const eksisterendeMap = new Map<string, number>()
  for (const e of (eksisterende ?? [])) {
    if (e.ingredient_id) eksisterendeMap.set(e.ingredient_id, e.amount)
  }

  // Beregn hva som trengs (inkl. pakke-utregning)
  const allNeeded = await beregnHandleliste(supabase, wk, yr)

  // Finn varer som mangler fra eksisterende liste
  const nyeVarer: {
    list_id: string
    ingredient_id: string
    amount: number
    unit: string
    packages_needed: number | null
    estimated_price: number | null
    sort_order: number
  }[] = []
  let sortStart = ((eksisterende as unknown[])?.length ?? 0) + 1

  for (const item of allNeeded) {
    const påListe = eksisterendeMap.get(item.ingredient_id) ?? 0
    if (påListe > 0) continue // allerede på listen

    nyeVarer.push({
      list_id: listId,
      ingredient_id: item.ingredient_id,
      amount: item.amount,
      unit: item.unit,
      packages_needed: item.packages_needed,
      estimated_price: item.estimated_price,
      sort_order: sortStart++,
    })
  }

  if (nyeVarer.length === 0) {
    return NextResponse.json({ message: 'Listen er allerede oppdatert — ingen nye varer å legge til', added: 0 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('shopping_list_items').insert(nyeVarer)

  return NextResponse.json({ message: `${nyeVarer.length} nye varer lagt til`, added: nyeVarer.length })
}
