'use server'

import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function deleteAuthUser(userId: string) {
  console.log('🔑 Attempting to delete user:', userId)

  if (!userId || typeof userId !== 'string') {
    return { success: false, error: 'Valid user ID is required' }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' }
  }

  if (user.id !== userId) {
    return { success: false, error: 'Forbidden' }
  }

  if (!supabaseAdmin) {
    console.error('❌ Missing environment variables for admin client')
    return { success: false, error: 'Server configuration error' }
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (error) {
      console.error('❌ Delete user error:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ User deleted successfully:', userId)
    return { success: true }
  } catch (error: unknown) {
    console.error('❌ Unexpected error in deleteAuthUser:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error',
    }
  }
}