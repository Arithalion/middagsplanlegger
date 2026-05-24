'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const HVERDAGER = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag'] as const
type Hverdag = typeof HVERDAGER[number]

type Barn = { id: string; name: string; role: string }

interface Props {
  barn: Barn[]
  planMap: Record<string, Record<string, { num_lunchboxes: number; num_fruit: number }>>
  weekNumber: number
  year: number
}

export default function MatpakkeKlient({ barn, planMap: initialPlanMap, weekNumber, year }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [planMap, setPlanMap] = useState(initialPlanMap)
  const [lagrer, setLagrer] = useState(false)
  const [melding, setMelding] = useState('')

  function getVerdi(memberId: string, dag: string, felt: 'num_lunchboxes' | 'num_fruit'): number {
    return planMap[memberId]?.[dag]?.[felt] ?? (felt === 'num_lunchboxes' ? 1 : 1)
  }

  function oppdater(memberId: string, dag: string, felt: 'num_lunchboxes' | 'num_fruit', verdi: number) {
    setPlanMap((prev) => ({
      ...prev,
      [memberId]: {
        ...(prev[memberId] ?? {}),
        [dag]: {
          num_lunchboxes: felt === 'num_lunchboxes' ? verdi : (prev[memberId]?.[dag]?.num_lunchboxes ?? 1),
          num_fruit: felt === 'num_fruit' ? verdi : (prev[memberId]?.[dag]?.num_fruit ?? 1),
        },
      },
    }))
  }

  async function lagrePlan() {
    setLagrer(true)
    setMelding('')
    try {
      const res = await fetch('/api/matpakker/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekNumber, year, planMap }),
      })
      const data = await res.json()
      if (!res.ok) { setMelding(data.error ?? 'Feil ved lagring'); return }
      setMelding('Matpakkeplan lagret! ✓')
      startTransition(() => router.refresh())
    } catch {
      setMelding('En feil oppstod')
    } finally {
      setLagrer(false)
      setTimeout(() => setMelding(''), 3000)
    }
  }

  async function leggTilHandleliste() {
    setLagrer(true)
    setMelding('')
    try {
      const res = await fetch('/api/matpakker/add-to-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekNumber, year }),
      })
      const data = await res.json()
      setMelding(data.message ?? 'Lagt til i handlelisten!')
    } catch {
      setMelding('Klarte ikke legge til i handlelisten')
    } finally {
      setLagrer(false)
      setTimeout(() => setMelding(''), 4000)
    }
  }

  // Tell opp totalt
  const totaler = barn.map((b) => {
    const matpakker = HVERDAGER.reduce((s, dag) => s + getVerdi(b.id, dag, 'num_lunchboxes'), 0)
    const frukt = HVERDAGER.reduce((s, dag) => s + getVerdi(b.id, dag, 'num_fruit'), 0)
    return { navn: b.name, matpakker, frukt }
  })

  if (barn.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Matpakker</h1>
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-4xl mb-3">🍞</p>
          <p className="font-medium text-gray-700 mb-2">Ingen barn registrert</p>
          <p className="text-sm text-gray-500">
            Gå til <a href="/innstillinger" className="text-green-600 hover:underline">Innstillinger → Medlemmer</a> for å legge til barn
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Matpakker</h1>
          <p className="text-sm text-gray-500 mt-1">Uke {weekNumber} · {year}</p>
        </div>
        <div className="flex items-center gap-2">
          {melding && <span className="text-sm text-green-600 font-medium">{melding}</span>}
          <button
            onClick={leggTilHandleliste}
            disabled={lagrer || isPending}
            className="px-3 py-2 text-sm font-medium bg-blue-100 text-blue-700
              rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
          >
            🛒 Legg til i handleliste
          </button>
          <button
            onClick={lagrePlan}
            disabled={lagrer || isPending}
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white
              rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {lagrer ? 'Lagrer…' : 'Lagre'}
          </button>
        </div>
      </div>

      {/* Per barn */}
      {barn.map((b) => (
        <div key={b.id} className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-xl">🧒</span>
            {b.name}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 pr-4">
                    Dag
                  </th>
                  <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 px-3">
                    🍞 Matpakker
                  </th>
                  <th className="text-center text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 px-3">
                    🍎 Frukt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {HVERDAGER.map((dag) => (
                  <tr key={dag}>
                    <td className="py-2 pr-4 text-gray-700 capitalize font-medium">{dag}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => oppdater(b.id, dag, 'num_lunchboxes', Math.max(0, getVerdi(b.id, dag, 'num_lunchboxes') - 1))}
                          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold"
                        >−</button>
                        <span className="w-6 text-center font-semibold">
                          {getVerdi(b.id, dag, 'num_lunchboxes')}
                        </span>
                        <button
                          onClick={() => oppdater(b.id, dag, 'num_lunchboxes', getVerdi(b.id, dag, 'num_lunchboxes') + 1)}
                          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold"
                        >+</button>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => oppdater(b.id, dag, 'num_fruit', Math.max(0, getVerdi(b.id, dag, 'num_fruit') - 1))}
                          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold"
                        >−</button>
                        <span className="w-6 text-center font-semibold">
                          {getVerdi(b.id, dag, 'num_fruit')}
                        </span>
                        <button
                          onClick={() => oppdater(b.id, dag, 'num_fruit', getVerdi(b.id, dag, 'num_fruit') + 1)}
                          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center text-sm font-bold"
                        >+</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200">
                  <td className="pt-2 text-xs text-gray-500 font-medium">Total</td>
                  <td className="pt-2 text-center font-bold text-gray-900">
                    {HVERDAGER.reduce((s, d) => s + getVerdi(b.id, d, 'num_lunchboxes'), 0)}
                  </td>
                  <td className="pt-2 text-center font-bold text-gray-900">
                    {HVERDAGER.reduce((s, d) => s + getVerdi(b.id, d, 'num_fruit'), 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}

      {/* Sammendrag */}
      {barn.length > 1 && (
        <div className="bg-green-50 rounded-2xl border border-green-200 p-4">
          <h3 className="font-semibold text-green-900 mb-2 text-sm">Ukessammendrag</h3>
          <div className="flex flex-wrap gap-4">
            {totaler.map((t) => (
              <div key={t.navn} className="text-sm">
                <span className="font-medium text-green-800">{t.navn}:</span>{' '}
                <span className="text-green-700">{t.matpakker} matpakker, {t.frukt} frukt</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
