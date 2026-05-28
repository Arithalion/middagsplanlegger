import { createClient } from '@/lib/supabase/server'
import PriserKlient from './PriserKlient'

type PriceRow = {
  ingredient_id: string
  id: string
  price_per_unit: number
  unit: string
  source: string | null
  updated_at: string
  is_organic: boolean
}

type RawIngredient = {
  id: string
  name: string
  category: string | null
  default_unit: string
}

type RawKassalLink = {
  ingredient_id: string
  kassal_ean: string
  kassal_product_id: number | null
  product_name: string
  package_size: number
  package_unit: string
  price_per_package: number | null
  last_synced_at: string | null
  is_organic: boolean
}

export default async function PriserPage() {
  const supabase = await createClient()

  // Hent alt parallelt — ingredient_prices som separat query (unngår PostgREST-cache-problemer med ny UNIQUE-constraint)
  const [
    ingredientsRes,
    pricesRes,
    linksRes,
    settingsRes,
  ] = await Promise.all([
    supabase
      .from('ingredients')
      .select('id, name, category, default_unit')
      .order('name'),
    supabase
      .from('ingredient_prices')
      .select('ingredient_id, id, price_per_unit, unit, source, updated_at, is_organic'),
    supabase
      .from('household_ingredient_products')
      .select('ingredient_id, kassal_ean, kassal_product_id, product_name, package_size, package_unit, price_per_package, last_synced_at, is_organic'),
    supabase
      .from('household_settings')
      .select('prefer_organic')
      .maybeSingle(),
  ])

  const ingredients = (ingredientsRes.data ?? []) as unknown as RawIngredient[]
  const prices = (pricesRes.data ?? []) as unknown as PriceRow[]
  const links = (linksRes.data ?? []) as unknown as RawKassalLink[]
  const preferOrganic = (settingsRes.data as unknown as { prefer_organic: boolean } | null)?.prefer_organic ?? false

  // Bygg price-maps per ingrediens
  const normalPriceMap = new Map<string, PriceRow>()
  const organicPriceMap = new Map<string, PriceRow>()
  for (const p of prices) {
    if (p.is_organic) {
      organicPriceMap.set(p.ingredient_id, p)
    } else {
      normalPriceMap.set(p.ingredient_id, p)
    }
  }

  // Bygg link-maps per ingrediens
  const normalLinkMap = new Map<string, RawKassalLink>()
  const organicLinkMap = new Map<string, RawKassalLink>()
  for (const l of links) {
    if (l.is_organic) {
      organicLinkMap.set(l.ingredient_id, l)
    } else {
      normalLinkMap.set(l.ingredient_id, l)
    }
  }

  const ingredientsWithPrice = ingredients.map((ing) => ({
    id: ing.id,
    name: ing.name,
    category: ing.category,
    default_unit: ing.default_unit,
    normalPrice: normalPriceMap.get(ing.id) ?? null,
    organicPrice: organicPriceMap.get(ing.id) ?? null,
    normalLink: normalLinkMap.get(ing.id) ?? null,
    organicLink: organicLinkMap.get(ing.id) ?? null,
  }))

  return <PriserKlient ingredients={ingredientsWithPrice} preferOrganic={preferOrganic} />
}
