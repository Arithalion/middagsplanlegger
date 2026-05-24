'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Weekday } from '@/types/database'

export async function updateHouseholdSettings(data: {
  name?: string
  weekly_budget?: number | null
  fish_days_per_week?: number
  always_vegetables?: boolean
  shopping_days?: Weekday[]
  special_days?: Weekday[]
}) {
  const supabase = await createClient()

  const { data: householdId, error } = await supabase.rpc('my_household_id')
  if (error || !householdId) throw new Error('Fant ikke husstand')

  if (data.name !== undefined) {
    await supabase.from('households').update({ name: data.name }).eq('id', householdId)
  }

  const { name: _ignored, ...settingsFields } = data

  if (Object.keys(settingsFields).length > 0) {
    const upsertPayload: {
      household_id: string
      weekly_budget?: number | null
      fish_days_per_week?: number
      always_vegetables?: boolean
      shopping_days?: string[]
      special_days?: string[]
    } = { household_id: householdId }

    if (settingsFields.weekly_budget !== undefined) upsertPayload.weekly_budget = settingsFields.weekly_budget
    if (settingsFields.fish_days_per_week !== undefined) upsertPayload.fish_days_per_week = settingsFields.fish_days_per_week
    if (settingsFields.always_vegetables !== undefined) upsertPayload.always_vegetables = settingsFields.always_vegetables
    if (settingsFields.shopping_days !== undefined) upsertPayload.shopping_days = settingsFields.shopping_days as string[]
    if (settingsFields.special_days !== undefined) upsertPayload.special_days = settingsFields.special_days as string[]

    await supabase
      .from('household_settings')
      .upsert(upsertPayload, { onConflict: 'household_id' })
  }

  revalidatePath('/innstillinger')
}

export async function addMember(data: {
  name: string
  role: 'voksen' | 'barn'
  birth_year?: number | null
  gender?: 'gutt' | 'jente' | 'mann' | 'kvinne' | null
}) {
  const supabase = await createClient()

  const { data: householdId, error } = await supabase.rpc('my_household_id')
  if (error || !householdId) throw new Error('Fant ikke husstand')

  await supabase.from('household_members').insert({
    household_id: householdId,
    name: data.name,
    role: data.role,
    birth_year: data.birth_year ?? null,
    gender: data.gender ?? null,
  })

  revalidatePath('/innstillinger')
}

export async function deleteMember(id: string) {
  const supabase = await createClient()
  await supabase.from('household_members').delete().eq('id', id)
  revalidatePath('/innstillinger')
}
