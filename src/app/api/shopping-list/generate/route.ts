import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getWeekNumber } from '@/lib/utils'

type RawMealPlan = {
  weekday: string
  recipe: {
    servings: number
    recipe_ingredients: { amount: number; unit: string; ingredient_id: string }[]
  } | null
}

type RawPantryItem = { ingredient_id: string; amount: number; unit: string }
type RawShoppingItem = { ingredient_id: string; amount: number; unit: string }

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const now = new Date()
  const weekNumber = getWeekNumber(now)
  const year = now.getFullYear()

  const [{ data: rawMealPlans }, { data: rawPantry }] = await Promise.all([
    supabase
      .from('meal_plans')
      .select(`
        weekday,
        recipe:recipes(
          servings,
          recipe_ingredients(amount, unit, ingredient_id)
        )
      `)
      .eq('week_number', weekNumber)
      .eq('year', year),
    supabase
      .from('pantry_items')
      .select('ingredient_id, amount, unit'),
  ])

  const mealPlans = (rawMealPlans ?? []) as unknown as RawMealPlan[]
  const pantry = (rawPantry ?? []) as unknown as RawPantryItem[]

  const pantryMap = new Map<string, number>()
  for (const item of pantry) {
    pantryMap.set(item.ingredient_id, item.amount)
  }

  // Summer ingredienser
  const needed = new Map<string, { amount: number; unit: string; ingredient_id: string }>()
  for (const plan of mealPlans) {
    if (!plan.recipe) continue
    for (const ri of plan.recipe.recipe_ingredients ?? []) {
      const key = ri.ingredient_id
      const existing = needed.get(key)
      if (existing) {
        existing.amount += ri.amount
      } else {
        needed.set(key, { amount: ri.amount, unit: ri.unit, ingredient_id: ri.ingredient_id })
      }
    }
  }

  // Trekk fra beholdning
  const shoppingItems: RawShoppingItem[] = []
  for (const [ingredientId, { amount, unit }] of needed) {
    const inPantry = pantryMap.get(ingredientId) ?? 0
    const diff = amount - inPantry
    if (diff > 0) {
      shoppingItems.push({ ingredient_id: ingredientId, amount: diff, unit })
    }
  }

  if (shoppingItems.length === 0) {
    return NextResponse.json({ message: 'Alt er allerede på lager!', list_id: null })
  }

  const { data: householdId } = await supabase.rpc('my_household_id')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: list, error: listError } = await (supabase as any)
    .from('shopping_lists')
    .insert({
      household_id: householdId,
      list_date: now.toISOString().split('T')[0],
      list_type: 'hoved',
      week_number: weekNumber,
      year,
      status: 'aktiv',
    })
    .select('id')
    .single()

  if (listError || !list) {
    return NextResponse.json({ error: 'Klarte ikke opprette handleliste' }, { status: 500 })
  }

  const items = shoppingItems.map((item, i) => ({
    list_id: list.id,
    ingredient_id: item.ingredient_id,
    amount: item.amount,
    unit: item.unit,
    sort_order: i,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('shopping_list_items').insert(items)

  return NextResponse.json({ message: 'Handleliste generert!', list_id: list.id })
}
