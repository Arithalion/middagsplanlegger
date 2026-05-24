'use client'

import { useState } from 'react'
import Link from 'next/link'
import KategoriBadge from '@/components/ui/KategoriBadge'
import StjerneRating from '@/components/ui/StjerneRating'
import type { RecipeCategory } from '@/types/database'

type Oppskrift = {
  id: string
  name: string
  category: RecipeCategory
  prep_time_minutes: number | null
  servings: number
  avg_rating: number | null
  rating_count: number
}

const KATEGORIER: { value: RecipeCategory | 'alle'; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'hverdagsmat', label: 'Hverdagsmat' },
  { value: 'fisk', label: 'Fisk' },
  { value: 'vegetar', label: 'Vegetar' },
  { value: 'kylling', label: 'Kylling' },
  { value: 'helgemat', label: 'Helgemat' },
  { value: 'søndagsmiddag', label: 'Søndagsmiddag' },
  { value: 'selskapsmat', label: 'Selskapsmat' },
]

export default function OppskrifterKlient({ oppskrifter }: { oppskrifter: Oppskrift[] }) {
  const [søk, setSøk] = useState('')
  const [aktivKategori, setAktivKategori] = useState<RecipeCategory | 'alle'>('alle')

  const filtrert = oppskrifter.filter((r) => {
    const matcherKategori = aktivKategori === 'alle' || r.category === aktivKategori
    const matcherSøk = r.name.toLowerCase().includes(søk.toLowerCase())
    return matcherKategori && matcherSøk
  })

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Overskrift */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Oppskrifter</h1>
          <p className="text-sm text-gray-500 mt-1">{oppskrifter.length} oppskrifter totalt</p>
        </div>
        <Link
          href="/oppskrifter/ny"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm
            font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          + Ny oppskrift
        </Link>
      </div>

      {/* Søk */}
      <div className="mb-4">
        <input
          type="search"
          value={søk}
          onChange={(e) => setSøk(e.target.value)}
          placeholder="Søk etter oppskrift…"
          className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Kategorifaner */}
      <div className="flex gap-1.5 flex-wrap mb-6">
        {KATEGORIER.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setAktivKategori(value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              aktivKategori === value
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Oppskriftsliste */}
      {filtrert.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📖</p>
          <p className="text-gray-500 font-medium">Ingen oppskrifter funnet</p>
          {søk && (
            <button
              onClick={() => setSøk('')}
              className="mt-2 text-sm text-green-600 hover:text-green-700"
            >
              Tøm søket
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrert.map((r) => (
            <Link
              key={r.id}
              href={`/oppskrifter/${r.id}`}
              className="bg-white rounded-2xl border border-gray-200 p-4 hover:border-green-300
                hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors leading-snug">
                  {r.name}
                </h3>
                <KategoriBadge category={r.category} />
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-3">
                  {r.prep_time_minutes && <span>⏱ {r.prep_time_minutes} min</span>}
                  <span>👥 {r.servings} pers</span>
                </div>
                <StjerneRating score={r.avg_rating} size="sm" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
