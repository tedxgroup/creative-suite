// Server-side Supabase client using service role key (bypasses RLS)
// ⚠️ Never expose this client to the browser
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!serviceRoleKey) {
  console.warn("[supabase] SUPABASE_SERVICE_ROLE_KEY not configured")
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
