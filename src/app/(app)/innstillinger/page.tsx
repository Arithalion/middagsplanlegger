import { createClient } from '@/lib/supabase/server'
import InnstillingerKlient from './InnstillingerKlient'
import type { Weekday, MemberRole } from '@/types/database'

export default async function InnstillingerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: household }, { data: settings }, { data: members }] = await Promise.all([
    supabase.from('households').select('id, name').maybeSingle(),
    supabase.from('household_settings').select('*').maybeSingle(),
    supabase.from('household_members').select('id, name, role, birth_year, gender').order('role').order('name'),
  ])

  return (
    <InnstillingerKlient
      household={household as { id: string; name: string } | null}
      settings={settings as {
        id: string
        fish_days_per_week: number
        always_vegetables: boolean
        shopping_days: Weekday[]
        special_days: Weekday[]
        weekly_budget: number | null
      } | null}
      members={(members ?? []) as { id: string; name: string; role: MemberRole; birth_year: number | null; gender: string | null }[]}
      userEmail={user?.email ?? ''}
    />
  )
}
