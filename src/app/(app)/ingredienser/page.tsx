'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Variant {
  id: string
  name: string
  bruk: number
}

interface DuplikatGruppe {
  basis: string
  varianter: Variant[]
}

interface KandidaterResponse {
  duplikater: DuplikatGruppe[]
  alle: Variant[]
}

export default function IngrediensAdminPage() {
  const router = useRouter()
  const [data, setData] = useState<KandidaterResponse | null>(null)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState('')
  const [sok, setSok] = useState('')

  const [valg, setValg] = useState<Record<string, string>>({})
  const [slaarSammen, setSlaarSammen] = useState<Record<string, boolean>>({})
  const [sletter, setSletter] = useState<Set<string>>(new Set())
  const [slettedeIds, setSlettedeIds] = useState<Set<string>>(new Set())

  const lastData = useCallback(async () => {
    setLaster(true)
    setFeil('')
    try {
      const res = await fetch('/api/ingredienser/kandidater')
      if (!res.ok) throw new Error('Klarte ikke hente ingredienser')
      const json: KandidaterResponse = await res.json()
      setData(json)
      const init: Record<string, string> = {}
      for (const g of json.duplikater) {
        init[g.basis] = g.varianter[0].id
      }
      setValg((prev) => ({ ...init, ...prev }))
    } catch (e) {
      setFeil(e instanceof Error ? e.message : 'Ukjent feil')
    } finally {
      setLaster(false)
    }
  }, [])

  useEffect(() => { lastData() }, [lastData])

  async function slaaSammen(gruppe: DuplikatGruppe) {
    const winnerId = valg[gruppe.basis] ?? gruppe.varianter[0].id
    const losers = gruppe.varianter.filter((v) => v.id !== winnerId)
    if (losers.length === 0) return

    setSlaarSammen((prev) => ({ ...prev, [gruppe.basis]: true }))
    try {
      for (const loser of losers) {
        const res = await fetch('/api/ingredienser/slaa-sammen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ winnerId, loserId: loser.id }),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.error ?? 'Feil ved sammenslåing')
        }
      }
      setData((prev) => {
        if (!prev) return prev
        const loserIds = new Set(losers.map((l) => l.id))
        return {
          duplikater: prev.duplikater.filter((g) => g.basis !== gruppe.basis),
          alle: prev.alle
            .filter((i) => !loserIds.has(i.id))
            .map((i) =>
              i.id === winnerId
                ? { ...i, bruk: gruppe.varianter.reduce((sum, v) => sum + v.bruk, 0) }
                : i
            ),
        }
      })
    } catch (e) {
      setFeil(e instanceof Error ? e.message : 'Feil ved sammenslåing')
    } finally {
      setSlaarSammen((prev) => ({ ...prev, [gruppe.basis]: false }))
    }
  }

  async function slettIngrediens(ing: Variant) {
    const advarsel = ing.bruk > 0
      ? `«${ing.name}» er brukt i ${ing.bruk} oppskrift${ing.bruk !== 1 ? 'er' : ''}. Den fjernes fra alle oppskrifter. Fortsett?`
      : `Slett «${ing.name}»?`
    if (!confirm(advarsel)) return

    setSletter((prev) => new Set(prev).add(ing.id))
    try {
      const res = await fetch('/api/ingredienser/slett', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredient_id: ing.id }),
      })
      if (!res.ok) {
        const e = await res.json()
        setFeil(e.error ?? 'Klarte ikke slette')
        return
      }
      // Optimistisk: fjern fra begge lister
      setSlettedeIds((prev) => new Set(prev).add(ing.id))
      setData((prev) => {
        if (!prev) return prev
        return {
          duplikater: prev.duplikater
            .map((g) => ({
              ...g,
              varianter: g.varianter.filter((v) => v.id !== ing.id),
            }))
            .filter((g) => g.varianter.length >= 2),
          alle: prev.alle.filter((i) => i.id !== ing.id),
        }
      })
    } catch {
      setFeil('Nettverksfeil. Prøv igjen.')
    } finally {
      setSletter((prev) => { const ny = new Set(prev); ny.delete(ing.id); return ny })
    }
  }

  const filtrert = (data?.alle ?? [])
    .filter((i) => !slettedeIds.has(i.id))
    .filter((i) => i.name.toLowerCase().includes(sok.toLowerCase()))

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Tilbake
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Ingredienser</h1>
      </div>

      {feil && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700 flex items-center justify-between">
          <span>{feil}</span>
          <button onClick={() => setFeil('')} className="text-red-400 hover:text-red-600 ml-2">×</button>
        </div>
      )}

      {/* ── Mulige duplikater ── */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Mulige duplikater
        </h2>

        {laster && <p className="text-sm text-gray-400 italic">Laster…</p>}

        {!laster && data?.duplikater.length === 0 && (
          <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            Ingen mulige duplikater funnet — ingredienslisten er ryddig!
          </div>
        )}

        {data?.duplikater.map((gruppe) => {
          const winner = valg[gruppe.basis] ?? gruppe.varianter[0].id
          const lasterNaa = slaarSammen[gruppe.basis] ?? false
          return (
            <div key={gruppe.basis} className="bg-white rounded-2xl border border-amber-200 p-4 mb-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">
                {gruppe.basis}
              </p>
              <div className="space-y-1.5 mb-3">
                {gruppe.varianter.map((v) => (
                  <label key={v.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name={`gruppe-${gruppe.basis}`}
                      value={v.id}
                      checked={winner === v.id}
                      onChange={() => setValg((p) => ({ ...p, [gruppe.basis]: v.id }))}
                      className="accent-green-600"
                    />
                    <span className="text-sm text-gray-900 flex-1">{v.name}</span>
                    <span className="text-xs text-gray-400">
                      {v.bruk === 0 ? 'ikke brukt' : `${v.bruk} oppskrift${v.bruk !== 1 ? 'er' : ''}`}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Behold: <span className="font-medium text-gray-700">
                    {gruppe.varianter.find((v) => v.id === winner)?.name}
                  </span>
                </p>
                <button
                  onClick={() => slaaSammen(gruppe)}
                  disabled={lasterNaa}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs
                    font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  {lasterNaa ? 'Slår sammen…' : 'Slå sammen →'}
                </button>
              </div>
            </div>
          )
        })}
      </section>

      {/* ── Alle ingredienser ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Alle ingredienser
            {data && (
              <span className="ml-2 font-normal normal-case">
                ({data.alle.filter((i) => !slettedeIds.has(i.id)).length})
              </span>
            )}
          </h2>
          <input
            type="search"
            value={sok}
            onChange={(e) => setSok(e.target.value)}
            placeholder="Søk…"
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm w-40
              focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {!laster && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {filtrert.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400 italic">
                {sok ? 'Ingen treff' : 'Ingen ingredienser ennå'}
              </p>
            ) : (
              filtrert.map((ing, i) => (
                <div
                  key={ing.id}
                  className={`flex items-center px-4 py-2.5 gap-3 group
                    ${i > 0 ? 'border-t border-gray-100' : ''}`}
                >
                  <span className="flex-1 text-sm text-gray-900">{ing.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {ing.bruk === 0
                      ? 'ikke brukt'
                      : `${ing.bruk} oppskrift${ing.bruk !== 1 ? 'er' : ''}`}
                  </span>
                  <button
                    onClick={() => slettIngrediens(ing)}
                    disabled={sletter.has(ing.id)}
                    title="Slett ingrediens"
                    className={`shrink-0 text-xs px-2 py-1 rounded-md font-medium transition-colors
                      disabled:opacity-40
                      ${ing.bruk > 0
                        ? 'text-orange-600 hover:bg-orange-50 opacity-0 group-hover:opacity-100'
                        : 'text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                      }`}
                  >
                    {sletter.has(ing.id) ? '…' : 'Slett'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  )
}
