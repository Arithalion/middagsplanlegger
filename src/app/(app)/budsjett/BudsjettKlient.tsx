'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatNok } from '@/lib/utils'
import { updateBudget } from '@/lib/actions/budgets'

type HistoryItem = { week_number: number; year: number; planned_amount: number | null; actual_amount: number | null }

interface Props {
  weekNumber: number
  year: number
  budgetId: string | null
  plannedAmount: number | null
  actualAmount: number | null
  history: HistoryItem[]
}

export default function BudsjettKlient({ weekNumber, year, budgetId, plannedAmount, actualAmount, history }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [redigerPlanlagt, setRedigerPlanlagt] = useState(false)
  const [redigerFaktisk, setRedigerFaktisk] = useState(false)
  const [nyPlanlagt, setNyPlanlagt] = useState(plannedAmount?.toString() ?? '')
  const [nyFaktisk, setNyFaktisk] = useState(actualAmount?.toString() ?? '')
  const [laster, setLaster] = useState(false)

  const prosent = plannedAmount && actualAmount
    ? Math.min(100, Math.round((actualAmount / plannedAmount) * 100))
    : null

  const progresjonFarge = prosent == null ? 'bg-gray-300'
    : prosent > 90 ? 'bg-red-500'
    : prosent > 70 ? 'bg-amber-500'
    : 'bg-green-500'

  async function lagreBudsjett() {
    setLaster(true)
    await updateBudget({
      week_number: weekNumber,
      year,
      planned_amount: nyPlanlagt ? parseFloat(nyPlanlagt) : null,
      actual_amount: nyFaktisk ? parseFloat(nyFaktisk) : null,
    })
    setRedigerPlanlagt(false)
    setRedigerFaktisk(false)
    setLaster(false)
    startTransition(() => router.refresh())
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Budsjett</h1>
        <p className="text-sm text-gray-500 mt-1">Uke {weekNumber} · {year}</p>
      </div>

      {/* Inneværende uke */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
        <h2 className="font-semibold text-gray-900 mb-4">Denne uken</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Planlagt */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Planlagt budsjett</p>
            {redigerPlanlagt ? (
              <input
                type="number"
                value={nyPlanlagt}
                onChange={(e) => setNyPlanlagt(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-gray-900">
                  {plannedAmount != null ? formatNok(plannedAmount) : '—'}
                </p>
                <button onClick={() => setRedigerPlanlagt(true)} className="text-xs text-green-600 hover:text-green-700">Endre</button>
              </div>
            )}
          </div>

          {/* Faktisk */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Faktisk forbruk</p>
            {redigerFaktisk ? (
              <input
                type="number"
                value={nyFaktisk}
                onChange={(e) => setNyFaktisk(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-gray-900">
                  {actualAmount != null ? formatNok(actualAmount) : '—'}
                </p>
                <button onClick={() => setRedigerFaktisk(true)} className="text-xs text-green-600 hover:text-green-700">Oppdater</button>
              </div>
            )}
          </div>
        </div>

        {/* Progress-bar */}
        {plannedAmount != null && plannedAmount > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>0</span>
              <span>{prosent}% brukt</span>
              <span>{formatNok(plannedAmount)}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${progresjonFarge}`}
                style={{ width: `${prosent ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {(redigerPlanlagt || redigerFaktisk) && (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setRedigerPlanlagt(false); setRedigerFaktisk(false) }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Avbryt
            </button>
            <button
              onClick={lagreBudsjett}
              disabled={laster}
              className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg
                hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {laster ? 'Lagrer…' : 'Lagre'}
            </button>
          </div>
        )}
      </div>

      {/* Historikk */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Historikk</h2>
          </div>
          {history.map((h, i) => {
            const p = h.planned_amount && h.actual_amount
              ? Math.round((h.actual_amount / h.planned_amount) * 100)
              : null
            const erDenne = h.week_number === weekNumber && h.year === year
            return (
              <div key={`${h.year}-${h.week_number}`}
                className={`flex items-center px-5 py-3 gap-4 ${i > 0 ? 'border-t border-gray-100' : ''} ${erDenne ? 'bg-green-50' : ''}`}>
                <div className="w-20 shrink-0">
                  <p className="text-sm font-medium text-gray-900">Uke {h.week_number}</p>
                  <p className="text-xs text-gray-400">{h.year}</p>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Planlagt</p>
                    <p className="font-medium">{h.planned_amount != null ? formatNok(h.planned_amount) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Faktisk</p>
                    <p className="font-medium">{h.actual_amount != null ? formatNok(h.actual_amount) : '—'}</p>
                  </div>
                </div>
                {p != null && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    p > 100 ? 'bg-red-100 text-red-700' : p > 80 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {p}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
