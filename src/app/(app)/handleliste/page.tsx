import { createClient } from '@/lib/supabase/server'
import HandlelisteKlient from './HandlelisteKlient'
import type { Unit } from '@/types/database'

type RawListItem = {
  id: string
  amount: number
  unit: Unit
  estimated_price: number | null
  is_bought: boolean
  sort_order: number
  ingredient: { id: string; name: string; category: string | null }
}

type RawList = {
  id: string
  list_date: string
  list_type: string
  status: string
  week_number: number | null
  year: number | null
  shopping_list_items: RawListItem[]
}

export default async function HandlelistePage() {
  const supabase = await createClient()

  const { data: rawLists } = await supabase
    .from('shopping_lists')
    .select(`
      id, list_date, list_type, status, week_number, year,
      shopping_list_items(
        id, amount, unit, estimated_price, is_bought, sort_order,
        ingredient:ingredients(id, name, category)
      )
    `)
    .eq('status', 'aktiv')
    .order('created_at', { ascending: false })
    .limit(5)

  const lists = (rawLists ?? []) as unknown as RawList[]
  const aktivListe = lists[0] ?? null

  const items = (aktivListe?.shopping_list_items ?? []).sort((a, b) => {
    if (a.ingredient.category !== b.ingredient.category) {
      return (a.ingredient.category ?? '').localeCompare(b.ingredient.category ?? '')
    }
    return a.sort_order - b.sort_order
  })

  const totalEstimert = items.reduce((s, i) => s + (i.estimated_price ?? 0), 0)

  return (
    <HandlelisteKlient
      listId={aktivListe?.id ?? null}
      listType={aktivListe?.list_type ?? null}
      weekNumber={aktivListe?.week_number ?? null}
      items={items}
      totalEstimert={totalEstimert}
    />
  )
}
