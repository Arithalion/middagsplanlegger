'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { deleteRecipe } from '@/lib/actions/recipes'
import KategoriBadge from '@/components/ui/KategoriBadge'
import StjerneRating from '@/components/ui/StjerneRating'
import { createClient } from '@/lib/supabase/client'
import type { RecipeCategory, Unit } from '@/types/database'

type Ingrediens = { id: string; amount: number; unit: Unit; note: string | null; ingredient: { id: string; name: string } }
type Rating = { id: string; score: number; rated_at: string; member: { id: string; name: string } | null }

interface Props {
  recipe: { id: string; name: string; description: string | null; category: RecipeCategory; servings: number; prep_time_minutes: number | null; source_url: string | null }
  ingredients: Ingrediens[]
  ratings: Rating[]
  avgRating: number | null
  currentMemberId: string | null
}

export default function OppskriftDetalj({ recipe, ingredients, ratings, avgRating, currentMemberId }: Props) {
  const router = useRouter()
  const [minRating, setMinRating] = useState<number>(
    ratings.find((r) => r.member?.id === currentMemberId)?.score ?? 0
  )
  const [lagrerRating, setLagrerRating] = useState(false)

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

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Tilbake
        </button>
        <Link
          href={`/oppskrifter/${recipe.id}/rediger`}
          className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50
            border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
        >
          ✏️ Rediger
        </Link>
      </div>

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

      <div className="flex justify-end">
        <button
          onClick={slettOppskrift}
          className="text-sm text-red-500 hover:text-red-700 font-medium"
        >
          Slett oppskrift
        </button>
      </div>
    </div>
  )
}
