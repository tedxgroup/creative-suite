"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import {
  RiVideoLine,
  RiVoiceprintLine,
  RiImageLine,
  RiSettings3Line,
  RiSunLine,
  RiMoonLine,
  RiMenuLine,
  RiLogoutBoxLine,
} from "@remixicon/react"
import { supabaseBrowser } from "@/lib/supabase/client"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const tabs = [
  { id: "videos", label: "Vídeos", href: "/", icon: RiVideoLine },
  { id: "vozes", label: "Vozes", href: "/vozes", icon: RiVoiceprintLine },
  { id: "imagens", label: "Imagens", href: "/imagens", icon: RiImageLine },
]

function isActive(href: string, pathname: string): boolean {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/projetos")
  }
  return pathname === href || pathname.startsWith(href + "/")
}

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  async function signOut() {
    await supabaseBrowser.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  // Hide on auth/login routes
  if (pathname.startsWith("/login")) {
    return null
  }

  return (
    <header className="bg-background flex h-12 items-center gap-3 border-b px-4 sm:px-6">
      <Link href="/" className="flex items-center gap-2">
        <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center font-mono text-[10px] font-bold tracking-tighter">
          CS
        </div>
        <span className="text-foreground hidden text-xs font-medium tracking-tight sm:inline">
          Creative Suite
        </span>
      </Link>

      <Separator orientation="vertical" className="hidden h-4 sm:block" />

      <NavigationMenu className="hidden sm:flex" viewport={false}>
        <NavigationMenuList>
          {tabs.map((tab) => {
            const Icon = tab.icon
            const active = isActive(tab.href, pathname)
            return (
              <NavigationMenuItem key={tab.id}>
                <NavigationMenuLink
                  asChild
                  active={active}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "gap-1.5 px-2.5",
                    active && "text-foreground bg-muted/50"
                  )}
                >
                  <Link href={tab.href}>
                    <Icon className="size-3.5" />
                    {tab.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            )
          })}
        </NavigationMenuList>
      </NavigationMenu>

      <div className="ml-auto flex items-center gap-1">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-8"
        >
          <Link href="/configuracoes" aria-label="Configurações">
            <RiSettings3Line className="size-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-8"
          onClick={() =>
            setTheme(resolvedTheme === "dark" ? "light" : "dark")
          }
          aria-label="Alternar tema"
        >
          {mounted &&
            (resolvedTheme === "dark" ? (
              <RiSunLine className="size-4" />
            ) : (
              <RiMoonLine className="size-4" />
            ))}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground size-8"
          onClick={signOut}
          aria-label="Sair"
          title="Sair"
        >
          <RiLogoutBoxLine className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild className="sm:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8"
            >
              <RiMenuLine className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <DropdownMenuItem key={tab.id} asChild>
                  <Link href={tab.href} className="flex items-center gap-2">
                    <Icon className="size-3.5" />
                    {tab.label}
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
