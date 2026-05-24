'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { addToCollection, reportRecipe } from '@/lib/actions/recipes'
import KategoriBadge from '@/components/ui/KategoriBadge'
import StjerneRating from '@/components/ui/StjerneRating'
import type { RecipeCategory } from '@/types/database'

type Oppskrift = {
  id: string
  name: string
  category: RecipeCategory
  prep_time_minutes: number | null
  servings: number
  husstandNavn: string
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

export default function UtforskKlient({ oppskrifter }: { oppskrifter: Oppskrift[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [søk, setSøk] = useState('')
  const [aktivKategori, setAktivKategori] = useState<RecipeCategory | 'alle'>('alle')
  const [lagtTilIds, setLagtTilIds] = useState<Set<string>>(new Set())
  const [rapportForm, setRapportForm] = useState<{ id: string; tekst: string } | null>(null)
  const [rapporterteIds, setRapporterteIds] = useState<Set<string>>(new Set())

  const filtrert = oppskrifter.filter((r) => {
    const matcherKategori = aktivKategori === 'alle' || r.category === aktivKategori
    const matcherSøk = r.name.toLowerCase().includes(søk.toLowerCase())
    return matcherKategori && matcherSøk
  })

  function håndterLeggTil(id: string) {
    startTransition(async () => {
      await addToCollection(id)
      setLagtTilIds((prev) => new Set(prev).add(id))
      router.refresh()
    })
  }

  function åpneRapport(id: string) {
    setRapportForm({ id, tekst: '' })
  }

  function sendRapport(e: React.FormEvent) {
    e.preventDefault()
    if (!rapportForm) return
    const { id, tekst } = rapportForm
    startTransition(async () => {
      await reportRecipe(id, tekst)
      setRapporterteIds((prev) => new Set(prev).add(id))
      setRapportForm(null)
    })
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Overskrift */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/oppskrifter" className="text-gray-400 hover:text-gray-600 text-sm">
              ← Mine oppskrifter
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Utforsk oppskrifter</h1>
          <p className="text-sm text-gray-500 mt-1">{oppskrifter.length} offentlige oppskrifter tilgjengelig</p>
        </div>
      </div>

      {/* Søk */}
      <div className="mb-4">
        <input
          type="search"
          value={søk}
          onChange={(e) => setSøk(e.target.value)}
          placeholder="Søk etter oppskrift…"
          className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Rapport-modal */}
      {rapportForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <form
            onSubmit={sendRapport}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
          >
            <h3 className="font-semibold text-gray-900 mb-3">Rapporter oppskrift</h3>
            <textarea
              value={rapportForm.tekst}
              onChange={(e) => setRapportForm({ ...rapportForm, tekst: e.target.value })}
              placeholder="Hva er problemet? (valgfritt)"
              rows={3}
              className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-3"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 py-2 bg-red-500 text-white text-sm font-medium rounded-lg
                  hover:bg-red-600 disabled:opacity-60"
              >
                Send rapport
              </button>
              <button
                type="button"
                onClick={() => setRapportForm(null)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg
                  hover:bg-gray-200"
              >
                Avbryt
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste */}
      {filtrert.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-gray-500 font-medium">
            {oppskrifter.length === 0
              ? 'Ingen offentlige oppskrifter ennå'
              : 'Ingen oppskrifter matchet søket'}
          </p>
          {søk && (
            <button
              onClick={() => setSøk('')}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Tøm søket
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrert.map((r) => {
            const erLagtTil = lagtTilIds.has(r.id)
            const erRapportert = rapporterteIds.has(r.id)

            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Link
                      href={`/oppskrifter/${r.id}`}
                      className="font-semibold text-gray-900 hover:text-blue-700 transition-colors leading-snug"
                    >
                      {r.name}
                    </Link>
                    <KategoriBadge category={r.category} />
                  </div>
                  <p className="text-xs text-gray-400">Delt av {r.husstandNavn}</p>
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-3">
                    {r.prep_time_minutes && <span>⏱ {r.prep_time_minutes} min</span>}
                    <span>👥 {r.servings} pers</span>
                  </div>
                  <StjerneRating score={r.avg_rating} size="sm" />
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                  {erLagtTil ? (
                    <span className="text-xs text-green-600 font-medium">✓ Lagt til i samlingen</span>
                  ) : (
                    <button
                      onClick={() => håndterLeggTil(r.id)}
                      disabled={isPending}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800
                        disabled:opacity-60 transition-colors"
                    >
                      + Legg til
                    </button>
                  )}
                  {erRapportert ? (
                    <span className="text-xs text-gray-400">Rapportert</span>
                  ) : (
                    <button
                      onClick={() => åpneRapport(r.id)}
                      className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                    >
                      ⚑ Rapporter
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
