'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatNok, formatMengde } from '@/lib/utils'
import type { Unit } from '@/types/database'

type HandlelisteItem = {
  id: string
  amount: number
  unit: Unit
  estimated_price: number | null
  is_bought: boolean
  sort_order: number
  ingredient: { id: string; name: string; category: string | null }
}

interface Props {
  listId: string | null
  listType: string | null
  weekNumber: number | null
  items: HandlelisteItem[]
  totalEstimert: number
}

export default function HandlelisteKlient({ listId, listType, weekNumber, items, totalEstimert }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [lokalItems, setLokalItems] = useState(items)
  const [genererer, setGenererer] = useState(false)
  const [melding, setMelding] = useState('')

  async function toggleKjøpt(itemId: string) {
    setLokalItems((prev) => prev.map((i) => i.id === itemId ? { ...i, is_bought: !i.is_bought } : i))
    const res = await fetch('/api/shopping-list/item-bought', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    })
    if (!res.ok) {
      setLokalItems((prev) => prev.map((i) => i.id === itemId ? { ...i, is_bought: !i.is_bought } : i))
    }
  }

  async function markerAltKjøpt() {
    if (!listId || !confirm('Marker hele listen som kjøpt?')) return
    setLokalItems((prev) => prev.map((i) => ({ ...i, is_bought: true })))
    await fetch('/api/shopping-list/mark-all-bought', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId }),
    })
    startTransition(() => router.refresh())
  }

  async function genererHandleliste() {
    setGenererer(true)
    setMelding('')
    const res = await fetch('/api/shopping-list/generate', { method: 'POST' })
    const data = await res.json()
    setMelding(data.message ?? 'Handleliste generert!')
    setGenererer(false)
    startTransition(() => router.refresh())
    setTimeout(() => setMelding(''), 4000)
  }

  // Grupper etter kategori
  const grupper = lokalItems.reduce<Record<string, HandlelisteItem[]>>((acc, item) => {
    const kat = item.ingredient.category ?? 'Annet'
    if (!acc[kat]) acc[kat] = []
    acc[kat].push(item)
    return acc
  }, {})

  const ikkeKjøpt = lokalItems.filter((i) => !i.is_bought).length

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Handleliste</h1>
          {listId && (
            <p className="text-sm text-gray-500 mt-1">
              {listType === 'hoved' ? 'Hovedhandel' : 'Ferskvarehandel'}
              {weekNumber ? ` · Uke ${weekNumber}` : ''}
              {' · '}{ikkeKjøpt} varer gjenstår
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {melding && <span className="text-sm text-green-600 font-medium">{melding}</span>}
          <button
            onClick={genererHandleliste}
            disabled={genererer || isPending}
            className="px-3 py-2 text-sm font-medium bg-blue-100 text-blue-700
              rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
          >
            {genererer ? 'Genererer…' : '🔄 Generer liste'}
          </button>
        </div>
      </div>

      {!listId ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-gray-500 font-medium mb-4">Ingen aktiv handleliste</p>
          <button
            onClick={genererHandleliste}
            disabled={genererer}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg
              hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {genererer ? 'Genererer…' : 'Generer fra ukesplan'}
          </button>
        </div>
      ) : (
        <>
          {Object.entries(grupper).map(([kategori, vareListe]) => (
            <div key={kategori} className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {kategori}
              </h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {vareListe.map((item, i) => (
                  <div
                    key={item.id}
                    className={`flex items-center px-4 py-3 gap-3 ${
                      i > 0 ? 'border-t border-gray-100' : ''
                    } ${item.is_bought ? 'bg-gray-50' : ''}`}
                  >
                    <button
                      onClick={() => toggleKjøpt(item.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        item.is_bought
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {item.is_bought && <span className="text-white text-xs">✓</span>}
                    </button>
                    <span className={`flex-1 text-sm ${item.is_bought ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {item.ingredient.name}
                    </span>
                    <span className="text-sm text-gray-500 shrink-0">
                      {formatMengde(item.amount, item.unit)}
                    </span>
                    {item.estimated_price != null && (
                      <span className="text-sm text-gray-400 shrink-0 w-16 text-right">
                        {formatNok(item.estimated_price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Bunntekst */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div>
              {totalEstimert > 0 && (
                <p className="text-sm text-gray-500">Estimert total: <span className="font-semibold text-gray-900">{formatNok(totalEstimert)}</span></p>
              )}
            </div>
            <button
              onClick={markerAltKjøpt}
              disabled={isPending || ikkeKjøpt === 0}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg
                hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              ✅ Hele lista kjøpt
            </button>
          </div>
        </>
      )}
    </div>
  )
}
