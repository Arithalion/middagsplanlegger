'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { loggUt } from '@/lib/actions/auth'

const nav = [
  { href: '/dashboard',    label: 'Oversikt',       icon: '🏠' },
  { href: '/planlegger',   label: 'Ukesplan',        icon: '📅' },
  { href: '/oppskrifter',  label: 'Oppskrifter',     icon: '📖' },
  { href: '/handleliste',  label: 'Handleliste',     icon: '🛒' },
  { href: '/beholdning',   label: 'Beholdning',      icon: '📦' },
  { href: '/budsjett',     label: 'Budsjett',        icon: '💰' },
  { href: '/innstillinger',label: 'Innstillinger',   icon: '⚙️'  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 h-16 border-b border-gray-200">
        <span className="text-2xl">🍽️</span>
        <span className="font-bold text-gray-900 text-sm leading-tight">
          Middags&shy;planleggeren
        </span>
      </div>

      {/* Navigasjon */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {nav.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="text-base">{icon}</span>
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logg ut */}
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
