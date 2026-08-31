import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { Session, User } from "@supabase/supabase-js"

import { getSupabaseClient, isSupabaseConfigured } from "@/utils/supabase"

export type AuthStatus = "loading" | "guest" | "authenticated"

type AuthContextValue = {
  status: AuthStatus
  user: User | null
  configured: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function authState(session: Session | null) {
  return {
    status: session ? ("authenticated" as const) : ("guest" as const),
    user: session?.user ?? null,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isSupabaseConfigured()
  const [state, setState] = useState<{
    status: AuthStatus
    user: User | null
  }>({
    status: configured ? "loading" : "guest",
    user: null,
  })

  useEffect(() => {
    const client = getSupabaseClient()

    if (!client) {
      setState({ status: "guest", user: null })
      return
    }

    let active = true
    let observedAuthEvent = false
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      observedAuthEvent = true
      if (active) {
        setState(authState(session))
      }
    })

    void client.auth.getSession().then(({ data, error }) => {
      if (!active || observedAuthEvent) return
      setState(error ? authState(null) : authState(data.session))
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const client = getSupabaseClient()
    if (!client) {
      throw new Error("Account sign-in is not configured.")
    }

    const redirectTo = new URL(window.location.href)
    redirectTo.hash = ""

    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        skipBrowserRedirect: false,
      },
    })

    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const client = getSupabaseClient()
    if (!client) return

    const { error } = await client.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo(
    () => ({
      ...state,
      configured,
      signInWithGoogle,
      signOut,
    }),
    [configured, signInWithGoogle, signOut, state]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.")
  }

  return context
}
