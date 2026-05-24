import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { changes } = await request.json() as {
    changes: { id: string; is_bought: boolean }[]
  }

  if (!changes?.length) return NextResponse.json({ ok: true })

  const kjøpt = changes.filter(c => c.is_bought).map(c => c.id)
  const ikkeKjøpt = changes.filter(c => !c.is_bought).map(c => c.id)

  if (kjøpt.length)
    await supabase.from('shopping_list_items').update({ is_bought: true }).in('id', kjøpt)
  if (ikkeKjøpt.length)
    await supabase.from('shopping_list_items').update({ is_bought: false }).in('id', ikkeKjøpt)

  return NextResponse.json({ ok: true })
}
