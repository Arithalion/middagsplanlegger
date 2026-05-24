'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { loggUt } from '@/lib/actions/auth'

const allNav = [
  { href: '/dashboard',     label: 'Oversikt',      icon: '🏠' },
  { href: '/planlegger',    label: 'Ukesplan',       icon: '📅' },
  { href: '/handleliste',   label: 'Handleliste',    icon: '🛒' },
  { href: '/oppskrifter',   label: 'Oppskrifter',    icon: '📖' },
  { href: '/matpakker',     label: 'Matpakker',      icon: '🍞' },
  { href: '/beholdning',    label: 'Beholdning',     icon: '📦' },
  { href: '/priser',        label: 'Priser',         icon: '💲' },
  { href: '/budsjett',      label: 'Budsjett',       icon: '💰' },
  { href: '/innstillinger', label: 'Innstillinger',  icon: '⚙️'  },
]

// Vises direkte i bottom nav
const bottomNav = [
  { href: '/dashboard',   label: 'Oversikt',    icon: '🏠' },
  { href: '/planlegger',  label: 'Ukesplan',    icon: '📅' },
  { href: '/handleliste', label: 'Liste',       icon: '🛒' },
  { href: '/oppskrifter', label: 'Oppskrifter', icon: '📖' },
]

// ─── Desktop sidebar ──────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-white border-r border-gray-200 shrink-0">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-200">
        <span className="text-2xl">🍽️</span>
        <span className="font-bold text-gray-900 text-sm leading-tight">
          Middags&shy;planleggeren
        </span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {allNav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-4 border-t border-gray-200">
        <form action={loggUt}>
          <button
            type="submit"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm
              font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <span className="text-base">🚪</span>
            Logg ut
          </button>
        </form>
      </div>
    </aside>
  )
}

// ─── Mobil: toppmeny ──────────────────────────────────────────

const sidetitler: Record<string, string> = {
  '/dashboard':     'Oversikt',
  '/planlegger':    'Ukesplan',
  '/handleliste':   'Handleliste',
  '/oppskrifter':   'Oppskrifter',
  '/matpakker':     'Matpakker',
  '/beholdning':    'Beholdning',
  '/priser':        'Priser',
  '/budsjett':      'Budsjett',
  '/innstillinger': 'Innstillinger',
}

export function MobilTopp({ onMerKlikk }: { onMerKlikk: () => void }) {
  const pathname = usePathname()
  const tittel = Object.entries(sidetitler).find(([k]) =>
    pathname === k || (k !== '/dashboard' && pathname.startsWith(k))
  )?.[1] ?? 'Middagsplanleggeren'

  return (
    <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-white border-b border-gray-200
      flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <span className="text-xl">🍽️</span>
        <span className="font-semibold text-gray-900 text-sm">{tittel}</span>
      </div>
      <button
        onClick={onMerKlikk}
        className="flex items-center gap-1 text-sm text-gray-600 px-2 py-1.5 rounded-lg
          hover:bg-gray-100 transition-colors"
        aria-label="Meny"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  )
}

// ─── Mobil: bottom nav ────────────────────────────────────────

export function MobilBunnNav({ onMerKlikk }: { onMerKlikk: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200
      flex items-stretch h-16 safe-area-pb">
      {bottomNav.map(({ href, label, icon }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium
              transition-colors active:bg-gray-100 ${
                active ? 'text-green-700' : 'text-gray-500'
              }`}
          >
            <span className={`text-xl leading-none ${active ? 'scale-110' : ''} transition-transform`}>
              {icon}
            </span>
            <span>{label}</span>
          </Link>
        )
      })}
      <button
        onClick={onMerKlikk}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium
          text-gray-500 transition-colors active:bg-gray-100"
      >
        <span className="text-xl leading-none">☰</span>
        <span>Mer</span>
      </button>
    </nav>
  )
}

// ─── Mobil: slide-up skuff med alle sider ─────────────────────

export function MobilMenySkuff({ open, onLukk }: { open: boolean; onLukk: () => void }) {
  if (!open) return null

  return (
    <>
      {/* Bakgrunn */}
      <div
        className="md:hidden fixed inset-0 z-50 bg-black/40"
        onClick={onLukk}
      />
      {/* Skuff */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl
        shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Håndtak */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-4 pb-2 pt-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 px-2">
            Alle sider
          </p>
          <nav className="space-y-0.5">
            {allNav.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onLukk}
                className="flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-medium
                  text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <span className="text-xl w-7 text-center">{icon}</span>
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-3 pt-3 border-t border-gray-100">
            <form action={loggUt}>
              <button
                type="submit"
                className="flex items-center gap-3 w-full px-3 py-3.5 rounded-xl text-sm
                  font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
              >
                <span className="text-xl w-7 text-center">🚪</span>
                Logg ut
              </button>
            </form>
          </div>
        </div>
        {/* Bunn-padding for safe area */}
        <div className="h-6" />
      </div>
    </>
  )
}
