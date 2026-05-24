'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoggInnPage() {
  const router = useRouter()
  const [epost, setEpost] = useState('')
  const [passord, setPassord] = useState('')
  const [feil, setFeil] = useState('')
  const [laster, setLaster] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeil('')
    setLaster(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: epost,
      password: passord,
    })

    if (error) {
      setFeil('Feil e-post eller passord. Prøv igjen.')
      setLaster(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Logg inn</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            E-post
          </label>
          <input
            type="email"
            required
            value={epost}
            onChange={(e) => setEpost(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="din@epost.no"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Passord
          </label>
          <input
            type="password"
            required
            value={passord}
            onChange={(e) => setPassord(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="••••••••"
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
          {laster ? 'Logger inn…' : 'Logg inn'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Ny bruker?{' '}
        <Link href="/registrer" className="text-green-600 hover:text-green-700 font-medium">
          Opprett konto
        </Link>
      </p>
    </div>
  )
}
