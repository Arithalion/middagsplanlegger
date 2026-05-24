import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST — legg til manuell vare i handleliste
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { list_id, manual_name, amount, unit } = await request.json() as {
    list_id: string
    manual_name: string
    amount: number
    unit: string
  }

  if (!list_id || !manual_name?.trim()) {
    return NextResponse.json({ error: 'Mangler list_id eller navn' }, { status: 400 })
  }

  // Finn neste sort_order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('shopping_list_items')
    .select('id', { count: 'exact', head: true })
    .eq('list_id', list_id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error } = await (supabase as any)
    .from('shopping_list_items')
    .insert({
      list_id,
      ingredient_id: null,
      amount: amount ?? 1,
      unit: unit ?? 'stk',
      is_manual: true,
      manual_name: manual_name.trim(),
      sort_order: (count ?? 0) + 1,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: item.id })
}
