import {
  createContext,
  lazy,
  startTransition,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { Link, Outlet, useLocation } from "@tanstack/react-router"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ChartNoAxesCombinedIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDollarSignIcon,
  CloudIcon,
  GaugeIcon,
  HardDriveIcon,
  LayoutDashboardIcon,
  LogInIcon,
  LogOutIcon,
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
  Dialog as SheetDialog,
  DialogContent as SheetContent,
  DialogDescription as SheetDescription,
  DialogHeader as SheetHeader,
  DialogTitle as SheetTitle,
} from "@/components/ui/dialog"
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
  buildCategorySpending,
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
import { SignInDialog } from "@/features/auth/sign-in-dialog"
import { BudgetDialog } from "@/features/finance/budget-dialog"
import { CategoryManager } from "@/features/finance/category-manager"
import { getCategoryIcon } from "@/features/finance/category-icon"
import { TransactionDialog } from "@/features/finance/transaction-dialog"
import { useFinance } from "@/features/finance/use-finance"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import type { DateRange as CalendarDateRange } from "react-day-picker"

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

export type CoinView = "overview" | "transactions" | "budgets" | "settings"

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
    view: "transactions",
    label: "Transactions",
    shortLabel: "Activity",
    to: "/transactions",
    icon: ReceiptTextIcon,
  },
  {
    view: "budgets",
    label: "Budgets",
    shortLabel: "Budgets",
    to: "/budgets",
    icon: GaugeIcon,
  },
  {
    view: "settings",
    label: "Categories & settings",
    shortLabel: "Profile",
    to: "/settings",
    icon: Settings2Icon,
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
    return "settings"
  }

  return "overview"
}

type CoinAppContextValue = ReturnType<typeof useFinance> & {
  openBudget: (categoryId?: string) => void
  openSignIn: () => void
  openTransaction: () => void
}

type TransactionOverlayContextValue = {
  openTransaction: () => void
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
  onSubmit,
}: {
  categories: Category[]
  children: React.ReactNode
  onCreateCategory: (
    name: string,
    type: FinanceTransaction["type"]
  ) => Promise<Category>
  onSubmit: ReturnType<typeof useFinance>["addTransaction"]
}) {
  const [open, setOpen] = useState(false)
  const openTransaction = useCallback(() => setOpen(true), [])
  const value = useMemo(() => ({ openTransaction }), [openTransaction])

  return (
    <TransactionOverlayContext.Provider value={value}>
      {children}
      <TransactionDialog
        open={open}
        onOpenChange={setOpen}
        categories={categories}
        onCreateCategory={onCreateCategory}
        onSubmit={onSubmit}
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
      onSubmit={finance.addTransaction}
    >
      <CoinAppShell finance={finance} />
    </TransactionOverlayProvider>
  )
}

function CoinAppShell({ finance }: { finance: ReturnType<typeof useFinance> }) {
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const view = getView(pathname)
  const [isInteractive, setIsInteractive] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [budgetCategoryId, setBudgetCategoryId] = useState<string>()
  const [signInOpen, setSignInOpen] = useState(false)
  const { openTransaction } = useTransactionOverlay()
  const appReady = isInteractive && !finance.isLoading
  const openBudget = useCallback((categoryId?: string) => {
    setBudgetCategoryId(categoryId)
    setBudgetOpen(true)
  }, [])
  const openSignIn = useCallback(() => setSignInOpen(true), [])
  const contextValue = useMemo(
    () => ({
      ...finance,
      openBudget,
      openSignIn,
      openTransaction,
    }),
    [finance, openBudget, openSignIn, openTransaction]
  )

  useEffect(() => {
    setIsInteractive(true)
  }, [])

  return (
    <CoinAppContext.Provider value={contextValue}>
      <SidebarProvider>
        <CoinSidebar view={view} onAdd={openTransaction} />
        <SidebarInset
          data-app-ready={appReady ? "true" : "false"}
          aria-busy={!appReady}
          inert={!appReady}
          className="min-w-0 pb-24 md:pb-0"
        >
          <AppHeader
            view={view}
            onAdd={openTransaction}
            onSignIn={openSignIn}
          />
          <div
            key={view}
            data-testid="route-stage"
            data-view={view}
            className="coin-route-enter mx-auto flex w-full max-w-384 flex-1 flex-col px-4 py-5 sm:px-6 md:py-7 xl:px-8"
          >
            <Outlet />
          </div>
        </SidebarInset>

        <MobileDock view={view} onAdd={openTransaction} />
        <BudgetDialog
          open={budgetOpen}
          onOpenChange={setBudgetOpen}
          categories={finance.categories}
          initialCategoryId={budgetCategoryId}
          onSubmit={finance.saveBudget}
        />
        <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
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
      onAdd={finance.openTransaction}
      onBudget={finance.openBudget}
      onDelete={finance.deleteTransaction}
      onClearDemo={finance.clearDemoTransactions}
    />
  )
}

export function TransactionsPage() {
  const finance = useCoinApp()

  return (
    <TransactionsView
      categories={finance.categories}
      transactions={finance.transactions}
      onAdd={finance.openTransaction}
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

export function SettingsPage() {
  const finance = useCoinApp()

  return (
    <SettingsView
      categories={finance.categories}
      onSignIn={finance.openSignIn}
      onCreateCategory={finance.createCategory}
    />
  )
}

function accountLabel(email?: string) {
  return email ?? "Cloud account"
}

function accountInitials(email?: string) {
  if (!email) return "CO"
  return email.slice(0, 2).toUpperCase()
}

function CoinSidebar({ view, onAdd }: { view: CoinView; onAdd: () => void }) {
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
}: {
  view: CoinView
  onAdd: () => void
  onSignIn: () => void
}) {
  const auth = useAuth()
  const title =
    navigation.find((item) => item.view === view)?.label ?? "Overview"
  const cloudWorkspace = auth.status === "authenticated"
  const profile = cloudWorkspace ? accountLabel(auth.user?.email) : "Guest mode"

  const signOut = async () => {
    try {
      await auth.signOut()
      toast.success("Signed out. Your guest workspace is still on this device.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-out failed.")
    }
  }

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
          <p className="truncate text-sm font-medium">{title}</p>
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
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <ShapesIcon />
                  Categories
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings2Icon />
                  Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {cloudWorkspace ? (
                <DropdownMenuItem onSelect={() => void signOut()}>
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
  const Icon = item.view === "settings" ? UserRoundIcon : item.icon
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
  onBudget,
  onDelete,
  onClearDemo,
}: FinanceViewProps & {
  onAdd: () => void
  onBudget: () => void
  onDelete: (id: string) => Promise<void>
  onClearDemo: () => Promise<void>
}) {
  const isMobile = useIsMobile()
  const chartsReady = useOverviewChartsReady()
  const [period, setPeriod] = useState<PeriodPreset>("month")
  const [periodOpen, setPeriodOpen] = useState(false)
  const initialCustomRange = useMemo(
    () => getPeriodRange("month", { from: "", to: "" }),
    []
  )
  const [customRange, setCustomRange] = useState<DateRange>(initialCustomRange)
  const activeRange = useMemo(
    () => getPeriodRange(period, customRange),
    [customRange, period]
  )
  const mobileTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.date >= activeRange.from &&
          transaction.date <= activeRange.to
      ),
    [activeRange, transactions]
  )
  const summary = useMemo(() => summarizeLedger(transactions), [transactions])
  const mobileSummary = useMemo(
    () => summarizeLedger(mobileTransactions),
    [mobileTransactions]
  )
  const series = useMemo(
    () => (chartsReady ? buildCashFlowSeries(transactions) : []),
    [chartsReady, transactions]
  )
  const spending = useMemo(
    () => (chartsReady ? buildCategorySpending(transactions, categories) : []),
    [categories, chartsReady, transactions]
  )
  const mobileCashFlow = useMemo(
    () =>
      chartsReady ? buildCategoryCashFlow(mobileTransactions, categories) : [],
    [categories, chartsReady, mobileTransactions]
  )
  const budget = useMemo(
    () => calculateBudgetProgress(transactions, budgets),
    [transactions, budgets]
  )
  const topCategoryName = spending.length > 0 ? spending[0].name : "No expenses"

  return (
    <div className="flex flex-col gap-6">
      <MobileOverview
        categories={categories}
        transactions={mobileTransactions}
        summary={mobileSummary}
        cashFlow={mobileCashFlow}
        chartsReady={chartsReady && isMobile}
        period={period}
        periodLabel={getPeriodLabel(period, activeRange)}
        periodOpen={periodOpen}
        customRange={customRange}
        onPeriodOpenChange={setPeriodOpen}
        onPeriodChange={setPeriod}
        onCustomRangeChange={setCustomRange}
        onDelete={onDelete}
      />

      <div
        data-testid="desktop-overview"
        className="hidden flex-col gap-6 md:flex"
      >
        <PageHeading eyebrow="Today" />

        <section
          aria-label="Financial summary"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <Card className="overflow-hidden sm:col-span-2 xl:col-span-1">
            <CardHeader>
              <CardTitle>Net cash flow</CardTitle>
              <CardDescription>Income minus expenses</CardDescription>
              <CardAction>
                <ChartNoAxesCombinedIcon aria-hidden="true" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-[-0.04em] tabular-nums sm:text-4xl">
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

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.8fr)]">
          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
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

            <Card aria-busy={!chartsReady}>
              <CardHeader>
                <CardTitle>Spending overview</CardTitle>
                <CardDescription>
                  Where expenses are concentrated.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartsReady && !isMobile ? (
                  <Suspense fallback={<SpendingSkeleton />}>
                    <SpendingChart data={spending} />
                  </Suspense>
                ) : (
                  <SpendingSkeleton />
                )}
              </CardContent>
              <CardFooter className="justify-between">
                <span className="text-sm text-muted-foreground">
                  Top category
                </span>
                {chartsReady && !isMobile ? (
                  <span className="text-sm font-medium">{topCategoryName}</span>
                ) : (
                  <Skeleton aria-hidden="true" className="h-4 w-20" />
                )}
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
              transactions={transactions.slice(0, 5)}
              onDelete={onDelete}
              onClearDemo={onClearDemo}
              compact
            />
          </div>
        </div>
      </div>
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

function MobileOverview({
  categories,
  transactions,
  summary,
  cashFlow,
  chartsReady,
  period,
  periodLabel,
  periodOpen,
  customRange,
  onPeriodOpenChange,
  onPeriodChange,
  onCustomRangeChange,
  onDelete,
}: {
  categories: Category[]
  transactions: FinanceTransaction[]
  summary: LedgerSummary
  cashFlow: CategoryCashFlow[]
  chartsReady: boolean
  period: PeriodPreset
  periodLabel: string
  periodOpen: boolean
  customRange: DateRange
  onPeriodOpenChange: (open: boolean) => void
  onPeriodChange: (period: PeriodPreset) => void
  onCustomRangeChange: (range: DateRange) => void
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
          <p className="text-3xl font-semibold tracking-[-0.045em] tabular-nums">
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

      <Card aria-busy={!chartsReady}>
        <CardHeader>
          <CardTitle>Cash flow</CardTitle>
          <CardDescription>{periodLabel}</CardDescription>
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
          <div className="flex min-w-0 flex-col gap-2">
            {cashFlow.slice(0, 5).map((item, index) => {
              const Icon = getCategoryIcon(item.categoryId)
              return (
                <div
                  key={`${item.type}:${item.categoryId}`}
                  className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
                >
                  <span className="relative flex size-7 items-center justify-center rounded-lg bg-muted">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute top-1 right-1 size-1.5 rounded-full",
                        chartDotClasses[index]
                      )}
                    />
                    <Icon aria-hidden="true" className="size-3.5" />
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
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
            {chartsReady && !cashFlow.length && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Add income or an expense to see its category share.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="mobile-recent-activity">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Within {periodLabel.toLowerCase()}</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/transactions">See all</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TransactionList
            categories={categories}
            transactions={transactions.slice(0, 4)}
            onDelete={onDelete}
            compact
            hideDelete
          />
        </CardContent>
      </Card>

      <PeriodFilterDrawer
        open={periodOpen}
        period={period}
        customRange={customRange}
        onOpenChange={onPeriodOpenChange}
        onPeriodChange={onPeriodChange}
        onCustomRangeChange={onCustomRangeChange}
      />
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
  const customRangeInvalid =
    !customRange.from || !customRange.to || customRange.from > customRange.to
  const selectedRange: CalendarDateRange = {
    from: dateFromKey(customRange.from),
    to: dateFromKey(customRange.to),
  }

  return (
    <SheetDialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="period-filter-drawer"
        showCloseButton={false}
        className="top-auto right-0 bottom-0 left-0 max-h-[92svh] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-t-2xl rounded-b-none p-0 sm:max-w-none data-open:zoom-in-100 data-open:slide-in-from-bottom-4 data-closed:zoom-out-100 data-closed:slide-out-to-bottom-4"
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-3 h-1 w-20 shrink-0 rounded-full bg-muted"
        />
        <SheetHeader className="shrink-0 gap-1 px-4 pt-4 pb-3 text-center">
          <SheetTitle>Choose a period</SheetTitle>
          <SheetDescription>
            The summary, category chart, and recent activity update together.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <ToggleGroup
            type="single"
            value={period}
            variant="outline"
            className="grid w-full grid-cols-2"
            onValueChange={(value) => {
              if (!value) return
              const nextPeriod = value as PeriodPreset
              if (nextPeriod === "custom" && period !== "custom") {
                onCustomRangeChange({ from: "", to: "" })
              }
              onPeriodChange(nextPeriod)
              if (nextPeriod !== "custom") onOpenChange(false)
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

          <Collapsible open={period === "custom"}>
            <CollapsibleContent className="coin-collapsible-content">
              <div className="mt-4 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border bg-card px-3 py-2">
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="mt-1 truncate text-sm font-medium">
                      {formatPeriodDate(customRange.from)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-card px-3 py-2">
                    <p className="text-xs text-muted-foreground">To</p>
                    <p className="mt-1 truncate text-sm font-medium">
                      {formatPeriodDate(customRange.to)}
                    </p>
                  </div>
                </div>
                <Calendar
                  mode="range"
                  selected={selectedRange}
                  defaultMonth={selectedRange.from ?? new Date()}
                  onSelect={(range) => {
                    if (!range?.from) return
                    onCustomRangeChange({
                      from: dateKey(range.from),
                      to: range.to ? dateKey(range.to) : "",
                    })
                  }}
                  disabled={{ after: new Date() }}
                  className="mx-auto"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        {period === "custom" && (
          <div className="shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              className="w-full"
              disabled={customRangeInvalid}
              onClick={() => onOpenChange(false)}
            >
              Apply custom period
            </Button>
          </div>
        )}
      </SheetContent>
    </SheetDialog>
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
  onDelete,
  onClearDemo,
}: {
  categories: Category[]
  transactions: FinanceTransaction[]
  onAdd: () => void
  onDelete: (id: string) => Promise<void>
  onClearDemo: () => Promise<void>
}) {
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all")
  const visible = transactions.filter(
    (transaction) => filter === "all" || transaction.type === filter
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Unified ledger"
        title="Transactions"
        description="Every recorded movement, newest first."
        action={
          <Button onClick={onAdd}>
            <PlusIcon data-icon="inline-start" />
            Add transaction
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>All activity</CardTitle>
          <CardDescription>
            Filter the ledger without separating it into accounts.
          </CardDescription>
          <CardAction>
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(value) => {
                if (value) setFilter(value as typeof filter)
              }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="all">All</ToggleGroupItem>
              <ToggleGroupItem value="income">Income</ToggleGroupItem>
              <ToggleGroupItem value="expense">Expense</ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent>
          <TransactionList
            categories={categories}
            transactions={visible}
            onDelete={onDelete}
          />
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
    </div>
  )
}

function RecentTransactions({
  categories,
  transactions,
  onDelete,
  onClearDemo,
  compact,
}: {
  categories: Category[]
  transactions: FinanceTransaction[]
  onDelete: (id: string) => Promise<void>
  onClearDemo: () => Promise<void>
  compact?: boolean
}) {
  const hasDemo = transactions.some((transaction) => transaction.isDemo)
  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <CardDescription>Your newest ledger entries.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/transactions">View all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <TransactionList
          categories={categories}
          transactions={compact ? transactions.slice(0, 5) : transactions}
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
  onDelete,
  compact,
  hideDelete,
}: {
  categories: Category[]
  transactions: FinanceTransaction[]
  onDelete: (id: string) => Promise<void>
  compact?: boolean
  hideDelete?: boolean
}) {
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

  return (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
      {transactions.map((transaction) => {
        const category = categories.find(
          (item) => item.id === transaction.categoryId
        )
        const Icon = getCategoryIcon(category?.name ?? "Other")
        return (
          <div
            key={transaction.id}
            className="group flex min-w-0 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {category?.name ?? "Other"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {transaction.note ||
                  (transaction.type === "income" ? "Income" : "Expense")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-sm font-medium tabular-nums",
                  transaction.type === "income"
                    ? "text-positive"
                    : "text-foreground"
                )}
              >
                {transaction.type === "income" ? "+" : "-"}
                {formatCompactRupiah(transaction.amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatTransactionDate(transaction.date)}
              </p>
            </div>
            {!hideDelete && (
              <DeleteTransactionButton
                transaction={transaction}
                onDelete={onDelete}
              />
            )}
          </div>
        )
      })}
    </div>
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
    <AlertDialog>
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes {formatRupiah(transaction.amount)} from the local
            ledger and recalculates every summary.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              void onDelete(transaction.id).then(() =>
                toast.success("Transaction deleted")
              )
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
      <PageHeading
        eyebrow="Optional limits"
        title="Budgets"
        description="Set boundaries only where they help. Unbudgeted categories stay unmetered."
        action={
          <Button onClick={() => onBudget()}>
            <PlusIcon data-icon="inline-start" />
            Add budget
          </Button>
        }
      />
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onBudget(budget.categoryId)}
                >
                  Adjust limit
                </Button>
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
              <Button onClick={() => onBudget()}>Set the first budget</Button>
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

function SettingsView({
  categories,
  onSignIn,
  onCreateCategory,
}: {
  categories: Category[]
  onSignIn: () => void
  onCreateCategory: ReturnType<typeof useFinance>["createCategory"]
}) {
  const auth = useAuth()
  const [categoriesOpen, setCategoriesOpen] = useState(false)
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

  const signOut = async () => {
    try {
      await auth.signOut()
      toast.success("Signed out. Your guest workspace is still on this device.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-out failed.")
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeading
        eyebrow="Account"
        title="Profile"
        description="Manage your Coin experience and personal finance preferences."
      />
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-6 text-center sm:flex-row sm:text-left">
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
            <Button variant="outline" onClick={() => void signOut()}>
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

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
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
          <Separator />
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              {cloudWorkspace ? (
                <CloudIcon aria-hidden="true" className="size-4" />
              ) : (
                <HardDriveIcon aria-hidden="true" className="size-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Your data</p>
              <p className="text-xs text-muted-foreground">
                {cloudWorkspace
                  ? "Synced with your Coin account"
                  : "Saved on this device"}
              </p>
            </div>
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
      />
    </div>
  )
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
        {title && (
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
            {title}
          </h1>
        )}
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function formatTransactionDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  })
}
