'use client'

import { useState, useTransition } from 'react'
import { setRating } from '@/lib/actions/ratings'
import StjerneRating from '@/components/ui/StjerneRating'

interface Props {
  recipeId: string
  memberId: string
  memberName: string
  initialScore: number | null
}

export default function RatingInndata({ recipeId, memberId, memberName, initialScore }: Props) {
  const [score, setScore] = useState<number | null>(initialScore)
  const [isPending, startTransition] = useTransition()

  function handleRate(s: number) {
    setScore(s)
    startTransition(async () => {
      await setRating(recipeId, memberId, s as 1 | 2 | 3 | 4 | 5)
    })
  }

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className={`text-sm ${isPending ? 'text-gray-400' : 'text-gray-700'}`}>
        {memberName}
      </span>
      <div className="flex items-center gap-2">
        {score && <span className="text-xs text-gray-400">{score}/5</span>}
        <StjerneRating score={score} onRate={handleRate} size="sm" />
      </div>
    </div>
  )
}
