import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const body = await request.json()
  const { winnerId, loserId } = body as { winnerId?: string; loserId?: string }
  if (!winnerId || !loserId) {
    return NextResponse.json({ error: 'Mangler winnerId eller loserId' }, { status: 400 })
  }
  if (winnerId === loserId) {
    return NextResponse.json({ error: 'Winner og loser er den samme' }, { status: 400 })
  }

  // Verifiser at begge tilhører brukerens husholdning
  const { data: ing, error: ingErr } = await supabase
    .from('ingredients')
    .select('id')
    .in('id', [winnerId, loserId])

  if (ingErr) return NextResponse.json({ error: ingErr.message }, { status: 500 })
  if ((ing ?? []).length !== 2) {
    return NextResponse.json({ error: 'En eller begge ingredienser finnes ikke' }, { status: 404 })
  }

  // ── 1. recipe_ingredients ────────────────────────────────────
  const { error: riErr } = await supabase
    .from('recipe_ingredients')
    .update({ ingredient_id: winnerId })
    .eq('ingredient_id', loserId)

  if (riErr) return NextResponse.json({ error: riErr.message }, { status: 500 })

  // ── 2. pantry_items ──────────────────────────────────────────
  // Finn loser sin pantry-rad
  const { data: loserPantry } = await supabase
    .from('pantry_items')
    .select('id, amount, unit')
    .eq('ingredient_id', loserId)
    .maybeSingle()

  if (loserPantry) {
    // Sjekk om winner allerede har en rad
    const { data: winnerPantry } = await supabase
      .from('pantry_items')
      .select('id, amount')
      .eq('ingredient_id', winnerId)
      .maybeSingle()

    if (winnerPantry) {
      // Slå sammen mengder, slett loser
      await supabase
        .from('pantry_items')
        .update({ amount: winnerPantry.amount + loserPantry.amount })
        .eq('id', winnerPantry.id)
      await supabase.from('pantry_items').delete().eq('id', loserPantry.id)
    } else {
      // Bare flytt loser → winner
      await supabase
        .from('pantry_items')
        .update({ ingredient_id: winnerId })
        .eq('id', loserPantry.id)
    }
  }

  // ── 3. shopping_list_items (ikke manuelle) ───────────────────
  const { error: sliErr } = await supabase
    .from('shopping_list_items')
    .update({ ingredient_id: winnerId })
    .eq('ingredient_id', loserId)
    .eq('is_manual', false)

  if (sliErr) return NextResponse.json({ error: sliErr.message }, { status: 500 })

  // ── 4. ingredient_prices (kan ha is_organic=false og true etter migrasjon 010) ──
  const { data: loserPrices } = await supabase
    .from('ingredient_prices')
    .select('id, is_organic')
    .eq('ingredient_id', loserId)

  const { data: winnerPrices } = await supabase
    .from('ingredient_prices')
    .select('id, is_organic')
    .eq('ingredient_id', winnerId)

  const winnerHar = new Set(
    (winnerPrices ?? []).map((p: { is_organic: boolean }) => p.is_organic)
  )

  for (const lp of (loserPrices ?? []) as { id: string; is_organic: boolean }[]) {
    if (winnerHar.has(lp.is_organic)) {
      // Winner har allerede denne varianten — slett loser sin
      await supabase.from('ingredient_prices').delete().eq('id', lp.id)
    } else {
      // Winner mangler denne varianten — flytt loser sin over
      await supabase.from('ingredient_prices').update({ ingredient_id: winnerId }).eq('id', lp.id)
    }
  }

  // ── 5. Slett loser ───────────────────────────────────────────
  const { error: delErr } = await supabase
    .from('ingredients')
    .delete()
    .eq('id', loserId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
