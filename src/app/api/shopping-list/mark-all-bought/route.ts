import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { listId } = (await request.json()) as { listId: string }

  if (!listId) {
    return NextResponse.json({ error: 'Mangler listId' }, { status: 400 })
  }

  await Promise.all([
    supabase.from('shopping_list_items').update({ is_bought: true }).eq('list_id', listId),
    supabase.from('shopping_lists').update({ status: 'kjøpt' }).eq('id', listId),
  ])

  return NextResponse.json({ success: true })
}
