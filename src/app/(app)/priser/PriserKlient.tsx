'use client'

import { useState } from 'react'

type PrisIng = {
  id: string
  name: string
  category: string | null
  default_unit: string
  price: { id: string; price_per_unit: number; unit: string; source: string | null; updated_at: string } | null
}

interface Props {
  ingredients: PrisIng[]
}

export default function PriserKlient({ ingredients }: Props) {
  const [søk, setSøk] = useState('')
  const [redigerer, setRedigerer] = useState<string | null>(null)
  const [nyPris, setNyPris] = useState('')
  const [lagrer, setLagrer] = useState(false)
  const [lagretId, setLagretId] = useState<string | null>(null)

  const filtrert = ingredients.filter((i) =>
    i.name.toLowerCase().includes(søk.toLowerCase()) ||
    (i.category ?? '').toLowerCase().includes(søk.toLowerCase())
  )

  async function lagrePris(ingredientId: string) {
    if (!nyPris) return
    setLagrer(true)
    const res = await fetch('/api/priser/oppdater', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientId, price: parseFloat(nyPris) }),
    })
    setLagrer(false)
    if (res.ok) {
      setLagretId(ingredientId)
      setTimeout(() => setLagretId(null), 2000)
    }
    setRedigerer(null)
    setNyPris('')
  }

  const medPris = ingredients.filter((i) => i.price !== null).length
  const utenPris = ingredients.length - medPris

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Priser</h1>
          <p className="text-sm text-gray-500 mt-1">
            {medPris} med pris · {utenPris} uten pris
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled
            title="Oda-integrasjon kommer snart"
            className="px-3 py-2 text-sm font-medium bg-gray-100 text-gray-400
              rounded-lg cursor-not-allowed border border-dashed border-gray-300"
          >
            🛒 Hent fra Oda (kommer snart)
          </button>
        </div>
      </div>

      {/* Søk */}
      <div className="mb-4">
        <input
          type="search"
          value={søk}
          onChange={(e) => setSøk(e.target.value)}
          placeholder="Søk etter ingrediens…"
          className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Info-boks */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 text-sm text-blue-700">
        💡 Priser brukes til å estimere kostnader i handlelisten og budsjettet. Oppdater dem manuelt etter hvert som du handler.
      </div>

      {/* Ingrediensliste */}
      {filtrert.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Ingen ingredienser funnet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {filtrert.map((ing, i) => (
            <div
              key={ing.id}
              className={`flex items-center px-4 py-3 gap-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{ing.name}</p>
                {ing.category && <p className="text-xs text-gray-400">{ing.category}</p>}
              </div>

              {redigerer === ing.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={nyPris}
                    onChange={(e) => setNyPris(e.target.value)}
                    placeholder="Pris"
                    min={0}
                    step="0.5"
                    autoFocus
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm
                      focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-xs text-gray-500">kr/{ing.default_unit}</span>
                  <button
                    onClick={() => lagrePris(ing.id)}
                    disabled={lagrer}
                    className="text-xs text-white bg-green-600 px-2 py-1 rounded-md hover:bg-green-700"
                  >
                    {lagrer ? '…' : 'Sett'}
                  </button>
                  <button
                    onClick={() => { setRedigerer(null); setNyPris('') }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Avbryt
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {ing.price ? (
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {ing.price.price_per_unit.toFixed(2)} kr/{ing.price.unit}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(ing.price.updated_at).toLocaleDateString('nb-NO')}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Ingen pris</span>
                  )}
                  {lagretId === ing.id && <span className="text-xs text-green-600">✓</span>}
                  <button
                    onClick={() => {
                      setRedigerer(ing.id)
                      setNyPris(ing.price?.price_per_unit.toString() ?? '')
                    }}
                    className="text-xs text-green-600 hover:text-green-700 font-medium"
                  >
                    {ing.price ? 'Endre' : 'Sett pris'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
