'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UKEDAGER, KATEGORI_FARGER, KATEGORI_LABELS, formatDatoKort } from '@/lib/utils'
import KategoriBadge from '@/components/ui/KategoriBadge'
import type { RecipeCategory, Weekday } from '@/types/database'
import { setMealPlan, removeMealPlan, updateMealPlanServings } from '@/lib/actions/meal-plans'

type Oppskrift = { id: string; name: string; category: RecipeCategory; avg_rating: number | null }
type DagPlan = {
  id: string
  weekday: Weekday
  is_special_day: boolean
  note: string | null
  servings: number | null
  recipe: { id: string; name: string; category: RecipeCategory; servings: number } | null
}

interface Props {
  thisWeek: number
  thisYear: number
  nextWeek: number
  nextYear: number
  thisPlanMap: Record<string, DagPlan>
  nextPlanMap: Record<string, DagPlan>
  oppskrifter: Oppskrift[]
  defaultSpecialDays: Weekday[]
  fishDaysPerWeek: number
  thisWeekDates: string[]
  nextWeekDates: string[]
  today: string
  defaultServings: number
}

const HELGEKATEGORIER: RecipeCategory[] = ['helgemat', 'søndagsmiddag', 'selskapsmat']
const HVERDAGSKATEGORIER: RecipeCategory[] = ['hverdagsmat', 'fisk', 'vegetar', 'kylling']

export default function PlanleggerKlient({
  thisWeek, thisYear, nextWeek, nextYear,
  thisPlanMap, nextPlanMap,
  oppskrifter, defaultSpecialDays, fishDaysPerWeek,
  thisWeekDates, nextWeekDates, today,
  defaultServings,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [valgt, setValgt] = useState<{ dag: Weekday; week: number; year: number } | null>(null)
  const [autoForeslar, setAutoForeslar] = useState(false)
  const [melding, setMelding] = useState('')

  const [planMaps, setPlanMaps] = useState<Record<string, Record<string, DagPlan>>>({
    [`${thisYear}-${thisWeek}`]: thisPlanMap,
    [`${nextYear}-${nextWeek}`]: nextPlanMap,
  })

  function getPlanMap(week: number, year: number) {
    return planMaps[`${year}-${week}`] ?? {}
  }

  async function velgOppskrift(recipeId: string) {
    if (!valgt) return
    const { dag, week, year } = valgt
    const isSpecial = defaultSpecialDays.includes(dag)

    const recipe = oppskrifter.find(r => r.id === recipeId)
    if (recipe) {
      setPlanMaps(prev => ({
        ...prev,
        [`${year}-${week}`]: {
          ...prev[`${year}-${week}`],
          [dag]: {
            id: prev[`${year}-${week}`]?.[dag]?.id ?? '',
            weekday: dag,
            is_special_day: isSpecial,
            note: null,
            servings: defaultServings,
            recipe: { id: recipe.id, name: recipe.name, category: recipe.category, servings: defaultServings },
          },
        },
      }))
    }

    setValgt(null)
    await setMealPlan({
      weekday: dag, recipe_id: recipeId, week_number: week, year,
      is_special_day: isSpecial, servings: defaultServings,
    })
    startTransition(() => router.refresh())
  }

  async function fjernOppskrift(dagId: string, dag: Weekday, week: number, year: number) {
    setPlanMaps(prev => {
      const copy = { ...prev[`${year}-${week}`] }
      delete copy[dag]
      return { ...prev, [`${year}-${week}`]: copy }
    })
    await removeMealPlan(dagId)
    startTransition(() => router.refresh())
  }

  async function justerPorsjoner(
    planId: string,
    dag: Weekday,
    week: number,
    year: number,
    delta: number,
    currentServings: number | null,
    recipeServings: number
  ) {
    const effective = currentServings ?? defaultServings
    const newServings = Math.max(1, effective + delta)

    setPlanMaps(prev => ({
      ...prev,
      [`${year}-${week}`]: {
        ...prev[`${year}-${week}`],
        [dag]: {
          ...prev[`${year}-${week}`][dag],
          servings: newServings,
        },
      },
    }))

    await updateMealPlanServings(planId, newServings)
  }

  async function autoForslag() {
    setAutoForeslar(true)
    setMelding('')
    try {
      const res = await fetch('/api/ai/suggest-week', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setMelding(data.error ?? 'Feil'); return }
      for (const [dag, recipeId] of Object.entries(data.plan)) {
        if (recipeId) {
          await setMealPlan({
            weekday: dag as Weekday, recipe_id: recipeId as string,
            week_number: thisWeek, year: thisYear,
            is_special_day: defaultSpecialDays.includes(dag as Weekday),
            servings: defaultServings,
          })
        }
      }
      setMelding('Forslag generert!')
      startTransition(() => router.refresh())
    } catch { setMelding('En feil oppstod') }
    finally {
      setAutoForeslar(false)
      setTimeout(() => setMelding(''), 3000)
    }
  }

  function filterOppskrifter(dag: Weekday) {
    const isSpecial = defaultSpecialDays.includes(dag)
    return isSpecial
      ? oppskrifter.filter(r => HELGEKATEGORIER.includes(r.category))
      : oppskrifter.filter(r => HVERDAGSKATEGORIER.includes(r.category))
  }

  function fishCount(week: number, year: number) {
    return Object.values(getPlanMap(week, year)).filter(p => p.recipe?.category === 'fisk').length
  }

  const todayDate = new Date(today)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Ukesplan</h1>
        <div className="flex items-center gap-2">
          {melding && <span className="text-sm text-green-600 font-medium">{melding}</span>}
          <button
            onClick={autoForslag}
            disabled={autoForeslar || isPending}
            className="px-3 py-2 text-sm font-medium bg-purple-100 text-purple-700
              rounded-xl hover:bg-purple-200 transition-colors disabled:opacity-50"
          >
            {autoForeslar ? '✨ …' : '✨ Auto-forslag'}
          </button>
        </div>
      </div>

      {/* Denne uken */}
      <UkeSeksjon
        tittel="Denne uken"
        week={thisWeek}
        year={thisYear}
        planMap={getPlanMap(thisWeek, thisYear)}
        datoer={thisWeekDates}
        todayDate={todayDate}
        defaultSpecialDays={defaultSpecialDays}
        fishCount={fishCount(thisWeek, thisYear)}
        fishDaysPerWeek={fishDaysPerWeek}
        defaultServings={defaultServings}
        onVelg={(dag) => setValgt({ dag, week: thisWeek, year: thisYear })}
        onFjern={(id, dag) => fjernOppskrift(id, dag, thisWeek, thisYear)}
        onJusterPorsjoner={(planId, dag, delta, current, recipeServings) =>
          justerPorsjoner(planId, dag, thisWeek, thisYear, delta, current, recipeServings)
        }
      />

      {/* Neste uke */}
      <UkeSeksjon
        tittel="Neste uke"
        week={nextWeek}
        year={nextYear}
        planMap={getPlanMap(nextWeek, nextYear)}
        datoer={nextWeekDates}
        todayDate={todayDate}
        defaultSpecialDays={defaultSpecialDays}
        fishCount={fishCount(nextWeek, nextYear)}
        fishDaysPerWeek={fishDaysPerWeek}
        defaultServings={defaultServings}
        onVelg={(dag) => setValgt({ dag, week: nextWeek, year: nextYear })}
        onFjern={(id, dag) => fjernOppskrift(id, dag, nextWeek, nextYear)}
        onJusterPorsjoner={(planId, dag, delta, current, recipeServings) =>
          justerPorsjoner(planId, dag, nextWeek, nextYear, delta, current, recipeServings)
        }
      />

      {/* Modal — bottom sheet på mobil */}
      {valgt && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
          onClick={() => setValgt(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md
              max-h-[85vh] sm:max-h-[70vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 capitalize">
                Velg for {valgt.dag}
              </h2>
              <button onClick={() => setValgt(null)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-70px)] p-3 space-y-1">
              {filterOppskrifter(valgt.dag).length === 0 && (
                <p className="text-sm text-gray-400 italic px-3 py-4 text-center">
                  Ingen {defaultSpecialDays.includes(valgt.dag) ? 'helge' : 'hverdags'}oppskrifter ennå
                </p>
              )}
              {filterOppskrifter(valgt.dag).map(r => (
                <button
                  key={r.id}
                  onClick={() => velgOppskrift(r.id)}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl
                    text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">{r.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.avg_rating != null && (
                      <span className="text-xs text-amber-500">{'★'.repeat(Math.round(r.avg_rating))}</span>
                    )}
                    <KategoriBadge category={r.category} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Uke-seksjon ──────────────────────────────────────────────

function UkeSeksjon({
  tittel, week, year, planMap, datoer, todayDate,
  defaultSpecialDays, fishCount, fishDaysPerWeek,
  defaultServings, onVelg, onFjern, onJusterPorsjoner,
}: {
  tittel: string
  week: number
  year: number
  planMap: Record<string, DagPlan>
  datoer: string[]
  todayDate: Date
  defaultSpecialDays: Weekday[]
  fishCount: number
  fishDaysPerWeek: number
  defaultServings: number
  onVelg: (dag: Weekday) => void
  onFjern: (id: string, dag: Weekday) => void
  onJusterPorsjoner: (planId: string, dag: Weekday, delta: number, current: number | null, recipeServings: number) => void
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2 px-1">
        <h2 className="font-semibold text-gray-900">{tittel}</h2>
        <span className="text-sm text-gray-400">uke {week}</span>
        <span className="ml-auto text-xs text-gray-400">
          🐟 {fishCount}/{fishDaysPerWeek}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {UKEDAGER.map((dag, i) => {
          const plan = planMap[dag]
          const dato = new Date(datoer[i])
          const erIDag = dato.toDateString() === todayDate.toDateString()
          const isSpecial = defaultSpecialDays.includes(dag)
          const effectiveServings = plan?.servings ?? defaultServings
          const isNonStandard = plan?.recipe != null && effectiveServings !== plan.recipe.servings

          return (
            <div
              key={dag}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''}
                ${erIDag ? 'bg-green-50' : isSpecial ? 'bg-amber-50/50' : ''}`}
            >
              {/* Dato */}
              <div className="w-24 shrink-0">
                <p className={`text-sm font-semibold capitalize ${erIDag ? 'text-green-700' : isSpecial ? 'text-amber-700' : 'text-gray-700'}`}>
                  {dag.slice(0, 3)}{erIDag && ' •'}
                </p>
                <p className="text-xs text-gray-400">{formatDatoKort(dato)}</p>
              </div>

              {/* Middag + porsjoner */}
              <div className="flex-1 min-w-0">
                {plan?.recipe ? (
                  <>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {plan.recipe.name}
                      </span>
                      <KategoriBadge category={plan.recipe.category} className="hidden sm:inline-flex" />
                      {plan.recipe.category === 'fisk' && <span className="text-sm">🐟</span>}
                      {plan.recipe.category === 'vegetar' && <span className="text-sm">🥦</span>}
                      {isSpecial && <span className="text-sm">⭐</span>}
                    </div>
                    {/* Porsjonsvelger */}
                    {plan.id && (
                      <div className="flex items-center gap-0.5 mt-1">
                        <button
                          onClick={() => onJusterPorsjoner(plan.id, dag, -1, plan.servings, plan.recipe!.servings)}
                          className="w-5 h-5 flex items-center justify-center rounded-full
                            bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold
                            leading-none transition-colors"
                          aria-label="Færre porsjoner"
                        >−</button>
                        <span className={`text-xs px-1 tabular-nums ${isNonStandard ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                          👥 {effectiveServings}
                        </span>
                        <button
                          onClick={() => onJusterPorsjoner(plan.id, dag, +1, plan.servings, plan.recipe!.servings)}
                          className="w-5 h-5 flex items-center justify-center rounded-full
                            bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold
                            leading-none transition-colors"
                          aria-label="Flere porsjoner"
                        >+</button>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-gray-400 italic">Ikke planlagt</span>
                )}
              </div>

              {/* Handlinger */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onVelg(dag)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700
                    hover:bg-green-100 active:bg-green-200 transition-colors border border-green-200"
                >
                  {plan?.recipe ? 'Bytt' : '+ Legg til'}
                </button>
                {plan?.id && (
                  <button
                    onClick={() => onFjern(plan.id, dag)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400
                      hover:text-red-500 hover:bg-red-50 transition-colors text-sm"
                    aria-label="Fjern"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
