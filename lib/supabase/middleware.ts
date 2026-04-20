import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuthRoute = pathname.startsWith("/login")
  const isPublic = pathname.startsWith("/_next") || pathname === "/favicon.ico"

  // Not logged in and trying to access app → redirect to login
  if (!user && !isAuthRoute && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  // Logged in but on /login → send to home
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  // Optional allowlist enforcement
  if (user) {
    const allowlist = (process.env.AUTH_ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    if (allowlist.length > 0) {
      const email = user.email?.toLowerCase() || ""
      if (!allowlist.includes(email)) {
        // Sign out + redirect to login with error
        await supabase.auth.signOut()
        const url = request.nextUrl.clone()
        url.pathname = "/login"
        url.searchParams.set("error", "not_allowed")
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
