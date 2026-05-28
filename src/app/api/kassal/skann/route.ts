import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const KASSAL_BASE = 'https://kassal.app/api/v1'

// Kassal EAN-endepunkt returnerer { data: { products: [...] } }
// NB: current_price er et objekt i EAN-endepunktet, ulikt søk-endepunktet (tall)
type KassalEanCurrentPrice = {
  price: number
  unit_price: number
  date: string
} | null

type KassalEanProduct = {
  id: number
  name: string
  brand: string | null
  vendor: string | null
  ean: string | null
  image: string | null
  current_price: KassalEanCurrentPrice
  weight: number | null
  weight_unit: string | null
}

type KassalEanResponse = {
  data: {
    products: KassalEanProduct[]
  }
}

function isOrganic(name: string): boolean {
  const low = name.toLowerCase()
  return low.includes('øk') || low.includes('eko') || low.includes('organic')
}

// GET /api/kassal/skann?ean=XXXXXXXXXX
export async function GET(request: NextRequest) {
  const apiKey = process.env.KASSAL_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'KASSAL_API_KEY ikke konfigurert' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const ean = searchParams.get('ean')?.trim()
  if (!ean) return NextResponse.json({ error: 'Mangler EAN' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  // Slå opp EAN i Kassal
  const kassalRes = await fetch(`${KASSAL_BASE}/products/ean/${encodeURIComponent(ean)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 3600 }, // cache 1 time — EAN-data endres sjelden
  })

  if (kassalRes.status === 404) {
    return NextResponse.json({ error: 'Produkt ikke funnet for denne EAN-koden' }, { status: 404 })
  }

  if (!kassalRes.ok) {
    return NextResponse.json({ error: 'Kassal-feil: ' + kassalRes.status }, { status: 502 })
  }

  const kassalData = (await kassalRes.json()) as KassalEanResponse
  const products = kassalData.data?.products ?? []

  if (products.length === 0) {
    return NextResponse.json({ error: 'Ingen produkter funnet for denne EAN-koden' }, { status: 404 })
  }

  // Bruk første produkt (beste treff)
  const p = products[0]
  const packageUnit = p.weight_unit ?? (p.weight != null ? 'g' : null)

  // Sjekk om EAN er koblet til en ingrediens i husstanden
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linkedRows } = await (supabase as any)
    .from('household_ingredient_products')
    .select('ingredient_id, ingredients(id, name)')
    .eq('kassal_ean', ean)
    .limit(1)

  const linked = linkedRows?.[0]
  const linkedIngredient = linked?.ingredients
    ? { id: linked.ingredients.id as string, name: linked.ingredients.name as string }
    : null

  return NextResponse.json({
    product_name: p.name,
    brand: p.brand ?? null,
    package_size: p.weight ?? null,
    package_unit: packageUnit,
    price: p.current_price?.price ?? null,
    is_organic: isOrganic(p.name),
    kassal_product_id: p.id,
    ean,
    linked_ingredient: linkedIngredient,
  })
}
