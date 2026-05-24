import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { ingredientId, price } = await request.json()
  if (!ingredientId || typeof price !== 'number') {
    return NextResponse.json({ error: 'Mangler ingredientId eller pris' }, { status: 400 })
  }

  // Hent ingrediensenhet
  const { data: ingredient } = await supabase
    .from('ingredients')
    .select('default_unit')
    .eq('id', ingredientId)
    .single()

  if (!ingredient) return NextResponse.json({ error: 'Ingrediens ikke funnet' }, { status: 404 })

  await supabase
    .from('ingredient_prices')
    .upsert(
      {
        ingredient_id: ingredientId,
        price_per_unit: price,
        unit: ingredient.default_unit,
        source: 'manual',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'ingredient_id' }
    )

  return NextResponse.json({ ok: true })
}
