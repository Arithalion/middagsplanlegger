import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/kassal/koble — lagrer en ingrediens–produkt-kobling og oppdaterer ingredient_prices
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { data: householdId } = await supabase.rpc('my_household_id')
  if (!householdId) return NextResponse.json({ error: 'Fant ikke husstand' }, { status: 400 })

  const body = await request.json() as {
    ingredient_id: string
    kassal_ean: string
    kassal_product_id: number
    product_name: string
    package_size: number
    package_unit: string
    price_per_package: number | null
  }

  // Lagre/oppdater koblingen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('household_ingredient_products')
    .upsert(
      {
        household_id: householdId,
        ingredient_id: body.ingredient_id,
        kassal_ean: body.kassal_ean,
        kassal_product_id: body.kassal_product_id,
        product_name: body.product_name,
        package_size: body.package_size,
        package_unit: body.package_unit,
        price_per_package: body.price_per_package,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'household_id,ingredient_id' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Oppdater ingredient_prices med pris per enhet
  if (body.price_per_package && body.package_size > 0) {
    const pricePerUnit = body.price_per_package / body.package_size
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('ingredient_prices')
      .upsert(
        {
          ingredient_id: body.ingredient_id,
          price_per_unit: Math.round(pricePerUnit * 1000) / 1000,
          unit: body.package_unit,
          source: 'kassal',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'ingredient_id' }
      )
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/kassal/koble — fjerner en kobling
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { ingredient_id } = await request.json() as { ingredient_id: string }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('household_ingredient_products')
    .delete()
    .eq('ingredient_id', ingredient_id)

  return NextResponse.json({ ok: true })
}
