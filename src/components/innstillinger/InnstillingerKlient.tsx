'use client'

import { useState, useTransition } from 'react'
import type { Household, HouseholdSettings, HouseholdMember, Weekday } from '@/types/database'
import { updateHouseholdSettings, addMember, deleteMember } from '@/lib/actions/settings'
import { UKEDAGER } from '@/lib/utils'
import Knapp from '@/components/ui/Knapp'

type Fane = 'husholdning' | 'kosthold' | 'medlemmer' | 'konto'

interface Props {
  husstand: Household | null
  innstillinger: HouseholdSettings | null
  medlemmer: HouseholdMember[]
  epost: string
}

export default function InnstillingerKlient({ husstand, innstillinger, medlemmer, epost }: Props) {
  const [aktivFane, setAktivFane] = useState<Fane>('husholdning')

  return (
    <div>
      {/* Tab-rader */}
      <div className="flex gap-0.5 mb-8 border-b border-gray-200">
        {([
          ['husholdning', '🏠 Husholdning'],
          ['kosthold', '🥗 Kosthold'],
          ['medlemmer', '👥 Husstandsmedlemmer'],
          ['konto', '👤 Konto'],
        ] as [Fane, string][]).map(([fane, label]) => (
          <button
            key={fane}
            onClick={() => setAktivFane(fane)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              aktivFane === fane
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {aktivFane === 'husholdning' && (
        <HusholdningTab husstand={husstand} innstillinger={innstillinger} />
      )}
      {aktivFane === 'kosthold' && (
        <KostholdTab innstillinger={innstillinger} />
      )}
      {aktivFane === 'medlemmer' && (
        <MedlemmerTab medlemmer={medlemmer} />
      )}
      {aktivFane === 'konto' && (
        <KontoTab epost={epost} />
      )}
    </div>
  )
}

// ─── Husholdning-tab ────────────────────────────────────────────────────────

function HusholdningTab({
  husstand,
  innstillinger,
}: {
  husstand: Household | null
  innstillinger: HouseholdSettings | null
}) {
  const [navn, setNavn] = useState(husstand?.name ?? '')
  const [handledager, setHandledager] = useState<Weekday[]>(innstillinger?.shopping_days ?? [])
  const [spesialdager, setSpesialdager] = useState<Weekday[]>(
    innstillinger?.special_days ?? ['fredag', 'lørdag']
  )
  const [lagret, setLagret] = useState(false)
  const [isPending, startTransition] = useTransition()

  function toggleDag(liste: Weekday[], dag: Weekday, setter: (d: Weekday[]) => void) {
    setter(
      liste.includes(dag) ? liste.filter((d) => d !== dag) : [...liste, dag]
    )
  }

  function lagre() {
    startTransition(async () => {
      await updateHouseholdSettings({
        name: navn,
        shopping_days: handledager,
        special_days: spesialdager,
      })
      setLagret(true)
      setTimeout(() => setLagret(false), 2000)
    })
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Navn på husstand
        </label>
        <input
          type="text"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Handledager
        </label>
        <div className="flex flex-wrap gap-2">
          {UKEDAGER.map((dag) => (
            <button
              key={dag}
              onClick={() => toggleDag(handledager, dag, setHandledager)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Spesialdager (helgemat, valgfritt)
        </label>
        <div className="flex flex-wrap gap-2">
          {UKEDAGER.map((dag) => (
            <button
              key={dag}
              onClick={() => toggleDag(spesialdager, dag, setSpesialdager)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                spesialdager.includes(dag)
                  ? 'bg-amber-400 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {dag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Knapp onClick={lagre} laster={isPending}>Lagre endringer</Knapp>
        {lagret && <span className="text-sm text-green-600">✓ Lagret!</span>}
      </div>
    </div>
  )
}

// ─── Kosthold-tab ───────────────────────────────────────────────────────────

function KostholdTab({ innstillinger }: { innstillinger: HouseholdSettings | null }) {
  const [fiskedager, setFiskedager] = useState(innstillinger?.fish_days_per_week ?? 2)
  const [alltidGrønnsaker, setAlltidGrønnsaker] = useState(
    innstillinger?.always_vegetables ?? true
  )
  const [ukentligBudsjett, setUkentligBudsjett] = useState<number | ''>(
    innstillinger?.weekly_budget ?? ''
  )
  const [lagret, setLagret] = useState(false)
  const [isPending, startTransition] = useTransition()

  function lagre() {
    startTransition(async () => {
      await updateHouseholdSettings({
        fish_days_per_week: fiskedager,
        always_vegetables: alltidGrønnsaker,
        weekly_budget: ukentligBudsjett ? Number(ukentligBudsjett) : null,
      })
      setLagret(true)
      setTimeout(() => setLagret(false), 2000)
    })
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <label className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            🐟 Fiskedager per uke
          </span>
          <span className="text-lg font-bold text-green-700">{fiskedager}</span>
        </label>
        <input
          type="range"
          min={0}
          max={7}
          value={fiskedager}
          onChange={(e) => setFiskedager(Number(e.target.value))}
          className="w-full accent-green-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0</span>
          <span>7</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">🥦 Alltid grønnsaker</p>
          <p className="text-xs text-gray-500">Prioriter retter med grønnsaker</p>
        </div>
        <button
          onClick={() => setAlltidGrønnsaker(!alltidGrønnsaker)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            alltidGrønnsaker ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              alltidGrønnsaker ? 'translate-x-6' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          💰 Ukentlig matbudsjett (kr)
        </label>
        <input
          type="number"
          min={0}
          value={ukentligBudsjett}
          onChange={(e) => setUkentligBudsjett(e.target.value ? Number(e.target.value) : '')}
          placeholder="F.eks. 1500"
          className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <Knapp onClick={lagre} laster={isPending}>Lagre innstillinger</Knapp>
        {lagret && <span className="text-sm text-green-600">✓ Lagret!</span>}
      </div>
    </div>
  )
}

// ─── Medlemmer-tab ──────────────────────────────────────────────────────────

function MedlemmerTab({ medlemmer }: { medlemmer: HouseholdMember[] }) {
  const [visSkjema, setVisSkjema] = useState(false)
  const [navn, setNavn] = useState('')
  const [rolle, setRolle] = useState<'voksen' | 'barn'>('barn')
  const [fødselsar, setFødselsar] = useState<number | ''>('')
  const [kjønn, setKjønn] = useState<'gutt' | 'jente' | 'mann' | 'kvinne' | ''>('')
  const [feil, setFeil] = useState('')
  const [isPending, startTransition] = useTransition()

  function leggTilMedlem() {
    if (!navn.trim()) { setFeil('Navn er påkrevd'); return }
    setFeil('')
    startTransition(async () => {
      await addMember({
        name: navn.trim(),
        role: rolle,
        birth_year: fødselsar ? Number(fødselsar) : null,
        gender: kjønn || null,
      })
      setNavn('')
      setFødselsar('')
      setKjønn('')
      setVisSkjema(false)
    })
  }

  function slett(id: string) {
    startTransition(async () => {
      await deleteMember(id)
    })
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 mb-5">
        {medlemmer.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">Ingen husstandsmedlemmer ennå</p>
        ) : (
          medlemmer.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xl">
                {m.role === 'barn'
                  ? m.gender === 'gutt' ? '👦' : '👧'
                  : m.gender === 'mann' ? '👨' : '👩'}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{m.name}</p>
                <p className="text-xs text-gray-400 capitalize">
                  {m.role}
                  {m.birth_year ? ` · f. ${m.birth_year}` : ''}
                </p>
              </div>
              <button
                onClick={() => slett(m.id)}
                disabled={isPending}
                className="text-gray-300 hover:text-red-400 transition-colors text-xl leading-none"
                aria-label="Fjern medlem"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {visSkjema ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Legg til husstandsmedlem</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Navn *</label>
              <input
                type="text"
                value={navn}
                onChange={(e) => setNavn(e.target.value)}
                placeholder="F.eks. Emma"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rolle</label>
              <select
                value={rolle}
                onChange={(e) => setRolle(e.target.value as 'voksen' | 'barn')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="barn">Barn</option>
                <option value="voksen">Voksen</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fødselssår</label>
              <input
                type="number"
                min={1940}
                max={new Date().getFullYear()}
                value={fødselsar}
                onChange={(e) => setFødselsar(e.target.value ? Number(e.target.value) : '')}
                placeholder={new Date().getFullYear().toString()}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Kjønn</label>
              <select
                value={kjønn}
                onChange={(e) => setKjønn(e.target.value as typeof kjønn)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Velg kjønn</option>
                <option value="gutt">Gutt</option>
                <option value="jente">Jente</option>
                <option value="mann">Mann</option>
                <option value="kvinne">Kvinne</option>
              </select>
            </div>
          </div>
          {feil && <p className="text-xs text-red-600">{feil}</p>}
          <div className="flex gap-2">
            <Knapp størrelse="sm" onClick={leggTilMedlem} laster={isPending}>Legg til</Knapp>
            <Knapp variant="sekundær" størrelse="sm" onClick={() => setVisSkjema(false)}>Avbryt</Knapp>
          </div>
        </div>
      ) : (
        <Knapp onClick={() => setVisSkjema(true)}>+ Legg til husstandsmedlem</Knapp>
      )}
    </div>
  )
}

// ─── Konto-tab ──────────────────────────────────────────────────────────────

function KontoTab({ epost }: { epost: string }) {
  return (
    <div className="max-w-xl space-y-5">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-xs text-gray-500 mb-1">Innlogget som</p>
        <p className="font-medium text-gray-900">{epost}</p>
      </div>
      <form action="/api/auth/logout">
        <Knapp type="submit" variant="fare">
          🚪 Logg ut
        </Knapp>
      </form>
    </div>
  )
}
