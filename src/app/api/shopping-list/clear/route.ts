import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Sletter alle varer og arkiverer listen
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { listId } = await request.json()
  if (!listId) return NextResponse.json({ error: 'Mangler listId' }, { status: 400 })

  await supabase.from('shopping_list_items').delete().eq('list_id', listId)
  await supabase.from('shopping_lists').update({ status: 'arkivert' }).eq('id', listId)

  return NextResponse.json({ ok: true })
}
