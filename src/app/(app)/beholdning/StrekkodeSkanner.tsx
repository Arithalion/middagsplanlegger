'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { addPantryItem } from '@/lib/actions/pantry'
import type { Unit } from '@/types/database'

const ENHET_GRUPPER = [
  { label: 'Vekt',   enheter: ['g', 'kg'] as Unit[] },
  { label: 'Volum',  enheter: ['ml', 'dl', 'l', 'tsk', 'ss'] as Unit[] },
  { label: 'Antall', enheter: ['stk', 'boks', 'pose', 'flaske', 'pk'] as Unit[] },
]

type ScanResult = {
  product_name: string
  brand: string | null
  package_size: number | null
  package_unit: string | null
  price: number | null
  is_organic: boolean
  kassal_product_id: number
  ean: string
  linked_ingredient: { id: string; name: string } | null
}

interface Props {
  onLukk: () => void
  ingredients: { id: string; name: string; default_unit: Unit }[]
}

type Fase = 'skanner' | 'produkt' | 'feil'

export default function StrekkodeSkanner({ onLukk, ingredients }: Props) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readerRef = useRef<any>(null)
  const harOppdagetRef = useRef(false)

  const [fase, setFase] = useState<Fase>('skanner')
  const [lasterApi, setLasterApi] = useState(false)
  const [feilmelding, setFeilmelding] = useState('')
  const [scanResultat, setScanResultat] = useState<ScanResult | null>(null)

  // Skjema-tilstand
  const [ingredientId, setIngredientId] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState<Unit>('stk')
  const [expiryDate, setExpiryDate] = useState('')
  const [leggerTil, setLeggerTil] = useState(false)

  const stoppSkanner = useCallback(() => {
    if (readerRef.current) {
      try { readerRef.current.reset() } catch { /* ignorer */ }
      readerRef.current = null
    }
  }, [])

  const startSkanner = useCallback(async () => {
    harOppdagetRef.current = false
    setFase('skanner')
    setScanResultat(null)
    setFeilmelding('')

    if (!videoRef.current) return

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      readerRef.current = reader

      await reader.decodeFromVideoDevice(
        undefined, // bruk standard kamera (bakre på mobil)
        videoRef.current,
        async (result, err) => {
          if (!result) return
          if (harOppdagetRef.current) return
          harOppdagetRef.current = true

          const ean = result.getText()
          stoppSkanner()
          setLasterApi(true)

          try {
            const res = await fetch(`/api/kassal/skann?ean=${encodeURIComponent(ean)}`)
            if (!res.ok) {
              const data = await res.json()
              setFeilmelding(data.error ?? 'Ukjent feil fra Kassal')
              setFase('feil')
            } else {
              const data: ScanResult = await res.json()
              setScanResultat(data)

              // Forhåndsfyll skjema
              if (data.linked_ingredient) {
                setIngredientId(data.linked_ingredient.id)
                const ing = ingredients.find((i) => i.id === data.linked_ingredient!.id)
                if (ing) setUnit(ing.default_unit)
              } else {
                setIngredientId('')
                setUnit('stk')
              }
              setAmount(data.package_size != null ? String(data.package_size) : '')
              setExpiryDate('')
              setFase('produkt')
            }
          } catch {
            setFeilmelding('Nettverksfeil — prøv igjen')
            setFase('feil')
          } finally {
            setLasterApi(false)
          }
        }
      )
    } catch {
      setFeilmelding('Kameraet er ikke tilgjengelig. Sjekk tillatelser i nettleseren.')
      setFase('feil')
    }
  }, [stoppSkanner, ingredients])

  useEffect(() => {
    startSkanner()
    return () => stoppSkanner()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLeggTil(e: React.FormEvent) {
    e.preventDefault()
    if (!ingredientId || !amount) return
    setLeggerTil(true)
    await addPantryItem({
      ingredient_id: ingredientId,
      amount: parseFloat(amount),
      unit,
      expiry_date: expiryDate || null,
    })
    setLeggerTil(false)
    router.refresh()
    onLukk()
  }

  function handleSkannNeste() {
    startSkanner()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Topplinje */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <p className="text-white font-semibold text-sm">
          {fase === 'skanner' && 'Hold strekkoden i rammen'}
          {fase === 'produkt' && 'Produkt funnet'}
          {fase === 'feil' && 'Kunne ikke lese strekkoden'}
        </p>
        <button
          onClick={() => { stoppSkanner(); onLukk() }}
          className="text-white text-2xl leading-none w-8 h-8 flex items-center justify-center"
          aria-label="Lukk"
        >
          ✕
        </button>
      </div>

      {/* Kamera */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          autoPlay
        />

        {/* Søkelinje-overlay */}
        {fase === 'skanner' && !lasterApi && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-72 h-40">
              {/* Hjørner */}
              <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl" />
              <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr" />
              <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl" />
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br" />
              {/* Sikte-linje */}
              <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-green-400/60 -translate-y-0.5" />
            </div>
          </div>
        )}

        {/* Laster-spinner etter EAN-deteksjon */}
        {lasterApi && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              <p className="text-white text-sm">Slår opp produkt…</p>
            </div>
          </div>
        )}
      </div>

      {/* Bunnskjerm — produkt eller feil */}
      {(fase === 'produkt' || fase === 'feil') && (
        <div className="bg-white rounded-t-3xl shadow-2xl max-h-[65vh] overflow-y-auto">
          {fase === 'feil' && (
            <div className="p-6 flex flex-col items-center gap-4">
              <p className="text-3xl">❌</p>
              <p className="text-gray-700 text-center font-medium">{feilmelding}</p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleSkannNeste}
                  className="flex-1 py-3 bg-green-600 text-white font-medium rounded-xl
                    hover:bg-green-700 transition-colors"
                >
                  📷 Prøv igjen
                </button>
                <button
                  onClick={() => { stoppSkanner(); onLukk() }}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl
                    hover:bg-gray-200 transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {fase === 'produkt' && scanResultat && (
            <form onSubmit={handleLeggTil} className="p-4">
              {/* Produktkort */}
              <div className="flex items-start gap-3 mb-4 p-3 bg-gray-50 rounded-2xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm leading-snug">
                      {scanResultat.product_name}
                    </p>
                    {scanResultat.is_organic && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        🌿 Økologisk
                      </span>
                    )}
                  </div>
                  {scanResultat.brand && (
                    <p className="text-xs text-gray-500 mt-0.5">{scanResultat.brand}</p>
                  )}
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    {scanResultat.package_size != null && (
                      <span>{scanResultat.package_size} {scanResultat.package_unit ?? ''}</span>
                    )}
                    {scanResultat.price != null && (
                      <span>{scanResultat.price.toFixed(2)} kr</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Ingrediens-valg */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ingrediens
                  {!scanResultat.linked_ingredient && (
                    <span className="ml-1 text-xs text-amber-600 font-normal">(velg manuelt)</span>
                  )}
                </label>
                <select
                  value={ingredientId}
                  onChange={(e) => {
                    setIngredientId(e.target.value)
                    const ing = ingredients.find((i) => i.id === e.target.value)
                    if (ing) setUnit(ing.default_unit)
                  }}
                  required
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">Velg ingrediens…</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>

              {/* Mengde + Enhet */}
              <div className="grid grid-cols-2 gap-3 mb-3">
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
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enhet</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as Unit)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    {ENHET_GRUPPER.map(({ label, enheter }) => (
                      <optgroup key={label} label={label}>
                        {enheter.map((u) => <option key={u} value={u}>{u}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              {/* Holdbarhet */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Holdbarhet <span className="font-normal text-gray-400">(valgfritt)</span>
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                    focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Knapper */}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={leggerTil || !ingredientId}
                  className="flex-1 py-3 bg-green-600 text-white font-semibold rounded-xl
                    hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {leggerTil ? 'Legger til…' : '✓ Legg til i beholdning'}
                </button>
                <button
                  type="button"
                  onClick={handleSkannNeste}
                  className="py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-xl
                    hover:bg-gray-200 transition-colors whitespace-nowrap"
                >
                  📷 Skann neste
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
