'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UKEDAGER, KATEGORI_FARGER, KATEGORI_LABELS, formatNok } from '@/lib/utils'
import KategoriBadge from '@/components/ui/KategoriBadge'
import type { RecipeCategory, Weekday } from '@/types/database'
import { setMealPlan, removeMealPlan } from '@/lib/actions/meal-plans'

type Oppskrift = { id: string; name: string; category: RecipeCategory; avg_rating: number | null }

type DagPlan = {
  id: string
  weekday: Weekday
  is_special_day: boolean
  note: string | null
  recipe: { id: string; name: string; category: RecipeCategory } | null
}

interface Props {
  weekNumber: number
  year: number
  planMap: Record<string, DagPlan>
  oppskrifter: Oppskrift[]
  defaultSpecialDays: Weekday[]
  fishDaysPerWeek: number
  ukedatoer: string[]
}

const HELGEKATEGORIER: RecipeCategory[] = ['helgemat', 'søndagsmiddag', 'selskapsmat']
const HVERDAGSKATEGORIER: RecipeCategory[] = ['hverdagsmat', 'fisk', 'vegetar', 'kylling']

export default function PlanleggerKlient({
  weekNumber, year, planMap, oppskrifter, defaultSpecialDays, fishDaysPerWeek, ukedatoer,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [valgtDag, setValgtDag] = useState<Weekday | null>(null)
  const [autoForeslar, setAutoForeslar] = useState(false)
  const [melding, setMelding] = useState('')

  function navigerUke(delta: number) {
    const neste = weekNumber + delta
    router.push(`/planlegger?uke=${neste}&år=${year}`)
  }

  function åpneModal(dag: Weekday) {
    setValgtDag(dag)
  }

  function lukkModal() {
    setValgtDag(null)
  }

  async function velgOppskrift(recipeId: string) {
    if (!valgtDag) return
    const dag = UKEDAGER.indexOf(valgtDag)
    const isSpecial = defaultSpecialDays.includes(valgtDag)
    await setMealPlan({ weekday: valgtDag, recipe_id: recipeId, week_number: weekNumber, year, is_special_day: isSpecial })
    setValgtDag(null)
    startTransition(() => router.refresh())
  }

  async function fjernOppskrift(dagId: string) {
    await removeMealPlan(dagId)
    startTransition(() => router.refresh())
  }

  async function autoForslag() {
    setAutoForeslar(true)
    setMelding('')
    try {
      const res = await fetch('/api/ai/suggest-week', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setMelding(data.error ?? 'Klarte ikke generere forslag'); return }

      for (const [dag, recipeId] of Object.entries(data.plan)) {
        if (recipeId) {
          await setMealPlan({
            weekday: dag as Weekday,
            recipe_id: recipeId as string,
            week_number: weekNumber,
            year,
            is_special_day: defaultSpecialDays.includes(dag as Weekday),
          })
        }
      }
      setMelding('Ukesforslag generert!')
      startTransition(() => router.refresh())
    } catch {
      setMelding('En feil oppstod')
    } finally {
      setAutoForeslar(false)
      setTimeout(() => setMelding(''), 3000)
    }
  }

  const fishCount = UKEDAGER.filter((d) => planMap[d]?.recipe?.category === 'fisk').length

  const filterOppskrifter = (dag: Weekday) => {
    const isSpecial = defaultSpecialDays.includes(dag)
    if (isSpecial) return oppskrifter.filter((r) => HELGEKATEGORIER.includes(r.category))
    return oppskrifter.filter((r) => HVERDAGSKATEGORIER.includes(r.category))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ukesplan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Uke {weekNumber} · {year} · 🐟 {fishCount}/{fishDaysPerWeek} fiskedager
          </p>
        </div>
        <div className="flex items-center gap-2">
          {melding && (
            <span className="text-sm text-green-600 font-medium">{melding}</span>
          )}
          <button
            onClick={autoForslag}
            disabled={autoForeslar || isPending}
            className="px-3 py-2 text-sm font-medium bg-purple-100 text-purple-700
              rounded-lg hover:bg-purple-200 transition-colors disabled:opacity-50"
          >
            {autoForeslar ? '✨ Genererer…' : '✨ Auto-forslag'}
          </button>
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => navigerUke(-1)}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ←
            </button>
            <span className="px-3 text-sm font-medium">Uke {weekNumber}</span>
            <button
              onClick={() => navigerUke(1)}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Kalendervisning */}
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {UKEDAGER.map((dag, i) => {
          const plan = planMap[dag]
          const isSpecial = defaultSpecialDays.includes(dag)
          const dato = new Date(ukedatoer[i])
          const erIDag = dato.toDateString() === new Date().toDateString()

          return (
            <div
              key={dag}
              className={`rounded-xl border p-3 min-h-32 flex flex-col ${
                isSpecial
                  ? 'bg-amber-50 border-amber-200'
                  : erIDag
                  ? 'bg-green-50 border-green-300'
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Dag-header */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${erIDag ? 'text-green-700' : 'text-gray-500'}`}>
                    {dag.slice(0, 3)}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {dato.getDate()}/{dato.getMonth() + 1}
                  </p>
                </div>
                {isSpecial && <span className="text-xs text-amber-600 font-medium">⭐</span>}
              </div>

              {/* Innhold */}
              <div className="flex-1">
                {plan?.recipe ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-900 leading-snug mb-1">
                      {plan.recipe.name}
                    </p>
                    <KategoriBadge category={plan.recipe.category} className="text-xs" />
                    <div className="flex gap-1 mt-1 text-xs">
                      {plan.recipe.category === 'fisk' && <span>🐟</span>}
                      {plan.recipe.category === 'vegetar' && <span>🥦</span>}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Ikke planlagt</p>
                )}
              </div>

              {/* Handlinger */}
              <div className="flex gap-1 mt-2">
                <button
                  onClick={() => åpneModal(dag)}
                  className="flex-1 text-xs py-1 rounded-md bg-green-600 text-white
                    hover:bg-green-700 transition-colors"
                >
                  {plan?.recipe ? 'Bytt' : '+ Legg til'}
                </button>
                {plan?.id && (
                  <button
                    onClick={() => fjernOppskrift(plan.id)}
                    className="px-2 text-xs rounded-md text-red-400 hover:bg-red-50 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal for oppskriftsvalg */}
      {valgtDag && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={lukkModal}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[70vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 capitalize">Velg oppskrift for {valgtDag}</h2>
              <button onClick={lukkModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="overflow-y-auto max-h-[calc(70vh-64px)] p-3 space-y-1">
              {filterOppskrifter(valgtDag).map((r) => (
                <button
                  key={r.id}
                  onClick={() => velgOppskrift(r.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                    text-left hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-sm font-medium text-gray-900 group-hover:text-green-700">
                    {r.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {r.avg_rating != null && (
                      <span className="text-xs text-amber-500">{'★'.repeat(Math.round(r.avg_rating))}</span>
                    )}
                    <KategoriBadge category={r.category} />
                  </div>
                </button>
              ))}
              {filterOppskrifter(valgtDag).length === 0 && (
                <p className="text-sm text-gray-400 italic px-3 py-2">
                  Ingen {defaultSpecialDays.includes(valgtDag) ? 'helge' : 'hverdags'}oppskrifter lagt til ennå
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
