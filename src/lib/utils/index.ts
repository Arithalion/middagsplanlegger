import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ')
}

/** Returnerer ISO-ukenummer for en dato */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

/** Returnerer mandagen i en gitt ISO-uke */
export function getISOWeekStart(year: number, week: number): Date {
  // 4. januar er alltid i uke 1
  const jan4 = new Date(year, 0, 4)
  const mondayWeek1 = new Date(jan4)
  mondayWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const result = new Date(mondayWeek1)
  result.setDate(mondayWeek1.getDate() + (week - 1) * 7)
  return result
}

/** Returnerer de 7 datoene (man–søn) for en gitt uke */
export function getWeekDates(year: number, week: number): Date[] {
  const monday = getISOWeekStart(year, week)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

/** Neste eller forrige uke — håndterer årsskifte */
export function offsetWeek(year: number, week: number, delta: number): { year: number; week: number } {
  const date = getISOWeekStart(year, week)
  date.setDate(date.getDate() + delta * 7)
  return { year: date.getFullYear(), week: getWeekNumber(date) }
}

/** Formater dato norsk, kort */
export function formatDatoKort(date: Date): string {
  return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })
}

/** Ukedagnavn norsk */
export const UKEDAGER = ['mandag','tirsdag','onsdag','torsdag','fredag','lørdag','søndag'] as const


/** Formater beløp i NOK */
export function formatNok(amount: number): string {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(amount)
}

/** Formater mengde med enhet */
export function formatMengde(amount: number, unit: string): string {
  const n = amount % 1 === 0 ? amount.toString() : amount.toFixed(1)
  return `${n} ${unit}`
}

/** Konverter mengde til basisenhet (g for masse, ml for volum, stk for stykkvarer) */
export function tilBaseEnhet(amount: number, unit: string): { amount: number; baseUnit: string } {
  const u = unit.toLowerCase().trim()
  if (u === 'g')    return { amount, baseUnit: 'g' }
  if (u === 'kg')   return { amount: amount * 1000, baseUnit: 'g' }
  if (u === 'hg')   return { amount: amount * 100, baseUnit: 'g' }
  if (u === 'mg')   return { amount: amount / 1000, baseUnit: 'g' }
  if (u === 'ml')   return { amount, baseUnit: 'ml' }
  if (u === 'cl')   return { amount: amount * 10, baseUnit: 'ml' }
  if (u === 'dl')   return { amount: amount * 100, baseUnit: 'ml' }
  if (u === 'l' || u === 'liter') return { amount: amount * 1000, baseUnit: 'ml' }
  return { amount, baseUnit: u } // stk, ss, ts etc.
}

/**
 * Beregn estimert kostnad for en oppskrift (per porsjon × antall porsjoner).
 * Returnerer null om ingen ingredienser har pris.
 */
export function beregnOppskriftKostnad(
  ingredients: { amount: number; unit: string; price_per_unit: number | null; price_unit: string | null }[],
  recipeServings: number,
  targetServings: number,
): number | null {
  const scale = recipeServings > 0 ? targetServings / recipeServings : 1
  let total = 0
  let harPris = false

  for (const ing of ingredients) {
    if (ing.price_per_unit == null || ing.price_unit == null) continue

    const scaled = ing.amount * scale
    const { amount: recipeBase, baseUnit: recipeBase2 } = tilBaseEnhet(scaled, ing.unit)
    const { amount: priceBase, baseUnit: priceBase2 } = tilBaseEnhet(1, ing.price_unit)

    // Sjekk at basisenhetene matcher
    if (recipeBase2 !== priceBase2) continue

    // Konverter price_per_unit fra kr/<price_unit> til kr/<baseUnit>
    const pricePerBase = ing.price_per_unit / priceBase

    total += recipeBase * pricePerBase
    harPris = true
  }

  return harPris ? total : null
}

/** Dager til utløp */
export function dagerTilUtlop(date: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(date)
  return Math.floor((expiry.getTime() - today.getTime()) / 86400000)
}

/** Fargekode for holdbarhet */
export function holdbarhetFarge(dager: number): 'grønn' | 'gul' | 'rød' {
  if (dager < 0) return 'rød'
  if (dager <= 3) return 'gul'
  return 'grønn'
}

/** Kategori-badge-farger */
export const KATEGORI_FARGER: Record<string, string> = {
  hverdagsmat:    'bg-blue-100 text-blue-700',
  fisk:           'bg-cyan-100 text-cyan-700',
  vegetar:        'bg-green-100 text-green-700',
  kylling:        'bg-yellow-100 text-yellow-700',
  helgemat:       'bg-purple-100 text-purple-700',
  søndagsmiddag:  'bg-orange-100 text-orange-700',
  selskapsmat:    'bg-pink-100 text-pink-700',
}

export const KATEGORI_LABELS: Record<string, string> = {
  hverdagsmat:    'Hverdagsmat',
  fisk:           'Fisk',
  vegetar:        'Vegetar',
  kylling:        'Kylling',
  helgemat:       'Helgemat',
  søndagsmiddag:  'Søndagsmiddag',
  selskapsmat:    'Selskapsmat',
}
