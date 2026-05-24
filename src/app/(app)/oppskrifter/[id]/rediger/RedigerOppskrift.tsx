'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateRecipe } from '@/lib/actions/recipes'
import type { RecipeCategory, Unit } from '@/types/database'

const KATEGORIER: { value: RecipeCategory; label: string }[] = [
  { value: 'hverdagsmat',   label: 'Hverdagsmat' },
  { value: 'fisk',          label: 'Fisk' },
  { value: 'vegetar',       label: 'Vegetar' },
  { value: 'kylling',       label: 'Kylling' },
  { value: 'helgemat',      label: 'Helgemat' },
  { value: 'søndagsmiddag', label: 'Søndagsmiddag' },
  { value: 'selskapsmat',   label: 'Selskapsmat' },
]

const ENHET_GRUPPER = [
  { label: 'Vekt',   enheter: ['g', 'kg'] as Unit[] },
  { label: 'Volum',  enheter: ['ml', 'dl', 'l', 'tsk', 'ss'] as Unit[] },
  { label: 'Antall', enheter: ['stk', 'boks', 'pose', 'flaske', 'pk'] as Unit[] },
]

type Ingredienslinje = { ingredientNavn: string; amount: string; unit: Unit; note: string }

interface InitialData {
  name: string
  description: string
  category: RecipeCategory
  servings: number
  prep_time_minutes: number
  source_url: string
  ingredients: Ingredienslinje[]
}

export default function RedigerOppskrift({ id, initial }: { id: string; initial: InitialData }) {
  const router = useRouter()
  const [laster, setLaster] = useState(false)
  const [feil, setFeil] = useState('')

  const [navn, setNavn] = useState(initial.name)
  const [beskrivelse, setBeskrivelse] = useState(initial.description)
  const [kategori, setKategori] = useState<RecipeCategory>(initial.category)
  const [porsjoner, setPorsjoner] = useState(initial.servings)
  const [tilberedningstid, setTilberedningstid] = useState(
    initial.prep_time_minutes ? String(initial.prep_time_minutes) : ''
  )
  const [kildeUrl, setKildeUrl] = useState(initial.source_url)
  const [ingredienser, setIngredienser] = useState<Ingredienslinje[]>(
    initial.ingredients.length > 0 ? initial.ingredients : [{ ingredientNavn: '', amount: '', unit: 'stk', note: '' }]
  )

  function oppdaterIngrediens(i: number, felt: keyof Ingredienslinje, verdi: string) {
    setIngredienser((prev) => prev.map((x, idx) => idx === i ? { ...x, [felt]: verdi } : x))
  }

  function leggTilIngrediens() {
    setIngredienser((prev) => [...prev, { ingredientNavn: '', amount: '', unit: 'stk', note: '' }])
  }

  function fjernIngrediens(i: number) {
    setIngredienser((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeil('')
    setLaster(true)
    try {
      await updateRecipe(id, {
        name: navn,
        description: beskrivelse,
        category: kategori,
        servings: porsjoner,
        prep_time_minutes: tilberedningstid ? parseInt(tilberedningstid) : 0,
        source_url: kildeUrl,
        ingredients: ingredienser
          .filter((i) => i.ingredientNavn.trim())
          .map((i) => ({
            ingredient_name: i.ingredientNavn.trim(),
            amount: parseFloat(i.amount) || 1,
            unit: i.unit,
            note: i.note,
          })),
      })
    } catch (err) {
      setFeil(err instanceof Error ? err.message : 'En feil oppstod')
      setLaster(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Tilbake
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Rediger oppskrift</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Grunninfo */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Grunninfo</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Navn *</label>
            <input
              type="text" required value={navn} onChange={(e) => setNavn(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivelse</label>
            <textarea
              value={beskrivelse} onChange={(e) => setBeskrivelse(e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select
                value={kategori} onChange={(e) => setKategori(e.target.value as RecipeCategory)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {KATEGORIER.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porsjoner</label>
              <input
                type="number" min={1} max={20} value={porsjoner}
                onChange={(e) => setPorsjoner(parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tid (min)</label>
              <input
                type="number" min={0} value={tilberedningstid}
                onChange={(e) => setTilberedningstid(e.target.value)} placeholder="30"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kilde-URL</label>
            <input
              type="url" value={kildeUrl} onChange={(e) => setKildeUrl(e.target.value)}
              placeholder="https://www.matprat.no/…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        {/* Ingredienser */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Ingredienser</h3>
          <div className="space-y-2">
            {ingredienser.map((linje, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  type="text" value={linje.ingredientNavn}
                  onChange={(e) => oppdaterIngrediens(i, 'ingredientNavn', e.target.value)}
                  placeholder="Ingrediensnavn"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="number" value={linje.amount}
                  onChange={(e) => oppdaterIngrediens(i, 'amount', e.target.value)}
                  placeholder="Mengde" min={0} step="any"
                  className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <select
                  value={linje.unit}
                  onChange={(e) => oppdaterIngrediens(i, 'unit', e.target.value)}
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {ENHET_GRUPPER.map(({ label, enheter }) => (
                    <optgroup key={label} label={label}>
                      {enheter.map((u) => <option key={u} value={u}>{u}</option>)}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button" onClick={() => fjernIngrediens(i)}
                  className="text-red-400 hover:text-red-600 px-2 py-2 text-sm"
                  aria-label="Fjern"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button" onClick={leggTilIngrediens}
            className="mt-3 text-sm text-green-600 hover:text-green-700 font-medium"
          >
            + Legg til ingrediens
          </button>
        </div>

        {feil && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {feil}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button" onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300
              rounded-lg hover:bg-gray-50 transition-colors"
          >
            Avbryt
          </button>
          <button
            type="submit" disabled={laster}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg
              hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {laster ? 'Lagrer…' : 'Lagre endringer'}
          </button>
        </div>
      </form>
    </div>
  )
}
