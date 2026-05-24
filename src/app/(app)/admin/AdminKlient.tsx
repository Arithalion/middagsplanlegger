'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { adminDeleteRecipe } from '@/lib/actions/recipes'

type Rapport = {
  id: string
  reason: string | null
  reported_at: string
  fraHusstand: string
}

type RapportertOppskrift = {
  recipeId: string
  recipeName: string
  isPublic: boolean
  rapporter: Rapport[]
}

export default function AdminKlient({ oppskrifter }: { oppskrifter: RapportertOppskrift[] }) {
  const [isPending, startTransition] = useTransition()
  const [slettedeIds, setSlettedeIds] = useState<Set<string>>(new Set())

  function slettOppskrift(id: string, navn: string) {
    if (!confirm(`Slett «${navn}» globalt? Dette fjerner oppskriften for alle og kan ikke angres.`)) return
    startTransition(async () => {
      await adminDeleteRecipe(id)
      setSlettedeIds((prev) => new Set(prev).add(id))
    })
  }

  const synlige = oppskrifter.filter((o) => !slettedeIds.has(o.recipeId))

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500 mt-1">Innrapporterte oppskrifter</p>
      </div>

      {synlige.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-500 font-medium">Ingen innrapporterte oppskrifter</p>
        </div>
      ) : (
        <div className="space-y-4">
          {synlige.map((o) => (
            <div
              key={o.recipeId}
              className="bg-white rounded-2xl border border-red-200 p-5"
            >
              {/* Oppskrift-header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <Link
                    href={`/oppskrifter/${o.recipeId}`}
                    className="font-semibold text-gray-900 hover:text-blue-700 transition-colors"
                  >
                    {o.recipeName}
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      o.isPublic
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {o.isPublic ? '🌍 Delt' : '🔒 Privat'}
                    </span>
                    <span className="text-xs text-red-600 font-medium">
                      {o.rapporter.length} rapport{o.rapporter.length !== 1 ? 'er' : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => slettOppskrift(o.recipeId, o.recipeName)}
                  disabled={isPending}
                  className="flex-shrink-0 px-3 py-1.5 bg-red-500 text-white text-sm font-medium
                    rounded-lg hover:bg-red-600 disabled:opacity-60 transition-colors"
                >
                  Slett globalt
                </button>
              </div>

              {/* Rapporter */}
              <div className="space-y-2">
                {o.rapporter.map((r) => (
                  <div
                    key={r.id}
                    className="bg-red-50 rounded-lg px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-0.5">
                      <span>{r.fraHusstand}</span>
                      <span>{new Date(r.reported_at).toLocaleDateString('nb-NO')}</span>
                    </div>
                    {r.reason ? (
                      <p className="text-gray-700">{r.reason}</p>
                    ) : (
                      <p className="text-gray-400 italic">Ingen begrunnelse oppgitt</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
