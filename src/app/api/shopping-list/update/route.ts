import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWeekNumber } from '@/lib/utils'

// Oppdaterer eksisterende handleliste med varer som mangler fra ukesmenyen
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { listId, weekNumber, year } = await request.json()
  if (!listId) return NextResponse.json({ error: 'Mangler listId' }, { status: 400 })

  const wk = weekNumber ?? getWeekNumber(new Date())
  const yr = year ?? new Date().getFullYear()

  // Hent hva som allerede er på listen
  const { data: eksisterende } = await supabase
    .from('shopping_list_items')
    .select('ingredient_id, amount, unit')
    .eq('list_id', listId)

  const eksisterendeMap = new Map<string, number>()
  for (const e of eksisterende ?? []) eksisterendeMap.set(e.ingredient_id, e.amount)

  // Hent ukesplan og beregn ingrediensbehov
  type RawMealPlan = { recipe: { recipe_ingredients: { ingredient_id: string; amount: number; unit: string }[] } | null }

  const { data: rawPlans } = await supabase
    .from('meal_plans')
    .select('recipe:recipes(recipe_ingredients(ingredient_id, amount, unit))')
    .eq('week_number', wk)
    .eq('year', yr)

  const plans = (rawPlans ?? []) as unknown as RawMealPlan[]

  const needed = new Map<string, { amount: number; unit: string }>()
  for (const p of plans) {
    for (const ri of p.recipe?.recipe_ingredients ?? []) {
      const existing = needed.get(ri.ingredient_id)
      if (existing) existing.amount += ri.amount
      else needed.set(ri.ingredient_id, { amount: ri.amount, unit: ri.unit })
    }
  }

  // Hent beholdning
  const { data: pantry } = await supabase
    .from('pantry_items')
    .select('ingredient_id, amount')

  const pantryMap = new Map<string, number>()
  for (const p of pantry ?? []) pantryMap.set(p.ingredient_id, p.amount)

  // Finn varer som mangler fra eksisterende liste
  const nyeVarer: { list_id: string; ingredient_id: string; amount: number; unit: string; sort_order: number }[] = []
  let sortStart = (eksisterende?.length ?? 0) + 1

  for (const [ingredientId, { amount, unit }] of needed) {
    const påListe = eksisterendeMap.get(ingredientId) ?? 0
    const påLager = pantryMap.get(ingredientId) ?? 0
    const mangler = amount - påLager - påListe

    if (mangler > 0) {
      nyeVarer.push({ list_id: listId, ingredient_id: ingredientId, amount: mangler, unit, sort_order: sortStart++ })
    }
  }

  if (nyeVarer.length === 0) {
    return NextResponse.json({ message: 'Listen er allerede oppdatert — ingen nye varer å legge til', added: 0 })
  }

  await supabase.from('shopping_list_items').insert(nyeVarer)

  return NextResponse.json({ message: `${nyeVarer.length} nye varer lagt til`, added: nyeVarer.length })
}
