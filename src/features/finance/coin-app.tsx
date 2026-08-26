import {
  createContext,
  lazy,
  startTransition,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Link, Outlet, useLocation } from "@tanstack/react-router"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  CloudIcon,
  GaugeIcon,
  HardDriveIcon,
  LayoutDashboardIcon,
  LogInIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ReceiptTextIcon,
  Settings2Icon,
  ShapesIcon,
  Trash2Icon,
  UserRoundIcon,
  WalletCardsIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  buildCashFlowSeries,
  buildCategoryCashFlow,
  calculateBudgetProgress,
  formatCompactRupiah,
  formatRupiah,
  monthKey,
  summarizeLedger,
} from "@/domain/finance"
import type {
  Budget,
  Category,
  CategoryCashFlow,
  FinanceTransaction,
  LedgerSummary,
} from "@/domain/finance"
import { useAuth } from "@/features/auth/auth-provider"
import { GuardedSignOutDialog } from "@/features/auth/guarded-sign-out-dialog"
import { SignInDialog } from "@/features/auth/sign-in-dialog"
import { BudgetDialog } from "@/features/finance/budget-dialog"
import { CategoryManager } from "@/features/finance/category-manager"
import { getCategoryIcon } from "@/features/finance/category-icon"
import { CloudWorkspaceStatus } from "@/features/finance/cloud-workspace-status"
import { TransactionDialog } from "@/features/finance/transaction-dialog"
import { SyncStatus } from "@/features/finance/sync-status"
import { useFinance } from "@/features/finance/use-finance"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const CashFlowChart = lazy(() =>
  import("@/features/finance/cash-flow-chart").then((module) => ({
    default: module.CashFlowChart,
  }))
)

const SpendingChart = lazy(() =>
  import("@/features/finance/spending-chart").then((module) => ({
    default: module.SpendingChart,
  }))
)

let overviewChartsPrimed = false

function useOverviewChartsReady() {
  const [ready, setReady] = useState(overviewChartsPrimed)

  useEffect(() => {
    if (ready) return

    const requestIdle = Reflect.get(window, "requestIdleCallback") as
      | ((
          callback: IdleRequestCallback,
          options?: IdleRequestOptions
        ) => number)
      | undefined
    const cancelIdle = Reflect.get(window, "cancelIdleCallback") as
      ((handle: number) => void) | undefined
    const markReady = () => {
      overviewChartsPrimed = true
      startTransition(() => setReady(true))
    }

    if (requestIdle) {
      const handle = requestIdle.call(window, markReady, { timeout: 400 })
      return () => cancelIdle?.call(window, handle)
    }

    const timeout = window.setTimeout(markReady, 220)
    return () => window.clearTimeout(timeout)
  }, [ready])

  return ready
}

export type CoinView =
  "overview" | "transactions" | "budgets" | "preferences" | "profile"

const navigation: Array<{
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

function getView(pathname: string): CoinView {
  if (pathname.startsWith("/transactions")) {
    return "transactions"
  }

  if (pathname.startsWith("/budgets")) {
    return "budgets"
  }

  if (pathname.startsWith("/settings")) {
    return "preferences"
  }

  if (pathname.startsWith("/preferences")) {
    return "preferences"
  }

  if (pathname.startsWith("/profile")) {
    return "profile"
  }

  return "overview"
}

const pageTitles: Record<CoinView, string> = {
  overview: "Overview",
  transactions: "Transactions",
  budgets: "Budgets",
  preferences: "Preferences",
  profile: "Profile",
}

type CoinAppContextValue = ReturnType<typeof useFinance> & {
  openBudget: (categoryId?: string) => void
  openSignIn: () => void
  openTransaction: (transaction?: FinanceTransaction) => void
  overviewCustomRange: DateRange
  overviewPeriod: PeriodPreset
  overviewPeriodOpen: boolean
  setOverviewCustomRange: (range: DateRange) => void
  setOverviewPeriod: (period: PeriodPreset) => void
  setOverviewPeriodOpen: (open: boolean) => void
  requestSignOut: () => void
}

type TransactionOverlayContextValue = {
  openTransaction: (transaction?: FinanceTransaction) => void
}

const CoinAppContext = createContext<CoinAppContextValue | null>(null)
const TransactionOverlayContext =
  createContext<TransactionOverlayContextValue | null>(null)

function useCoinApp() {
  const context = useContext(CoinAppContext)

  if (!context) {
    throw new Error("Coin route pages must render inside CoinApp.")
  }

  return context
}

function useTransactionOverlay() {
  const context = useContext(TransactionOverlayContext)

  if (!context) {
    throw new Error(
      "Transaction actions must render inside TransactionOverlayProvider."
    )
  }

  return context
}

function TransactionOverlayProvider({
  categories,
  children,
  onCreateCategory,
  onAdd,
  onUpdate,
}: {
  categories: Category[]
  children: React.ReactNode
  onCreateCategory: (
    name: string,
    type: FinanceTransaction["type"]
  ) => Promise<Category>
  onAdd: ReturnType<typeof useFinance>["addTransaction"]
  onUpdate: ReturnType<typeof useFinance>["updateTransaction"]
}) {
  const [open, setOpen] = useState(false)
  const [transaction, setTransaction] = useState<FinanceTransaction>()
  const openTransaction = useCallback(
    (nextTransaction?: FinanceTransaction) => {
      setTransaction(nextTransaction)
      setOpen(true)
    },
    []
  )
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setTransaction(undefined)
  }, [])
  const handleSubmit = useCallback(
    (draft: Parameters<typeof onAdd>[0]) =>
      transaction ? onUpdate(transaction.id, draft) : onAdd(draft),
    [onAdd, onUpdate, transaction]
  )
  const value = useMemo(() => ({ openTransaction }), [openTransaction])

  return (
    <TransactionOverlayContext.Provider value={value}>
      {children}
      <TransactionDialog
        open={open}
        onOpenChange={handleOpenChange}
        categories={categories}
        transaction={transaction}
        onCreateCategory={onCreateCategory}
        onSubmit={handleSubmit}
      />
    </TransactionOverlayContext.Provider>
  )
}

export function CoinApp() {
  const finance = useFinance()

  return (
    <TransactionOverlayProvider
      categories={finance.categories}
      onCreateCategory={finance.createCategory}
      onAdd={finance.addTransaction}
      onUpdate={finance.updateTransaction}
    >
      <CoinAppShell finance={finance} />
    </TransactionOverlayProvider>
  )
}

function CoinAppShell({ finance }: { finance: ReturnType<typeof useFinance> }) {
  const auth = useAuth()
  const { signOut } = auth
  const { clearAccountData, getPendingCount, syncPendingChanges } = finance
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const view = getView(pathname)
  const [isInteractive, setIsInteractive] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [budgetCategoryId, setBudgetCategoryId] = useState<string>()
  const [signInOpen, setSignInOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signOutPendingCount, setSignOutPendingCount] = useState(0)
  const [overviewPeriod, setOverviewPeriod] = useState<PeriodPreset>("month")
  const [overviewPeriodOpen, setOverviewPeriodOpen] = useState(false)
  const [overviewCustomRange, setOverviewCustomRange] = useState<DateRange>(
    () => getPeriodRange("month", { from: "", to: "" })
  )
  const { openTransaction } = useTransactionOverlay()
  const openNewTransaction = useCallback(
    () => openTransaction(),
    [openTransaction]
  )
  const appReady = isInteractive && !finance.isLoading
  const openBudget = useCallback((categoryId?: string) => {
    setBudgetCategoryId(categoryId)
    setBudgetOpen(true)
  }, [])
  const openSignIn = useCallback(() => setSignInOpen(true), [])
  const completeSignOut = useCallback(async () => {
    await signOut()
    await clearAccountData()
    toast.success("Signed out. Your guest workspace is still on this device.")
  }, [clearAccountData, signOut])
  const requestSignOut = useCallback(() => {
    void getPendingCount()
      .then(async (currentPendingCount) => {
        if (currentPendingCount > 0) {
          setSignOutPendingCount(currentPendingCount)
          setSignOutOpen(true)
          return
        }
        await completeSignOut()
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Sign-out failed.")
      })
  }, [completeSignOut, getPendingCount])
  const syncAndSignOut = useCallback(async () => {
    const remaining = await syncPendingChanges()
    if (remaining === 0) await completeSignOut()
    return remaining
  }, [completeSignOut, syncPendingChanges])
  const contextValue = useMemo(
    () => ({
      ...finance,
      openBudget,
      openSignIn,
      openTransaction,
      overviewCustomRange,
      overviewPeriod,
      overviewPeriodOpen,
      setOverviewCustomRange,
      setOverviewPeriod,
      setOverviewPeriodOpen,
      requestSignOut,
    }),
    [
      finance,
      openBudget,
      openSignIn,
      openTransaction,
      overviewCustomRange,
      overviewPeriod,
      overviewPeriodOpen,
      requestSignOut,
    ]
  )

  useEffect(() => {
    setIsInteractive(true)
  }, [])

  return (
    <CoinAppContext.Provider value={contextValue}>
      <SidebarProvider>
        <CoinSidebar
          view={view}
          onAdd={openNewTransaction}
          onSignIn={openSignIn}
          onSignOut={requestSignOut}
        />
        <SidebarInset
          data-app-ready={appReady ? "true" : "false"}
          aria-busy={!appReady}
          inert={!appReady}
          className="min-w-0 pb-24 md:pb-0"
        >
          <AppHeader
            view={view}
            onAdd={openNewTransaction}
            onSignIn={openSignIn}
            onSignOut={requestSignOut}
          />
          <div
            key={view}
            data-testid="route-stage"
            data-view={view}
            className="coin-route-enter mx-auto flex w-full max-w-384 flex-1 flex-col px-4 py-5 sm:px-6 md:py-7 xl:px-8"
          >
            <div className="flex flex-col gap-5">
              <CloudWorkspaceStatus
                state={finance.cloudState}
                issue={finance.issue}
                isRefreshing={finance.isRefreshing}
                onRetry={() => void finance.retryCloud()}
              />
              {finance.storage === "cloud" && (
                <SyncStatus
                  pendingCount={finance.pendingCount}
                  conflicts={finance.conflicts}
                  isOnline={finance.isOnline}
                  onUseCloud={finance.useCloudConflict}
                  onUseDevice={finance.useDeviceConflict}
                />
              )}
              {finance.cloudState !== "loading" &&
                !(
                  finance.cloudState === "error" &&
                  finance.issue?.source !== "sync"
                ) &&
                !(
                  finance.cloudState === "offline" &&
                  finance.issue?.source === "load"
                ) && <Outlet />}
            </div>
          </div>
        </SidebarInset>

        <MobileDock view={view} onAdd={openNewTransaction} />
        <BudgetDialog
          open={budgetOpen}
          onOpenChange={setBudgetOpen}
          categories={finance.categories}
          budgets={finance.budgets}
          initialCategoryId={budgetCategoryId}
          onSubmit={finance.saveBudget}
          onDelete={finance.deleteBudget}
        />
        <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
        <GuardedSignOutDialog
          open={signOutOpen}
          onOpenChange={setSignOutOpen}
          pendingCount={Math.max(signOutPendingCount, finance.pendingCount)}
          isOnline={finance.isOnline}
          onSync={syncAndSignOut}
          onDiscardAndSignOut={completeSignOut}
        />
      </SidebarProvider>
    </CoinAppContext.Provider>
  )
}

export function OverviewPage() {
  const finance = useCoinApp()

  return (
    <OverviewView
      categories={finance.categories}
      transactions={finance.transactions}
      budgets={finance.budgets}
      onAdd={() => finance.openTransaction()}
      onEdit={finance.openTransaction}
      onBudget={finance.openBudget}
      onDelete={finance.deleteTransaction}
      onClearDemo={finance.clearDemoTransactions}
      period={finance.overviewPeriod}
      periodOpen={finance.overviewPeriodOpen}
      customRange={finance.overviewCustomRange}
      onPeriodOpenChange={finance.setOverviewPeriodOpen}
      onPeriodChange={finance.setOverviewPeriod}
      onCustomRangeChange={finance.setOverviewCustomRange}
    />
  )
}

export function TransactionsPage() {
  const finance = useCoinApp()

  return (
    <TransactionsView
      categories={finance.categories}
      transactions={finance.transactions}
      onAdd={() => finance.openTransaction()}
      onEdit={finance.openTransaction}
      onDelete={finance.deleteTransaction}
      onClearDemo={finance.clearDemoTransactions}
    />
  )
}

export function BudgetsPage() {
  const finance = useCoinApp()

  return (
    <BudgetsView
      categories={finance.categories}
      transactions={finance.transactions}
      budgets={finance.budgets}
      onBudget={finance.openBudget}
    />
  )
}

export function PreferencesPage() {
  const finance = useCoinApp()

  return (
    <PreferencesView
      categories={finance.categories}
      onSignIn={finance.openSignIn}
      onCreateCategory={finance.createCategory}
      onUpdateCategory={finance.updateCategory}
      onDeleteCategory={finance.deleteCategory}
    />
  )
}

export function ProfilePage() {
  const finance = useCoinApp()

  return (
    <ProfileView
      onSignIn={finance.openSignIn}
      onSignOut={finance.requestSignOut}
    />
  )
}

export function SettingsPage() {
  return <PreferencesPage />
}

function accountLabel(email?: string) {
  return email ?? "Cloud account"
}

function accountInitials(email?: string) {
  if (!email) return "CO"
  return email.slice(0, 2).toUpperCase()
}

function CoinSidebar({
  view,
  onAdd,
  onSignIn,
  onSignOut,
}: {
  view: CoinView
  onAdd: () => void
  onSignIn: () => void
  onSignOut: () => void
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
function AppHeader({
  view,
  onAdd,
  onSignIn,
  onSignOut,
}: {
  view: CoinView
  onAdd: () => void
  onSignIn: () => void
  onSignOut: () => void
}) {
  const auth = useAuth()
  const title = pageTitles[view]
  const cloudWorkspace = auth.status === "authenticated"
  const profile = cloudWorkspace ? accountLabel(auth.user?.email) : "Guest mode"

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
        >
          <PlusIcon data-icon="inline-start" />
          Add transaction
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open profile menu">
              <Avatar size="sm">
                <AvatarFallback>
                  {cloudWorkspace ? accountInitials(auth.user?.email) : "GU"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex flex-col gap-1">
              <span>{profile}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {cloudWorkspace ? "Cloud workspace" : "On this device"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {cloudWorkspace ? (
                <DropdownMenuItem onSelect={onSignOut}>
                  <LogOutIcon />
                  Sign out
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  disabled={!auth.configured || auth.status === "loading"}
                  onSelect={onSignIn}
                >
                  <LogInIcon />
                  Continue with Google
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
function MobileDock({ view, onAdd }: { view: CoinView; onAdd: () => void }) {
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

type PeriodPreset = "day" | "week" | "month" | "year" | "custom"
type TransactionPeriod = "all" | PeriodPreset

type DateRange = {
  from: string
  to: string
}

const periodOptions: Array<{ value: PeriodPreset; label: string }> = [
  { value: "day", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom" },
]

const transactionPeriodOptions: Array<{
  value: TransactionPeriod
  label: string
}> = [{ value: "all", label: "All dates" }, ...periodOptions]

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

function dateFromKey(value: string) {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function formatPeriodDate(value: string) {
  const date = dateFromKey(value)
  if (!date) return "Select date"

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function getPeriodRange(
  period: PeriodPreset,
  customRange: DateRange,
  now = new Date()
): DateRange {
  if (period === "custom" && customRange.from && customRange.to) {
    return customRange
  }
  if (period === "custom") period = "month"

  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const to = new Date(from)

  if (period === "week") {
    const mondayOffset = (from.getDay() + 6) % 7
    from.setDate(from.getDate() - mondayOffset)
    to.setDate(from.getDate() + 6)
  } else if (period === "month") {
    from.setDate(1)
    to.setMonth(to.getMonth() + 1, 0)
  } else if (period === "year") {
    from.setMonth(0, 1)
    to.setMonth(11, 31)
  }

  return { from: dateKey(from), to: dateKey(to) }
}

function getPeriodLabel(period: PeriodPreset, range: DateRange) {
  if (period !== "custom") {
    return periodOptions.find((option) => option.value === period)?.label ?? ""
  }
  if (!range.from || !range.to) return "Custom period"

  const format = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    })

  return `${format(range.from)} – ${format(range.to)}`
}

type FinanceViewProps = {
  categories: Category[]
  transactions: FinanceTransaction[]
  budgets: Budget[]
}

function OverviewView({
  categories,
  transactions,
  budgets,
  onAdd,
  onEdit,
  onBudget,
  onDelete,
  onClearDemo,
  period,
  periodOpen,
  customRange,
  onPeriodOpenChange,
  onPeriodChange,
  onCustomRangeChange,
}: FinanceViewProps & {
  onAdd: () => void
  onEdit: (transaction: FinanceTransaction) => void
  onBudget: () => void
  onDelete: (id: string) => Promise<void>
  onClearDemo: () => Promise<void>
  period: PeriodPreset
  periodOpen: boolean
  customRange: DateRange
  onPeriodOpenChange: (open: boolean) => void
  onPeriodChange: (period: PeriodPreset) => void
  onCustomRangeChange: (range: DateRange) => void
}) {
  const isMobile = useIsMobile()
  const chartsReady = useOverviewChartsReady()
  const [categoryDetailOpen, setCategoryDetailOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const activeRange = useMemo(
    () => getPeriodRange(period, customRange),
    [customRange, period]
  )
  const periodTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.date >= activeRange.from &&
          transaction.date <= activeRange.to
      ),
    [activeRange, transactions]
  )
  const summary = useMemo(
    () => summarizeLedger(periodTransactions),
    [periodTransactions]
  )
  const series = useMemo(
    () => (chartsReady ? buildCashFlowSeries(transactions) : []),
    [chartsReady, transactions]
  )
  const categoryFlow = useMemo(
    () =>
      chartsReady ? buildCategoryCashFlow(periodTransactions, categories) : [],
    [categories, chartsReady, periodTransactions]
  )
  const budget = useMemo(
    () => calculateBudgetProgress(transactions, budgets),
    [transactions, budgets]
  )
  const periodLabel = getPeriodLabel(
    period,
    period === "custom" ? customRange : activeRange
  )
  const openCategoryDetails = () => setCategoryDetailOpen(true)
  const openActivity = () => setActivityOpen(true)
  const handleActivityEdit = (transaction: FinanceTransaction) => {
    setActivityOpen(false)
    onEdit(transaction)
  }

  return (
    <div className="flex flex-col gap-6">
      <MobileOverview
        categories={categories}
        transactions={periodTransactions}
        summary={summary}
        cashFlow={categoryFlow}
        chartsReady={chartsReady && isMobile}
        periodLabel={periodLabel}
        onPeriodOpenChange={onPeriodOpenChange}
        onOpenCategoryDetails={openCategoryDetails}
        onViewAll={openActivity}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      <div
        data-testid="desktop-overview"
        className="hidden flex-col gap-6 md:flex"
      >
        <section
          aria-label="Financial summary"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <Card className="overflow-hidden sm:col-span-2 xl:col-span-1">
            <CardHeader>
              <CardTitle>Net cash flow</CardTitle>
              <CardDescription>Income minus expenses</CardDescription>
              <CardAction>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={"Change period, currently " + periodLabel}
                  onClick={() => onPeriodOpenChange(true)}
                >
                  <CalendarDaysIcon data-icon="inline-start" />
                  {periodLabel}
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p
                className={cn(
                  "text-3xl font-semibold tracking-[-0.04em] tabular-nums sm:text-4xl",
                  summary.net > 0 && "text-positive",
                  summary.net < 0 && "text-negative"
                )}
              >
                {formatCompactRupiah(summary.net)}
              </p>
            </CardContent>
            <CardFooter>
              <Badge variant="secondary">From recorded entries</Badge>
            </CardFooter>
          </Card>
          <MetricCard
            title="Income"
            description="All recorded income"
            value={summary.income}
            icon={ArrowDownLeftIcon}
          />
          <MetricCard
            title="Expenses"
            description="All recorded expenses"
            value={summary.expenses}
            icon={ArrowUpRightIcon}
          />
          <MetricCard
            title="Keep rate"
            description="Recorded net over income"
            value={`${Math.round(summary.savingsRate)}%`}
            icon={WalletCardsIcon}
          />
        </section>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.95fr)]">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
            <Card
              data-testid="cash-flow-card"
              aria-busy={!chartsReady}
              className="min-w-0 self-start lg:row-span-2"
            >
              <CardHeader>
                <CardTitle>Cash-flow rhythm</CardTitle>
                <CardDescription>
                  Income and expenses over six months.
                </CardDescription>
                <CardAction>
                  <Badge variant="outline">IDR</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="min-w-0">
                {chartsReady && !isMobile ? (
                  <Suspense fallback={<CashFlowSkeleton />}>
                    <CashFlowChart data={series} />
                  </Suspense>
                ) : (
                  <CashFlowSkeleton />
                )}
              </CardContent>
            </Card>

            <Card
              data-testid="desktop-category-card"
              aria-busy={!chartsReady}
              role="button"
              tabIndex={0}
              aria-label="Open category activity details"
              className="cursor-pointer transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={openCategoryDetails}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  openCategoryDetails()
                }
              }}
            >
              <CardHeader>
                <CardTitle>Category activity</CardTitle>
                <CardDescription>
                  Income and expenses in {periodLabel.toLowerCase()}.
                </CardDescription>
                <CardAction>
                  <ChevronRightIcon aria-hidden="true" />
                </CardAction>
              </CardHeader>
              <CardContent className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3">
                {chartsReady && !isMobile ? (
                  <Suspense fallback={<SpendingSkeleton />}>
                    <SpendingChart
                      data={categoryFlow}
                      compact
                      centerLabel="Net"
                      centerValue={summary.net}
                      centerTone={
                        summary.net > 0
                          ? "positive"
                          : summary.net < 0
                            ? "negative"
                            : "default"
                      }
                    />
                  </Suspense>
                ) : (
                  <SpendingSkeleton compact />
                )}
                <CategoryFlowLegend items={categoryFlow} />
              </CardContent>
              <CardFooter className="justify-between">
                <span className="text-sm text-muted-foreground">
                  {categoryFlow.length}{" "}
                  {categoryFlow.length === 1 ? "category" : "categories"}
                </span>
                <span className="flex items-center gap-1 text-sm font-medium">
                  View details
                  <ChevronRightIcon aria-hidden="true" className="size-4" />
                </span>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Budget pulse</CardTitle>
                <CardDescription>
                  {budget.configured
                    ? "This month's selected limits."
                    : "No limits set this month."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-end justify-between gap-4">
                  <p className="text-2xl font-semibold tracking-[-0.03em] tabular-nums">
                    {formatCompactRupiah(budget.spent)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    of {formatCompactRupiah(budget.limit)}
                  </p>
                </div>
                <Progress
                  value={budget.percentage}
                  aria-label="Monthly budget used"
                />
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" onClick={onBudget}>
                  <GaugeIcon data-icon="inline-start" />
                  {budget.configured ? "Adjust budget" : "Set a budget"}
                </Button>
              </CardFooter>
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <QuickActions onAdd={onAdd} onBudget={onBudget} />
            <RecentTransactions
              categories={categories}
              transactions={periodTransactions.slice(0, 5)}
              onEdit={handleActivityEdit}
              onDelete={onDelete}
              onClearDemo={onClearDemo}
              onViewAll={openActivity}
              compact
            />
          </div>
        </div>
      </div>
      <PeriodFilterDrawer
        open={periodOpen}
        period={period}
        customRange={customRange}
        onOpenChange={onPeriodOpenChange}
        onPeriodChange={onPeriodChange}
        onCustomRangeChange={onCustomRangeChange}
      />
      <CategoryDetailOverlay
        open={categoryDetailOpen}
        onOpenChange={setCategoryDetailOpen}
        periodLabel={periodLabel}
        categoryFlow={categoryFlow}
        summary={summary}
      />
      <ActivityHistoryOverlay
        open={activityOpen}
        onOpenChange={setActivityOpen}
        categories={categories}
        transactions={transactions}
        onAdd={onAdd}
        onEdit={handleActivityEdit}
        onDelete={onDelete}
        onClearDemo={onClearDemo}
      />
    </div>
  )
}

const chartDotClasses = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
]

function CategoryFlowLegend({
  items,
  limit = 5,
}: {
  items: CategoryCashFlow[]
  limit?: number
}) {
  if (!items.length) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Add income or an expense to see its category share.
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {items.slice(0, limit).map((item, index) => {
        const Icon = getCategoryIcon(item.categoryId)
        return (
          <div
            key={item.type + ":" + item.categoryId}
            className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
          >
            <span className="relative flex size-7 items-center justify-center rounded-lg bg-muted">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1 right-1 size-1.5 rounded-full",
                  chartDotClasses[index % chartDotClasses.length]
                )}
              />
              <Icon aria-hidden="true" className="size-3.5" />
            </span>
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {item.name}
            </span>
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                item.type === "income" ? "text-positive" : "text-negative"
              )}
            >
              {item.type === "income" ? "+" : "-"}
              {formatCompactRupiah(item.value)}
            </span>
          </div>
        )
      })}
      {items.length > limit && (
        <p className="text-xs text-muted-foreground">
          +{items.length - limit} more categories
        </p>
      )}
    </div>
  )
}

function ResponsiveOverlay({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: React.ReactNode
  className?: string
}) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className="max-h-[92svh] overflow-hidden"
          data-testid="responsive-drawer"
        >
          <DrawerHeader className="shrink-0 pb-3">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div
            className={cn(
              "min-h-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
              className
            )}
          >
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88svh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className={cn("min-h-0 overflow-y-auto", className)}>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CategoryDetailOverlay({
  open,
  onOpenChange,
  periodLabel,
  categoryFlow,
  summary,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  periodLabel: string
  categoryFlow: CategoryCashFlow[]
  summary: LedgerSummary
}) {
  const income = categoryFlow.filter((item) => item.type === "income")
  const expenses = categoryFlow.filter((item) => item.type === "expense")

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Category activity"
      description={
        "Every category recorded in " + periodLabel.toLowerCase() + "."
      }
      className="flex flex-col gap-4 pb-4"
    >
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">Categories</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {categoryFlow.length}
          </p>
        </div>
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">Money in</p>
          <p className="mt-1 truncate text-sm font-semibold text-positive tabular-nums">
            {formatCompactRupiah(summary.income)}
          </p>
        </div>
        <div className="rounded-xl bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">Money out</p>
          <p className="mt-1 truncate text-sm font-semibold text-negative tabular-nums">
            {formatCompactRupiah(summary.expenses)}
          </p>
        </div>
      </div>
      <CategoryBreakdownSection title="Income" items={income} />
      <CategoryBreakdownSection title="Expenses" items={expenses} />
    </ResponsiveOverlay>
  )
}

function CategoryBreakdownSection({
  title,
  items,
}: {
  title: string
  items: CategoryCashFlow[]
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardAction>
          <Badge variant="secondary">{items.length}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.length ? (
          items.map((item, index) => {
            const Icon = getCategoryIcon(item.categoryId)
            const percentage = total > 0 ? (item.value / total) * 100 : 0
            return (
              <div
                key={item.type + ":" + item.categoryId}
                className="flex gap-3"
              >
                <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-1 right-1 size-1.5 rounded-full",
                      chartDotClasses[index % chartDotClasses.length]
                    )}
                  />
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCompactRupiah(item.value)}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <Progress
                      value={percentage}
                      aria-label={
                        item.name + " share of " + title.toLowerCase()
                      }
                      className="h-1.5"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {Math.round(percentage)}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-sm text-muted-foreground">
            No {title.toLowerCase()} recorded in this period.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityHistoryOverlay({
  open,
  onOpenChange,
  categories,
  transactions,
  onAdd,
  onEdit,
  onDelete,
  onClearDemo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  transactions: FinanceTransaction[]
  onAdd: () => void
  onEdit: (transaction: FinanceTransaction) => void
  onDelete: (id: string) => Promise<void>
  onClearDemo: () => Promise<void>
}) {
  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Ledger activity"
      description="Review, filter, edit, or delete every recorded entry."
      className="pb-4"
    >
      <TransactionsView
        categories={categories}
        transactions={transactions}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
        onClearDemo={onClearDemo}
        embedded
      />
    </ResponsiveOverlay>
  )
}

function MobileOverview({
  categories,
  transactions,
  summary,
  cashFlow,
  chartsReady,
  periodLabel,
  onPeriodOpenChange,
  onOpenCategoryDetails,
  onViewAll,
  onEdit,
  onDelete,
}: {
  categories: Category[]
  transactions: FinanceTransaction[]
  summary: LedgerSummary
  cashFlow: CategoryCashFlow[]
  chartsReady: boolean
  periodLabel: string
  onPeriodOpenChange: (open: boolean) => void
  onOpenCategoryDetails: () => void
  onViewAll: () => void
  onEdit: (transaction: FinanceTransaction) => void
  onDelete: (id: string) => Promise<void>
}) {
  return (
    <section
      aria-label="Mobile financial overview"
      className="flex flex-col gap-5 md:hidden"
    >
      <Card data-testid="mobile-net-cash-flow">
        <CardHeader>
          <CardTitle>
            <h1>Net cash flow</h1>
          </CardTitle>
          <CardDescription>Income minus expenses</CardDescription>
          <CardAction>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Change period, currently ${periodLabel}`}
              onClick={() => onPeriodOpenChange(true)}
            >
              <CalendarDaysIcon data-icon="inline-start" />
              {periodLabel}
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p
            data-testid="mobile-net-cash-flow-value"
            className={cn(
              "text-3xl font-semibold tracking-[-0.045em] tabular-nums",
              summary.net > 0 && "text-positive",
              summary.net < 0 && "text-negative"
            )}
          >
            {formatRupiah(summary.net)}
          </p>
        </CardContent>
        <CardFooter className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-card p-3">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="mt-1 font-semibold text-positive tabular-nums">
              +{formatCompactRupiah(summary.income)}
            </p>
          </div>
          <div className="rounded-lg bg-card p-3">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="mt-1 font-semibold text-negative tabular-nums">
              -{formatCompactRupiah(summary.expenses)}
            </p>
          </div>
        </CardFooter>
      </Card>

      <Card
        aria-busy={!chartsReady}
        role="button"
        tabIndex={0}
        aria-label="Open category activity details"
        className="cursor-pointer transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={onOpenCategoryDetails}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onOpenCategoryDetails()
          }
        }}
      >
        <CardHeader>
          <CardTitle>Category activity</CardTitle>
          <CardDescription>
            Income and expenses in {periodLabel.toLowerCase()}.
          </CardDescription>
          <CardAction>
            <ChevronRightIcon aria-hidden="true" />
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-[9rem_minmax(0,1fr)] items-center gap-3">
          {chartsReady ? (
            <Suspense fallback={<SpendingSkeleton compact />}>
              <SpendingChart
                data={cashFlow}
                compact
                centerLabel="Net"
                centerValue={summary.net}
                centerTone={
                  summary.net > 0
                    ? "positive"
                    : summary.net < 0
                      ? "negative"
                      : "default"
                }
                emptyLabel="No cash-flow data yet"
              />
            </Suspense>
          ) : (
            <SpendingSkeleton compact />
          )}
          <CategoryFlowLegend items={cashFlow} />
        </CardContent>
      </Card>

      <Card data-testid="mobile-recent-activity">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Within {periodLabel.toLowerCase()}</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              See all
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TransactionList
            categories={categories}
            transactions={transactions.slice(0, 4)}
            onEdit={onEdit}
            onDelete={onDelete}
            compact
          />
        </CardContent>
      </Card>
    </section>
  )
}

function PeriodFilterDrawer({
  open,
  period,
  customRange,
  onOpenChange,
  onPeriodChange,
  onCustomRangeChange,
}: {
  open: boolean
  period: PeriodPreset
  customRange: DateRange
  onOpenChange: (open: boolean) => void
  onPeriodChange: (period: PeriodPreset) => void
  onCustomRangeChange: (range: DateRange) => void
}) {
  const isMobile = useIsMobile()
  const [draftPeriod, setDraftPeriod] = useState<PeriodPreset>(period)
  const [draftRange, setDraftRange] = useState<DateRange>(customRange)
  const [activeDateField, setActiveDateField] = useState<"from" | "to" | null>(
    null
  )
  const customRangeInvalid =
    !draftRange.from || !draftRange.to || draftRange.from > draftRange.to

  useEffect(() => {
    if (!open) return
    setDraftPeriod(period)
    setDraftRange(customRange)
  }, [customRange, open, period])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setActiveDateField(null)
    onOpenChange(nextOpen)
  }

  if (!isMobile) {
    return (
      <PeriodFilterDialog
        open={open}
        period={period}
        customRange={customRange}
        onOpenChange={onOpenChange}
        onPeriodChange={onPeriodChange}
        onCustomRangeChange={onCustomRangeChange}
      />
    )
  }

  return (
    <>
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent
          data-testid="period-filter-drawer"
          className="gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[92svh]"
        >
          <DrawerHeader className="shrink-0 pb-3">
            <DrawerTitle>Choose a period</DrawerTitle>
            <DrawerDescription>
              The summary, category chart, and recent activity update together.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <ToggleGroup
              type="single"
              value={draftPeriod}
              variant="outline"
              className="grid w-full grid-cols-2"
              onValueChange={(value) => {
                if (!value) return
                const nextPeriod = value as PeriodPreset
                if (nextPeriod === "custom") {
                  if (draftPeriod !== "custom") {
                    setDraftRange({ from: "", to: "" })
                  }
                  setDraftPeriod(nextPeriod)
                  return
                }
                onPeriodChange(nextPeriod)
                handleOpenChange(false)
              }}
            >
              {periodOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="w-full last:col-span-2"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <Collapsible open={draftPeriod === "custom"}>
              <CollapsibleContent className="coin-collapsible-content">
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-w-0 flex-col items-start gap-1 px-3 py-2.5"
                    aria-label={`Select from date, currently ${formatPeriodDate(draftRange.from)}`}
                    onClick={() => setActiveDateField("from")}
                  >
                    <span className="text-xs font-normal text-muted-foreground">
                      From
                    </span>
                    <span className="w-full truncate text-left font-medium">
                      {formatPeriodDate(draftRange.from)}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-w-0 flex-col items-start gap-1 px-3 py-2.5"
                    aria-label={`Select to date, currently ${formatPeriodDate(draftRange.to)}`}
                    onClick={() => setActiveDateField("to")}
                  >
                    <span className="text-xs font-normal text-muted-foreground">
                      To
                    </span>
                    <span className="w-full truncate text-left font-medium">
                      {formatPeriodDate(draftRange.to)}
                    </span>
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
          {draftPeriod === "custom" && (
            <DrawerFooter className="shrink-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                className="w-full"
                disabled={customRangeInvalid}
                onClick={() => {
                  onCustomRangeChange(draftRange)
                  onPeriodChange("custom")
                  handleOpenChange(false)
                }}
              >
                Apply custom period
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
      <PeriodDateDialog
        field={activeDateField}
        customRange={draftRange}
        onFieldChange={setActiveDateField}
        onCustomRangeChange={setDraftRange}
      />
    </>
  )
}

function PeriodFilterDialog({
  open,
  period,
  customRange,
  onOpenChange,
  onPeriodChange,
  onCustomRangeChange,
}: {
  open: boolean
  period: PeriodPreset
  customRange: DateRange
  onOpenChange: (open: boolean) => void
  onPeriodChange: (period: PeriodPreset) => void
  onCustomRangeChange: (range: DateRange) => void
}) {
  const [draftPeriod, setDraftPeriod] = useState<PeriodPreset>(period)
  const [draftRange, setDraftRange] = useState<DateRange>(customRange)
  const [activeDateField, setActiveDateField] = useState<"from" | "to" | null>(
    null
  )
  const customRangeInvalid =
    !draftRange.from || !draftRange.to || draftRange.from > draftRange.to

  useEffect(() => {
    if (!open) return
    setDraftPeriod(period)
    setDraftRange(customRange)
  }, [customRange, open, period])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setActiveDateField(null)
    onOpenChange(nextOpen)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          data-testid="period-filter-dialog"
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Choose a period</DialogTitle>
            <DialogDescription>
              The summary, category chart, and recent activity update together.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <ToggleGroup
              type="single"
              value={draftPeriod}
              variant="outline"
              className="grid w-full grid-cols-2"
              onValueChange={(value) => {
                if (!value) return
                const nextPeriod = value as PeriodPreset
                if (nextPeriod === "custom") {
                  if (draftPeriod !== "custom") {
                    setDraftRange({ from: "", to: "" })
                  }
                  setDraftPeriod(nextPeriod)
                  return
                }
                onPeriodChange(nextPeriod)
                handleOpenChange(false)
              }}
            >
              {periodOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="w-full last:col-span-2"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <Collapsible open={draftPeriod === "custom"}>
              <CollapsibleContent className="coin-collapsible-content">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-w-0 flex-col items-start gap-1 px-3 py-2.5"
                    aria-label={
                      "Select from date, currently " +
                      formatPeriodDate(draftRange.from)
                    }
                    onClick={() => setActiveDateField("from")}
                  >
                    <span className="text-xs font-normal text-muted-foreground">
                      From
                    </span>
                    <span className="w-full truncate text-left font-medium">
                      {formatPeriodDate(draftRange.from)}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-w-0 flex-col items-start gap-1 px-3 py-2.5"
                    aria-label={
                      "Select to date, currently " +
                      formatPeriodDate(draftRange.to)
                    }
                    onClick={() => setActiveDateField("to")}
                  >
                    <span className="text-xs font-normal text-muted-foreground">
                      To
                    </span>
                    <span className="w-full truncate text-left font-medium">
                      {formatPeriodDate(draftRange.to)}
                    </span>
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {draftPeriod === "custom" && (
              <Button
                disabled={customRangeInvalid}
                onClick={() => {
                  onCustomRangeChange(draftRange)
                  onPeriodChange("custom")
                  handleOpenChange(false)
                }}
              >
                Apply custom period
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <PeriodDateDialog
        field={activeDateField}
        customRange={draftRange}
        onFieldChange={setActiveDateField}
        onCustomRangeChange={setDraftRange}
      />
    </>
  )
}

function PeriodDateDialog({
  field,
  customRange,
  onFieldChange,
  onCustomRangeChange,
}: {
  field: "from" | "to" | null
  customRange: DateRange
  onFieldChange: (field: "from" | "to" | null) => void
  onCustomRangeChange: (range: DateRange) => void
}) {
  const today = new Date()
  const fromDate = dateFromKey(customRange.from)
  const selectedDate = field ? dateFromKey(customRange[field]) : undefined
  const disabledDates =
    field === "to" && fromDate
      ? [{ before: fromDate }, { after: today }]
      : { after: today }

  const selectDate = (date: Date | undefined) => {
    if (!date || !field) return
    const selectedKey = dateKey(date)

    if (field === "from") {
      onCustomRangeChange({
        from: selectedKey,
        to:
          customRange.to && customRange.to >= selectedKey ? customRange.to : "",
      })
    } else {
      onCustomRangeChange({ ...customRange, to: selectedKey })
    }

    onFieldChange(null)
  }

  return (
    <Dialog
      open={field !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onFieldChange(null)
      }}
    >
      <DialogContent
        data-testid="period-date-dialog"
        className="w-auto max-w-[calc(100%-1.5rem)] gap-3"
      >
        <DialogHeader>
          <DialogTitle>
            Select {field === "to" ? "to" : "from"} date
          </DialogTitle>
          <DialogDescription>
            Use the month and year menus to move quickly.
          </DialogDescription>
        </DialogHeader>
        <Calendar
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate ?? fromDate ?? today}
          onSelect={selectDate}
          captionLayout="dropdown"
          startMonth={new Date(2000, 0, 1)}
          endMonth={today}
          disabled={disabledDates}
          className="mx-auto"
        />
      </DialogContent>
    </Dialog>
  )
}

function TransactionDateFilter({
  open,
  period,
  customRange,
  onOpenChange,
  onApply,
  forceDialog = false,
}: {
  open: boolean
  period: TransactionPeriod
  customRange: DateRange
  onOpenChange: (open: boolean) => void
  onApply: (period: TransactionPeriod, range: DateRange) => void
  forceDialog?: boolean
}) {
  const isMobile = useIsMobile()
  const [draftPeriod, setDraftPeriod] = useState<TransactionPeriod>(period)
  const [draftRange, setDraftRange] = useState(customRange)
  const [activeDateField, setActiveDateField] = useState<"from" | "to" | null>(
    null
  )
  const customRangeInvalid =
    !draftRange.from || !draftRange.to || draftRange.from > draftRange.to

  useEffect(() => {
    if (!open) return
    setDraftPeriod(period)
    setDraftRange(customRange)
  }, [customRange, open, period])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setActiveDateField(null)
    onOpenChange(nextOpen)
  }

  const controls = (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <ToggleGroup
        type="single"
        value={draftPeriod}
        variant="outline"
        className="grid w-full grid-cols-2"
        onValueChange={(value) => {
          if (!value) return
          const nextPeriod = value as TransactionPeriod
          setDraftPeriod(nextPeriod)

          if (nextPeriod !== "custom") {
            onApply(nextPeriod, draftRange)
            handleOpenChange(false)
          }
        }}
      >
        {transactionPeriodOptions.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="w-full last:col-span-2"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Collapsible open={draftPeriod === "custom"}>
        <CollapsibleContent className="coin-collapsible-content">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-auto min-w-0 flex-col items-start gap-1 px-3 py-2.5"
              aria-label={`Filter from date, currently ${formatPeriodDate(draftRange.from)}`}
              onClick={() => setActiveDateField("from")}
            >
              <span className="text-xs font-normal text-muted-foreground">
                From
              </span>
              <span className="w-full truncate text-left font-medium">
                {formatPeriodDate(draftRange.from)}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-auto min-w-0 flex-col items-start gap-1 px-3 py-2.5"
              aria-label={`Filter to date, currently ${formatPeriodDate(draftRange.to)}`}
              onClick={() => setActiveDateField("to")}
            >
              <span className="text-xs font-normal text-muted-foreground">
                To
              </span>
              <span className="w-full truncate text-left font-medium">
                {formatPeriodDate(draftRange.to)}
              </span>
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {draftPeriod === "custom" && (
        <Button
          disabled={customRangeInvalid}
          onClick={() => {
            onApply("custom", draftRange)
            handleOpenChange(false)
          }}
        >
          Apply date range
        </Button>
      )}
    </div>
  )

  if (isMobile && !forceDialog) {
    return (
      <>
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent data-testid="transaction-date-filter">
            <DrawerHeader>
              <DrawerTitle>Filter by date</DrawerTitle>
              <DrawerDescription>
                Choose the part of your ledger you want to review.
              </DrawerDescription>
            </DrawerHeader>
            {controls}
          </DrawerContent>
        </Drawer>
        <PeriodDateDialog
          field={activeDateField}
          customRange={draftRange}
          onFieldChange={setActiveDateField}
          onCustomRangeChange={setDraftRange}
        />
      </>
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          data-testid="transaction-date-filter"
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Filter by date</DialogTitle>
            <DialogDescription>
              Choose the part of your ledger you want to review.
            </DialogDescription>
          </DialogHeader>
          {controls}
        </DialogContent>
      </Dialog>
      <PeriodDateDialog
        field={activeDateField}
        customRange={draftRange}
        onFieldChange={setActiveDateField}
        onCustomRangeChange={setDraftRange}
      />
    </>
  )
}

function CashFlowSkeleton() {
  return (
    <Skeleton
      data-testid="cash-flow-skeleton"
      role="status"
      aria-label="Loading cash-flow chart"
      className="h-65 w-full"
    />
  )
}

function SpendingSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <Skeleton
      data-testid="spending-skeleton"
      role="status"
      aria-label="Loading spending chart"
      className={cn("mx-auto rounded-full", compact ? "size-36" : "size-44")}
    />
  )
}

function MetricCard({
  title,
  description,
  value,
  icon: Icon,
}: {
  title: string
  description: string
  value: number | string
  icon: LucideIcon
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <span className="flex size-8 items-center justify-center rounded-lg bg-secondary">
            <Icon aria-hidden="true" className="size-4" />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-[-0.035em] tabular-nums">
          {typeof value === "number" ? formatCompactRupiah(value) : value}
        </p>
      </CardContent>
    </Card>
  )
}

function QuickActions({
  onAdd,
  onBudget,
}: {
  onAdd: () => void
  onBudget: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>Keep the ledger moving.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-auto justify-start py-3"
          onClick={onAdd}
        >
          <PlusIcon data-icon="inline-start" />
          Transaction
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start py-3"
          onClick={onBudget}
        >
          <GaugeIcon data-icon="inline-start" />
          Budget
        </Button>
      </CardContent>
    </Card>
  )
}

function TransactionsView({
  categories,
  transactions,
  onAdd,
  onEdit,
  onDelete,
  onClearDemo,
  embedded = false,
}: {
  categories: Category[]
  transactions: FinanceTransaction[]
  onAdd: () => void
  onEdit: (transaction: FinanceTransaction) => void
  onDelete: (id: string) => Promise<void>
  onClearDemo: () => Promise<void>
  embedded?: boolean
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">(
    "all"
  )
  const [period, setPeriod] = useState<TransactionPeriod>("all")
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const initialCustomRange = useMemo(
    () => getPeriodRange("month", { from: "", to: "" }),
    []
  )
  const [customRange, setCustomRange] = useState(initialCustomRange)
  const activeRange = useMemo(
    () => (period === "all" ? undefined : getPeriodRange(period, customRange)),
    [customRange, period]
  )
  const visible = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          (typeFilter === "all" || transaction.type === typeFilter) &&
          (!activeRange ||
            (transaction.date >= activeRange.from &&
              transaction.date <= activeRange.to))
      ),
    [activeRange, transactions, typeFilter]
  )
  const summary = useMemo(() => summarizeLedger(visible), [visible])
  const dateLabel =
    period === "all"
      ? "All dates"
      : getPeriodLabel(period, period === "custom" ? customRange : activeRange!)
  const hasFilters = typeFilter !== "all" || period !== "all"
  const resetFilters = () => {
    setTypeFilter("all")
    setPeriod("all")
  }

  return (
    <div className="flex flex-col gap-6">
      <Card data-testid="transaction-summary">
        <CardHeader>
          <CardTitle>{dateLabel}</CardTitle>
          <CardDescription>
            {visible.length} {visible.length === 1 ? "entry" : "entries"} in
            this view.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <TransactionSummaryMetric
            label="Money in"
            value={summary.income}
            tone="positive"
          />
          <TransactionSummaryMetric
            label="Money out"
            value={summary.expenses}
            tone="negative"
          />
          <TransactionSummaryMetric
            label="Net change"
            value={summary.net}
            tone={
              summary.net > 0
                ? "positive"
                : summary.net < 0
                  ? "negative"
                  : "neutral"
            }
            signed
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger activity</CardTitle>
          <CardDescription>
            Grouped by date, with the newest entries first.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <ToggleGroup
              type="single"
              value={typeFilter}
              onValueChange={(value) => {
                if (value) setTypeFilter(value as typeof typeFilter)
              }}
              variant="outline"
              size="sm"
              className="grid w-full grid-cols-3 sm:w-auto"
              aria-label="Filter transaction type"
            >
              <ToggleGroupItem value="all" className="w-full">
                All
              </ToggleGroupItem>
              <ToggleGroupItem value="income" className="w-full">
                Income
              </ToggleGroupItem>
              <ToggleGroupItem value="expense" className="w-full">
                Expense
              </ToggleGroupItem>
            </ToggleGroup>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Filter transaction date, currently ${dateLabel}`}
              onClick={() => setDateFilterOpen(true)}
            >
              <CalendarDaysIcon data-icon="inline-start" />
              {dateLabel}
              <ChevronDownIcon data-icon="inline-end" />
            </Button>
          </div>

          <Separator />

          {visible.length ? (
            <TransactionList
              categories={categories}
              transactions={visible}
              onEdit={onEdit}
              onDelete={onDelete}
              detailed
              groupByDate
            />
          ) : (
            <Empty className="min-h-56">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ReceiptTextIcon />
                </EmptyMedia>
                <EmptyTitle>
                  {transactions.length
                    ? "No transactions match"
                    : "No transactions yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {transactions.length
                    ? "Try a different type or date range."
                    : "Add your first entry to begin the ledger."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {hasFilters ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Reset filters
                  </Button>
                ) : (
                  <Button size="sm" onClick={onAdd}>
                    <PlusIcon data-icon="inline-start" />
                    Add transaction
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          )}
        </CardContent>
        {transactions.some((transaction) => transaction.isDemo) && (
          <CardFooter className="justify-between">
            <span className="text-sm text-muted-foreground">
              These examples disappear after your first entry.
            </span>
            <Button variant="ghost" size="sm" onClick={onClearDemo}>
              Clear examples
            </Button>
          </CardFooter>
        )}
      </Card>

      <TransactionDateFilter
        open={dateFilterOpen}
        period={period}
        customRange={customRange}
        forceDialog={embedded}
        onOpenChange={setDateFilterOpen}
        onApply={(nextPeriod, range) => {
          setPeriod(nextPeriod)
          if (nextPeriod === "custom") setCustomRange(range)
        }}
      />
    </div>
  )
}

function TransactionSummaryMetric({
  label,
  value,
  tone,
  signed,
}: {
  label: string
  value: number
  tone: "positive" | "negative" | "neutral"
  signed?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-semibold tabular-nums sm:text-base",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative"
        )}
        title={formatRupiah(value)}
      >
        {signed && value > 0 ? "+" : ""}
        {formatCompactRupiah(value)}
      </p>
    </div>
  )
}

function RecentTransactions({
  categories,
  transactions,
  onEdit,
  onDelete,
  onClearDemo,
  onViewAll,
  compact,
}: {
  categories: Category[]
  transactions: FinanceTransaction[]
  onEdit: (transaction: FinanceTransaction) => void
  onDelete: (id: string) => Promise<void>
  onClearDemo: () => Promise<void>
  onViewAll: () => void
  compact?: boolean
}) {
  const hasDemo = transactions.some((transaction) => transaction.isDemo)
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <CardDescription>Your newest ledger entries.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View all
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <TransactionList
          categories={categories}
          transactions={compact ? transactions.slice(0, 5) : transactions}
          onEdit={onEdit}
          onDelete={onDelete}
          compact={compact}
        />
      </CardContent>
      {hasDemo && (
        <CardFooter className="justify-between">
          <Badge variant="outline">Example data</Badge>
          <Button variant="ghost" size="sm" onClick={onClearDemo}>
            Clear
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function TransactionList({
  categories,
  transactions,
  onEdit,
  onDelete,
  compact,
  detailed,
  groupByDate,
  hideDelete,
}: {
  categories: Category[]
  transactions: FinanceTransaction[]
  onEdit?: (transaction: FinanceTransaction) => void
  onDelete: (id: string) => Promise<void>
  compact?: boolean
  detailed?: boolean
  groupByDate?: boolean
  hideDelete?: boolean
}) {
  const isMobile = useIsMobile()
  const [swipedTransactionId, setSwipedTransactionId] = useState<string | null>(
    null
  )

  if (!transactions.length) {
    return (
      <div className="flex min-h-44 flex-col items-center justify-center gap-2 text-center">
        <ReceiptTextIcon
          aria-hidden="true"
          className="size-6 text-muted-foreground"
        />
        <p className="font-medium">No transactions here</p>
        <p className="text-sm text-muted-foreground">
          Add an entry to begin the ledger.
        </p>
      </div>
    )
  }

  const renderRows = (items: FinanceTransaction[]) => (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
      {items.map((transaction) => {
        const category = categories.find(
          (item) => item.id === transaction.categoryId
        )
        const Icon = getCategoryIcon(category?.name ?? "Other")
        const row = (
          <div
            data-transaction-row
            className="group flex min-w-0 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {category?.name ?? "Other"}
              </p>
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-xs text-muted-foreground">
                  {transaction.note ||
                    (transaction.type === "income" ? "Income" : "Expense")}
                </p>
                {transaction.syncStatus && (
                  <Badge
                    variant={
                      transaction.syncStatus === "conflict"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {transaction.syncStatus === "conflict"
                      ? "Conflict"
                      : "Pending"}
                  </Badge>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  transaction.type === "income"
                    ? "text-positive"
                    : "text-negative"
                )}
              >
                {transaction.type === "income" ? "+" : "-"}
                {detailed
                  ? formatRupiah(transaction.amount)
                  : formatCompactRupiah(transaction.amount)}
              </p>
              {!groupByDate && (
                <p className="text-xs text-muted-foreground">
                  {formatTransactionDate(transaction.date)}
                </p>
              )}
            </div>
            {!isMobile && !hideDelete && onEdit ? (
              <TransactionActions
                transaction={transaction}
                categoryName={category?.name ?? "Other"}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ) : !isMobile && !hideDelete ? (
              <DeleteTransactionButton
                transaction={transaction}
                onDelete={onDelete}
              />
            ) : null}
          </div>
        )

        return isMobile ? (
          <SwipeableTransactionRow
            key={transaction.id}
            open={swipedTransactionId === transaction.id}
            onOpenChange={(open) =>
              setSwipedTransactionId(open ? transaction.id : null)
            }
            transaction={transaction}
            categoryName={category?.name ?? "Other"}
            onEdit={onEdit}
            onDelete={onDelete}
          >
            {row}
          </SwipeableTransactionRow>
        ) : (
          <div key={transaction.id}>{row}</div>
        )
      })}
    </div>
  )

  if (!groupByDate) return renderRows(transactions)

  const groups = transactions.reduce<
    Array<{ date: string; items: FinanceTransaction[] }>
  >((result, transaction) => {
    const current = result.at(-1)
    if (current?.date === transaction.date) {
      current.items.push(transaction)
    } else {
      result.push({ date: transaction.date, items: [transaction] })
    }
    return result
  }, [])

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => {
        const dailySummary = summarizeLedger(group.items)
        return (
          <section key={group.date} className="flex flex-col gap-1.5">
            <header className="flex items-center justify-between gap-3 px-2">
              <div>
                <h3 className="text-sm font-semibold">
                  {formatTransactionGroupDate(group.date)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "entry" : "entries"}
                </p>
              </div>
              <p
                className={cn(
                  "text-xs font-medium tabular-nums",
                  dailySummary.net > 0 && "text-positive",
                  dailySummary.net < 0 && "text-negative",
                  dailySummary.net === 0 && "text-muted-foreground"
                )}
              >
                Net {dailySummary.net > 0 ? "+" : ""}
                {formatCompactRupiah(dailySummary.net)}
              </p>
            </header>
            {renderRows(group.items)}
          </section>
        )
      })}
    </div>
  )
}

function SwipeableTransactionRow({
  children,
  open,
  onOpenChange,
  transaction,
  categoryName,
  onEdit,
  onDelete,
}: {
  children: React.ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: FinanceTransaction
  categoryName: string
  onEdit?: (transaction: FinanceTransaction) => void
  onDelete: (id: string) => Promise<void>
}) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        aria-hidden={!open}
        className="absolute inset-y-0 right-0 flex w-36 items-stretch gap-1 p-1"
      >
        {onEdit && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            tabIndex={open ? 0 : -1}
            className="h-full flex-1 flex-col gap-1 px-2"
            onClick={() => {
              onOpenChange(false)
              onEdit(transaction)
            }}
          >
            <PencilIcon data-icon="inline-start" />
            Edit
          </Button>
        )}
        <DeleteTransactionDialog
          transaction={transaction}
          onDelete={onDelete}
          trigger={
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                tabIndex={open ? 0 : -1}
                className="h-full flex-1 flex-col gap-1 px-2"
                aria-label={"Delete " + categoryName + " transaction"}
              >
                <Trash2Icon data-icon="inline-start" />
                Delete
              </Button>
            </AlertDialogTrigger>
          }
        />
      </div>
      <div
        className={cn(
          "relative touch-pan-y bg-background transition-transform duration-200 ease-out",
          open && "-translate-x-36"
        )}
        onPointerDown={(event) => {
          pointerStart.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerUp={(event) => {
          const start = pointerStart.current
          pointerStart.current = null
          if (!start) return

          const deltaX = event.clientX - start.x
          const deltaY = event.clientY - start.y
          if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
            onOpenChange(deltaX < 0)
            return
          }

          if (open && Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) {
            onOpenChange(false)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}

function formatTransactionGroupDate(value: string) {
  const current = dateKey(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (value === current) return "Today"
  if (value === dateKey(yesterday)) return "Yesterday"

  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function TransactionActions({
  transaction,
  categoryName,
  onEdit,
  onDelete,
}: {
  transaction: FinanceTransaction
  categoryName: string
  onEdit: (transaction: FinanceTransaction) => void
  onDelete: (id: string) => Promise<void>
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${categoryName} transaction`}
            className="shrink-0"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Transaction</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onEdit(transaction)}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => setDeleteOpen(true)}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteTransactionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        transaction={transaction}
        onDelete={onDelete}
      />
    </>
  )
}

function DeleteTransactionButton({
  transaction,
  onDelete,
}: {
  transaction: FinanceTransaction
  onDelete: (id: string) => Promise<void>
}) {
  return (
    <DeleteTransactionDialog
      transaction={transaction}
      onDelete={onDelete}
      trigger={
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete transaction"
            className="shrink-0 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <Trash2Icon />
          </Button>
        </AlertDialogTrigger>
      }
    />
  )
}

function DeleteTransactionDialog({
  transaction,
  onDelete,
  open,
  onOpenChange,
  trigger,
}: {
  transaction: FinanceTransaction
  onDelete: (id: string) => Promise<void>
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {formatRupiah(transaction.amount)} from the recorded
            ledger and recalculates every summary.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              void onDelete(transaction.id)
                .then(() => toast.success("Transaction deleted"))
                .catch((error: unknown) => {
                  toast.error("Could not delete transaction", {
                    description:
                      error instanceof Error
                        ? error.message
                        : "Please try again.",
                  })
                })
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function BudgetsView({
  categories,
  transactions,
  budgets,
  onBudget,
}: FinanceViewProps & { onBudget: (categoryId?: string) => void }) {
  const currentMonth = monthKey(new Date())
  const active = budgets.filter((budget) => budget.month === currentMonth)
  const overall = calculateBudgetProgress(transactions, budgets, currentMonth)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-[-0.03em] md:hidden">
        Budgets
      </h1>
      <Card className="bg-primary text-primary-foreground">
        <CardHeader>
          <CardTitle>Monthly breathing room</CardTitle>
          <CardDescription className="text-primary-foreground/65">
            Across every configured category
          </CardDescription>
          <CardAction>
            <GaugeIcon aria-hidden="true" />
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <SummaryValue label="Limit" value={overall.limit} />
          <SummaryValue label="Spent" value={overall.spent} />
          <SummaryValue label="Remaining" value={overall.remaining} />
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2">
          <Progress
            value={overall.percentage}
            aria-label="Overall budget used"
          />
          <p className="text-xs text-primary-foreground/65">
            {Math.round(overall.percentage)}% used
          </p>
        </CardFooter>
      </Card>
      <section
        aria-label="Category budgets"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {active.map((budget) => {
          const category = categories.find(
            (item) => item.id === budget.categoryId
          )
          const spent = transactions
            .filter(
              (transaction) =>
                transaction.type === "expense" &&
                transaction.categoryId === budget.categoryId &&
                monthKey(transaction.date) === currentMonth
            )
            .reduce((total, transaction) => total + transaction.amount, 0)
          const percentage = Math.min((spent / budget.amount) * 100, 100)
          const Icon = getCategoryIcon(category?.name ?? "Other")
          return (
            <Card key={budget.id}>
              <CardHeader>
                <CardTitle>{category?.name ?? "Other"}</CardTitle>
                <CardDescription>
                  {formatCompactRupiah(spent)} spent
                </CardDescription>
                <CardAction>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-secondary">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatCompactRupiah(budget.amount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(percentage)}%
                  </p>
                </div>
                <Progress
                  value={percentage}
                  aria-label={`${category?.name ?? "Category"} budget used`}
                />
              </CardContent>
              <CardFooter>
                <div className="flex w-full items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onBudget(budget.categoryId)}
                  >
                    Adjust limit
                  </Button>
                  {budget.syncStatus && (
                    <Badge
                      variant={
                        budget.syncStatus === "conflict"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {budget.syncStatus === "conflict"
                        ? "Conflict"
                        : "Pending"}
                    </Badge>
                  )}
                </div>
              </CardFooter>
            </Card>
          )
        })}
        {!active.length && (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
              <GaugeIcon
                aria-hidden="true"
                className="size-7 text-muted-foreground"
              />
              <div>
                <p className="font-medium">No budget limits yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your recorded totals still work without them.
                </p>
              </div>
              <Button onClick={() => onBudget()}>Add budget</Button>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}

function SummaryValue({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-primary-foreground/65">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] tabular-nums">
        {formatCompactRupiah(value)}
      </p>
    </div>
  )
}

function PreferencesView({
  categories,
  onSignIn,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}: {
  categories: Category[]
  onSignIn: () => void
  onCreateCategory: ReturnType<typeof useFinance>["createCategory"]
  onUpdateCategory: ReturnType<typeof useFinance>["updateCategory"]
  onDeleteCategory: ReturnType<typeof useFinance>["deleteCategory"]
}) {
  const auth = useAuth()
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const cloudWorkspace = auth.status === "authenticated"

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card className="overflow-hidden">
        <CardHeader>
          <h1 className="font-heading text-base leading-snug font-medium">
            Preferences
          </h1>
          <CardDescription>
            Keep labels and display details easy to find.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Button
            variant="ghost"
            className="h-auto w-full justify-start rounded-none px-4 py-4 text-left"
            onClick={() => setCategoriesOpen(true)}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <ShapesIcon aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Categories</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {categories.length} transaction labels
              </span>
            </span>
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
          <Separator />
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <CircleDollarSignIcon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Currency</p>
              <p className="text-xs text-muted-foreground">Indonesian rupiah</p>
            </div>
            <Badge variant="outline">IDR</Badge>
          </div>
        </CardContent>
      </Card>

      <CategoryManager
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
        canCustomize={cloudWorkspace}
        onSignIn={onSignIn}
        onCreateCategory={onCreateCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
      />
    </div>
  )
}

function ProfileView({
  onSignIn,
  onSignOut,
}: {
  onSignIn: () => void
  onSignOut: () => void
}) {
  const auth = useAuth()
  const cloudWorkspace = auth.status === "authenticated"
  const metadataName =
    typeof auth.user?.user_metadata.full_name === "string"
      ? auth.user.user_metadata.full_name
      : undefined
  const profileName = cloudWorkspace
    ? metadataName || auth.user?.email?.split("@")[0] || "Coin member"
    : "Guest profile"
  const profileDetail = cloudWorkspace
    ? auth.user?.email
    : "Your finance stays on this device"

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <h1 className="font-heading text-base leading-snug font-medium">
            Profile
          </h1>
          <CardDescription>
            Manage the account connected to this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 pt-2 text-center sm:flex-row sm:text-left">
          <Avatar className="size-16">
            <AvatarFallback className="text-lg font-semibold">
              {accountInitials(profileName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold tracking-[-0.02em]">
              {profileName}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {profileDetail}
            </p>
          </div>
          {cloudWorkspace ? (
            <Button variant="outline" onClick={onSignOut}>
              <LogOutIcon data-icon="inline-start" />
              Sign out
            </Button>
          ) : (
            <Button
              variant="outline"
              disabled={!auth.configured || auth.status === "loading"}
              onClick={onSignIn}
            >
              <LogInIcon data-icon="inline-start" />
              Continue with Google
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            See where this workspace stores your recorded finance data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
            {cloudWorkspace ? (
              <CloudIcon aria-hidden="true" className="size-4" />
            ) : (
              <HardDriveIcon aria-hidden="true" className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {cloudWorkspace ? "Cloud workspace" : "On this device"}
            </p>
            <p className="text-xs text-muted-foreground">
              {cloudWorkspace
                ? "Synced with your Coin account"
                : "Your guest ledger stays in this browser."}
            </p>
          </div>
          <Badge variant="outline">{cloudWorkspace ? "Cloud" : "Local"}</Badge>
        </CardContent>
      </Card>
    </div>
  )
}

function formatTransactionDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  })
}
