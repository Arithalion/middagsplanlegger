import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const KASSAL_BASE = 'https://kassal.app/api/v1'

// EAN-endepunktet returnerer ProductComparisonResource
type PriceEntry = { price: number; unit_price: number | null; date: string }

type ComparisonProduct = {
  id: number
  name: string
  current_price: PriceEntry | null   // objekt, ikke array
  weight: number | null
  weight_unit: string | null
  store: { name: string; code: string } | null
}

type KassalEanResponse = {
  data: {
    ean: string
    products: ComparisonProduct[]
  }
}

export async function POST() {
  const apiKey = process.env.KASSAL_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'KASSAL_API_KEY ikke konfigurert' }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { data: householdId } = await supabase.rpc('my_household_id')
  if (!householdId) return NextResponse.json({ error: 'Fant ikke husstand' }, { status: 400 })

  // Hent alle koblede produkter for husstanden (inkl. is_organic)
  const { data: rawLinks } = await supabase
    .from('household_ingredient_products')
    .select('id, ingredient_id, kassal_ean, package_size, package_unit, is_organic')

  const links = (rawLinks ?? []) as unknown as {
    id: string
    ingredient_id: string
    kassal_ean: string
    package_size: number
    package_unit: string
    is_organic: boolean
  }[]

  if (links.length === 0) {
    return NextResponse.json({ message: 'Ingen koblede produkter å synkronisere', updated: 0 })
  }

  let updated = 0
  let errors = 0

  for (const link of links) {
    try {
      const url = `${KASSAL_BASE}/products/ean/${encodeURIComponent(link.kassal_ean)}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })

      if (!res.ok) { errors++; continue }

      const kassalData = (await res.json()) as KassalEanResponse
      const products = kassalData.data?.products ?? []
      if (products.length === 0) { errors++; continue }

      // current_price er et objekt { price, unit_price, date } per produkt (én per butikk)
      const priser = products
        .map((p) => p.current_price?.price)
        .filter((v): v is number => v !== undefined && v > 0)

      if (priser.length === 0) { errors++; continue }

      const snittpris = priser.reduce((a, b) => a + b, 0) / priser.length
      const pkgSize = link.package_size

      // Oppdater package-tabellen
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('household_ingredient_products')
        .update({
          price_per_package: Math.round(snittpris * 100) / 100,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', link.id)

      // Beregn pris per enhet og oppdater ingredient_prices
      if (pkgSize > 0) {
        const pricePerUnit = snittpris / pkgSize
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('ingredient_prices')
          .upsert(
            {
              ingredient_id: link.ingredient_id,
              price_per_unit: Math.round(pricePerUnit * 1000) / 1000,
              unit: link.package_unit,
              source: 'kassal',
              is_organic: link.is_organic,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'ingredient_id,is_organic' }
          )
      }

      updated++
    } catch {
      errors++
    }
  }

  return NextResponse.json({
    message: `Synkronisert ${updated} av ${links.length} produkter${errors > 0 ? ` (${errors} feil)` : ''}`,
    updated,
    errors,
  })
}
