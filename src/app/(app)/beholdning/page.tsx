import { createClient } from '@/lib/supabase/server'
import { dagerTilUtlop, holdbarhetFarge } from '@/lib/utils'
import BeholdningKlient from './BeholdningKlient'
import type { Unit } from '@/types/database'

type RawPantryItem = {
  id: string
  amount: number
  unit: Unit
  expiry_date: string | null
  updated_at: string
  ingredient: { id: string; name: string; category: string | null }
}

export default async function BeholdningPage() {
  const supabase = await createClient()

  const { data: rawPantry } = await supabase
    .from('pantry_items')
    .select(`
      id, amount, unit, expiry_date, updated_at,
      ingredient:ingredients(id, name, category)
    `)
    .order('expiry_date', { ascending: true, nullsFirst: false })

  const { data: ingredients } = await supabase
    .from('ingredients')
    .select('id, name, default_unit, category')
    .order('name')

  const pantry = (rawPantry ?? []) as unknown as RawPantryItem[]

  type Item = {
    id: string
    amount: number
    unit: Unit
    expiry_date: string | null
    ingredient: { id: string; name: string; category: string | null }
    dager: number | null
    farge: 'grønn' | 'gul' | 'rød' | null
  }

  const items: Item[] = pantry.map((p) => {
    const dager = p.expiry_date ? dagerTilUtlop(p.expiry_date) : null
    return {
      id: p.id,
      amount: p.amount,
      unit: p.unit,
      expiry_date: p.expiry_date,
      ingredient: p.ingredient,
      dager,
      farge: dager !== null ? holdbarhetFarge(dager) : null,
    }
  })

  return (
    <BeholdningKlient
      items={items}
      ingredients={(ingredients ?? []) as { id: string; name: string; default_unit: Unit; category: string | null }[]}
    />
  )
}
