import { createClient } from '@/lib/supabase/server'
import PriserKlient from './PriserKlient'

type RawIngredient = {
  id: string
  name: string
  category: string | null
  default_unit: string
  ingredient_prices: { id: string; price_per_unit: number; unit: string; source: string | null; updated_at: string }[]
}

export default async function PriserPage() {
  const supabase = await createClient()

  const { data: rawIngredients } = await supabase
    .from('ingredients')
    .select(`
      id, name, category, default_unit,
      ingredient_prices(id, price_per_unit, unit, source, updated_at)
    `)
    .order('name')

  const ingredients = (rawIngredients ?? []) as unknown as RawIngredient[]

  const ingredientsWithPrice = ingredients.map((ing) => ({
    id: ing.id,
    name: ing.name,
    category: ing.category,
    default_unit: ing.default_unit,
    price: ing.ingredient_prices[0] ?? null,
  }))

  return <PriserKlient ingredients={ingredientsWithPrice} />
}
