import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getWeekNumber } from '@/lib/utils'

// POST — legg til manuell vare i handleliste.
// Hvis list_id ikke er oppgitt, opprettes en tom liste automatisk.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const body = await request.json() as {
    list_id?: string | null
    manual_name: string
    amount: number
    unit: string
  }

  const { manual_name, amount, unit } = body
  let list_id = body.list_id ?? null

  if (!manual_name?.trim()) {
    return NextResponse.json({ error: 'Mangler varenavn' }, { status: 400 })
  }

  // ── Hvis ingen liste — opprett en tom en ──────────────────────────────────
  if (!list_id) {
    const { data: householdId } = await supabase.rpc('my_household_id')

    // Sjekk om det finnes en aktiv liste fra før
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('shopping_lists')
      .select('id')
      .eq('household_id', householdId)
      .eq('status', 'aktiv')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      list_id = existing.id as string
    } else {
      const now = new Date()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newList, error: createError } = await (supabase as any)
        .from('shopping_lists')
        .insert({
          household_id: householdId,
          list_date: now.toISOString().split('T')[0],
          list_type: 'hoved',
          week_number: getWeekNumber(now),
          year: now.getFullYear(),
          status: 'aktiv',
        })
        .select('id')
        .single()

      if (createError || !newList) {
        return NextResponse.json({ error: 'Klarte ikke opprette handleliste' }, { status: 500 })
      }
      list_id = newList.id as string
    }
  }

  // ── Finn neste sort_order ─────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('shopping_list_items')
    .select('id', { count: 'exact', head: true })
    .eq('list_id', list_id)

  // ── Sett inn varen ────────────────────────────────────────────────────────
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

  return NextResponse.json({ ok: true, id: item.id, list_id })
}
