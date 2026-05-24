'use client'

import { useState, useTransition } from 'react'
import type { RecipeCategory, Unit } from '@/types/database'
import { createRecipe } from '@/lib/actions/recipes'
import Knapp from '@/components/ui/Knapp'

const KATEGORIER: { value: RecipeCategory; label: string }[] = [
  { value: 'hverdagsmat', label: 'Hverdagsmat' },
  { value: 'fisk', label: 'Fisk' },
  { value: 'vegetar', label: 'Vegetar' },
  { value: 'kylling', label: 'Kylling' },
  { value: 'helgemat', label: 'Helgemat' },
  { value: 'søndagsmiddag', label: 'Søndagsmiddag' },
  { value: 'selskapsmat', label: 'Selskapsmat' },
]

const ENHETER: Unit[] = ['g', 'kg', 'ml', 'dl', 'l', 'stk', 'boks', 'pose', 'flaske', 'pk']

interface Ingrediens {
  ingredient_name: string
  amount: number
  unit: Unit
  note: string
}

function tomIngrediensRad(): Ingrediens {
  return { ingredient_name: '', amount: 0, unit: 'stk', note: '' }
}

export default function NyOppskriftSkjema() {
  const [fane, setFane] = useState<'manuell' | 'url'>('manuell')
  const [navn, setNavn] = useState('')
  const [beskrivelse, setBeskrivelse] = useState('')
  const [kategori, setKategori] = useState<RecipeCategory>('hverdagsmat')
  const [porsjoner, setPorsjoner] = useState(4)
  const [tilberedningstid, setTilberedningstid] = useState<number | ''>('')
  const [kildeUrl, setKildeUrl] = useState('')
  const [ingredienser, setIngredienser] = useState<Ingrediens[]>([tomIngrediensRad()])
  const [importUrl, setImportUrl] = useState('')
  const [importLaster, setImportLaster] = useState(false)
  const [importFeil, setImportFeil] = useState('')
  const [feil, setFeil] = useState('')
  const [isPending, startTransition] = useTransition()

  function oppdaterIngrediens(i: number, felt: keyof Ingrediens, verdi: string | number) {
    setIngredienser((prev) => {
      const ny = [...prev]
      ny[i] = { ...ny[i], [felt]: verdi }
      return ny
    })
  }

  function leggTilRad() {
    setIngredienser((prev) => [...prev, tomIngrediensRad()])
  }

  function fjernRad(i: number) {
    setIngredienser((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function importerFraUrl() {
    if (!importUrl.trim()) return
    setImportLaster(true)
    setImportFeil('')
    try {
      const res = await fetch('/api/recipes/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        setImportFeil(data.error ?? 'Kunne ikke importere oppskriften.')
        return
      }
      setNavn(data.name ?? '')
      setBeskrivelse(data.description ?? '')
      if (data.servings) setPorsjoner(data.servings)
      if (data.prep_time_minutes) setTilberedningstid(data.prep_time_minutes)
      setKildeUrl(importUrl)
      if (data.raw_ingredients?.length) {
        setIngredienser(
          (data.raw_ingredients as string[]).map((ing) => ({
            ingredient_name: ing,
            amount: 1,
            unit: 'stk' as Unit,
            note: '',
          }))
        )
      }
      setFane('manuell')
    } catch {
      setImportFeil('Noe gikk galt. Prøv igjen.')
    } finally {
      setImportLaster(false)
    }
  }

  function handleLagre() {
    if (!navn.trim()) {
      setFeil('Oppskriften må ha et navn.')
      return
    }
    setFeil('')
    startTransition(async () => {
      await createRecipe({
        name: navn.trim(),
        description: beskrivelse,
        category: kategori,
        servings: porsjoner,
        prep_time_minutes: tilberedningstid ? Number(tilberedningstid) : 0,
        source_url: kildeUrl,
        ingredients: ingredienser.filter((i) => i.ingredient_name.trim()),
      })
    })
  }

  return (
    <div className="max-w-2xl">
      {/* Faner */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['manuell', 'url'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFane(f)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              fane === f
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'manuell' ? 'Legg inn manuelt' : 'Importer fra URL'}
          </button>
        ))}
      </div>

      {fane === 'url' ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Støtter alle nettsider med oppskrift i schema.org-format (f.eks.{' '}
            <span className="font-medium">Tine.no</span>,{' '}
            <span className="font-medium">MatPrat.no</span>).
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://www.tine.no/oppskrifter/..."
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <Knapp onClick={importerFraUrl} laster={importLaster}>
              Hent oppskrift
            </Knapp>
          </div>
          {importFeil && <p className="text-sm text-red-600">{importFeil}</p>}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Navn */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Navn <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={navn}
              onChange={(e) => setNavn(e.target.value)}
              placeholder="F.eks. Spagetti bolognese"
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Beskrivelse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivelse</label>
            <textarea
              value={beskrivelse}
              onChange={(e) => setBeskrivelse(e.target.value)}
              rows={2}
              placeholder="Kort beskrivelse..."
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Kategori + Porsjoner + Tid */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value as RecipeCategory)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {KATEGORIER.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porsjoner</label>
              <input
                type="number"
                min={1}
                value={porsjoner}
                onChange={(e) => setPorsjoner(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tid (min)</label>
              <input
                type="number"
                min={0}
                value={tilberedningstid}
                onChange={(e) => setTilberedningstid(e.target.value ? Number(e.target.value) : '')}
                placeholder="30"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Kilde-URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kilde-URL</label>
            <input
              type="url"
              value={kildeUrl}
              onChange={(e) => setKildeUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Ingredienser */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ingredienser</label>
            <div className="space-y-2">
              {ingredienser.map((ing, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={ing.ingredient_name}
                    onChange={(e) => oppdaterIngrediens(i, 'ingredient_name', e.target.value)}
                    placeholder="Ingrediens"
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={ing.amount || ''}
                    onChange={(e) => oppdaterIngrediens(i, 'amount', Number(e.target.value))}
                    placeholder="Mengde"
                    className="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <select
                    value={ing.unit}
                    onChange={(e) => oppdaterIngrediens(i, 'unit', e.target.value)}
                    className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {ENHETER.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input
                    type="text"
                    value={ing.note}
                    onChange={(e) => oppdaterIngrediens(i, 'note', e.target.value)}
                    placeholder="Merknad"
                    className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  {ingredienser.length > 1 && (
                    <button
                      type="button"
                      onClick={() => fjernRad(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors text-lg leading-none"
                      aria-label="Fjern rad"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={leggTilRad}
              className="mt-2 text-sm text-green-600 hover:text-green-700 font-medium"
            >
              + Legg til ingrediens
            </button>
          </div>

          {feil && <p className="text-sm text-red-600">{feil}</p>}

          <div className="flex gap-3 pt-2">
            <Knapp onClick={handleLagre} laster={isPending}>
              Lagre oppskrift
            </Knapp>
          </div>
        </div>
      )}
    </div>
  )
}
