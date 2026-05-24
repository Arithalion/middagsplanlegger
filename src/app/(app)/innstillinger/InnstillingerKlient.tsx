'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { loggUt } from '@/lib/actions/auth'
import { updateHouseholdSettings, addMember, deleteMember } from '@/lib/actions/settings'
import type { Weekday, MemberRole } from '@/types/database'

const ALLE_UKEDAGER: Weekday[] = ['mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag']

type Tab = 'husholdning' | 'kosthold' | 'medlemmer' | 'konto'

interface Props {
  household: { id: string; name: string } | null
  settings: {
    id: string
    fish_days_per_week: number
    always_vegetables: boolean
    shopping_days: Weekday[]
    special_days: Weekday[]
    weekly_budget: number | null
  } | null
  members: { id: string; name: string; role: MemberRole; birth_year: number | null; gender: string | null }[]
  userEmail: string
}

export default function InnstillingerKlient({ household, settings, members, userEmail }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [aktivTab, setAktivTab] = useState<Tab>('husholdning')

  // Husholdning
  const [husstandNavn, setHusstandNavn] = useState(household?.name ?? '')

  // Kosthold
  const [fiskedager, setFiskedager] = useState(settings?.fish_days_per_week ?? 2)
  const [alltidGronn, setAlltidGronn] = useState(settings?.always_vegetables ?? true)
  const [handledager, setHandledager] = useState<Weekday[]>(settings?.shopping_days ?? ['lørdag'])
  const [spesialdager, setSpesialdager] = useState<Weekday[]>(settings?.special_days ?? ['fredag','lørdag'])
  const [ukesbudsjett, setUkesbudsjett] = useState(settings?.weekly_budget?.toString() ?? '')

  // Nytt medlem
  const [nyttMedlemNavn, setNyttMedlemNavn] = useState('')
  const [nyttMedlemRolle, setNyttMedlemRolle] = useState<MemberRole>('barn')
  const [nyttMedlemFødsel, setNyttMedlemFødsel] = useState('')
  const [nyttMedlemKjønn, setNyttMedlemKjønn] = useState('')
  const [lagrerMedlem, setLagrerMedlem] = useState(false)
  const [lagrer, setLagrer] = useState(false)
  const [melding, setMelding] = useState('')

  function toggleDag(dag: Weekday, liste: Weekday[], setter: (v: Weekday[]) => void) {
    if (liste.includes(dag)) {
      setter(liste.filter((d) => d !== dag))
    } else {
      setter([...liste, dag])
    }
  }

  async function lagreInnstillinger() {
    setLagrer(true)
    try {
      await updateHouseholdSettings({
        name: husstandNavn !== household?.name ? husstandNavn : undefined,
        fish_days_per_week: fiskedager,
        always_vegetables: alltidGronn,
        shopping_days: handledager,
        special_days: spesialdager,
        weekly_budget: ukesbudsjett ? parseFloat(ukesbudsjett) : null,
      })
      setMelding('Innstillinger lagret!')
      startTransition(() => router.refresh())
    } finally {
      setLagrer(false)
      setTimeout(() => setMelding(''), 3000)
    }
  }

  async function leggTilMedlem(e: React.FormEvent) {
    e.preventDefault()
    if (!nyttMedlemNavn.trim()) return
    setLagrerMedlem(true)
    await addMember({
      name: nyttMedlemNavn.trim(),
      role: nyttMedlemRolle,
      birth_year: nyttMedlemFødsel ? parseInt(nyttMedlemFødsel) : null,
      gender: (nyttMedlemKjønn || null) as 'gutt' | 'jente' | 'mann' | 'kvinne' | null,
    })
    setNyttMedlemNavn('')
    setNyttMedlemFødsel('')
    setNyttMedlemKjønn('')
    setLagrerMedlem(false)
    startTransition(() => router.refresh())
  }

  async function slettMedlem(id: string, navn: string) {
    if (!confirm(`Slett ${navn} fra husstanden?`)) return
    await deleteMember(id)
    startTransition(() => router.refresh())
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'husholdning', label: 'Husholdning', icon: '🏠' },
    { id: 'kosthold', label: 'Kosthold', icon: '🥗' },
    { id: 'medlemmer', label: 'Medlemmer', icon: '👥' },
    { id: 'konto', label: 'Konto', icon: '👤' },
  ]

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Innstillinger</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setAktivTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              aktivTab === id
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* ── Husholdning ── */}
      {aktivTab === 'husholdning' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Husstandsnavn</h3>
            <input
              type="text"
              value={husstandNavn}
              onChange={(e) => setHusstandNavn(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Handledager</h3>
            <p className="text-sm text-gray-500 mb-3">Hvilke dager handler dere vanligvis?</p>
            <div className="flex flex-wrap gap-2">
              {ALLE_UKEDAGER.map((dag) => (
                <button
                  key={dag}
                  onClick={() => toggleDag(dag, handledager, setHandledager)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                    handledager.includes(dag)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {dag}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Spesialdager</h3>
            <p className="text-sm text-gray-500 mb-3">
              Spesialdager tilbyr helge-/søndagsmiddager i forslagslisten
            </p>
            <div className="flex flex-wrap gap-2">
              {ALLE_UKEDAGER.map((dag) => (
                <button
                  key={dag}
                  onClick={() => toggleDag(dag, spesialdager, setSpesialdager)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                    spesialdager.includes(dag)
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {dag}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Ukesbudsjett</h3>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={ukesbudsjett}
                onChange={(e) => setUkesbudsjett(e.target.value)}
                placeholder="2000"
                min={0}
                className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <span className="text-sm text-gray-500">NOK per uke</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            {melding && <span className="text-sm text-green-600 font-medium">{melding}</span>}
            <div className="ml-auto">
              <button
                onClick={lagreInnstillinger}
                disabled={lagrer || isPending}
                className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg
                  hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {lagrer ? 'Lagrer…' : 'Lagre innstillinger'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Kosthold ── */}
      {aktivTab === 'kosthold' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Alltid grønnsaker 🥦</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Ukesplanleggeren prioriterer oppskrifter med grønnsaker
                </p>
              </div>
              <button
                onClick={() => setAlltidGronn(!alltidGronn)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                  alltidGronn ? 'bg-green-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 inline-block h-5 w-5 rounded-full bg-white
                    shadow transform transition-transform ${alltidGronn ? 'translate-x-5' : ''}`}
                />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-2">Fiskedager per uke 🐟</h3>
            <p className="text-sm text-gray-500 mb-4">
              Ukesplanleggeren sørger for minst dette antallet fiskeretter per uke
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={7}
                value={fiskedager}
                onChange={(e) => setFiskedager(parseInt(e.target.value))}
                className="flex-1 accent-green-600"
              />
              <span className="text-lg font-bold text-gray-900 w-8 text-center">{fiskedager}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
              {[0,1,2,3,4,5,6,7].map((n) => <span key={n}>{n}</span>)}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={lagreInnstillinger}
              disabled={lagrer || isPending}
              className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg
                hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {lagrer ? 'Lagrer…' : 'Lagre kostholdsregler'}
            </button>
          </div>
          {melding && <p className="text-sm text-green-600 font-medium text-right">{melding}</p>}
        </div>
      )}

      {/* ── Husstandsmedlemmer ── */}
      {aktivTab === 'medlemmer' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {members.length === 0 ? (
              <p className="px-5 py-4 text-sm text-gray-400 italic">Ingen medlemmer ennå</p>
            ) : (
              members.map((m, i) => (
                <div key={m.id} className={`flex items-center px-5 py-3 gap-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                  <span className="text-xl">{m.role === 'barn' ? '👦' : '🧑'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-400">
                      {m.role === 'barn' ? 'Barn' : 'Voksen'}
                      {m.birth_year && ` · f. ${m.birth_year}`}
                      {m.gender && ` · ${m.gender}`}
                    </p>
                  </div>
                  <button
                    onClick={() => slettMedlem(m.id, m.name)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    Slett
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Legg til husstandsmedlem</h3>
            <form onSubmit={leggTilMedlem} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Navn *</label>
                  <input
                    type="text"
                    required
                    value={nyttMedlemNavn}
                    onChange={(e) => setNyttMedlemNavn(e.target.value)}
                    placeholder="Ola"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
                  <select
                    value={nyttMedlemRolle}
                    onChange={(e) => setNyttMedlemRolle(e.target.value as MemberRole)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="voksen">Voksen</option>
                    <option value="barn">Barn</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fødselsår</label>
                  <input
                    type="number"
                    value={nyttMedlemFødsel}
                    onChange={(e) => setNyttMedlemFødsel(e.target.value)}
                    placeholder={new Date().getFullYear().toString()}
                    min={1920}
                    max={new Date().getFullYear()}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kjønn</label>
                  <select
                    value={nyttMedlemKjønn}
                    onChange={(e) => setNyttMedlemKjønn(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                      focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Ikke oppgitt</option>
                    <option value="gutt">Gutt</option>
                    <option value="jente">Jente</option>
                    <option value="mann">Mann</option>
                    <option value="kvinne">Kvinne</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={lagrerMedlem}
                className="w-full py-2 bg-green-600 text-white text-sm font-medium rounded-lg
                  hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {lagrerMedlem ? 'Legger til…' : 'Legg til'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Konto ── */}
      {aktivTab === 'konto' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Kontoinformasjon</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-green-700 font-semibold text-sm">
                  {userEmail[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{userEmail}</p>
                <p className="text-xs text-gray-400">{household?.name}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <form action={loggUt}>
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-medium text-red-600 bg-red-50
                  border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                Logg ut
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
