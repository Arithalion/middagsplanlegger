import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const KASSAL_BASE = 'https://kassal.app/api/v1'

// Search-endepunkt returnerer data som direkte array
type KassalProduct = {
  id: number
  name: string
  vendor: string | null
  brand: string | null
  ean: string | null
  image: string | null
  current_price: number | null        // tall i search-endepunktet
  current_unit_price: number | null
  weight: number | null
  weight_unit: string | null
  store: { name: string; code: string } | null
}

type KassalResponse = {
  data: KassalProduct[]  // direkte array, ikke { products: [] }
}

function isOrganic(name: string): boolean {
  const low = name.toLowerCase()
  return low.includes('øk') || low.includes('eko') || low.includes('organic')
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.KASSAL_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'KASSAL_API_KEY ikke konfigurert' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Mangler søkeord' }, { status: 400 })

  // Hent husstandens organisk-preferanse
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { data: settingsRow } = await supabase
    .from('household_settings')
    .select('prefer_organic')
    .single()

  const preferOrganic = (settingsRow as unknown as { prefer_organic: boolean } | null)?.prefer_organic ?? false

  // Søk Kassal — hent 20 produkter for å ha nok til å sortere på organisk
  const url = new URL(`${KASSAL_BASE}/products`)
  url.searchParams.set('search', q)
  url.searchParams.set('size', '20')
  url.searchParams.set('unique', '1')
  url.searchParams.set('exclude_without_ean', '1')

  const kassalRes = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 300 }, // cache 5 min
  })

  if (!kassalRes.ok) {
    return NextResponse.json({ error: 'Kassal-feil: ' + kassalRes.status }, { status: 502 })
  }

  const kassalData = (await kassalRes.json()) as KassalResponse
  let products = kassalData.data ?? []

  // Sorter: organisk først om husstanden foretrekker det
  if (preferOrganic) {
    products = [
      ...products.filter((p) => isOrganic(p.name)),
      ...products.filter((p) => !isOrganic(p.name)),
    ]
  }

  // Returner topp 5, normalisert
  const topp5 = products.slice(0, 5).map((p) => {
    // Noen produkter mangler weight_unit — fall tilbake til 'g'
    const packageUnit = p.weight_unit ?? (p.weight != null ? 'g' : null)
    return {
      kassal_product_id: p.id,
      kassal_ean: p.ean ?? '',
      product_name: p.name,
      brand: p.brand ?? null,
      image: p.image ?? null,
      price_per_package: p.current_price ?? null,
      package_size: p.weight ?? null,
      package_unit: packageUnit,
      store: p.store?.name ?? null,
      is_organic: isOrganic(p.name),
    }
  })

  return NextResponse.json({ products: topp5 })
}
