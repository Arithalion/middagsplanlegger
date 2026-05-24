import { SupabaseClient } from '@supabase/supabase-js'
import { getWeekNumber } from '@/lib/utils'

// ─── Interne typer ───────────────────────────────────────────────────────────

type RawMealPlan = {
  servings: number | null
  recipe: {
    servings: number
    recipe_ingredients: { amount: number; unit: string; ingredient_id: string }[]
  } | null
}

type KassalLink = {
  ingredient_id: string
  package_size: number
  package_unit: string
  price_per_package: number | null
}

// ─── Eksporterte typer ───────────────────────────────────────────────────────

export type ShoppingItem = {
  ingredient_id: string
  amount: number
  unit: string
  packages_needed: number | null
  estimated_price: number | null
}

export type PeriodDay = {
  date: Date
  weekday: string
  weekNumber: number
  year: number
}

export type HandlePeriode = {
  fromDate: Date
  toDate: Date
  /** Norsk kort-label, f.eks. «lør 14. jun → fre 20. jun» */
  label: string
  days: PeriodDay[]
}

// ─── Hjelpefunksjoner ────────────────────────────────────────────────────────

const UKEDAGER_NORM = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag'] as const

function ukedagTilIndeks(weekday: string): number {
  return UKEDAGER_NORM.indexOf(weekday.toLowerCase() as (typeof UKEDAGER_NORM)[number])
}

/** JS Date.getDay() (0=søn) → UKEDAGER-indeks (0=man, 6=søn) */
function jsDagTilIndeks(jsDay: number): number {
  return (jsDay + 6) % 7
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

// ─── beregnHandleperiode ─────────────────────────────────────────────────────

/**
 * Beregner neste handleperiode basert på handledager og om man handler
 * etter middag (dvs. er ikke klar til å bruke varene samme dag).
 *
 * - shopping_after_dinner=false: handler i dag er mulig → fromDate = i dag hvis
 *   i dag er handledag, ellers neste handledag
 * - shopping_after_dinner=true: varene brukes fra neste dag → fromDate = neste
 *   handledag etter i dag (aldri i dag selv)
 *
 * Perioden varer fra fromDate til dagen FØR neste handledag etter fromDate.
 */
export function beregnHandleperiode(
  shoppingDays: string[],
  shoppingAfterDinner: boolean,
  now: Date = new Date(),
): HandlePeriode | null {
  if (shoppingDays.length === 0) return null

  const shoppingIndices = shoppingDays
    .map(ukedagTilIndeks)
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)

  if (shoppingIndices.length === 0) return null

  const todayIdx = jsDagTilIndeks(now.getDay())

  // Finn dager til neste handledag
  let daysUntilNext = 8
  for (const idx of shoppingIndices) {
    let delta = idx - todayIdx
    if (delta < 0) delta += 7
    // Hopp over i dag om man handler etter middag
    if (delta === 0 && shoppingAfterDinner) delta = 7
    if (delta < daysUntilNext) daysUntilNext = delta
  }

  const fromDate = addDays(now, daysUntilNext)
  const fromDayIdx = jsDagTilIndeks(fromDate.getDay())

  // Finn dager fra fromDate til neste handledag (strengt fremover)
  let daysUntilFollowing = 8
  for (const idx of shoppingIndices) {
    let delta = idx - fromDayIdx
    if (delta <= 0) delta += 7
    if (delta < daysUntilFollowing) daysUntilFollowing = delta
  }

  const toDate = addDays(fromDate, daysUntilFollowing - 1)

  // Bygg dagsliste
  const days: PeriodDay[] = []
  const cur = new Date(fromDate)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(toDate)
  end.setHours(23, 59, 59, 999)

  while (cur <= end) {
    const dayIdx = jsDagTilIndeks(cur.getDay())
    days.push({
      date: new Date(cur),
      weekday: UKEDAGER_NORM[dayIdx],
      weekNumber: getWeekNumber(cur),
      year: cur.getFullYear(),
    })
    cur.setDate(cur.getDate() + 1)
  }

  const formatShort = (d: Date) => {
    const idx = jsDagTilIndeks(d.getDay())
    const weekday = UKEDAGER_NORM[idx].slice(0, 4)
    return `${weekday} ${d.getDate()}. ${d.toLocaleDateString('nb-NO', { month: 'short' })}`
  }

  return {
    fromDate,
    toDate,
    label: `${formatShort(fromDate)} → ${formatShort(toDate)}`,
    days,
  }
}

// ─── beregnHandleliste ───────────────────────────────────────────────────────

/**
 * Beregner handleliste-varer basert på ukesplan, beholdning og Kassal-koblinger.
 *
 * Kan kalles med enten:
 *   - beregnHandleliste(supabase, weekNumber, year)   ← eksisterende oppførsel
 *   - beregnHandleliste(supabase, days)               ← periode-basert (ny)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function beregnHandleliste(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  weekNumberOrDays?: number | PeriodDay[],
  year?: number,
): Promise<ShoppingItem[]> {
  const now = new Date()

  // ── Hent ukesplan ──────────────────────────────────────────────────────────
  let mealPlans: RawMealPlan[]

  if (Array.isArray(weekNumberOrDays)) {
    // Periode-basert: grupper etter uke+år og hent parallelt
    const byWeek = new Map<string, { wk: number; yr: number; weekdays: string[] }>()
    for (const day of weekNumberOrDays) {
      const key = `${day.year}-${day.weekNumber}`
      if (!byWeek.has(key)) byWeek.set(key, { wk: day.weekNumber, yr: day.year, weekdays: [] })
      byWeek.get(key)!.weekdays.push(day.weekday)
    }

    const results = await Promise.all(
      Array.from(byWeek.values()).map(({ wk, yr, weekdays }) =>
        supabase
          .from('meal_plans')
          .select(`
            servings,
            recipe:recipes(
              servings,
              recipe_ingredients(amount, unit, ingredient_id)
            )
          `)
          .eq('week_number', wk)
          .eq('year', yr)
          .in('weekday', weekdays),
      ),
    )
    mealPlans = results.flatMap((r) => (r.data ?? []) as unknown as RawMealPlan[])
  } else {
    // Uke-basert (eksisterende)
    const wk = weekNumberOrDays ?? getWeekNumber(now)
    const yr = year ?? now.getFullYear()

    const { data } = await supabase
      .from('meal_plans')
      .select(`
        servings,
        recipe:recipes(
          servings,
          recipe_ingredients(amount, unit, ingredient_id)
        )
      `)
      .eq('week_number', wk)
      .eq('year', yr)

    mealPlans = (data ?? []) as unknown as RawMealPlan[]
  }

  // ── Hent beholdning + Kassal-koblinger parallelt ───────────────────────────
  const [{ data: rawPantry }, { data: rawLinks }] = await Promise.all([
    supabase.from('pantry_items').select('ingredient_id, amount'),
    supabase
      .from('household_ingredient_products')
      .select('ingredient_id, package_size, package_unit, price_per_package'),
  ])

  const pantry = rawPantry ?? []
  const links = (rawLinks ?? []) as unknown as KassalLink[]

  const linkMap = new Map(links.map((l) => [l.ingredient_id, l]))
  const pantryMap = new Map<string, number>(
    pantry.map((p: { ingredient_id: string; amount: number }) => [p.ingredient_id, p.amount]),
  )

  // ── Summer ingrediensbehov — skaler etter porsjonsoverstyring ─────────────
  const needed = new Map<string, { amount: number; unit: string }>()
  for (const plan of mealPlans) {
    if (!plan.recipe) continue
    const scale =
      plan.servings != null && plan.recipe.servings > 0
        ? plan.servings / plan.recipe.servings
        : 1

    for (const ri of plan.recipe.recipe_ingredients ?? []) {
      const scaled = ri.amount * scale
      const existing = needed.get(ri.ingredient_id)
      if (existing) {
        existing.amount += scaled
      } else {
        needed.set(ri.ingredient_id, { amount: scaled, unit: ri.unit })
      }
    }
  }

  // ── Trekk fra beholdning + beregn pakker ──────────────────────────────────
  const shoppingItems: ShoppingItem[] = []
  for (const [ingredientId, { amount, unit }] of needed) {
    const inPantry = pantryMap.get(ingredientId) ?? 0
    const diff = amount - inPantry
    if (diff <= 0) continue

    const link = linkMap.get(ingredientId)
    if (link && link.package_size > 0) {
      const packages = Math.ceil(diff / link.package_size)
      const estimated =
        link.price_per_package != null ? packages * link.price_per_package : null
      shoppingItems.push({
        ingredient_id: ingredientId,
        amount: packages * link.package_size,
        unit: link.package_unit,
        packages_needed: packages,
        estimated_price: estimated,
      })
    } else {
      shoppingItems.push({
        ingredient_id: ingredientId,
        amount: diff,
        unit,
        packages_needed: null,
        estimated_price: null,
      })
    }
  }

  return shoppingItems
}
