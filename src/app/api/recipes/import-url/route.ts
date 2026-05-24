import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'dns/promises'
import { isIPv4 } from 'net'

interface SchemaRecipe {
  name?: string
  description?: string
  recipeYield?: string | number
  totalTime?: string
  prepTime?: string
  cookTime?: string
  recipeIngredient?: string[]
  image?: string | { url: string } | { url: string }[]
}

interface ParsedIngredient {
  name: string
  amount: number | null
  unit: string | null
}

// Norske enhet-aliaser → interne enhetskoder
const UNIT_MAP: Record<string, string> = {
  ts: 'tsk', tsk: 'tsk', teskje: 'tsk', teskjeer: 'tsk', teskjei: 'tsk',
  ss: 'ss', spiseskje: 'ss', spiseskjeer: 'ss', tbsp: 'ss',
  ml: 'ml',
  dl: 'dl',
  l: 'l', liter: 'l',
  g: 'g', gram: 'g',
  kg: 'kg', kilo: 'kg',
  stk: 'stk', stykk: 'stk', stykker: 'stk',
  pk: 'pk', pakke: 'pk', pakning: 'pk', pakninger: 'pk',
  pose: 'pose', poser: 'pose',
  boks: 'boks', bokser: 'boks',
  flaske: 'flaske', flasker: 'flaske',
  neve: 'stk', krm: 'tsk', klype: 'tsk', klyper: 'tsk',
}

// Unicode-brøker og norske brøk-skrivemåter
function normaliserTall(s: string): string {
  return s
    .replace(/½/g, '0.5')
    .replace(/¼/g, '0.25')
    .replace(/¾/g, '0.75')
    .replace(/⅓/g, '0.333')
    .replace(/⅔/g, '0.667')
    .replace(/\b(\d+)\/(\d+)\b/g, (_, a, b) => String(Number(a) / Number(b)))
    .replace(/,/g, '.')
}

function parseIngredienslinje(raw: string): ParsedIngredient {
  let s = normaliserTall(raw.trim())

  // Prøv å matche: [tall] [enhet] [navn]   eller   [tall] [navn]
  const tallenhetNavn = /^([\d.]+)\s+([a-zæøå.]+)\s+(.+)$/i
  const tallNavn      = /^([\d.]+)\s+(.+)$/i

  let m = s.match(tallenhetNavn)
  if (m) {
    const [, tallStr, enhetRaw, navnRest] = m
    const enhet = UNIT_MAP[enhetRaw.toLowerCase().replace('.', '')]
    if (enhet) {
      return { amount: parseFloat(tallStr), unit: enhet, name: navnRest.trim() }
    }
    // Enhet ikke kjent — behandle enhetsdelen som del av navn
    return { amount: parseFloat(tallStr), unit: 'stk', name: `${enhetRaw} ${navnRest}`.trim() }
  }

  m = s.match(tallNavn)
  if (m) {
    const [, tallStr, navn] = m
    return { amount: parseFloat(tallStr), unit: 'stk', name: navn.trim() }
  }

  // Ingen tall funnet — hele strengen er ingrediensnavn
  return { amount: null, unit: null, name: s }
}

function parseDuration(iso: string): number | null {
  if (!iso) return null
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return null
  return (parseInt(match[1] ?? '0', 10)) * 60 + parseInt(match[2] ?? '0', 10)
}

function extractImage(image: SchemaRecipe['image']): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (Array.isArray(image)) return image[0]?.url ?? null
  return (image as { url: string }).url ?? null
}

// ─── SSRF-beskyttelse ─────────────────────────────────────────

function isPrivateIP(ip: string): boolean {
  if (!isIPv4(ip)) {
    // IPv6 loopback og ULA
    return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd')
  }
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 127 ||
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)   // link-local / cloud-metadata
  )
}

async function validateUrl(rawUrl: string): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let url: URL
  try { url = new URL(rawUrl) } catch { return { ok: false, reason: 'Ugyldig URL' } }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'Kun HTTPS-URLer er støttet' }
  }

  const hostname = url.hostname

  // Blokker numeriske IP-adresser direkte
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname === '::1') {
    if (isPrivateIP(hostname)) return { ok: false, reason: 'Tilgang nektet' }
    return { ok: true, url }
  }

  // Løs opp hostname og sjekk den returnerte IP-en
  try {
    const { address } = await lookup(hostname, { family: 4 })
    if (isPrivateIP(address)) return { ok: false, reason: 'Tilgang nektet' }
  } catch {
    return { ok: false, reason: 'Klarte ikke løse opp domenenavnet' }
  }

  return { ok: true, url }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { url } = await request.json()
  if (!url) return NextResponse.json({ error: 'Mangler URL' }, { status: 400 })

  const validated = await validateUrl(url)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.reason }, { status: 422 })
  }

  let html: string
  try {
    const res = await fetch(validated.url.toString(), {
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
    ((parseDuration(recipe.prepTime ?? '') ?? 0) + (parseDuration(recipe.cookTime ?? '') ?? 0))

  const servings = typeof recipe.recipeYield === 'number'
    ? recipe.recipeYield
    : parseInt(String(recipe.recipeYield ?? '4'), 10) || 4

  const parsedIngredients = (recipe.recipeIngredient ?? []).map(parseIngredienslinje)

  return NextResponse.json({
    name: recipe.name ?? '',
    description: recipe.description ?? '',
    servings,
    prep_time_minutes: totalMinutes || null,
    source_url: url,
    image_url: extractImage(recipe.image),
    ingredients: parsedIngredients,
  })
}
