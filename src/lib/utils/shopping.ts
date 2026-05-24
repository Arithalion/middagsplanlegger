import { SupabaseClient } from '@supabase/supabase-js'
import { getWeekNumber } from '@/lib/utils'

type RawMealPlan = {
  servings: number | null
  recipe: {
    servings: number
    recipe_ingredients: { amount: number; unit: string; ingredient_id: string }[]
  } | null
}

type KassalLink = {
  ingredient_id: string
  package_size: number
  package_unit: string
  price_per_package: number | null
}

export type ShoppingItem = {
  ingredient_id: string
  amount: number
  unit: string
  packages_needed: number | null
  estimated_price: number | null
}

/**
 * Beregner handleliste-varer basert på ukesplan, beholdning og Kassal-koblinger.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function beregnHandleliste(supabase: SupabaseClient<any>, weekNumber?: number, year?: number): Promise<ShoppingItem[]> {
  const now = new Date()
  const wk = weekNumber ?? getWeekNumber(now)
  const yr = year ?? now.getFullYear()

  const [{ data: rawMealPlans }, { data: rawPantry }, { data: rawLinks }] = await Promise.all([
    supabase
      .from('meal_plans')
      .select(`
        servings,
        recipe:recipes(
          servings,
          recipe_ingredients(amount, unit, ingredient_id)
        )
      `)
      .eq('week_number', wk)
      .eq('year', yr),
    supabase
      .from('pantry_items')
      .select('ingredient_id, amount'),
    supabase
      .from('household_ingredient_products')
      .select('ingredient_id, package_size, package_unit, price_per_package'),
  ])

  const mealPlans = (rawMealPlans ?? []) as unknown as RawMealPlan[]
  const pantry = rawPantry ?? []
  const links = (rawLinks ?? []) as unknown as KassalLink[]

  const linkMap = new Map(links.map((l) => [l.ingredient_id, l]))
  const pantryMap = new Map<string, number>(
    pantry.map((p: { ingredient_id: string; amount: number }) => [p.ingredient_id, p.amount])
  )

  // Summer ingrediensbehov — skaler etter porsjonsoverstyring
  const needed = new Map<string, { amount: number; unit: string }>()
  for (const plan of mealPlans) {
    if (!plan.recipe) continue
    const scale = plan.servings != null && plan.recipe.servings > 0
      ? plan.servings / plan.recipe.servings
      : 1

    for (const ri of plan.recipe.recipe_ingredients ?? []) {
      const scaled = ri.amount * scale
      const existing = needed.get(ri.ingredient_id)
      if (existing) {
        existing.amount += scaled
      } else {
        needed.set(ri.ingredient_id, { amount: scaled, unit: ri.unit })
      }
    }
  }

  // Trekk fra beholdning + beregn pakker
  const shoppingItems: ShoppingItem[] = []
  for (const [ingredientId, { amount, unit }] of needed) {
    const inPantry = pantryMap.get(ingredientId) ?? 0
    const diff = amount - inPantry
    if (diff <= 0) continue

    const link = linkMap.get(ingredientId)
    if (link && link.package_size > 0) {
      // Kobling funnet — beregn pakker
      const packages = Math.ceil(diff / link.package_size)
      const estimated = link.price_per_package != null ? packages * link.price_per_package : null
      shoppingItems.push({
        ingredient_id: ingredientId,
        amount: packages * link.package_size,
        unit: link.package_unit,
        packages_needed: packages,
        estimated_price: estimated,
      })
    } else {
      // Ingen kobling — inkluder med oppskriftsmengde
      shoppingItems.push({
        ingredient_id: ingredientId,
        amount: diff,
        unit,
        packages_needed: null,
        estimated_price: null,
      })
    }
  }

  return shoppingItems
}
