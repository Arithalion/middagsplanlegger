import { createClient } from '@/lib/supabase/server'
import {
  getWeekNumber, offsetWeek, getWeekDates, formatDatoKort,
  formatNok, UKEDAGER, KATEGORI_FARGER, KATEGORI_LABELS,
} from '@/lib/utils'
import Link from 'next/link'

type RawMealPlan = {
  week_number: number
  year: number
  weekday: string
  is_special_day: boolean
  recipe: { name: string; category: string } | null
}
type RawShoppingList = {
  id: string
  status: string
  shopping_list_items: { estimated_price: number | null; is_bought: boolean }[]
}
type RawPantryItem = {
  expiry_date: string | null
  ingredient: { name: string } | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const now = new Date()
  const thisWeek = getWeekNumber(now)
  const thisYear = now.getFullYear()
  const { week: nextWeek, year: nextYear } = offsetWeek(thisYear, thisWeek, 1)

  const [
    { data: rawMealPlans },
    { data: rawShoppingList },
    { data: rawPantryExpiring },
    { data: rawBudget },
  ] = await Promise.all([
    supabase
      .from('meal_plans')
      .select('week_number, year, weekday, is_special_day, recipe:recipes(name, category)')
      .or(
        `and(week_number.eq.${thisWeek},year.eq.${thisYear}),and(week_number.eq.${nextWeek},year.eq.${nextYear})`
      ),
    supabase
      .from('shopping_lists')
      .select('id, status, shopping_list_items(estimated_price, is_bought)')
      .eq('status', 'aktiv')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('pantry_items')
      .select('expiry_date, ingredient:ingredients(name)')
      .not('expiry_date', 'is', null)
      .lte('expiry_date', new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0])
      .order('expiry_date', { ascending: true })
      .limit(5),
    supabase
      .from('budgets')
      .select('planned_amount, actual_amount')
      .eq('week_number', thisWeek)
      .eq('year', thisYear)
      .maybeSingle(),
  ])

  const allPlans = (rawMealPlans ?? []) as unknown as RawMealPlan[]
  const shoppingList = rawShoppingList as unknown as RawShoppingList | null
  const pantryExpiring = (rawPantryExpiring ?? []) as unknown as RawPantryItem[]
  const budget = rawBudget as { planned_amount: number | null; actual_amount: number | null } | null

  // Bygg planMap per uke
  function buildPlanMap(week: number, year: number) {
    const map = new Map<string, { name: string; category: string; is_special_day: boolean }>()
    for (const p of allPlans.filter(p => p.week_number === week && p.year === year)) {
      if (p.recipe) map.set(p.weekday, { name: p.recipe.name, category: p.recipe.category, is_special_day: p.is_special_day })
    }
    return map
  }

  const thisWeekMap = buildPlanMap(thisWeek, thisYear)
  const nextWeekMap = buildPlanMap(nextWeek, nextYear)

  const listeItems = shoppingList?.shopping_list_items ?? []
  const ikkeKjøpt = listeItems.filter((i) => !i.is_bought).length
  const estimertSum = listeItems.reduce((s, i) => s + (i.estimated_price ?? 0), 0)
  const planlagt = budget?.planned_amount ?? 0
  const faktisk = budget?.actual_amount ?? 0
  const budsjettProsent = planlagt > 0 ? Math.min(100, Math.round((faktisk / planlagt) * 100)) : 0

  const thisWeekDates = getWeekDates(thisYear, thisWeek)
  const nextWeekDates = getWeekDates(nextYear, nextWeek)

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">God dag! 👋</h1>
        <p className="text-sm text-gray-500 mt-1">
          {now.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ── Widgets: handleliste + budsjett + utløper ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {/* Handleliste */}
        <Link href="/handleliste"
          className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between
            hover:border-green-300 hover:shadow-sm transition-all">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Handleliste</p>
            {shoppingList ? (
              <>
                <p className="text-2xl font-bold text-gray-900">{ikkeKjøpt}</p>
                <p className="text-xs text-gray-500">varer gjenstår</p>
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">Ingen aktiv liste</p>
            )}
          </div>
          {estimertSum > 0 && (
            <div className="text-right">
              <p className="text-lg font-semibold text-gray-900">{formatNok(estimertSum)}</p>
              <p className="text-xs text-gray-400">estimert</p>
            </div>
          )}
        </Link>

        {/* Budsjett */}
        <Link href="/budsjett"
          className="bg-white rounded-2xl border border-gray-200 p-4
            hover:border-green-300 hover:shadow-sm transition-all">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Budsjett uke {thisWeek}</p>
          {planlagt > 0 ? (
            <>
              <div className="flex justify-between text-sm text-gray-600 mb-1.5">
                <span>{formatNok(faktisk)} brukt</span>
                <span>{formatNok(planlagt)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${budsjettProsent > 90 ? 'bg-red-500' : budsjettProsent > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                  style={{ width: `${budsjettProsent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{budsjettProsent}% brukt</p>
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">Budsjett ikke satt</p>
          )}
        </Link>

        {/* Utløper snart */}
        {pantryExpiring.length > 0 && (
          <Link href="/beholdning"
            className="sm:col-span-2 bg-amber-50 rounded-2xl border border-amber-200 p-4
              hover:border-amber-400 transition-all">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">Utløper snart ⚠️</p>
            <div className="flex flex-wrap gap-3">
              {pantryExpiring.map((item, idx) => {
                const dager = Math.floor((new Date(item.expiry_date!).getTime() - Date.now()) / 86400000)
                return (
                  <span key={idx} className="flex items-center gap-1.5 text-sm">
                    <span className="text-amber-900 font-medium">{item.ingredient?.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${dager < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {dager < 0 ? 'Utløpt' : dager === 0 ? 'I dag' : `${dager}d`}
                    </span>
                  </span>
                )
              })}
            </div>
          </Link>
        )}
      </div>

      {/* ── Denne uken ── */}
      <UkesOversikt
        tittel="Denne uken"
        uke={thisWeek}
        år={thisYear}
        planMap={thisWeekMap}
        datoer={thisWeekDates}
        iDag={now}
      />

      {/* ── Neste uke ── */}
      <UkesOversikt
        tittel="Neste uke"
        uke={nextWeek}
        år={nextYear}
        planMap={nextWeekMap}
        datoer={nextWeekDates}
        iDag={now}
      />
    </div>
  )
}

// ─── Komponent: ukeoversikt ──────────────────────────────────

function UkesOversikt({
  tittel, uke, år, planMap, datoer, iDag,
}: {
  tittel: string
  uke: number
  år: number
  planMap: Map<string, { name: string; category: string; is_special_day: boolean }>
  datoer: Date[]
  iDag: Date
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">
          {tittel}
          <span className="ml-2 text-sm font-normal text-gray-400">uke {uke}</span>
        </h2>
        <Link href={`/planlegger?uke=${uke}&år=${år}`}
          className="text-sm text-green-600 hover:text-green-700 font-medium">
          Planlegg →
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {UKEDAGER.map((dag, i) => {
          const middag = planMap.get(dag)
          const dato = datoer[i]
          const erIDag = dato.toDateString() === iDag.toDateString()

          return (
            <div
              key={dag}
              className={`flex items-center px-4 py-3 gap-3 ${i > 0 ? 'border-t border-gray-100' : ''} ${erIDag ? 'bg-green-50' : ''}`}
            >
              {/* Dato-kolonne */}
              <div className="w-24 shrink-0">
                <p className={`text-sm font-semibold capitalize ${erIDag ? 'text-green-700' : 'text-gray-700'}`}>
                  {dag.slice(0, 3)}
                </p>
                <p className="text-xs text-gray-400">{formatDatoKort(dato)}</p>
              </div>

              {/* Middag */}
              {middag ? (
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-900 truncate">{middag.name}</span>
                  <span className={`shrink-0 hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${KATEGORI_FARGER[middag.category] ?? 'bg-gray-100 text-gray-700'}`}>
                    {KATEGORI_LABELS[middag.category]}
                  </span>
                  {middag.category === 'fisk' && <span className="shrink-0 text-sm">🐟</span>}
                  {middag.category === 'vegetar' && <span className="shrink-0 text-sm">🥦</span>}
                  {middag.is_special_day && <span className="shrink-0 text-sm">⭐</span>}
                </div>
              ) : (
                <span className="flex-1 text-sm text-gray-400 italic">Ikke planlagt</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
