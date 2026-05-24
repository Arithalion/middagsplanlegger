import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminKlient from './AdminKlient'

type RawReport = {
  id: string
  reason: string | null
  reported_at: string
  recipe: { id: string; name: string; is_public: boolean } | null
  reported_by_household: { name: string } | null
}

type RapportertOppskrift = {
  recipeId: string
  recipeName: string
  isPublic: boolean
  rapporter: { id: string; reason: string | null; reported_at: string; fraHusstand: string }[]
}

type RawDeltOppskrift = {
  id: string
  name: string
  category: string
  created_at: string
  household: { name: string } | null
}

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/logg-inn')

  // Sjekk global admin
  const { data: uh } = await supabase
    .from('user_households')
    .select('is_global_admin')
    .eq('user_id', user.id)
    .maybeSingle()

  const erGlobalAdmin = (uh as { is_global_admin: boolean } | null)?.is_global_admin ?? false
  if (!erGlobalAdmin) {
    return (
      <div className="p-8 text-center">
        <p className="text-4xl mb-3">🚫</p>
        <p className="font-semibold text-gray-700">Du har ikke tilgang til denne siden.</p>
      </div>
    )
  }

  // Hent alle rapporter + alle delte oppskrifter parallelt
  const [{ data: rawRapporter }, { data: rawDelte }] = await Promise.all([
    supabase
      .from('recipe_reports')
      .select(`
        id, reason, reported_at,
        recipe:recipes(id, name, is_public),
        reported_by_household:households(name)
      `)
      .order('reported_at', { ascending: false }),
    supabase
      .from('recipes')
      .select('id, name, category, created_at, household:households(name)')
      .eq('is_public', true)
      .order('created_at', { ascending: false }),
  ])

  // Grupper per oppskrift
  const gruppert = new Map<string, RapportertOppskrift>()
  for (const r of (rawRapporter ?? []) as unknown as RawReport[]) {
    if (!r.recipe) continue
    const key = r.recipe.id
    if (!gruppert.has(key)) {
      gruppert.set(key, {
        recipeId: r.recipe.id,
        recipeName: r.recipe.name,
        isPublic: r.recipe.is_public,
        rapporter: [],
      })
    }
    gruppert.get(key)!.rapporter.push({
      id: r.id,
      reason: r.reason,
      reported_at: r.reported_at,
      fraHusstand: r.reported_by_household?.name ?? 'Ukjent',
    })
  }

  const oppskrifter = Array.from(gruppert.values())

  const deltOppskrifter = ((rawDelte ?? []) as unknown as RawDeltOppskrift[]).map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    husstand: r.household?.name ?? 'Ukjent',
    opprettet: r.created_at,
  }))

  return <AdminKlient oppskrifter={oppskrifter} deltOppskrifter={deltOppskrifter} />
}
