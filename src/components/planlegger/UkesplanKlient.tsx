'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Recipe, Weekday, HouseholdSettings, RecipeCategory } from '@/types/database'
import { setMealPlan } from '@/lib/actions/meal-plans'
import KategoriBadge from '@/components/ui/KategoriBadge'
import Knapp from '@/components/ui/Knapp'
import { UKEDAGER, formatNok } from '@/lib/utils'

interface PlanEntry {
  id: string
  weekday: Weekday
  recipe_id: string | null
  is_special_day: boolean
  note: string | null
  recipe: { id: string; name: string; category: RecipeCategory } | null
}

interface Props {
  ukesplan: PlanEntry[]
  alleOppskrifter: Pick<Recipe, 'id' | 'name' | 'category' | 'prep_time_minutes'>[]
  uke: number
  ar: number
  innstillinger: HouseholdSettings | null
}

function datoForUkedag(uke: number, ar: number, dagIndex: number): Date {
  // ISO week: monday = dag 0
  const jan4 = new Date(ar, 0, 4)
  const dow = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - (dow - 1) + (uke - 1) * 7)
  monday.setDate(monday.getDate() + dagIndex)
  return monday
}

function formaterDato(d: Date): string {
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

function forrigeUke(uke: number, ar: number) {
  if (uke === 1) return { uke: 52, ar: ar - 1 }
  return { uke: uke - 1, ar }
}

function nesteUke(uke: number, ar: number) {
  if (uke === 52) return { uke: 1, ar: ar + 1 }
  return { uke: uke + 1, ar }
}

export default function UkesplanKlient({ ukesplan, alleOppskrifter, uke, ar, innstillinger }: Props) {
  const router = useRouter()
  const [modalDag, setModalDag] = useState<Weekday | null>(null)
  const [aiLaster, setAiLaster] = useState(false)
  const [aiMelding, setAiMelding] = useState('')
  const [isPending, startTransition] = useTransition()
  const [søkModal, setSøkModal] = useState('')

  const planMap = new Map<Weekday, PlanEntry>()
  for (const entry of ukesplan) {
    planMap.set(entry.weekday, entry)
  }

  const spesialdager = innstillinger?.special_days ?? ['fredag', 'lørdag']

  const estimertKostnad = ukesplan.reduce(() => 0, 0)

  function navigate(u: number, a: number) {
    router.push(`/planlegger?uke=${u}&ar=${a}`)
  }

  async function velgOppskrift(weekday: Weekday, recipeId: string | null) {
    startTransition(async () => {
      await setMealPlan({
        weekday,
        week_number: uke,
        year: ar,
        recipe_id: recipeId,
        is_special_day: spesialdager.includes(weekday),
      })
    })
    setModalDag(null)
    setSøkModal('')
  }

  async function autoForslag() {
    setAiLaster(true)
    setAiMelding('')
    try {
      const res = await fetch('/api/ai/suggest-week', { method: 'POST' })
      const data = await res.json()
      if (data.plan) {
        for (const [day, recipeId] of Object.entries(data.plan)) {
          await setMealPlan({
            weekday: day as Weekday,
            week_number: uke,
            year: ar,
            recipe_id: recipeId as string | null,
            is_special_day: spesialdager.includes(day as Weekday),
          })
        }
        router.refresh()
      }
      setAiMelding(data.message ?? 'Forslag generert!')
    } catch {
      setAiMelding('Noe gikk galt. Prøv igjen.')
    } finally {
      setAiLaster(false)
    }
  }

  const forrige = forrigeUke(uke, ar)
  const neste = nesteUke(uke, ar)

  const filtrerteOppskrifter = alleOppskrifter.filter((r) =>
    r.name.toLowerCase().includes(søkModal.toLowerCase())
  )

  return (
    <div>
      {/* Uke-navigasjon */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(forrige.uke, forrige.ar)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          ← Forrige uke
        </button>
        <div className="text-center">
          <span className="font-semibold text-gray-900">Uke {uke}</span>
          <span className="text-gray-500 text-sm ml-1">({ar})</span>
        </div>
        <button
          onClick={() => navigate(neste.uke, neste.ar)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Neste uke →
        </button>
      </div>

      {/* AI-forslag + melding */}
      <div className="flex items-center gap-3 mb-6">
        <Knapp variant="sekundær" onClick={autoForslag} laster={aiLaster}>
          ✨ Auto-forslag
        </Knapp>
        {aiMelding && (
          <span className="text-sm text-green-700 font-medium">✓ {aiMelding}</span>
        )}
      </div>

      {/* 7-dagers kalender */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 mb-6">
        {UKEDAGER.map((dag, i) => {
          const entry = planMap.get(dag)
          const dato = datoForUkedag(uke, ar, i)
          const erSpesialdag = spesialdager.includes(dag)

          return (
            <div
              key={dag}
              className={`rounded-xl border p-3 flex flex-col gap-2 min-h-[130px] ${
                erSpesialdag
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Dag-header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-700 capitalize">{dag}</span>
                  <span className="text-xs text-gray-400 ml-1">{formaterDato(dato)}</span>
                </div>
                {erSpesialdag && (
                  <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                    ⭐ Spesial
                  </span>
                )}
              </div>

              {/* Oppskrift */}
              {entry?.recipe ? (
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 leading-tight mb-1">
                    {entry.recipe.name}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <KategoriBadge category={entry.recipe.category} />
                    {entry.recipe.category === 'fisk' && <span title="Fisk">🐟</span>}
                    {entry.recipe.category === 'vegetar' && <span title="Vegetar">🥦</span>}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center">
                  <span className="text-xs text-gray-400 italic">Ikke planlagt</span>
                </div>
              )}

              {/* Bytt-knapp */}
              <button
                onClick={() => { setModalDag(dag); setSøkModal('') }}
                disabled={isPending}
                className="text-xs text-green-600 hover:text-green-800 font-medium text-left transition-colors"
              >
                {entry?.recipe ? '↺ Bytt oppskrift' : '+ Velg oppskrift'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Estimert kostnad */}
      <div className="text-sm text-gray-500 text-right">
        Estimert ukeskostnad:{' '}
        <span className="font-semibold text-gray-800">
          {estimertKostnad > 0 ? formatNok(estimertKostnad) : 'Ikke beregnet'}
        </span>
      </div>

      {/* Modal: velg oppskrift */}
      {modalDag && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setModalDag(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 capitalize mb-3">
                Velg oppskrift — {modalDag}
              </h3>
              <input
                type="search"
                placeholder="Søk..."
                value={søkModal}
                onChange={(e) => setSøkModal(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="overflow-y-auto flex-1 p-2">
              {/* Fjern oppskrift */}
              <button
                onClick={() => velgOppskrift(modalDag, null)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                🗑 Fjern oppskrift denne dagen
              </button>

              {filtrerteOppskrifter.map((r) => (
                <button
                  key={r.id}
                  onClick={() => velgOppskrift(modalDag, r.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-gray-900">{r.name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.prep_time_minutes && (
                      <span className="text-xs text-gray-400">⏱ {r.prep_time_minutes}m</span>
                    )}
                    <KategoriBadge category={r.category} />
                  </div>
                </button>
              ))}

              {filtrerteOppskrifter.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-6">Ingen oppskrifter funnet</p>
              )}
            </div>

            <div className="p-3 border-t border-gray-100">
              <Knapp variant="sekundær" className="w-full" onClick={() => setModalDag(null)}>
                Avbryt
              </Knapp>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
