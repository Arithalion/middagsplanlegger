'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function NyttPassordPage() {
  const router = useRouter()
  const [passord, setPassord] = useState('')
  const [bekreftPassord, setBekreftPassord] = useState('')
  const [feil, setFeil] = useState('')
  const [laster, setLaster] = useState(false)
  const [klar, setKlar] = useState(false)

  const passordMatcher = passord === bekreftPassord
  const bekreftFeil = bekreftPassord.length > 0 && !passordMatcher

  // Supabase setter en session via URL-fragment automatisk
  // Vi venter til klienten er klar
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setKlar(true)
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeil('')

    if (!passordMatcher) {
      setFeil('Passordene stemmer ikke overens.')
      return
    }

    setLaster(true)
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({ password: passord })

    if (error) {
      setFeil('Klarte ikke oppdatere passordet. Prøv å be om en ny lenke.')
      setLaster(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Sett nytt passord</h2>
      <p className="text-sm text-gray-500 mb-6">
        Velg et nytt passord for kontoen din.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nytt passord</label>
          <input
            type="password"
            required
            minLength={8}
            value={passord}
            onChange={(e) => setPassord(e.target.value)}
            placeholder="Minst 8 tegn"
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bekreft nytt passord</label>
          <input
            type="password"
            required
            minLength={8}
            value={bekreftPassord}
            onChange={(e) => setBekreftPassord(e.target.value)}
            placeholder="Gjenta passordet"
            className={`w-full rounded-lg border px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:border-transparent ${
                bekreftFeil
                  ? 'border-red-400 focus:ring-red-400'
                  : bekreftPassord.length > 0 && passordMatcher
                  ? 'border-green-400 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-green-500'
              }`}
          />
          {bekreftFeil && (
            <p className="mt-1 text-xs text-red-600">Passordene stemmer ikke overens</p>
          )}
          {bekreftPassord.length > 0 && passordMatcher && (
            <p className="mt-1 text-xs text-green-600">✓ Passordene matcher</p>
          )}
        </div>

        {feil && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {feil}
          </div>
        )}

        <button
          type="submit"
          disabled={laster || bekreftFeil || bekreftPassord.length === 0}
          className="w-full rounded-lg bg-green-600 text-white font-medium py-2.5 text-sm
            hover:bg-green-700 active:bg-green-800 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {laster ? 'Lagrer…' : 'Sett nytt passord'}
        </button>
      </form>
    </div>
  )
}
