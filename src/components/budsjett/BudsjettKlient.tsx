'use client'

import { useState, useTransition } from 'react'
import { updateBudget } from '@/lib/actions/budgets'
import { formatNok } from '@/lib/utils'
import Knapp from '@/components/ui/Knapp'

interface BudsjettRad {
  uke: number
  ar: number
  planlagt: number | null
  faktisk: number | null
}

interface Props {
  inneværendeUke: BudsjettRad
  historikk: BudsjettRad[]
}

export default function BudsjettKlient({ inneværendeUke, historikk }: Props) {
  const [visModal, setVisModal] = useState(false)
  const [faktiskInput, setFaktiskInput] = useState(
    inneværendeUke.faktisk?.toString() ?? ''
  )
  const [isPending, startTransition] = useTransition()

  const planlagt = inneværendeUke.planlagt ?? 0
  const faktisk = inneværendeUke.faktisk ?? 0
  const prosent = planlagt > 0 ? Math.min((faktisk / planlagt) * 100, 100) : 0
  const overBudsjett = faktisk > planlagt && planlagt > 0

  function lagreAktivt() {
    startTransition(async () => {
      await updateBudget({
        week_number: inneværendeUke.uke,
        year: inneværendeUke.ar,
        actual_amount: faktiskInput ? Number(faktiskInput) : null,
      })
      setVisModal(false)
    })
  }

  return (
    <div>
      {/* Denne uken */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">
              Uke {inneværendeUke.uke}, {inneværendeUke.ar}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Inneværende uke</p>
          </div>
          <Knapp variant="sekundær" størrelse="sm" onClick={() => setVisModal(true)}>
            Oppdater faktisk beløp
          </Knapp>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Planlagt</p>
            <p className="text-xl font-bold text-gray-900">
              {planlagt > 0 ? formatNok(planlagt) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Faktisk</p>
            <p className={`text-xl font-bold ${overBudsjett ? 'text-red-600' : 'text-gray-900'}`}>
              {faktisk > 0 ? formatNok(faktisk) : '—'}
            </p>
          </div>
        </div>

        {planlagt > 0 && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{Math.round(prosent)}% brukt</span>
              {overBudsjett && (
                <span className="text-red-600 font-medium">
                  {formatNok(faktisk - planlagt)} over budsjett
                </span>
              )}
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  overBudsjett ? 'bg-red-500' : prosent > 80 ? 'bg-amber-400' : 'bg-green-500'
                }`}
                style={{ width: `${prosent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Historikk */}
      {historikk.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Siste 8 uker</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {historikk.map((rad) => {
              const p = rad.planlagt ?? 0
              const f = rad.faktisk ?? 0
              const over = f > p && p > 0
              return (
                <div key={`${rad.uke}-${rad.ar}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm text-gray-500 w-20 shrink-0">
                    Uke {rad.uke}, {rad.ar}
                  </span>
                  <div className="flex-1 flex items-center gap-4">
                    {p > 0 && (
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${over ? 'bg-red-400' : 'bg-green-500'}`}
                          style={{ width: `${Math.min((f / p) * 100, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-right shrink-0">
                    <span className="text-gray-400">{p > 0 ? formatNok(p) : '—'}</span>
                    <span className={`font-medium ${over ? 'text-red-600' : 'text-gray-900'}`}>
                      {f > 0 ? formatNok(f) : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {visModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setVisModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-gray-900 mb-4">
              Oppdater faktisk beløp — uke {inneværendeUke.uke}
            </h3>
            <div className="mb-5">
              <label className="block text-sm text-gray-600 mb-1.5">
                Faktisk brukt (kr)
              </label>
              <input
                type="number"
                min={0}
                value={faktiskInput}
                onChange={(e) => setFaktiskInput(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Knapp onClick={lagreAktivt} laster={isPending} className="flex-1">
                Lagre
              </Knapp>
              <Knapp variant="sekundær" onClick={() => setVisModal(false)} className="flex-1">
                Avbryt
              </Knapp>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
