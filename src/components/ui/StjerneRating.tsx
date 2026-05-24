'use client'

interface StjerneRatingProps {
  score: number | null
  maxScore?: number
  size?: 'sm' | 'md'
  onRate?: (score: number) => void
  label?: string
}

export default function StjerneRating({
  score,
  maxScore = 5,
  size = 'md',
  onRate,
  label,
}: StjerneRatingProps) {
  const starSize = size === 'sm' ? 'text-sm' : 'text-base'
  const rounded = score != null ? Math.round(score) : 0

  return (
    <div className="flex items-center gap-1" role="img" aria-label={label ?? `${rounded} av ${maxScore} stjerner`}>
      {Array.from({ length: maxScore }, (_, i) => {
        const filled = i < rounded
        return onRate ? (
          <button
            key={i}
            type="button"
            onClick={() => onRate(i + 1)}
            className={`${starSize} leading-none transition-transform hover:scale-125 focus:outline-none`}
            aria-label={`${i + 1} stjerne${i > 0 ? 'r' : ''}`}
          >
            {filled ? '★' : '☆'}
          </button>
        ) : (
          <span key={i} className={`${starSize} leading-none ${filled ? 'text-amber-400' : 'text-gray-300'}`}>
            {filled ? '★' : '☆'}
          </span>
        )
      })}
      {score != null && (
        <span className="text-xs text-gray-500 ml-1">{score.toFixed(1)}</span>
      )}
    </div>
  )
}
