'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { addPantryItem } from '@/lib/actions/pantry'
import type { Unit } from '@/types/database'

// BarcodeDetector er ikke i TypeScript sine standard lib-typer ennå
interface BarcodeDetectorType {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string; format: string }>>
}
interface BarcodeDetectorConstructor {
  new(opts: { formats: string[] }): BarcodeDetectorType
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BarcodeDetectorAPI = (typeof window !== 'undefined' ? (window as any).BarcodeDetector : undefined) as BarcodeDetectorConstructor | undefined

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

type Fase = 'sjekker' | 'skanner' | 'produkt' | 'feil' | 'ingen-stoette'

export default function StrekkodeSkanner({ onLukk, ingredients }: Props) {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const harOppdagetRef = useRef(false)

  const [fase, setFase] = useState<Fase>('sjekker')
  const [lasterApi, setLasterApi] = useState(false)
  const [feilmelding, setFeilmelding] = useState('')
  const [scanResultat, setScanResultat] = useState<ScanResult | null>(null)
  const [manuellEan, setManuellEan] = useState('')

  // Skjema-tilstand
  const [ingredientId, setIngredientId] = useState('')
  const [amount, setAmount] = useState('')
  const [unit, setUnit] = useState<Unit>('stk')
  const [expiryDate, setExpiryDate] = useState('')
  const [leggerTil, setLeggerTil] = useState(false)

  const stoppKamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const behandleEan = useCallback(async (ean: string) => {
    if (harOppdagetRef.current) return
    harOppdagetRef.current = true
    stoppKamera()
    setLasterApi(true)

    try {
      const res = await fetch(`/api/kassal/skann?ean=${encodeURIComponent(ean)}`)
      if (!res.ok) {
        const data = await res.json()
        setFeilmelding(data.error ?? 'Produkt ikke funnet')
        setFase('feil')
      } else {
        const data: ScanResult = await res.json()
        setScanResultat(data)

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
  }, [stoppKamera, ingredients])

  const startSkanner = useCallback(async () => {
    harOppdagetRef.current = false
    setScanResultat(null)
    setFeilmelding('')
    setFase('sjekker')

    // Sjekk støtte for BarcodeDetector
    if (typeof window === 'undefined' || !('BarcodeDetector' in window) || !BarcodeDetectorAPI) {
      setFase('ingen-stoette')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream

      if (!videoRef.current) { stream.getTracks().forEach((t) => t.stop()); return }
      videoRef.current.srcObject = stream
      await videoRef.current.play()

      const detector = new BarcodeDetectorAPI({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128'],
      })

      setFase('skanner')

      const skanneFrame = async () => {
        if (!videoRef.current || harOppdagetRef.current) return
        if (videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(skanneFrame)
          return
        }
        try {
          const resultater = await detector.detect(videoRef.current)
          if (resultater.length > 0) {
            const ean = resultater[0].rawValue
            await behandleEan(ean)
            return
          }
        } catch { /* ignorer per-frame-feil */ }
        rafRef.current = requestAnimationFrame(skanneFrame)
      }

      rafRef.current = requestAnimationFrame(skanneFrame)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('allowed')) {
        setFeilmelding('Kameratilgang ble avvist. Tillat kamerabruk i nettleserinnstillingene og prøv igjen.')
      } else {
        setFeilmelding('Kameraet er ikke tilgjengelig.')
      }
      setFase('feil')
    }
  }, [behandleEan])

  useEffect(() => {
    startSkanner()
    return () => stoppKamera()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLeggTil(e: React.FormEvent) {
    e.preventDefault()
    if (!ingredientId || !amount) return
    setLeggerTil(true)
    try {
      await addPantryItem({
        ingredient_id: ingredientId,
        amount: parseFloat(amount),
        unit,
        expiry_date: expiryDate || null,
      })
      router.refresh()
      onLukk()
    } catch {
      setLeggerTil(false)
    }
  }

  function handleSkannNeste() {
    harOppdagetRef.current = false
    stoppKamera()
    startSkanner()
  }

  async function handleManuellSoek(e: React.FormEvent) {
    e.preventDefault()
    if (!manuellEan.trim()) return
    await behandleEan(manuellEan.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Topplinje */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 z-10">
        <p className="text-white font-semibold text-sm">
          {fase === 'sjekker' && 'Starter kamera…'}
          {fase === 'skanner' && 'Hold strekkoden i rammen'}
          {fase === 'produkt' && 'Produkt funnet'}
          {(fase === 'feil' || fase === 'ingen-stoette') && 'Strekkodeskanning'}
        </p>
        <button
          onClick={() => { stoppKamera(); onLukk() }}
          className="text-white text-2xl leading-none w-8 h-8 flex items-center justify-center"
          aria-label="Lukk"
        >
          ✕
        </button>
      </div>

      {/* Kamera-viewport */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover ${fase === 'produkt' || fase === 'feil' || fase === 'ingen-stoette' ? 'opacity-20' : ''}`}
          muted
          playsInline
        />

        {/* Søkelinje-overlay */}
        {fase === 'skanner' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-72 h-40">
              <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl" />
              <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr" />
              <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl" />
              <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br" />
              <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-green-400/60 -translate-y-0.5" />
            </div>
          </div>
        )}

        {/* Starter-spinner */}
        {fase === 'sjekker' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              <p className="text-white text-sm">Starter kamera…</p>
            </div>
          </div>
        )}

        {/* Laster etter EAN-deteksjon */}
        {lasterApi && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              <p className="text-white text-sm">Slår opp produkt…</p>
            </div>
          </div>
        )}
      </div>

      {/* Bunnskjerm */}
      {fase === 'ingen-stoette' && (
        <div className="bg-white rounded-t-3xl shadow-2xl p-6">
          <p className="text-gray-700 font-medium mb-1">Kameraet støttes ikke av denne nettleseren</p>
          <p className="text-sm text-gray-500 mb-4">
            BarcodeDetector krever Chrome 83+ eller Safari 17.4+. Du kan taste inn EAN-koden manuelt.
          </p>
          <form onSubmit={handleManuellSoek} className="flex gap-2">
            <input
              type="text"
              value={manuellEan}
              onChange={(e) => setManuellEan(e.target.value)}
              placeholder="F.eks. 7038010013014"
              inputMode="numeric"
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              disabled={!manuellEan.trim()}
              className="px-4 py-2 bg-green-600 text-white font-medium rounded-xl
                hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Søk
            </button>
          </form>
        </div>
      )}

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
                  onClick={() => { stoppKamera(); onLukk() }}
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
