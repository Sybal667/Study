'use server'

import { createClient } from '@supabase/supabase-js'

export async function deleteAuthUser(userId: string) {
  console.log('🔑 Attempting to delete user:', userId)
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables for admin client')
    return { success: false, error: 'Server configuration error' }
  }
  
  const supabaseAdmin = createClient(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (error) {
      console.error('❌ Delete user error:', error)
      return { success: false, error: error.message }
    }
    
    console.log('✅ User deleted successfully:', userId)
    return { success: true }
    
  } catch (error: any) {
    console.error('❌ Unexpected error in deleteAuthUser:', error)
    return { success: false, error: error.message }
  }
}