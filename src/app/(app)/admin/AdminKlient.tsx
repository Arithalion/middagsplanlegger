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

type DeltOppskrift = {
  id: string
  name: string
  category: string
  husstand: string
  opprettet: string
}

export default function AdminKlient({
  oppskrifter,
  deltOppskrifter,
}: {
  oppskrifter: RapportertOppskrift[]
  deltOppskrifter: DeltOppskrift[]
}) {
  const [isPending, startTransition] = useTransition()
  const [slettedeIds, setSlettedeIds] = useState<Set<string>>(new Set())
  const [visDelte, setVisDelte] = useState(false)

  function slettOppskrift(id: string, navn: string) {
    if (!confirm(`Slett «${navn}» globalt? Dette fjerner oppskriften for alle og kan ikke angres.`)) return
    startTransition(async () => {
      await adminDeleteRecipe(id)
      setSlettedeIds((prev) => new Set(prev).add(id))
    })
  }

  const synligeRapporterte = oppskrifter.filter((o) => !slettedeIds.has(o.recipeId))
  const synligeDelte = deltOppskrifter.filter((o) => !slettedeIds.has(o.id))

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-8">

      {/* ─── Innrapporterte ─── */}
      <section>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Innrapporterte oppskrifter</p>
        </div>

        {synligeRapporterte.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-500 font-medium">Ingen innrapporterte oppskrifter</p>
          </div>
        ) : (
          <div className="space-y-4">
            {synligeRapporterte.map((o) => (
              <div key={o.recipeId} className="bg-white rounded-2xl border border-red-200 p-5">
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
                <div className="space-y-2">
                  {o.rapporter.map((r) => (
                    <div key={r.id} className="bg-red-50 rounded-lg px-3 py-2 text-sm">
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
      </section>

      {/* ─── Alle delte oppskrifter ─── */}
      <section>
        <button
          onClick={() => setVisDelte((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl
            border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800">🌍 Alle delte oppskrifter</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {synligeDelte.length}
            </span>
          </div>
          <span className="text-gray-400 text-sm">{visDelte ? '▲ Skjul' : '▼ Vis'}</span>
        </button>

        {visDelte && (
          <div className="mt-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {synligeDelte.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-8">Ingen delte oppskrifter</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {synligeDelte.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/oppskrifter/${o.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-700 truncate block"
                      >
                        {o.name}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {o.husstand} · {new Date(o.opprettet).toLocaleDateString('nb-NO')}
                      </p>
                    </div>
                    <button
                      onClick={() => slettOppskrift(o.id, o.name)}
                      disabled={isPending}
                      className="flex-shrink-0 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-medium
                        rounded-lg hover:bg-red-100 border border-red-200 disabled:opacity-60 transition-colors"
                    >
                      Slett
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

    </div>
  )
}
