'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegistrerPage() {
  const router = useRouter()
  const [navn, setNavn] = useState('')
  const [husstandNavn, setHusstandNavn] = useState('')
  const [epost, setEpost] = useState('')
  const [passord, setPassord] = useState('')
  const [invitKode, setInvitKode] = useState('')
  const [mode, setMode] = useState<'ny' | 'bli-med'>('ny')
  const [feil, setFeil] = useState('')
  const [laster, setLaster] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFeil('')
    setLaster(true)

    const supabase = createClient()

    const { data, error } = await supabase.auth.signUp({
      email: epost,
      password: passord,
      options: {
        data: { full_name: navn, household_name: husstandNavn, invite_code: invitKode, mode },
      },
    })

    if (error) {
      setFeil(error.message)
      setLaster(false)
      return
    }

    if (data.user) {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Opprett konto</h2>
      <p className="text-sm text-gray-500 mb-6">
        Kom i gang med middagsplanleggeren for din husstand
      </p>

      {/* Velg modus */}
      <div className="flex rounded-lg border border-gray-200 p-1 mb-6 gap-1">
        {(['ny', 'bli-med'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${
              mode === m
                ? 'bg-green-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {m === 'ny' ? 'Ny husstand' : 'Bli med i husstand'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ditt navn</label>
          <input
            type="text"
            required
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Ola Nordmann"
          />
        </div>

        {mode === 'ny' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Navn på husstanden</label>
            <input
              type="text"
              required
              value={husstandNavn}
              onChange={(e) => setHusstandNavn(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Familie Nordmann"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invitasjonskode</label>
            <input
              type="text"
              required
              value={invitKode}
              onChange={(e) => setInvitKode(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Kode fra husstandsadmin"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Passord</label>
          <input
            type="password"
            required
            minLength={8}
            value={passord}
            onChange={(e) => setPassord(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Minst 8 tegn"
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
          {laster ? 'Oppretter konto…' : 'Opprett konto'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Har du allerede en konto?{' '}
        <Link href="/logg-inn" className="text-green-600 hover:text-green-700 font-medium">
          Logg inn
        </Link>
      </p>
    </div>
  )
}
