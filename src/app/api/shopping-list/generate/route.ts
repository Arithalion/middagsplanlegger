import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getWeekNumber } from '@/lib/utils'
import { beregnHandleliste, beregnHandleperiode } from '@/lib/utils/shopping'

export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const now = new Date()

  // ── Hent innstillinger ────────────────────────────────────────────────────
  const { data: settings } = await supabase
    .from('household_settings')
    .select('shopping_days, shopping_after_dinner')
    .maybeSingle()

  const shoppingDays: string[] = (settings?.shopping_days as string[] | null) ?? []
  const shoppingAfterDinner: boolean = (settings?.shopping_after_dinner as boolean | null) ?? false

  // ── Beregn handleperiode eller fall tilbake til inneværende uke ───────────
  const periode = shoppingDays.length > 0
    ? beregnHandleperiode(shoppingDays, shoppingAfterDinner, now)
    : null

  let shoppingItems: Awaited<ReturnType<typeof beregnHandleliste>>
  let periodeLabel: string

  if (periode) {
    shoppingItems = await beregnHandleliste(supabase, periode.days)
    periodeLabel = periode.label
  } else {
    // Ingen handledager satt — bruk inneværende uke
    const weekNumber = getWeekNumber(now)
    const year = now.getFullYear()
    shoppingItems = await beregnHandleliste(supabase, weekNumber, year)
    periodeLabel = `uke ${getWeekNumber(now)}`
  }

  if (shoppingItems.length === 0) {
    return NextResponse.json({ message: 'Alt er allerede på lager!', list_id: null })
  }

  // ── Opprett handleliste ───────────────────────────────────────────────────
  const { data: householdId } = await supabase.rpc('my_household_id')

  const weekNumber = getWeekNumber(periode?.fromDate ?? now)
  const year = (periode?.fromDate ?? now).getFullYear()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: list, error: listError } = await (supabase as any)
    .from('shopping_lists')
    .insert({
      household_id: householdId,
      list_date: (periode?.fromDate ?? now).toISOString().split('T')[0],
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
    packages_needed: item.packages_needed,
    estimated_price: item.estimated_price,
    sort_order: i,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('shopping_list_items').insert(items)

  return NextResponse.json({
    message: `Handleliste for ${periodeLabel} generert!`,
    list_id: list.id,
  })
}
