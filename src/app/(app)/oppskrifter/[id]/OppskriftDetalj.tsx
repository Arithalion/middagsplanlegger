'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  deleteRecipe,
  shareRecipe,
  unshareRecipe,
  addToCollection,
  removeFromCollection,
  forkRecipe,
  reportRecipe,
} from '@/lib/actions/recipes'
import KategoriBadge from '@/components/ui/KategoriBadge'
import StjerneRating from '@/components/ui/StjerneRating'
import { createClient } from '@/lib/supabase/client'
import type { RecipeCategory, Unit } from '@/types/database'

type Ingrediens = { id: string; amount: number; unit: Unit; note: string | null; ingredient: { id: string; name: string } }
type Rating = { id: string; score: number; rated_at: string; member: { id: string; name: string } | null }

interface Props {
  recipe: {
    id: string
    name: string
    description: string | null
    category: RecipeCategory
    servings: number
    prep_time_minutes: number | null
    source_url: string | null
    is_public: boolean
  }
  ingredients: Ingrediens[]
  ratings: Rating[]
  avgRating: number | null
  currentMemberId: string | null
  erEgen: boolean
  erISamlingen: boolean
}

export default function OppskriftDetalj({
  recipe,
  ingredients,
  ratings,
  avgRating,
  currentMemberId,
  erEgen,
  erISamlingen,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [minRating, setMinRating] = useState<number>(
    ratings.find((r) => r.member?.id === currentMemberId)?.score ?? 0
  )
  const [lagrerRating, setLagrerRating] = useState(false)
  const [erDelt, setErDelt] = useState(recipe.is_public)
  const [iSamlingen, setISamlingen] = useState(erISamlingen)
  const [visDeltStatus, setVisDeltStatus] = useState('')
  const [visRapportForm, setVisRapportForm] = useState(false)
  const [rapportTekst, setRapportTekst] = useState('')
  const [rapportSendt, setRapportSendt] = useState(false)

  async function håndterRating(score: number) {
    if (!currentMemberId) return
    setMinRating(score)
    setLagrerRating(true)
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('recipe_ratings').upsert(
      { recipe_id: recipe.id, member_id: currentMemberId, score },
      { onConflict: 'recipe_id,member_id' }
    )
    setLagrerRating(false)
  }

  async function slettOppskrift() {
    if (!confirm(`Slett «${recipe.name}»? Dette kan ikke angres.`)) return
    await deleteRecipe(recipe.id)
  }

  async function toggleDel() {
    startTransition(async () => {
      if (erDelt) {
        await unshareRecipe(recipe.id)
        setErDelt(false)
        setVisDeltStatus('Oppskriften er nå privat.')
      } else {
        await shareRecipe(recipe.id)
        setErDelt(true)
        setVisDeltStatus('Oppskriften er nå delt offentlig.')
      }
      setTimeout(() => setVisDeltStatus(''), 3000)
    })
  }

  async function håndterLeggTil() {
    startTransition(async () => {
      await addToCollection(recipe.id)
      setISamlingen(true)
    })
  }

  async function håndterFjernFraSamling() {
    if (!confirm('Fjern denne oppskriften fra din samling?')) return
    startTransition(async () => {
      await removeFromCollection(recipe.id)
      setISamlingen(false)
      router.push('/oppskrifter')
    })
  }

  async function håndterFork() {
    if (!confirm(`Lag din egen kopi av «${recipe.name}»?`)) return
    startTransition(async () => {
      await forkRecipe(recipe.id)
    })
  }

  async function sendRapport(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await reportRecipe(recipe.id, rapportTekst)
      setRapportSendt(true)
      setVisRapportForm(false)
    })
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Topp-navigasjon */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Tilbake
        </button>
        {erEgen && (
          <Link
            href={`/oppskrifter/${recipe.id}/rediger`}
            className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50
              border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
          >
            ✏️ Rediger
          </Link>
        )}
      </div>

      {/* Oppskrift-header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{recipe.name}</h1>
          <KategoriBadge category={recipe.category} />
        </div>
        {recipe.description && (
          <p className="text-gray-600 text-sm mb-4">{recipe.description}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          {recipe.prep_time_minutes && <span>⏱ {recipe.prep_time_minutes} min</span>}
          <span>👥 {recipe.servings} porsjoner</span>
          <div className="flex items-center gap-1">
            <StjerneRating score={avgRating} size="sm" />
            {ratings.length > 0 && <span className="text-xs">({ratings.length})</span>}
          </div>
        </div>
        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer"
            className="text-sm text-green-600 hover:text-green-700 underline">
            Se originaloppskrift →
          </a>
        )}

        {/* Del-toggle (kun egne) */}
        {erEgen && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {erDelt ? '🌍 Delt offentlig' : '🔒 Privat'}
              </span>
              <button
                onClick={toggleDel}
                disabled={isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  focus:outline-none disabled:opacity-60 ${erDelt ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                    ${erDelt ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
            {visDeltStatus && (
              <p className="text-xs text-gray-500 mt-1">{visDeltStatus}</p>
            )}
          </div>
        )}

        {/* Andres oppskrifter: legg til / fjern / fork */}
        {!erEgen && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
            {!iSamlingen ? (
              <button
                onClick={håndterLeggTil}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                  bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                + Legg til i min samling
              </button>
            ) : (
              <button
                onClick={håndterFjernFraSamling}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                  bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-60 transition-colors"
              >
                📌 I din samling — fjern
              </button>
            )}
            <button
              onClick={håndterFork}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                bg-green-50 text-green-700 border border-green-200 rounded-lg
                hover:bg-green-100 disabled:opacity-60 transition-colors"
            >
              🍴 Lag min versjon
            </button>
          </div>
        )}
      </div>

      {/* Ingredienser */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Ingredienser</h2>
        {ingredients.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Ingen ingredienser lagt til</p>
        ) : (
          <ul className="space-y-2">
            {ingredients.map((ing) => (
              <li key={ing.id} className="flex items-baseline gap-2 text-sm">
                <span className="text-gray-900 font-medium min-w-0">{ing.ingredient.name}</span>
                <span className="text-gray-500 shrink-0">{ing.amount} {ing.unit}</span>
                {ing.note && <span className="text-gray-400 italic">({ing.note})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Ratinger */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Vurderinger</h2>
        <ul className="space-y-2 mb-4">
          {ratings.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{r.member?.name ?? 'Ukjent'}</span>
              <StjerneRating score={r.score} size="sm" />
            </li>
          ))}
        </ul>
        {currentMemberId && (
          <div>
            <p className="text-sm text-gray-500 mb-2">Din vurdering:</p>
            <div className="flex items-center gap-2">
              <StjerneRating score={minRating} onRate={håndterRating} />
              {lagrerRating && <span className="text-xs text-gray-400">Lagrer…</span>}
            </div>
          </div>
        )}
      </div>

      {/* Bunn: slett (egne) eller rapporter (andres) */}
      <div className="flex items-center justify-between">
        {erEgen ? (
          <button
            onClick={slettOppskrift}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            Slett oppskrift
          </button>
        ) : (
          <div>
            {!rapportSendt && !visRapportForm && (
              <button
                onClick={() => setVisRapportForm(true)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ⚑ Rapporter denne oppskriften
              </button>
            )}
            {visRapportForm && (
              <form onSubmit={sendRapport} className="mt-2">
                <textarea
                  value={rapportTekst}
                  onChange={(e) => setRapportTekst(e.target.value)}
                  placeholder="Hva er problemet? (valgfritt)"
                  rows={2}
                  className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2
                    focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg
                      hover:bg-red-600 disabled:opacity-60"
                  >
                    Send rapport
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisRapportForm(false)}
                    className="text-xs px-3 py-1.5 text-gray-500 hover:text-gray-700"
                  >
                    Avbryt
                  </button>
                </div>
              </form>
            )}
            {rapportSendt && (
              <p className="text-xs text-gray-500">Takk — rapporten er sendt.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
