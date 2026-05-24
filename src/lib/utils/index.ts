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
