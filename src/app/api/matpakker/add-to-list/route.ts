import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const HVERDAGER = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { weekNumber, year } = await request.json()

  const { data: householdId } = await supabase.rpc('my_household_id')
  if (!householdId) return NextResponse.json({ error: 'Fant ikke husstand' }, { status: 400 })

  // Hent matpakke-planer for uken
  const { data: plans } = await supabase
    .from('lunchbox_plans')
    .select('weekday, num_lunchboxes, num_fruit')
    .eq('week_number', weekNumber)
    .eq('year', year)

  if (!plans || plans.length === 0) {
    return NextResponse.json({ message: 'Ingen matpakkeplaner for denne uken' })
  }

  // Summer opp total matpakker og frukt for uken
  const totaltMatpakker = plans.reduce((s, p) => s + p.num_lunchboxes, 0)
  const totaltFrukt = plans.reduce((s, p) => s + p.num_fruit, 0)

  // Finn eller opprett generiske ingredienser for brød og frukt
  async function finnEllerOpprettIngrediens(navn: string, defaultUnit: string) {
    const { data: existing } = await supabase
      .from('ingredients')
      .select('id')
      .ilike('name', navn)
      .maybeSingle()
    if (existing) return existing.id

    const { data: nytt } = await supabase
      .from('ingredients')
      .insert({ household_id: householdId, name: navn, default_unit: defaultUnit, category: 'Matpakke' })
      .select('id')
      .single()
    return nytt?.id ?? null
  }

  const brødId = await finnEllerOpprettIngrediens('Brød (matpakke)', 'pk')
  const fruktId = await finnEllerOpprettIngrediens('Frukt', 'stk')

  // Finn aktiv handleliste for uken, eller opprett ny
  let { data: liste } = await supabase
    .from('shopping_lists')
    .select('id')
    .eq('status', 'aktiv')
    .eq('week_number', weekNumber)
    .eq('year', year)
    .maybeSingle()

  if (!liste) {
    const now = new Date()
    const { data: nyListe } = await supabase
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
    liste = nyListe
  }

  if (!liste) return NextResponse.json({ error: 'Klarte ikke opprette handleliste' }, { status: 500 })

  // Legg til brød og frukt
  const varer = []
  if (brødId && totaltMatpakker > 0) {
    // Anslå 1/4 brød per 2 matpakker (ca. 1 pose per 2 brød, 12 skiver per brød)
    const antallBrød = Math.ceil(totaltMatpakker / 6)
    varer.push({ list_id: liste.id, ingredient_id: brødId, amount: antallBrød, unit: 'pk', sort_order: 100 })
  }
  if (fruktId && totaltFrukt > 0) {
    varer.push({ list_id: liste.id, ingredient_id: fruktId, amount: totaltFrukt, unit: 'stk', sort_order: 101 })
  }

  if (varer.length > 0) {
    await supabase.from('shopping_list_items').insert(varer)
  }

  return NextResponse.json({
    message: `Lagt til: ${totaltMatpakker} matpakker (${Math.ceil(totaltMatpakker / 6)} brød), ${totaltFrukt} frukt`,
  })
}
