'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function setRating(
  recipeId: string,
  memberId: string,
  score: 1 | 2 | 3 | 4 | 5
) {
  const supabase = await createClient()

  await supabase
    .from('recipe_ratings')
    .upsert(
      { recipe_id: recipeId, member_id: memberId, score },
      { onConflict: 'recipe_id,member_id' }
    )

  revalidatePath(`/oppskrifter/${recipeId}`)
}
