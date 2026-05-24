import { KATEGORI_FARGER, KATEGORI_LABELS } from '@/lib/utils'
import type { RecipeCategory } from '@/types/database'

interface KategoriBadgeProps {
  category: RecipeCategory
  className?: string
}

export default function KategoriBadge({ category, className = '' }: KategoriBadgeProps) {
  const farge = KATEGORI_FARGER[category] ?? 'bg-gray-100 text-gray-700'
  const label = KATEGORI_LABELS[category] ?? category
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${farge} ${className}`}>
      {label}
    </span>
  )
}
