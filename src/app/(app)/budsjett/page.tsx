import { createClient } from '@/lib/supabase/server'
import { getWeekNumber } from '@/lib/utils'
import BudsjettKlient from './BudsjettKlient'

type RawBudget = { id: string; planned_amount: number | null; actual_amount: number | null }
type RawSettings = { weekly_budget: number | null }
type HistoryItem = { week_number: number; year: number; planned_amount: number | null; actual_amount: number | null }

export default async function BudsjettPage() {
  const supabase = await createClient()
  const now = new Date()
  const weekNumber = getWeekNumber(now)
  const year = now.getFullYear()

  const [{ data: rawBudget }, { data: rawSettings }, { data: rawHistory }] = await Promise.all([
    supabase
      .from('budgets')
      .select('id, planned_amount, actual_amount')
      .eq('week_number', weekNumber)
      .eq('year', year)
      .maybeSingle(),
    supabase
      .from('household_settings')
      .select('weekly_budget')
      .maybeSingle(),
    supabase
      .from('budgets')
      .select('week_number, year, planned_amount, actual_amount')
      .order('year', { ascending: false })
      .order('week_number', { ascending: false })
      .limit(12),
  ])

  const currentBudget = rawBudget as RawBudget | null
  const settings = rawSettings as RawSettings | null
  const history = (rawHistory ?? []) as HistoryItem[]

  return (
    <BudsjettKlient
      weekNumber={weekNumber}
      year={year}
      budgetId={currentBudget?.id ?? null}
      plannedAmount={currentBudget?.planned_amount ?? settings?.weekly_budget ?? null}
      actualAmount={currentBudget?.actual_amount ?? null}
      history={history}
    />
  )
}
