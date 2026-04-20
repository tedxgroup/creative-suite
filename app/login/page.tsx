"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { RiLockLine } from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabaseBrowser } from "@/lib/supabase/client"
import { toast } from "sonner"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/"
  const errorParam = searchParams.get("error")

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (errorParam === "not_allowed") {
      toast.error("Acesso não autorizado para este email.")
    } else if (errorParam === "auth_failed") {
      toast.error("Falha na autenticação.")
    }
  }, [errorParam])

  async function signIn() {
    if (!email || !password) return
    setLoading(true)
    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email ou senha inválidos"
          : error.message
      )
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <Card className="w-full max-w-[400px]">
      <CardContent className="space-y-6 px-6 py-2">
        <div className="space-y-2 text-center">
          <div className="bg-primary text-primary-foreground mx-auto flex size-10 items-center justify-center font-mono text-sm font-bold tracking-tighter">
            CS
          </div>
          <h1 className="font-heading text-foreground text-xl font-semibold tracking-tight">
            Creative Suite
          </h1>
          <p className="text-muted-foreground text-xs">
            Entre com seu email e senha
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") signIn()
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter") signIn()
              }}
            />
          </div>
          <Button
            className="w-full"
            onClick={signIn}
            disabled={loading || !email || !password}
          >
            <RiLockLine className="size-4" />
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </div>

        <p className="text-muted-foreground text-center font-mono text-[10px]">
          Acesso restrito — usuários cadastrados no Supabase
        </p>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="bg-background flex min-h-svh items-center justify-center p-6">
      <React.Suspense fallback={null}>
        <LoginForm />
      </React.Suspense>
    </div>
  )
}
