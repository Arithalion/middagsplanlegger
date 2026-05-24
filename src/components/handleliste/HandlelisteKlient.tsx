'use client'

import { useState, useTransition } from 'react'
import type { ShoppingListItem, Ingredient } from '@/types/database'
import { markItemBought, markListBought } from '@/lib/actions/shopping-lists'
import { formatNok, formatMengde } from '@/lib/utils'
import Knapp from '@/components/ui/Knapp'

interface Vare extends ShoppingListItem {
  ingredient: Ingredient & { category?: string | null }
}

interface Props {
  listId: string
  varer: Vare[]
}

export default function HandlelisteKlient({ listId, varer }: Props) {
  const [kjøpt, setKjøpt] = useState<Set<string>>(
    new Set(varer.filter((v) => v.is_bought).map((v) => v.id))
  )
  const [isPending, startTransition] = useTransition()

  function toggleVare(id: string) {
    const erKjøpt = !kjøpt.has(id)
    setKjøpt((prev) => {
      const ny = new Set(prev)
      erKjøpt ? ny.add(id) : ny.delete(id)
      return ny
    })
    startTransition(async () => {
      await markItemBought(id, erKjøpt)
    })
  }

  function markerAlt() {
    startTransition(async () => {
      await markListBought(listId)
      setKjøpt(new Set(varer.map((v) => v.id)))
    })
  }

  // Grupper etter ingredienskategori
  const grupper = new Map<string, Vare[]>()
  for (const vare of varer) {
    const kat = vare.ingredient?.category ?? 'Annet'
    if (!grupper.has(kat)) grupper.set(kat, [])
    grupper.get(kat)!.push(vare)
  }

  const totalsum = varer.reduce((sum, v) => sum + (v.estimated_price ?? 0), 0)
  const kjøptSum = varer
    .filter((v) => kjøpt.has(v.id))
    .reduce((sum, v) => sum + (v.estimated_price ?? 0), 0)

  const alleKjøpt = varer.length > 0 && varer.every((v) => kjøpt.has(v.id))

  return (
    <div>
      {/* Topp-info */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          {kjøpt.size}/{varer.length} varer kjøpt
        </p>
        <Knapp
          variant="sekundær"
          størrelse="sm"
          onClick={markerAlt}
          laster={isPending}
          disabled={alleKjøpt}
        >
          ✅ Hele lista kjøpt
        </Knapp>
      </div>

      {/* Gruppert liste */}
      <div className="space-y-5">
        {Array.from(grupper.entries()).map(([kategori, vareGruppe]) => (
          <div key={kategori}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              {kategori}
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {vareGruppe.map((vare) => {
                const erKjøpt = kjøpt.has(vare.id)
                return (
                  <div
                    key={vare.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                      erKjøpt ? 'bg-gray-50' : ''
                    }`}
                  >
                    <button
                      onClick={() => toggleVare(vare.id)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        erKjøpt
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {erKjøpt && <span className="text-xs">✓</span>}
                    </button>

                    <span
                      className={`flex-1 text-sm ${
                        erKjøpt ? 'line-through text-gray-400' : 'text-gray-900'
                      }`}
                    >
                      {vare.ingredient?.name ?? 'Ukjent'}
                    </span>

                    <span className="text-sm text-gray-500">
                      {formatMengde(vare.amount, vare.unit)}
                    </span>

                    {vare.estimated_price != null && (
                      <span className="text-sm text-gray-400 w-16 text-right">
                        {formatNok(vare.estimated_price)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Totalsum */}
      <div className="mt-6 flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200">
        <div>
          <p className="text-sm text-gray-500">Estimert total</p>
          {kjøptSum > 0 && totalsum > 0 && (
            <p className="text-xs text-gray-400">{formatNok(kjøptSum)} kjøpt</p>
          )}
        </div>
        <span className="text-xl font-bold text-gray-900">
          {totalsum > 0 ? formatNok(totalsum) : '—'}
        </span>
      </div>
    </div>
  )
}
