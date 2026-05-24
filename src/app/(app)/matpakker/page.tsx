import { createClient } from '@/lib/supabase/server'
import { getWeekNumber, UKEDAGER } from '@/lib/utils'
import MatpakkeKlient from './MatpakkeKlient'

type RawMember = { id: string; name: string; role: string }
type RawLunchboxPlan = { member_id: string; weekday: string; num_lunchboxes: number; num_fruit: number }

export default async function MatpakkePage({
  searchParams,
}: {
  searchParams: Promise<{ uke?: string; år?: string }>
}) {
  const { uke, år } = await searchParams
  const now = new Date()
  const weekNumber = uke ? parseInt(uke) : getWeekNumber(now)
  const year = år ? parseInt(år) : now.getFullYear()

  const supabase = await createClient()

  const [{ data: rawMembers }, { data: rawPlans }] = await Promise.all([
    supabase
      .from('household_members')
      .select('id, name, role')
      .eq('role', 'barn')
      .order('name'),
    supabase
      .from('lunchbox_plans')
      .select('member_id, weekday, num_lunchboxes, num_fruit')
      .eq('week_number', weekNumber)
      .eq('year', year),
  ])

  const barn = (rawMembers ?? []) as RawMember[]
  const plans = (rawPlans ?? []) as RawLunchboxPlan[]

  // Bygg planMap: member_id → weekday → { num_lunchboxes, num_fruit }
  const planMap: Record<string, Record<string, { num_lunchboxes: number; num_fruit: number }>> = {}
  for (const plan of plans) {
    if (!planMap[plan.member_id]) planMap[plan.member_id] = {}
    planMap[plan.member_id][plan.weekday] = {
      num_lunchboxes: plan.num_lunchboxes,
      num_fruit: plan.num_fruit,
    }
  }

  return (
    <MatpakkeKlient
      barn={barn}
      planMap={planMap}
      weekNumber={weekNumber}
      year={year}
    />
  )
}
