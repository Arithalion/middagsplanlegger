'use client'

import { useState, useTransition } from 'react'
import type { Unit } from '@/types/database'
import { addPantryItem, deletePantryItem } from '@/lib/actions/pantry'
import { dagerTilUtlop, holdbarhetFarge, formatMengde } from '@/lib/utils'
import Knapp from '@/components/ui/Knapp'

interface PantryRad {
  id: string
  amount: number
  unit: Unit
  expiry_date: string | null
  ingredient: { name: string; category: string | null }
}

interface Props {
  varer: PantryRad[]
}

const ENHETER: Unit[] = ['g', 'kg', 'ml', 'dl', 'l', 'stk', 'boks', 'pose', 'flaske', 'pk']

const FARGE_KLASSER = {
  grønn: 'bg-green-50 text-green-700 border-green-200',
  gul: 'bg-amber-50 text-amber-700 border-amber-200',
  rød: 'bg-red-50 text-red-700 border-red-200',
}

export default function BeholdningKlient({ varer }: Props) {
  const [visSkjema, setVisSkjema] = useState(false)
  const [navn, setNavn] = useState('')
  const [mengde, setMengde] = useState<number | ''>('')
  const [enhet, setEnhet] = useState<Unit>('stk')
  const [holdbarhet, setHoldbarhet] = useState('')
  const [feil, setFeil] = useState('')
  const [isPending, startTransition] = useTransition()

  function tilbakestill() {
    setNavn('')
    setMengde('')
    setEnhet('stk')
    setHoldbarhet('')
    setFeil('')
    setVisSkjema(false)
  }

  function handleLagreVare() {
    if (!navn.trim()) { setFeil('Navn er påkrevd'); return }
    if (!mengde || Number(mengde) <= 0) { setFeil('Mengde må være større enn 0'); return }
    setFeil('')
    startTransition(async () => {
      await addPantryItem({
        ingredient_name: navn.trim(),
        amount: Number(mengde),
        unit: enhet,
        expiry_date: holdbarhet || null,
      })
      tilbakestill()
    })
  }

  function handleSlett(id: string) {
    startTransition(async () => {
      await deletePantryItem(id)
    })
  }

  return (
    <div>
      {/* Legg til-knapp */}
      <div className="mb-5">
        {visSkjema ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Legg til vare</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs text-gray-500 mb-1">Navn *</label>
                <input
                  type="text"
                  value={navn}
                  onChange={(e) => setNavn(e.target.value)}
                  placeholder="F.eks. Melk"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mengde *</label>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={mengde}
                  onChange={(e) => setMengde(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Enhet</label>
                <select
                  value={enhet}
                  onChange={(e) => setEnhet(e.target.value as Unit)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {ENHETER.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Holdbarhet</label>
                <input
                  type="date"
                  value={holdbarhet}
                  onChange={(e) => setHoldbarhet(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            {feil && <p className="text-xs text-red-600 mb-2">{feil}</p>}
            <div className="flex gap-2">
              <Knapp størrelse="sm" onClick={handleLagreVare} laster={isPending}>
                Lagre
              </Knapp>
              <Knapp variant="sekundær" størrelse="sm" onClick={tilbakestill}>
                Avbryt
              </Knapp>
            </div>
          </div>
        ) : (
          <Knapp onClick={() => setVisSkjema(true)}>+ Legg til vare</Knapp>
        )}
      </div>

      {/* Beholdningsliste */}
      {varer.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">📦</span>
          <p className="text-gray-500">Ingen varer i beholdningen</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {varer.map((vare) => {
            const dager = vare.expiry_date ? dagerTilUtlop(vare.expiry_date) : null
            const farge = dager !== null ? holdbarhetFarge(dager) : 'grønn'
            const fargeKlasse = FARGE_KLASSER[farge]

            return (
              <div key={vare.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{vare.ingredient.name}</p>
                  <p className="text-xs text-gray-500">{formatMengde(vare.amount, vare.unit)}</p>
                </div>

                {dager !== null && (
                  <span
                    className={`text-xs px-2 py-1 rounded-full border font-medium ${fargeKlasse}`}
                  >
                    {dager < 0
                      ? 'Utløpt'
                      : dager === 0
                      ? 'Utløper i dag'
                      : `${dager} dag${dager !== 1 ? 'er' : ''} igjen`}
                  </span>
                )}

                <button
                  onClick={() => handleSlett(vare.id)}
                  disabled={isPending}
                  className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                  aria-label="Slett vare"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
