import {
  CircleDollarSignIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  LogInIcon,
  LogOutIcon,
  PlusIcon,
  Settings2Icon,
  UserRoundIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useAuth } from "@/features/auth/auth-provider"
import {
  accountInitials,
  accountLabel,
} from "@/features/finance/account/account-display"
import { cn } from "@/lib/utils"
import type { CoinView } from "@/features/finance/finance-view-types"

export const navigation: Array<{
  view: CoinView
  label: string
  shortLabel: string
  to: string
  icon: LucideIcon
}> = [
  {
    view: "overview",
    label: "Overview",
    shortLabel: "Home",
    to: "/",
    icon: LayoutDashboardIcon,
  },
  {
    view: "budgets",
    label: "Budgets",
    shortLabel: "Budgets",
    to: "/budgets",
    icon: GaugeIcon,
  },
  {
    view: "preferences",
    label: "Preferences",
    shortLabel: "Preferences",
    to: "/preferences",
    icon: Settings2Icon,
  },
  {
    view: "profile",
    label: "Profile",
    shortLabel: "Profile",
    to: "/profile",
    icon: UserRoundIcon,
  },
]

export const pageTitles: Record<CoinView, string> = {
  overview: "Overview",
  transactions: "Transactions",
  budgets: "Budgets",
  preferences: "Preferences",
  profile: "Profile",
}

export function getView(pathname: string): CoinView {
  if (pathname.startsWith("/transactions")) return "transactions"
  if (pathname.startsWith("/budgets")) return "budgets"
  if (pathname.startsWith("/settings")) return "preferences"
  if (pathname.startsWith("/preferences")) return "preferences"
  if (pathname.startsWith("/profile")) return "profile"
  return "overview"
}

export function CoinSidebar({
  view,
  onAdd,
  onSignIn,
  onSignOut,
  canMutate,
}: {
  view: CoinView
  onAdd: () => void
  onSignIn: () => void
  onSignOut: () => void
  canMutate: boolean
}) {
  const auth = useAuth()
  const cloudWorkspace = auth.status === "authenticated"
  const profile = cloudWorkspace ? accountLabel(auth.user?.email) : "Guest mode"

  return (
    <Sidebar collapsible="icon" className="hidden md:flex">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
        <div className="flex items-center gap-3 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CircleDollarSignIcon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="font-semibold tracking-[-0.02em]">Coin</p>
            <p className="text-xs text-muted-foreground">Personal finance</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.view}>
                    <SidebarMenuButton
                      asChild
                      isActive={view === item.view}
                      tooltip={item.label}
                      size="lg"
                      className="group-data-[collapsible=icon]:justify-center"
                    >
                      <Link to={item.to}>
                        <Icon aria-hidden="true" />
                        <span className="group-data-[collapsible=icon]:sr-only">
                          {item.label}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Quick action</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onAdd}
                  disabled={!canMutate}
                  tooltip="Add transaction"
                  size="lg"
                  className="group-data-[collapsible=icon]:justify-center"
                >
                  <PlusIcon aria-hidden="true" />
                  <span className="group-data-[collapsible=icon]:sr-only">
                    Add transaction
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
        <div className="rounded-xl bg-sidebar-accent p-3 group-data-[collapsible=icon]:hidden">
          <p className="text-xs font-medium">
            {cloudWorkspace ? "Cloud workspace" : "On this device"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {cloudWorkspace
              ? "Your ledger is stored in your private account."
              : "Your guest ledger stays in this browser."}
          </p>
        </div>
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={profile}
              className="group-data-[collapsible=icon]:justify-center"
            >
              <Avatar size="sm">
                <AvatarFallback>
                  {cloudWorkspace ? accountInitials(auth.user?.email) : "GU"}
                </AvatarFallback>
              </Avatar>
              <span className="truncate group-data-[collapsible=icon]:sr-only">
                {profile}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip={cloudWorkspace ? "Sign out" : "Continue with Google"}
              disabled={
                !cloudWorkspace &&
                (!auth.configured || auth.status === "loading")
              }
              onClick={cloudWorkspace ? onSignOut : onSignIn}
              className="group-data-[collapsible=icon]:justify-center"
            >
              {cloudWorkspace ? (
                <LogOutIcon aria-hidden="true" />
              ) : (
                <LogInIcon aria-hidden="true" />
              )}
              <span className="group-data-[collapsible=icon]:sr-only">
                {cloudWorkspace ? "Sign out" : "Continue with Google"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export function AppHeader({
  view,
  onAdd,
  canMutate,
}: {
  view: CoinView
  onAdd: () => void
  canMutate: boolean
}) {
  const auth = useAuth()
  const cloudWorkspace = auth.status === "authenticated"
  const title = pageTitles[view]

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background/90 px-4 backdrop-blur-xl sm:px-6 xl:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SidebarTrigger className="hidden md:inline-flex" />
        <div className="flex items-center gap-2 md:hidden">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CircleDollarSignIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="font-semibold">Coin</span>
        </div>
        <Separator orientation="vertical" className="hidden h-5 md:block" />
        <div className="hidden min-w-0 md:block">
          <h1 className="truncate text-sm font-medium">{title}</h1>
          <p className="truncate text-xs text-muted-foreground">
            A clear view of what you record
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          data-testid="add-transaction-desktop"
          className="hidden md:inline-flex"
          onClick={onAdd}
          disabled={!canMutate}
        >
          <PlusIcon data-icon="inline-start" />
          Add transaction
        </Button>
        <Avatar size="sm" aria-label="Profile">
          <AvatarFallback>
            {cloudWorkspace ? accountInitials(auth.user?.email) : "GU"}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}

export function MobileDock({
  view,
  onAdd,
  canMutate,
}: {
  view: CoinView
  onAdd: () => void
  canMutate: boolean
}) {
  const first = navigation.slice(0, 2)
  const last = navigation.slice(2)

  return (
    <nav
      aria-label="Primary navigation"
      data-testid="mobile-dock"
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 items-center rounded-2xl border bg-card/95 px-2 py-2 shadow-xl shadow-black/30 backdrop-blur-xl md:hidden"
    >
      {first.map((item) => (
        <DockLink key={item.view} item={item} active={view === item.view} />
      ))}
      <div className="flex justify-center">
        <Button
          data-testid="add-transaction-mobile"
          size="icon-lg"
          className="-mt-7 size-12 rounded-full shadow-lg"
          aria-label="Add transaction"
          onClick={onAdd}
          disabled={!canMutate}
        >
          <PlusIcon />
        </Button>
      </div>
      {last.map((item) => (
        <DockLink key={item.view} item={item} active={view === item.view} />
      ))}
    </nav>
  )
}

function DockLink({
  item,
  active,
}: {
  item: (typeof navigation)[number]
  active: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className="flex min-w-0 touch-manipulation flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[0.66rem] font-medium text-muted-foreground transition-[color,transform] duration-75 active:scale-[0.96] active:text-foreground"
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-4 transition-[color,transform,stroke-width] duration-150",
          active && "-translate-y-0.5 stroke-[2.5] text-primary"
        )}
      />
      <span className="truncate">{item.shortLabel}</span>
    </Link>
  )
}
