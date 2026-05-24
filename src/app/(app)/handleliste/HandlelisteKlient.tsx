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
  // Sporer endringer: Map<itemId, is_bought>
  const [endringer, setEndringer] = useState<Map<string, boolean>>(new Map())

  const [genererer, setGenererer] = useState(false)
  const [oppdaterer, setOppdaterer] = useState(false)
  const [lagrer, setLagrer] = useState(false)
  const [tømmer, setTømmer] = useState(false)
  const [kjøptÅpen, setKjøptÅpen] = useState(false)
  const [oppsummeringÅpen, setOppsummeringÅpen] = useState(false)
  const [melding, setMelding] = useState('')

  function visMelding(tekst: string) {
    setMelding(tekst)
    setTimeout(() => setMelding(''), 3500)
  }

  // ── Toggle is_bought (kun lokalt — lagres med Lagre-knapp) ──
  function toggleKjøpt(itemId: string) {
    setLokalItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, is_bought: !i.is_bought } : i
    ))
    setEndringer(prev => {
      const ny = new Map(prev)
      const original = items.find(i => i.id === itemId)?.is_bought ?? false
      const nåværende = lokalItems.find(i => i.id === itemId)?.is_bought ?? false
      // Ny verdi er det motsatte av nåværende
      const nyVerdi = !nåværende
      if (nyVerdi === original) {
        ny.delete(itemId) // Tilbake til original — fjern fra endringer
      } else {
        ny.set(itemId, nyVerdi)
      }
      return ny
    })
  }

  // ── Lagre endringer ──
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

  // ── Marker hele lista kjøpt ──
  async function markerAltKjøpt() {
    if (!listId || !confirm('Marker hele listen som kjøpt og oppdater beholdning?')) return
    setLokalItems(prev => prev.map(i => ({ ...i, is_bought: true })))
    setEndringer(new Map())
    await fetch('/api/shopping-list/mark-all-bought', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listId }),
    })
    visMelding('Hele listen er kjøpt! Beholdning oppdatert.')
    startTransition(() => router.refresh())
  }

  // ── Tøm handleliste ──
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

  // ── Generer ny liste ──
  async function genererHandleliste() {
    setGenererer(true)
    const res = await fetch('/api/shopping-list/generate', { method: 'POST' })
    const data = await res.json()
    visMelding(data.message ?? 'Handleliste generert!')
    setGenererer(false)
    startTransition(() => router.refresh())
  }

  // ── Oppdater liste fra ukesmeny ──
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

  const ikkeKjøpt = lokalItems.filter(i => !i.is_bought)
  const kjøpt = lokalItems.filter(i => i.is_bought)
  const harEndringer = endringer.size > 0

  const grupper = ikkeKjøpt.reduce<Record<string, HandlelisteItem[]>>((acc, item) => {
    const kat = item.ingredient.category ?? 'Annet'
    if (!acc[kat]) acc[kat] = []
    acc[kat].push(item)
    return acc
  }, {})

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
          {/* Lagre-knapp — aktiv kun ved ulagrede endringer */}
          <button
            onClick={lagreEndringer}
            disabled={!harEndringer || lagrer}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl
              transition-colors ${harEndringer
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            {lagrer ? '…' : '💾'}
            {lagrer ? 'Lagrer…' : harEndringer ? `Lagre endringer (${endringer.size})` : 'Ingen endringer'}
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
            {tømmer ? '…' : '🗑️'} {tømmer ? 'Tømmer…' : 'Tøm liste'}
          </button>
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

      {!listId ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-gray-500 font-medium mb-4">Ingen aktiv handleliste</p>
          <button
            onClick={genererHandleliste}
            disabled={genererer}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl
              hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {genererer ? 'Genererer…' : 'Generer fra ukesplan'}
          </button>
        </div>
      ) : (
        <>
          {/* Aktiv liste */}
          {ikkeKjøpt.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center mb-4">
              <p className="text-2xl mb-2">🎉</p>
              <p className="font-medium text-green-800">Alt er plukket!</p>
              <p className="text-sm text-green-600 mt-1">Husk å lagre og trykk «Hele lista kjøpt» i kassen.</p>
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

          {/* Bunn */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-between gap-4">
            {totalEstimert > 0 && (
              <p className="text-sm text-gray-500">
                Estimert: <span className="font-semibold text-gray-900">{formatNok(totalEstimert)}</span>
              </p>
            )}
            <button
              onClick={markerAltKjøpt}
              disabled={isPending || lokalItems.every(i => i.is_bought)}
              className="ml-auto px-4 py-2 bg-green-600 text-white text-sm font-medium
                rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40"
            >
              ✅ Hele lista kjøpt
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Varerad ──────────────────────────────────────────────────

function VareRad({ item, border, onToggle, variant, erEndret }: {
  item: HandlelisteItem
  border: boolean
  onToggle: (id: string) => void
  variant: 'aktiv' | 'kjøpt'
  erEndret: boolean
}) {
  return (
    <button
      onClick={() => onToggle(item.id)}
      className={`w-full flex items-center px-4 py-3.5 gap-3 text-left
        active:bg-gray-50 transition-colors
        ${border ? 'border-t border-gray-100' : ''}
        ${variant === 'kjøpt' ? 'bg-gray-50/60' : 'hover:bg-gray-50/40'}
        ${erEndret ? 'bg-amber-50/40' : ''}`}
    >
      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
        variant === 'kjøpt' ? 'bg-green-500 border-green-500' : 'border-gray-300'
      }`}>
        {variant === 'kjøpt' && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>

      <span className={`flex-1 text-sm font-medium ${
        variant === 'kjøpt' ? 'line-through text-gray-400' : 'text-gray-900'
      }`}>
        {item.ingredient.name}
      </span>

      {erEndret && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Ulagret endring" />}

      <span className={`text-sm shrink-0 ${variant === 'kjøpt' ? 'text-gray-300' : 'text-gray-500'}`}>
        {formatMengde(item.amount, item.unit)}
      </span>

      {item.estimated_price != null && (
        <span className={`text-sm shrink-0 w-14 text-right ${variant === 'kjøpt' ? 'text-gray-300' : 'text-gray-400'}`}>
          {formatNok(item.estimated_price)}
        </span>
      )}

      {variant === 'kjøpt' && (
        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
        </svg>
      )}
    </button>
  )
}
