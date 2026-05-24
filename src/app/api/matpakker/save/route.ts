import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Ikke innlogget' }, { status: 401 })

  const { weekNumber, year, planMap } = await request.json()

  const upserts: {
    member_id: string
    week_number: number
    year: number
    weekday: string
    num_lunchboxes: number
    num_fruit: number
  }[] = []

  for (const [memberId, dagMap] of Object.entries(planMap as Record<string, Record<string, { num_lunchboxes: number; num_fruit: number }>>)) {
    for (const [weekday, plan] of Object.entries(dagMap)) {
      upserts.push({
        member_id: memberId,
        week_number: weekNumber,
        year,
        weekday,
        num_lunchboxes: plan.num_lunchboxes,
        num_fruit: plan.num_fruit,
      })
    }
  }

  if (upserts.length > 0) {
    const { data: householdId } = await supabase.rpc('my_household_id')
    const withHousehold = upserts.map((u) => ({ ...u, household_id: householdId }))

    const { error } = await supabase
      .from('lunchbox_plans')
      .upsert(withHousehold, { onConflict: 'member_id,year,week_number,weekday' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: 'Matpakkeplan lagret!' })
}
