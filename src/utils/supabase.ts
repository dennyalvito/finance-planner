import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/data/database.types"

let browserClient: SupabaseClient<Database> | undefined

function configuration() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL?.trim() ?? "",
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "",
  }
}

export function isSupabaseConfigured() {
  const { url, publishableKey } = configuration()

  return (
    /^https:\/\/.+\.supabase\.co$/.test(url) &&
    publishableKey.length > 0 &&
    !publishableKey.startsWith("your-")
  )
}

export function getSupabaseClient() {
  if (typeof window === "undefined" || !isSupabaseConfigured()) {
    return undefined
  }

  const { url, publishableKey } = configuration()
  browserClient ??= createClient<Database>(url, publishableKey)
  return browserClient
}
