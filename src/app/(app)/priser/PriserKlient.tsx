'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type KassalLink = {
  kassal_ean: string
  kassal_product_id: number | null
  product_name: string
  package_size: number
  package_unit: string
  price_per_package: number | null
  last_synced_at: string | null
}

type PrisIng = {
  id: string
  name: string
  category: string | null
  default_unit: string
  price: { id: string; price_per_unit: number; unit: string; source: string | null; updated_at: string } | null
  kassalLink: KassalLink | null
}

type KassalTreff = {
  kassal_product_id: number
  kassal_ean: string
  product_name: string
  brand: string | null
  image: string | null
  price_per_package: number | null
  package_size: number | null
  package_unit: string | null
  store: string | null
  is_organic: boolean
}

interface Props {
  ingredients: PrisIng[]
  preferOrganic: boolean
}

export default function PriserKlient({ ingredients, preferOrganic }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [søk, setSøk] = useState('')
  const [redigerer, setRedigerer] = useState<string | null>(null)
  const [nyPris, setNyPris] = useState('')
  const [lagrer, setLagrer] = useState(false)
  const [lagretId, setLagretId] = useState<string | null>(null)
  const [synker, setSynker] = useState(false)
  const [melding, setMelding] = useState('')

  // Kassal-søk
  const [kassalSøkId, setKassalSøkId] = useState<string | null>(null)
  const [kassalQuery, setKassalQuery] = useState('')
  const [kassalTreff, setKassalTreff] = useState<KassalTreff[]>([])
  const [kassalSøker, setKassalSøker] = useState(false)
  const [kassalFeil, setKassalFeil] = useState('')
  const [koblerIds, setKoblerIds] = useState<Set<string>>(new Set())

  const søkInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Lokale koblinger (optimistisk UI-oppdatering)
  const [lokaleLinks, setLokaleLinks] = useState<Map<string, KassalLink | null>>(
    new Map(ingredients.map((i) => [i.id, i.kassalLink]))
  )

  function visMelding(tekst: string) {
    setMelding(tekst)
    setTimeout(() => setMelding(''), 3500)
  }

  // ── Åpne søkemodal ──────────────────────────────────────────────────────
  function åpneKassalSøk(ing: PrisIng) {
    setKassalSøkId(ing.id)
    setKassalQuery(ing.name)
    setKassalTreff([])
    setKassalFeil('')
    setTimeout(() => søkInputRef.current?.focus(), 50)
    triggerSøk(ing.name)
  }

  function lukkModal() {
    setKassalSøkId(null)
    setKassalTreff([])
    setKassalFeil('')
  }

  // ── Søk i Kassal ─────────────────────────────────────────────────────────
  function triggerSøk(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setKassalTreff([]); return }
    debounceRef.current = setTimeout(() => utførSøk(q), 400)
  }

  async function utførSøk(q: string) {
    setKassalSøker(true)
    setKassalFeil('')
    try {
      const res = await fetch(`/api/kassal/soek?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) { setKassalFeil(data.error ?? 'Søk feilet'); return }
      setKassalTreff(data.products ?? [])
      if ((data.products ?? []).length === 0) setKassalFeil('Ingen treff. Prøv et annet søkeord.')
    } catch {
      setKassalFeil('Nettverksfeil. Sjekk tilkobling.')
    } finally {
      setKassalSøker(false)
    }
  }

  useEffect(() => {
    if (kassalQuery) triggerSøk(kassalQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kassalQuery])

  // ── Koble produkt ─────────────────────────────────────────────────────────
  async function kobleProdukt(ingId: string, treff: KassalTreff) {
    if (!treff.package_size || !treff.package_unit || !treff.kassal_ean) {
      setKassalFeil('Produktet mangler pakkedata — prøv et annet.')
      return
    }
    setKoblerIds((prev) => new Set(prev).add(ingId))
    try {
      const res = await fetch('/api/kassal/koble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredient_id: ingId,
          kassal_ean: treff.kassal_ean,
          kassal_product_id: treff.kassal_product_id,
          product_name: treff.product_name,
          package_size: treff.package_size,
          package_unit: treff.package_unit,
          price_per_package: treff.price_per_package,
        }),
      })
      if (!res.ok) { setKassalFeil('Klarte ikke lagre. Prøv igjen.'); return }

      // Optimistisk oppdatering
      setLokaleLinks((prev) => {
        const ny = new Map(prev)
        ny.set(ingId, {
          kassal_ean: treff.kassal_ean,
          kassal_product_id: treff.kassal_product_id,
          product_name: treff.product_name,
          package_size: treff.package_size!,
          package_unit: treff.package_unit!,
          price_per_package: treff.price_per_package,
          last_synced_at: new Date().toISOString(),
        })
        return ny
      })

      lukkModal()
      visMelding(`${treff.product_name} koblet ✓`)
      startTransition(() => router.refresh())
    } finally {
      setKoblerIds((prev) => { const ny = new Set(prev); ny.delete(ingId); return ny })
    }
  }

  // ── Avkoble produkt ───────────────────────────────────────────────────────
  async function avkobleProdukt(ingId: string) {
    if (!confirm('Fjerne Kassal-koblingen for denne ingrediensen?')) return
    await fetch('/api/kassal/koble', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredient_id: ingId }),
    })
    setLokaleLinks((prev) => { const ny = new Map(prev); ny.set(ingId, null); return ny })
    startTransition(() => router.refresh())
  }

  // ── Synk alle priser ─────────────────────────────────────────────────────
  async function synkAllePriser() {
    setSynker(true)
    const res = await fetch('/api/kassal/synk', { method: 'POST' })
    const data = await res.json()
    setSynker(false)
    visMelding(data.message ?? 'Synkronisert!')
    startTransition(() => router.refresh())
  }

  // ── Manuell pris ─────────────────────────────────────────────────────────
  async function lagrePris(ingredientId: string) {
    if (!nyPris) return
    setLagrer(true)
    const res = await fetch('/api/priser/oppdater', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientId, price: parseFloat(nyPris) }),
    })
    setLagrer(false)
    if (res.ok) {
      setLagretId(ingredientId)
      setTimeout(() => setLagretId(null), 2000)
    }
    setRedigerer(null)
    setNyPris('')
  }

  const filtrert = ingredients.filter((i) =>
    i.name.toLowerCase().includes(søk.toLowerCase()) ||
    (i.category ?? '').toLowerCase().includes(søk.toLowerCase())
  )

  const antallKoblet = Array.from(lokaleLinks.values()).filter(Boolean).length
  const medPris = ingredients.filter((i) => i.price !== null).length

  const aktivIngrediens = kassalSøkId ? ingredients.find((i) => i.id === kassalSøkId) : null

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Priser</h1>
          <p className="text-sm text-gray-500 mt-1">
            {antallKoblet} koblet til Kassal · {medPris} med pris · {ingredients.length - medPris} uten pris
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {melding && <span className="text-sm text-green-600 font-medium">{melding}</span>}
          <button
            onClick={synkAllePriser}
            disabled={synker || isPending || antallKoblet === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              bg-blue-600 text-white rounded-lg hover:bg-blue-700
              transition-colors disabled:opacity-40"
          >
            {synker ? '…' : '🔄'} {synker ? 'Synkroniserer…' : 'Synk alle priser'}
          </button>
        </div>
      </div>

      {/* ── Organisk-info ── */}
      {preferOrganic && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 mb-4 text-sm text-green-700 flex items-center gap-2">
          🌿 Organisk-preferanse er på — Kassal-søk viser økologiske produkter øverst
        </div>
      )}

      {/* ── Info ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 text-sm text-blue-700">
        💡 Koble ingredienser til Kassal-produkter for automatisk prisoppdatering og pakkeutregning i handlelisten.
      </div>

      {/* ── Søk ── */}
      <div className="mb-4">
        <input
          type="search"
          value={søk}
          onChange={(e) => setSøk(e.target.value)}
          placeholder="Søk etter ingrediens…"
          className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* ── Ingrediensliste ── */}
      {filtrert.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Ingen ingredienser funnet</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {filtrert.map((ing, i) => {
            const link = lokaleLinks.get(ing.id) ?? null
            return (
              <div
                key={ing.id}
                className={`px-4 py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* Ingrediensnavn */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{ing.name}</p>
                    {ing.category && <p className="text-xs text-gray-400">{ing.category}</p>}
                  </div>

                  {/* Kassal-status + handlinger */}
                  {link ? (
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {link.price_per_package != null
                            ? `${link.price_per_package.toFixed(2)} kr`
                            : 'Pris ukjent'}
                        </p>
                        <p className="text-xs text-gray-400 truncate max-w-[120px]" title={link.product_name}>
                          {link.product_name}
                        </p>
                        {link.last_synced_at && (
                          <p className="text-xs text-gray-300">
                            {new Date(link.last_synced_at).toLocaleDateString('nb-NO')}
                          </p>
                        )}
                      </div>
                      <span className="text-green-500 text-lg" title="Koblet til Kassal">🛒</span>
                      <button
                        onClick={() => åpneKassalSøk(ing)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Bytt
                      </button>
                      <button
                        onClick={() => avkobleProdukt(ing.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Fjern
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 shrink-0">
                      {redigerer === ing.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={nyPris}
                            onChange={(e) => setNyPris(e.target.value)}
                            placeholder="Pris"
                            min={0}
                            step="0.5"
                            autoFocus
                            className="w-20 rounded-lg border border-gray-300 px-2 py-1 text-sm
                              focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <span className="text-xs text-gray-500">kr/{ing.default_unit}</span>
                          <button
                            onClick={() => lagrePris(ing.id)}
                            disabled={lagrer}
                            className="text-xs text-white bg-green-600 px-2 py-1 rounded-md hover:bg-green-700"
                          >
                            {lagrer ? '…' : 'Sett'}
                          </button>
                          <button
                            onClick={() => { setRedigerer(null); setNyPris('') }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Avbryt
                          </button>
                        </div>
                      ) : (
                        <>
                          {ing.price ? (
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {ing.price.price_per_unit.toFixed(2)} kr/{ing.price.unit}
                              </p>
                              <p className="text-xs text-gray-400">
                                {ing.price.source === 'kassal' ? '🛒 kassal' : '✏️ manuell'} · {new Date(ing.price.updated_at).toLocaleDateString('nb-NO')}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Ingen pris</span>
                          )}
                          {lagretId === ing.id && <span className="text-xs text-green-600">✓</span>}
                          <button
                            onClick={() => åpneKassalSøk(ing)}
                            className="text-xs text-white bg-orange-500 px-2 py-1 rounded-md hover:bg-orange-600 font-medium whitespace-nowrap"
                          >
                            🛒 Kassal
                          </button>
                          <button
                            onClick={() => {
                              setRedigerer(ing.id)
                              setNyPris(ing.price?.price_per_unit.toString() ?? '')
                            }}
                            className="text-xs text-green-600 hover:text-green-700 font-medium"
                          >
                            {ing.price ? 'Endre' : 'Manuell'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Kassal søkemodal ── */}
      {kassalSøkId && aktivIngrediens && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) lukkModal() }}
        >
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Koble til Kassal-produkt</h2>
                <p className="text-sm text-gray-500">{aktivIngrediens.name}</p>
              </div>
              <button
                onClick={lukkModal}
                className="w-8 h-8 flex items-center justify-center rounded-full
                  bg-gray-100 text-gray-500 hover:bg-gray-200 text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Søkefelt */}
            <div className="px-5 py-3 border-b border-gray-100">
              <input
                ref={søkInputRef}
                type="search"
                value={kassalQuery}
                onChange={(e) => setKassalQuery(e.target.value)}
                placeholder="Søk i Kassal…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Resultater */}
            <div className="overflow-y-auto flex-1">
              {kassalSøker && (
                <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
                  Søker…
                </div>
              )}

              {kassalFeil && !kassalSøker && (
                <div className="px-5 py-8 text-center text-sm text-gray-400">{kassalFeil}</div>
              )}

              {!kassalSøker && kassalTreff.length > 0 && (
                <div>
                  {kassalTreff.map((treff, i) => (
                    <button
                      key={treff.kassal_ean + i}
                      onClick={() => kobleProdukt(kassalSøkId, treff)}
                      disabled={koblerIds.has(kassalSøkId)}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left
                        hover:bg-gray-50 transition-colors
                        ${i > 0 ? 'border-t border-gray-100' : ''}
                        disabled:opacity-50`}
                    >
                      {/* Produktbilde */}
                      <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {treff.image ? (
                          <Image
                            src={treff.image}
                            alt={treff.product_name}
                            width={56}
                            height={56}
                            className="object-contain w-full h-full"
                            unoptimized
                          />
                        ) : (
                          <span className="text-2xl">🛒</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {treff.is_organic && <span className="text-green-600 mr-1">🌿</span>}
                          {treff.product_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[treff.brand, treff.package_size != null ? `${treff.package_size} ${treff.package_unit ?? ''}` : null, treff.store]
                            .filter(Boolean).join(' · ')}
                        </p>
                      </div>

                      {/* Pris */}
                      <div className="text-right shrink-0">
                        {treff.price_per_package != null ? (
                          <p className="text-sm font-semibold text-gray-900">
                            {treff.price_per_package.toFixed(2)} kr
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400">Ingen pris</p>
                        )}
                        {koblerIds.has(kassalSøkId) ? (
                          <p className="text-xs text-orange-500 mt-0.5">Lagrer…</p>
                        ) : (
                          <p className="text-xs text-orange-500 font-medium mt-0.5">Velg</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
