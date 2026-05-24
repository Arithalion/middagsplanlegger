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
  packages_needed: number | null
  is_manual: boolean
  manual_name: string | null
  ingredient: { id: string; name: string; category: string | null } | null
}

type MealSummaryItem = {
  weekday: string
  dato: string
  recipeName: string | null
}

interface Props {
  listId: string | null
  listType: string | null
  weekNumber: number | null
  year: number | null
  items: HandlelisteItem[]
  totalEstimert: number
  mealSummary: MealSummaryItem[]
}

export default function HandlelisteKlient({
  listId, listType, weekNumber, year, items, totalEstimert, mealSummary,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [lokalItems, setLokalItems] = useState(items)
  const [endringer, setEndringer] = useState<Map<string, boolean>>(new Map())

  const [genererer, setGenererer] = useState(false)
  const [oppdaterer, setOppdaterer] = useState(false)
  const [lagrer, setLagrer] = useState(false)
  const [tømmer, setTømmer] = useState(false)
  const [kjøptÅpen, setKjøptÅpen] = useState(false)
  const [oppsummeringÅpen, setOppsummeringÅpen] = useState(false)
  const [melding, setMelding] = useState('')

  // Manuell tillegg
  const [visManualModal, setVisManualModal] = useState(false)
  const [manueltNavn, setManueltNavn] = useState('')
  const [manueltAntall, setManueltAntall] = useState('1')
  const [manueltEnhet, setManueltEnhet] = useState('stk')
  const [leggerTil, setLeggerTil] = useState(false)

  // Beholdningsmodal (post-kjøp)
  const [visBeholdningModal, setVisBeholdningModal] = useState(false)
  const [beholdningJust, setBeholdningJust] = useState<Map<string, number>>(new Map())
  const [fullfører, setFullfører] = useState(false)

  function visMelding(tekst: string) {
    setMelding(tekst)
    setTimeout(() => setMelding(''), 3500)
  }

  // ── Toggle is_bought ──────────────────────────────────────────────────────
  function toggleKjøpt(itemId: string) {
    setLokalItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, is_bought: !i.is_bought } : i
    ))
    setEndringer(prev => {
      const ny = new Map(prev)
      const original = items.find(i => i.id === itemId)?.is_bought ?? false
      const nåværende = lokalItems.find(i => i.id === itemId)?.is_bought ?? false
      const nyVerdi = !nåværende
      if (nyVerdi === original) ny.delete(itemId)
      else ny.set(itemId, nyVerdi)
      return ny
    })
  }

  // ── Lagre endringer ───────────────────────────────────────────────────────
  async function lagreEndringer() {
    if (endringer.size === 0) return
    setLagrer(true)
    const changes = Array.from(endringer.entries()).map(([id, is_bought]) => ({ id, is_bought }))
    await fetch('/api/shopping-list/batch-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes }),
    })
    setEndringer(new Map())
    setLagrer(false)
    visMelding('Endringer lagret ✓')
  }

  // ── Marker hele lista kjøpt — åpner beholdningsmodal ────────────────────
  function åpneBeholdningModal() {
    if (!listId) return
    // Bygg justeringer med default = kjøpt mengde
    const juster = new Map<string, number>()
    for (const item of lokalItems) {
      if (!item.is_bought && !item.is_manual && item.ingredient?.id) {
        juster.set(item.ingredient.id, item.amount)
      }
    }
    setBeholdningJust(juster)
    setVisBeholdningModal(true)
  }

  async function fullførKjøp(oppdaterBeholdning: boolean) {
    if (!listId) return
    setFullfører(true)

    const pantryUpdates = oppdaterBeholdning
      ? lokalItems
          .filter((i) => !i.is_manual && i.ingredient?.id && !i.is_bought)
          .map((i) => ({
            ingredient_id: i.ingredient!.id,
            amount: beholdningJust.get(i.ingredient!.id) ?? i.amount,
            unit: i.unit as string,
          }))
          .filter((u) => u.amount > 0)
      : []

    await fetch('/api/shopping-list/ferdig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId, pantryUpdates }),
    })

    setLokalItems(prev => prev.map(i => ({ ...i, is_bought: true })))
    setEndringer(new Map())
    setVisBeholdningModal(false)
    setFullfører(false)
    visMelding(oppdaterBeholdning ? 'Kjøpt! Beholdning oppdatert ✓' : 'Handleliste fullført ✓')
    startTransition(() => router.refresh())
  }

  // ── Tøm handleliste ───────────────────────────────────────────────────────
  async function tømListe() {
    if (!listId || !confirm('Tøm hele handlelisten? Dette kan ikke angres.')) return
    setTømmer(true)
    await fetch('/api/shopping-list/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId }),
    })
    setTømmer(false)
    startTransition(() => router.refresh())
  }

  // ── Generer ny liste ──────────────────────────────────────────────────────
  async function genererHandleliste() {
    setGenererer(true)
    const res = await fetch('/api/shopping-list/generate', { method: 'POST' })
    const data = await res.json()
    visMelding(data.message ?? 'Handleliste generert!')
    setGenererer(false)
    startTransition(() => router.refresh())
  }

  // ── Oppdater liste fra ukesmeny ───────────────────────────────────────────
  async function oppdaterListe() {
    if (!listId) return
    setOppdaterer(true)
    const res = await fetch('/api/shopping-list/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId, weekNumber, year }),
    })
    const data = await res.json()
    visMelding(data.message ?? 'Liste oppdatert!')
    setOppdaterer(false)
    startTransition(() => router.refresh())
  }

  // ── Legg til manuell vare ─────────────────────────────────────────────────
  async function leggTilManuelt(e: React.FormEvent) {
    e.preventDefault()
    if (!manueltNavn.trim()) return
    setLeggerTil(true)
    const res = await fetch('/api/shopping-list/add-manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        list_id: listId ?? null,
        manual_name: manueltNavn.trim(),
        amount: parseFloat(manueltAntall) || 1,
        unit: manueltEnhet,
      }),
    })
    setLeggerTil(false)
    if (res.ok) {
      setManueltNavn('')
      setManueltAntall('1')
      setManueltEnhet('stk')
      setVisManualModal(false)
      visMelding(`${manueltNavn} lagt til ✓`)
      startTransition(() => router.refresh())
    }
  }

  const ikkeKjøpt = lokalItems.filter(i => !i.is_bought)
  const kjøpt = lokalItems.filter(i => i.is_bought)
  const harEndringer = endringer.size > 0

  const ikkeKjøptAuto = ikkeKjøpt.filter(i => !i.is_manual)
  const ikkeKjøptManuell = ikkeKjøpt.filter(i => i.is_manual)

  const grupper = ikkeKjøptAuto.reduce<Record<string, HandlelisteItem[]>>((acc, item) => {
    const kat = item.ingredient?.category ?? 'Annet'
    if (!acc[kat]) acc[kat] = []
    acc[kat].push(item)
    return acc
  }, {})

  // Beregn estimert sum for varer som ikke er kjøpt
  const estimertGjenstår = ikkeKjøpt.reduce((s, i) => s + (i.estimated_price ?? 0), 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Handleliste</h1>
          {listId && (
            <p className="text-sm text-gray-500 mt-0.5">
              {listType === 'hoved' ? 'Hovedhandel' : 'Ferskvarehandel'}
              {weekNumber ? ` · Uke ${weekNumber}` : ''}
              {' · '}{ikkeKjøpt.length} varer gjenstår
            </p>
          )}
        </div>
        {melding && (
          <span className="text-sm text-green-600 font-medium shrink-0 mt-1">{melding}</span>
        )}
      </div>

      {/* Handlinger */}
      {listId && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={lagreEndringer}
            disabled={!harEndringer || lagrer}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl
              transition-colors ${harEndringer
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            {lagrer ? '…' : '💾'}
            {lagrer ? 'Lagrer…' : harEndringer ? `Lagre (${endringer.size})` : 'Ingen endringer'}
          </button>

          <button
            onClick={oppdaterListe}
            disabled={oppdaterer || isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              bg-blue-50 text-blue-700 border border-blue-200 rounded-xl
              hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            {oppdaterer ? '…' : '🔄'} {oppdaterer ? 'Oppdaterer…' : 'Oppdater fra meny'}
          </button>

          <button
            onClick={genererHandleliste}
            disabled={genererer || isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {genererer ? '…' : '✨'} {genererer ? 'Genererer…' : 'Ny liste'}
          </button>

          <button
            onClick={tømListe}
            disabled={tømmer || isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              bg-red-50 text-red-600 border border-red-200 rounded-xl
              hover:bg-red-100 transition-colors disabled:opacity-50 ml-auto"
          >
            {tømmer ? '…' : '🗑️'} {tømmer ? 'Tømmer…' : 'Tøm'}
          </button>
        </div>
      )}

      {/* Prisestimat */}
      {listId && estimertGjenstår > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between">
          <span className="text-sm text-green-700">Estimert gjenstående</span>
          <span className="text-sm font-semibold text-green-900">{formatNok(estimertGjenstår)}</span>
        </div>
      )}

      {/* Oppsummering — hvilke middager inngår */}
      {mealSummary.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setOppsummeringÅpen(!oppsummeringÅpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl
              bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors text-sm"
          >
            <span className="font-medium text-gray-600 flex items-center gap-2">
              📋 Middager i denne listen
              <span className="bg-gray-200 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                {mealSummary.length}
              </span>
            </span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${oppsummeringÅpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {oppsummeringÅpen && (
            <div className="mt-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
              {mealSummary.map((m, i) => (
                <div key={m.weekday}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <span className="w-24 shrink-0 font-medium text-gray-600 capitalize">{m.weekday.slice(0, 3)} {m.dato}</span>
                  <span className="text-gray-900">{m.recipeName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Seksjon 1: Fra ukesplan ── */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 px-1">
          Fra ukesplan
        </h2>

        {!listId ? (
          <div className="py-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-3xl mb-2">🛒</p>
            <p className="text-sm text-gray-500 font-medium mb-3">Ingen genererte varer</p>
            <button
              onClick={genererHandleliste}
              disabled={genererer}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl
                hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {genererer ? 'Genererer…' : 'Generer fra ukesplan'}
            </button>
          </div>
        ) : ikkeKjøptAuto.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-xl mb-1">🎉</p>
            <p className="font-medium text-green-800 text-sm">Alle genererte varer er plukket!</p>
          </div>
        ) : (
          Object.entries(grupper).map(([kategori, vareListe]) => (
            <div key={kategori} className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 px-1">
                {kategori}
              </h3>
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {vareListe.map((item, i) => (
                  <VareRad key={item.id} item={item} border={i > 0} onToggle={toggleKjøpt} variant="aktiv" erEndret={endringer.has(item.id)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Seksjon 2: Andre varer ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Andre varer
          </h2>
          <button
            onClick={() => setVisManualModal(true)}
            className="flex items-center gap-1 text-xs font-semibold text-green-700
              hover:text-green-800 transition-colors"
          >
            <span className="text-base leading-none">+</span> Legg til
          </button>
        </div>

        {ikkeKjøptManuell.length === 0 ? (
          <div className="py-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <p className="text-sm text-gray-400">Ingen manuelle varer — trykk «+ Legg til» for å legge til</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {ikkeKjøptManuell.map((item, i) => (
              <VareRad key={item.id} item={item} border={i > 0} onToggle={toggleKjøpt} variant="aktiv" erEndret={endringer.has(item.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Plukket/kjøpt */}
      {kjøpt.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setKjøptÅpen(!kjøptÅpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl
              bg-gray-100 hover:bg-gray-150 transition-colors text-sm"
          >
            <span className="font-medium text-gray-600 flex items-center gap-2">
              <span>✅</span>
              Plukket eller kjøpt
              <span className="bg-gray-300 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {kjøpt.length}
              </span>
            </span>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${kjøptÅpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {kjøptÅpen && (
            <div className="mt-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {kjøpt.map((item, i) => (
                <VareRad key={item.id} item={item} border={i > 0} onToggle={toggleKjøpt} variant="kjøpt" erEndret={endringer.has(item.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bunn — bare når liste finnes */}
      {listId && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4">
          {totalEstimert > 0 && (
            <p className="text-sm text-gray-500">
              Total estimert: <span className="font-semibold text-gray-900">{formatNok(totalEstimert)}</span>
            </p>
          )}
          <button
            onClick={åpneBeholdningModal}
            disabled={isPending || lokalItems.every(i => i.is_bought)}
            className="ml-auto px-4 py-2 bg-green-600 text-white text-sm font-medium
              rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40"
          >
            ✅ Hele lista kjøpt
          </button>
        </div>
      )}

      {/* ── Beholdningsmodal (post-kjøp) ── */}
      {visBeholdningModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Legg til i beholdning?</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Juster mengdene du vil lagre — alt overskudd fra handleturen.
              </p>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              {lokalItems
                .filter((i) => !i.is_bought && !i.is_manual && i.ingredient?.id)
                .map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-gray-900">{item.ingredient!.name}</span>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={beholdningJust.get(item.ingredient!.id) ?? item.amount}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        setBeholdningJust((prev) => {
                          const ny = new Map(prev)
                          ny.set(item.ingredient!.id, isNaN(v) ? 0 : v)
                          return ny
                        })
                      }}
                      className="w-20 text-sm rounded-lg border border-gray-300 px-2 py-1
                        focus:outline-none focus:ring-2 focus:ring-green-500 text-right"
                    />
                    <span className="text-sm text-gray-500 w-12 shrink-0">{item.unit}</span>
                  </div>
                ))}

              {lokalItems.filter((i) => !i.is_bought && !i.is_manual && i.ingredient?.id).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Ingen ingrediensvarer å legge til</p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex flex-col gap-2">
              <button
                onClick={() => fullførKjøp(true)}
                disabled={fullfører}
                className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl
                  hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {fullfører ? 'Lagrer…' : '🥕 Legg til i beholdning og fullfør'}
              </button>
              <button
                onClick={() => fullførKjøp(false)}
                disabled={fullfører}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Fullfør uten beholdningsoppdatering
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manuell tillegg-modal ── */}
      {visManualModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setVisManualModal(false) }}
        >
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Legg til manuelt</h2>
              <button
                onClick={() => setVisManualModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg"
              >
                ×
              </button>
            </div>
            <form onSubmit={leggTilManuelt} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Varenavn *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={manueltNavn}
                  onChange={(e) => setManueltNavn(e.target.value)}
                  placeholder="f.eks. Kjøkkenpapir"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                    focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Antall</label>
                  <input
                    type="number"
                    value={manueltAntall}
                    onChange={(e) => setManueltAntall(e.target.value)}
                    min={0}
                    step="any"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enhet</label>
                  <select
                    value={manueltEnhet}
                    onChange={(e) => setManueltEnhet(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="stk">stk</option>
                    <option value="pose">pose</option>
                    <option value="pk">pk</option>
                    <option value="liter">liter</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="dl">dl</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={leggerTil || !manueltNavn.trim()}
                className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl
                  hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {leggerTil ? 'Legger til…' : 'Legg til'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── VareRad ──────────────────────────────────────────────────────────────────

function VareRad({ item, border, onToggle, variant, erEndret }: {
  item: HandlelisteItem
  border: boolean
  onToggle: (id: string) => void
  variant: 'aktiv' | 'kjøpt'
  erEndret: boolean
}) {
  const navn = item.is_manual ? (item.manual_name ?? 'Ukjent') : (item.ingredient?.name ?? 'Ukjent')
  const isPriced = item.estimated_price != null

  return (
    <button
      onClick={() => onToggle(item.id)}
      className={`w-full flex items-center px-4 py-3.5 gap-3 text-left
        active:bg-gray-50 transition-colors
        ${border ? 'border-t border-gray-100' : ''}
        ${variant === 'kjøpt' ? 'bg-gray-50/60' : 'hover:bg-gray-50/40'}
        ${erEndret ? 'bg-amber-50/40' : ''}`}
    >
      {/* Checkbox */}
      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
        variant === 'kjøpt' ? 'bg-green-500 border-green-500' : 'border-gray-300'
      }`}>
        {variant === 'kjøpt' && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>

      {/* Navn + pris */}
      <span className="flex-1 min-w-0">
        <span className={`block text-sm font-medium ${
          variant === 'kjøpt' ? 'line-through text-gray-400' : 'text-gray-900'
        }`}>
          {item.is_manual && <span className="text-amber-500 mr-1">✏️</span>}
          {navn}
        </span>
        {isPriced && variant === 'aktiv' && (
          <span className="text-xs italic text-gray-400">
            {item.packages_needed != null ? `${item.packages_needed} pk · ` : ''}
            {formatNok(item.estimated_price!)}
          </span>
        )}
      </span>

      {erEndret && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Ulagret endring" />}

      {/* Mengde */}
      <span className={`text-sm shrink-0 ${variant === 'kjøpt' ? 'text-gray-300' : 'text-gray-500'}`}>
        {formatMengde(item.amount, item.unit)}
      </span>

      {variant === 'kjøpt' && (
        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      )}
    </button>
  )
}
