'use client'

import { useState, useTransition, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { formatMengde } from '@/lib/utils'
import { addPantryItem, deletePantryItem } from '@/lib/actions/pantry'
import type { Unit } from '@/types/database'

const StrekkodeSkanner = lazy(() => import('./StrekkodeSkanner'))

const ENHETER: Unit[] = ['g', 'kg', 'ml', 'dl', 'l', 'tsk', 'ss', 'stk', 'boks', 'pose', 'flaske', 'pk']

const ENHET_GRUPPER = [
  { label: 'Vekt',   enheter: ['g', 'kg'] as Unit[] },
  { label: 'Volum',  enheter: ['ml', 'dl', 'l', 'tsk', 'ss'] as Unit[] },
  { label: 'Antall', enheter: ['stk', 'boks', 'pose', 'flaske', 'pk'] as Unit[] },
]

type Item = {
  id: string
  amount: number
  unit: Unit
  expiry_date: string | null
  ingredient: { id: string; name: string; category: string | null }
  dager: number | null
  farge: 'grønn' | 'gul' | 'rød' | null
}

interface Props {
  items: Item[]
  ingredients: { id: string; name: string; default_unit: Unit; category: string | null }[]
}

const FARGE_KLASSER = {
  grønn: 'bg-green-100 text-green-800',
  gul: 'bg-amber-100 text-amber-800',
  rød: 'bg-red-100 text-red-800',
}

export default function BeholdningKlient({ items, ingredients }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [visSkjema, setVisSkjema] = useState(false)
  const [visSkanner, setVisSkanner] = useState(false)
  const [ingredientId, setIngredientId] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState<Unit>('stk')
  const [expiryDate, setExpiryDate] = useState('')
  const [laster, setLaster] = useState(false)

  async function handleLeggTil(e: React.FormEvent) {
    e.preventDefault()
    if (!ingredientId || !amount) return
    setLaster(true)
    await addPantryItem({
      ingredient_id: ingredientId,
      amount: parseFloat(amount),
      unit,
      expiry_date: expiryDate || null,
    })
    setIngredientId('')
    setAmount('')
    setUnit('stk')
    setExpiryDate('')
    setVisSkjema(false)
    setLaster(false)
    startTransition(() => router.refresh())
  }

  async function handleSlett(id: string) {
    await deletePantryItem(id)
    startTransition(() => router.refresh())
  }

  const utløptCount = items.filter((i) => i.farge === 'rød').length
  const snartCount = items.filter((i) => i.farge === 'gul').length

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beholdning</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} varer
            {utløptCount > 0 && <span className="text-red-600 font-medium"> · {utløptCount} utløpt</span>}
            {snartCount > 0 && <span className="text-amber-600 font-medium"> · {snartCount} utløper snart</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVisSkanner(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
              hover:bg-blue-700 transition-colors"
          >
            📷 Skann
          </button>
          <button
            onClick={() => setVisSkjema(!visSkjema)}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg
              hover:bg-green-700 transition-colors"
          >
            {visSkjema ? '✕ Avbryt' : '+ Legg til vare'}
          </button>
        </div>
      </div>

      {/* Legg til skjema */}
      {visSkjema && (
        <form onSubmit={handleLeggTil} className="bg-white rounded-2xl border border-gray-200 p-4 mb-5">
          <h3 className="font-semibold text-gray-900 mb-3">Ny vare</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ingrediens</label>
              <select
                value={ingredientId}
                onChange={(e) => {
                  setIngredientId(e.target.value)
                  const ing = ingredients.find((i) => i.id === e.target.value)
                  if (ing) setUnit(ing.default_unit)
                }}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Velg ingrediens…</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mengde</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={0}
                step="any"
                required
                placeholder="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enhet</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {ENHET_GRUPPER.map(({ label, enheter }) => (
                  <optgroup key={label} label={label}>
                    {enheter.map((u) => <option key={u} value={u}>{u}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Holdbarhet (valgfritt)</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button
              type="submit"
              disabled={laster}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg
                hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {laster ? 'Legger til…' : 'Legg til'}
            </button>
          </div>
        </form>
      )}

      {/* Vareliste */}
      {items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-500 font-medium">Ingen varer i beholdningen</p>
          <p className="text-sm text-gray-400 mt-1">
            Varer legges automatisk til når du markerer handlelisten som kjøpt
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {items.map((item, i) => (
            <div
              key={item.id}
              className={`flex items-center px-4 py-3 gap-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.ingredient.name}</p>
                {item.ingredient.category && (
                  <p className="text-xs text-gray-400">{item.ingredient.category}</p>
                )}
              </div>
              <span className="text-sm text-gray-600 shrink-0">
                {formatMengde(item.amount, item.unit)}
              </span>
              {item.expiry_date && item.farge && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${FARGE_KLASSER[item.farge]}`}>
                  {item.dager! < 0 ? 'Utløpt' : item.dager === 0 ? 'I dag' : `${item.dager}d`}
                </span>
              )}
              <button
                onClick={() => handleSlett(item.id)}
                className="text-red-400 hover:text-red-600 text-sm shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Strekkodeskanner-modal */}
      {visSkanner && (
        <Suspense fallback={null}>
          <StrekkodeSkanner
            ingredients={ingredients}
            onLukk={() => setVisSkanner(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
