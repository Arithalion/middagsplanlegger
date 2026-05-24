'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function GlemtPassordPage() {
  const [epost, setEpost] = useState('')
  const [sendt, setSendt] = useState(false)
  const [feil, setFeil] = useState('')
  const [laster, setLaster] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeil('')
    setLaster(true)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(epost, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/nytt-passord`,
    })

    if (error) {
      setFeil('Noe gikk galt. Sjekk at e-postadressen er riktig.')
      setLaster(false)
      return
    }

    setSendt(true)
  }

  if (sendt) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="text-4xl mb-4">📧</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Sjekk innboksen din</h2>
        <p className="text-sm text-gray-500 mb-6">
          Vi har sendt en lenke til <strong>{epost}</strong>. Klikk på lenken for å sette nytt passord.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Ikke fått e-posten? Sjekk søppelpost, eller{' '}
          <button
            onClick={() => setSendt(false)}
            className="text-green-600 hover:text-green-700 underline"
          >
            prøv igjen
          </button>
          .
        </p>
        <Link href="/logg-inn" className="text-sm text-green-600 hover:text-green-700 font-medium">
          ← Tilbake til innlogging
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Glemt passord?</h2>
      <p className="text-sm text-gray-500 mb-6">
        Skriv inn e-postadressen din, så sender vi en lenke for å sette nytt passord.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
          <input
            type="email"
            required
            value={epost}
            onChange={(e) => setEpost(e.target.value)}
            placeholder="din@epost.no"
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {feil && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {feil}
          </div>
        )}

        <button
          type="submit"
          disabled={laster}
          className="w-full rounded-lg bg-green-600 text-white font-medium py-2.5 text-sm
            hover:bg-green-700 active:bg-green-800 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {laster ? 'Sender…' : 'Send tilbakestillingslenke'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link href="/logg-inn" className="text-green-600 hover:text-green-700 font-medium">
          ← Tilbake til innlogging
        </Link>
      </p>
    </div>
  )
}
