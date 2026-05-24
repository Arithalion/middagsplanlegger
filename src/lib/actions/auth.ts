'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loggUt() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/logg-inn')
}
