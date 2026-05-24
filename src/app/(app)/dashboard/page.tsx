import { createClient } from '@/lib/supabase/server'
import { getWeekNumber, formatNok, UKEDAGER, KATEGORI_FARGER, KATEGORI_LABELS } from '@/lib/utils'
import Link from 'next/link'

type RawMealPlan = {
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
  const weekNumber = getWeekNumber(now)
  const year = now.getFullYear()

  const [
    { data: rawMealPlans },
    { data: rawShoppingList },
    { data: rawPantryExpiring },
    { data: rawBudget },
  ] = await Promise.all([
    supabase
      .from('meal_plans')
      .select('weekday, is_special_day, recipe:recipes(name, category)')
      .eq('week_number', weekNumber)
      .eq('year', year),
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
      .eq('week_number', weekNumber)
      .eq('year', year)
      .maybeSingle(),
  ])

  const mealPlans = (rawMealPlans ?? []) as unknown as RawMealPlan[]
  const shoppingList = rawShoppingList as unknown as RawShoppingList | null
  const pantryExpiring = (rawPantryExpiring ?? []) as unknown as RawPantryItem[]
  const budget = rawBudget as { planned_amount: number | null; actual_amount: number | null } | null

  const planMap = new Map<string, { name: string; category: string; is_special_day: boolean }>()
  for (const plan of mealPlans) {
    if (plan.recipe) {
      planMap.set(plan.weekday, {
        name: plan.recipe.name,
        category: plan.recipe.category,
        is_special_day: plan.is_special_day,
      })
    }
  }

  const listeItems = shoppingList?.shopping_list_items ?? []
  const ikkeKjøpt = listeItems.filter((i) => !i.is_bought).length
  const estimertSum = listeItems.reduce((s, i) => s + (i.estimated_price ?? 0), 0)

  const planlagt = budget?.planned_amount ?? 0
  const faktisk = budget?.actual_amount ?? 0
  const budsjettProsent = planlagt > 0 ? Math.min(100, Math.round((faktisk / planlagt) * 100)) : 0

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">God dag! 👋</h1>
        <p className="text-sm text-gray-500 mt-1">Uke {weekNumber} · {now.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ukesplan */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Ukens middager</h2>
            <Link href="/planlegger" className="text-sm text-green-600 hover:text-green-700 font-medium">
              Se plan →
            </Link>
          </div>
          <ul className="space-y-2">
            {UKEDAGER.map((dag) => {
              const middag = planMap.get(dag)
              return (
                <li key={dag} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 capitalize w-20">{dag.slice(0, 3)}</span>
                  {middag ? (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-gray-900 truncate">{middag.name}</span>
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${KATEGORI_FARGER[middag.category] ?? 'bg-gray-100 text-gray-700'}`}>
                        {KATEGORI_LABELS[middag.category] ?? middag.category}
                      </span>
                      {middag.is_special_day && <span className="text-amber-500 text-xs">⭐</span>}
                    </div>
                  ) : (
                    <span className="text-gray-400 italic flex-1">Ikke planlagt</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="space-y-4">
          {/* Handleliste */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Handleliste</h2>
              <Link href="/handleliste" className="text-sm text-green-600 hover:text-green-700 font-medium">
                Åpne →
              </Link>
            </div>
            {shoppingList ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{ikkeKjøpt}</p>
                  <p className="text-sm text-gray-500">varer gjenstår</p>
                </div>
                {estimertSum > 0 && (
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900">{formatNok(estimertSum)}</p>
                    <p className="text-sm text-gray-500">estimert</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Ingen aktiv handleliste</p>
            )}
          </div>

          {/* Utløper snart */}
          {pantryExpiring.length > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-amber-900">Utløper snart ⚠️</h2>
                <Link href="/beholdning" className="text-sm text-amber-700 hover:text-amber-800 font-medium">
                  Se beholdning →
                </Link>
              </div>
              <ul className="space-y-1">
                {pantryExpiring.map((item, idx) => {
                  const dager = Math.floor((new Date(item.expiry_date!).getTime() - Date.now()) / 86400000)
                  return (
                    <li key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-amber-900">{item.ingredient?.name}</span>
                      <span className={`text-xs font-medium ${dager < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                        {dager < 0 ? 'Utløpt' : dager === 0 ? 'I dag' : `${dager} dag${dager > 1 ? 'er' : ''}`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Budsjett */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Budsjett denne uken</h2>
              <Link href="/budsjett" className="text-sm text-green-600 hover:text-green-700 font-medium">
                Detaljer →
              </Link>
            </div>
            {planlagt > 0 ? (
              <>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Faktisk: {formatNok(faktisk)}</span>
                  <span>Budsjett: {formatNok(planlagt)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${budsjettProsent > 90 ? 'bg-red-500' : budsjettProsent > 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${budsjettProsent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{budsjettProsent}% brukt</p>
              </>
            ) : (
              <p className="text-sm text-gray-400 italic">Budsjett ikke satt</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
