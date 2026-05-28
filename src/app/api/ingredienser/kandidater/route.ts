import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ─── Deterministisk normalisering (ingen AI) ──────────────────

// Adjektiver og tilberedningsformer som strippes
const STRIP_WORDS = new Set([
  'fersk', 'ferske', 'frisk', 'friske',
  'tørket', 'tørkede', 'tørr', 'tørre',
  'hakket', 'hakkede', 'finhakket', 'grovhakket',
  'revet', 'finrevet', 'grovrevet',
  'skivet', 'skivede',
  'knust', 'knuste',
  'presset',
  'smeltet',
  'myk', 'myke',
  'rå', 'rått',
  'kokt', 'kokte',
  'stekt', 'stekte',
  'hel', 'hele',
  'stor', 'store', 'liten', 'lille', 'små',
])

function normaliserNavn(navn: string): string {
  let s = navn.toLowerCase().trim()

  // Fjern alt etter komma, " til ", " eller ", " og "
  s = s.replace(/,.*$/, '')
  s = s.replace(/\s+(til|eller|og)\s+.*$/, '')
  s = s.trim()

  // Fjern kjente adjektiver/tilberedningsformer
  const ord = s.split(/\s+/)
  const filtrert = ord.filter((o) => !STRIP_WORDS.has(o))
  s = filtrert.join(' ').trim()

  // Fjern enkel plural -er på slutten (f.eks. "gulrøtter" → "gulrot" er for komplekst,
  // men "tomater" og "tomat" blir normalisert likt via -er stripping)
  if (s.length > 4 && s.endsWith('er')) {
    s = s.slice(0, -2)
  }

  return s
}

export interface IngredientVariant {
  id: string
  name: string
  bruk: number
}

export interface DuplikatGruppe {
  basis: string
  varianter: IngredientVariant[]
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  // Hent alle ingredienser for husholdningen med antall ganger de brukes i oppskrifter
  const { data: ingredienser, error } = await supabase
    .from('ingredients')
    .select('id, name, recipe_ingredients(count)')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!ingredienser || ingredienser.length === 0) {
    return NextResponse.json({ duplikater: [], alle: [] })
  }

  // Bygg liste med normalisert basis + bruksantall
  const med = ingredienser.map((ing) => {
    const bruk = (ing.recipe_ingredients as unknown as { count: number }[])?.[0]?.count ?? 0
    return {
      id: ing.id,
      name: ing.name,
      bruk: Number(bruk),
      basis: normaliserNavn(ing.name),
    }
  })

  // Grupper etter normalisert basis
  const grupper = new Map<string, typeof med>()
  for (const item of med) {
    const g = grupper.get(item.basis) ?? []
    g.push(item)
    grupper.set(item.basis, g)
  }

  // Behold kun grupper med 2+ varianter
  const duplikater: DuplikatGruppe[] = []
  for (const [basis, varianter] of grupper) {
    if (varianter.length < 2) continue
    duplikater.push({
      basis,
      varianter: varianter
        .sort((a, b) => b.bruk - a.bruk)
        .map(({ id, name, bruk }) => ({ id, name, bruk })),
    })
  }
  duplikater.sort((a, b) => a.basis.localeCompare(b.basis, 'nb'))

  // Alle ingredienser (for nedre tabell)
  const alle = med
    .map(({ id, name, bruk }) => ({ id, name, bruk }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'))

  return NextResponse.json({ duplikater, alle })
}
