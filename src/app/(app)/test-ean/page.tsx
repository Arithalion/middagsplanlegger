'use client'

import { useState } from 'react'

export default function TestEanPage() {
  const [ean, setEan] = useState('7038010013014') // REMA melk som eksempel
  const [resultat, setResultat] = useState<string>('')
  const [laster, setLaster] = useState(false)

  async function test() {
    setLaster(true)
    setResultat('')
    try {
      const res = await fetch(`/api/kassal/skann?ean=${encodeURIComponent(ean.trim())}`)
      const text = await res.text()
      setResultat(`Status: ${res.status}\n\n${text}`)
    } catch (err) {
      setResultat(`FEIL: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLaster(false)
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Test EAN-oppslag</h1>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={ean}
          onChange={(e) => setEan(e.target.value)}
          className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono"
          placeholder="EAN-kode"
        />
        <button
          onClick={test}
          disabled={laster}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
        >
          {laster ? 'Søker…' : 'Søk'}
        </button>
      </div>
      {resultat && (
        <pre className="bg-gray-100 rounded-lg p-4 text-xs overflow-auto whitespace-pre-wrap break-all">
          {resultat}
        </pre>
      )}
    </div>
  )
}
