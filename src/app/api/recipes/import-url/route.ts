import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

interface SchemaRecipe {
  name?: string
  description?: string
  recipeYield?: string | number
  totalTime?: string
  prepTime?: string
  cookTime?: string
  recipeIngredient?: string[]
  recipeCategory?: string | string[]
  image?: string | { url: string } | { url: string }[]
}

function parseDuration(iso: string): number | null {
  if (!iso) return null
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return null
  const hours = parseInt(match[1] ?? '0', 10)
  const minutes = parseInt(match[2] ?? '0', 10)
  return hours * 60 + minutes
}

function extractImage(image: SchemaRecipe['image']): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (Array.isArray(image)) return image[0]?.url ?? null
  return (image as { url: string }).url ?? null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { url } = await request.json()
  if (!url) return NextResponse.json({ error: 'Mangler URL' }, { status: 400 })

  let html: string
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Middagsplanleggeren/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    html = await res.text()
  } catch {
    return NextResponse.json({ error: 'Klarte ikke hente siden. Prøv en annen URL.' }, { status: 422 })
  }

  // Finn schema.org Recipe JSON-LD
  const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  let recipe: SchemaRecipe | null = null

  for (const match of jsonLdMatches) {
    try {
      const json = JSON.parse(match[1])
      const candidates = Array.isArray(json) ? json : [json, ...(json['@graph'] ?? [])]
      const found = candidates.find(
        (c) => c['@type'] === 'Recipe' || (Array.isArray(c['@type']) && c['@type'].includes('Recipe'))
      )
      if (found) { recipe = found; break }
    } catch { /* ugyldig JSON */ }
  }

  if (!recipe) {
    return NextResponse.json(
      { error: 'Fant ingen oppskrift på denne siden. Nettsiden må støtte schema.org recipe-format.' },
      { status: 422 }
    )
  }

  const totalMinutes =
    parseDuration(recipe.totalTime ?? '') ??
    (parseDuration(recipe.prepTime ?? '') ?? 0) + (parseDuration(recipe.cookTime ?? '') ?? 0)

  const servings = typeof recipe.recipeYield === 'number'
    ? recipe.recipeYield
    : parseInt(String(recipe.recipeYield ?? '4'), 10) || 4

  return NextResponse.json({
    name: recipe.name ?? '',
    description: recipe.description ?? '',
    servings,
    prep_time_minutes: totalMinutes || null,
    source_url: url,
    image_url: extractImage(recipe.image),
    raw_ingredients: recipe.recipeIngredient ?? [],
  })
}
