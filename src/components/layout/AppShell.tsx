'use client'

import { useState } from 'react'
import { Sidebar, MobilTopp, MobilBunnNav, MobilMenySkuff } from '@/components/layout/Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [menyÅpen, setMenyÅpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobil topp + bunnmeny */}
      <MobilTopp onMerKlikk={() => setMenyÅpen(true)} />
      <MobilBunnNav onMerKlikk={() => setMenyÅpen(true)} />
      <MobilMenySkuff open={menyÅpen} onLukk={() => setMenyÅpen(false)} />

      {/* Innhold */}
      <main className="flex-1 overflow-y-auto pt-14 pb-20 md:pt-0 md:pb-0">
        {children}
      </main>
    </div>
  )
}
