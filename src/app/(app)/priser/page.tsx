import { createClient } from '@/lib/supabase/server'
import PriserKlient from './PriserKlient'

type RawIngredient = {
  id: string
  name: string
  category: string | null
  default_unit: string
  ingredient_prices: { id: string; price_per_unit: number; unit: string; source: string | null; updated_at: string }[]
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
}

export default async function PriserPage() {
  const supabase = await createClient()

  const [{ data: rawIngredients }, { data: rawLinks }, { data: settingsRow }] = await Promise.all([
    supabase
      .from('ingredients')
      .select(`id, name, category, default_unit, ingredient_prices(id, price_per_unit, unit, source, updated_at)`)
      .order('name'),
    supabase
      .from('household_ingredient_products')
      .select('ingredient_id, kassal_ean, kassal_product_id, product_name, package_size, package_unit, price_per_package, last_synced_at'),
    supabase
      .from('household_settings')
      .select('prefer_organic')
      .single(),
  ])

  const ingredients = (rawIngredients ?? []) as unknown as RawIngredient[]
  const links = (rawLinks ?? []) as unknown as RawKassalLink[]
  const preferOrganic = (settingsRow as unknown as { prefer_organic: boolean } | null)?.prefer_organic ?? false

  const linkMap = new Map(links.map((l) => [l.ingredient_id, l]))

  const ingredientsWithPrice = ingredients.map((ing) => ({
    id: ing.id,
    name: ing.name,
    category: ing.category,
    default_unit: ing.default_unit,
    price: ing.ingredient_prices[0] ?? null,
    kassalLink: linkMap.get(ing.id) ?? null,
  }))

  return <PriserKlient ingredients={ingredientsWithPrice} preferOrganic={preferOrganic} />
}
