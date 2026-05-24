import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { itemId, isBought } = (await request.json()) as {
    itemId: string
    isBought?: boolean
  }

  if (!itemId) {
    return NextResponse.json({ error: 'Mangler itemId' }, { status: 400 })
  }

  const { error } = await supabase
    .from('shopping_list_items')
    .update({ is_bought: isBought ?? true })
    .eq('id', itemId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
