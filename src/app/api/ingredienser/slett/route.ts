import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { ingredient_id } = await request.json() as { ingredient_id?: string }
  if (!ingredient_id) return NextResponse.json({ error: 'Mangler ingredient_id' }, { status: 400 })

  // Verifiser at ingrediensen tilhører brukerens husstand
  const { data: ing, error: ingErr } = await supabase
    .from('ingredients')
    .select('id, name')
    .eq('id', ingredient_id)
    .maybeSingle()

  if (ingErr) return NextResponse.json({ error: ingErr.message }, { status: 500 })
  if (!ing) return NextResponse.json({ error: 'Ingrediens ikke funnet' }, { status: 404 })

  // ── 1. Fjern fra oppskrifter (RESTRICT-FK — må gjøres manuelt) ──
  const { error: riErr } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('ingredient_id', ingredient_id)

  if (riErr) return NextResponse.json({ error: riErr.message }, { status: 500 })

  // ── 2. Nullstill handleliste-rader (ingredient_id kan være NULL etter migr. 008) ──
  const { error: sliErr } = await supabase
    .from('shopping_list_items')
    .update({ ingredient_id: null })
    .eq('ingredient_id', ingredient_id)

  if (sliErr) return NextResponse.json({ error: sliErr.message }, { status: 500 })

  // ── 3. Slett ingrediensen (CASCADE fjerner ingredient_prices, pantry_items, hip) ──
  const { error: delErr } = await supabase
    .from('ingredients')
    .delete()
    .eq('id', ingredient_id)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
