'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Recipe } from '@/types/database'
import KategoriBadge from '@/components/ui/KategoriBadge'
import StjerneRating from '@/components/ui/StjerneRating'
import Knapp from '@/components/ui/Knapp'

const KATEGORIER = [
  { value: 'alle', label: 'Alle' },
  { value: 'hverdagsmat', label: 'Hverdagsmat' },
  { value: 'fisk', label: 'Fisk' },
  { value: 'vegetar', label: 'Vegetar' },
  { value: 'kylling', label: 'Kylling' },
  { value: 'helgemat', label: 'Helgemat' },
] as const

interface Props {
  oppskrifter: (Recipe & { avg_rating: number | null; rating_count: number })[]
}

export default function OppskrifterKlient({ oppskrifter }: Props) {
  const [søk, setSøk] = useState('')
  const [kategori, setKategori] = useState('alle')

  const filtrert = oppskrifter.filter((r) => {
    const matcherSøk = r.name.toLowerCase().includes(søk.toLowerCase())
    const matcherKat = kategori === 'alle' || r.category === kategori
    return matcherSøk && matcherKat
  })

  return (
    <div>
      {/* Søk + ny oppskrift */}
      <div className="flex gap-3 mb-5">
        <input
          type="search"
          placeholder="Søk etter oppskrift..."
          value={søk}
          onChange={(e) => setSøk(e.target.value)}
          className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <Link href="/oppskrifter/ny">
          <Knapp>+ Ny oppskrift</Knapp>
        </Link>
      </div>

      {/* Kategori-faner */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {KATEGORIER.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setKategori(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              kategori === value
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Resultat-grid */}
      {filtrert.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-4xl mb-3 block">🔍</span>
          <p className="text-gray-500">Ingen oppskrifter funnet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrert.map((r) => (
            <Link
              key={r.id}
              href={`/oppskrifter/${r.id}`}
              className="block p-4 bg-white rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold text-gray-900 leading-snug group-hover:text-green-700 transition-colors">
                  {r.name}
                </h3>
                <KategoriBadge category={r.category} />
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                {r.prep_time_minutes && <span>⏱ {r.prep_time_minutes} min</span>}
                <span>👥 {r.servings} pers.</span>
                {r.rating_count > 0 && <span>({r.rating_count} vurd.)</span>}
              </div>
              <StjerneRating score={r.avg_rating} size="sm" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
