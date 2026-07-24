import {
  lazy,
  startTransition,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react"
import { Link, Outlet, useLocation } from "@tanstack/react-router"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ChartNoAxesCombinedIcon,
  CircleDollarSignIcon,
  GaugeIcon,
  LayoutDashboardIcon,
  MoreHorizontalIcon,
  PlusIcon,
  ReceiptTextIcon,
  Settings2Icon,
  ShapesIcon,
  Trash2Icon,
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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  buildCategorySpending,
  calculateBudgetProgress,
  formatCompactRupiah,
  formatRupiah,
  monthKey,
  summarizeLedger,
} from "@/domain/finance"
import type { Budget, Category, FinanceTransaction } from "@/domain/finance"
import { BudgetDialog } from "@/features/finance/budget-dialog"
import { getCategoryIcon } from "@/features/finance/category-icon"
import { TransactionDialog } from "@/features/finance/transaction-dialog"
import { useFinance } from "@/features/finance/use-finance"
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
    shortLabel: "More",
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

export function CoinApp() {
  const pathname = useLocation({
    select: (location) => location.pathname,
  })
  const view = getView(pathname)
  const [isInteractive, setIsInteractive] = useState(false)
  const [transactionOpen, setTransactionOpen] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const finance = useFinance()

  useEffect(() => {
    setIsInteractive(true)
  }, [])

  const shared = {
    categories: finance.categories,
    transactions: finance.transactions,
    budgets: finance.budgets,
  }

  return (
    <SidebarProvider>
      <CoinSidebar view={view} onAdd={() => setTransactionOpen(true)} />
      <SidebarInset
        data-app-ready={isInteractive ? "true" : "false"}
        aria-busy={!isInteractive}
        inert={!isInteractive}
        className="min-w-0 pb-24 md:pb-0"
      >
        <AppHeader view={view} onAdd={() => setTransactionOpen(true)} />
        <div
          key={view}
          data-testid="route-stage"
          data-view={view}
          className="coin-route-enter mx-auto flex w-full max-w-384 flex-1 flex-col px-4 py-5 sm:px-6 md:py-7 xl:px-8"
        >
          {view === "overview" && (
            <OverviewView
              {...shared}
              onAdd={() => setTransactionOpen(true)}
              onBudget={() => setBudgetOpen(true)}
              onDelete={finance.deleteTransaction}
              onClearDemo={finance.clearDemoTransactions}
            />
          )}
          {view === "transactions" && (
            <TransactionsView
              categories={finance.categories}
              transactions={finance.transactions}
              onAdd={() => setTransactionOpen(true)}
              onDelete={finance.deleteTransaction}
              onClearDemo={finance.clearDemoTransactions}
            />
          )}
          {view === "budgets" && (
            <BudgetsView {...shared} onBudget={() => setBudgetOpen(true)} />
          )}
          {view === "settings" && (
            <SettingsView categories={finance.categories} />
          )}
        </div>
      </SidebarInset>

      <MobileDock view={view} onAdd={() => setTransactionOpen(true)} />
      <TransactionDialog
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
        categories={finance.categories}
        onCreateCategory={finance.createCategory}
        onSubmit={finance.addTransaction}
      />
      <BudgetDialog
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        categories={finance.categories}
        onSubmit={finance.saveBudget}
      />
      <Outlet />
    </SidebarProvider>
  )
}

function CoinSidebar({ view, onAdd }: { view: CoinView; onAdd: () => void }) {
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
                      <Link to={item.to} preload="render">
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
          <p className="text-xs font-medium">Local-first</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Your ledger stays in this browser.
          </p>
        </div>
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Local profile"
              className="group-data-[collapsible=icon]:justify-center"
            >
              <Avatar size="sm">
                <AvatarFallback>CO</AvatarFallback>
              </Avatar>
              <span className="group-data-[collapsible=icon]:sr-only">
                Local profile
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function AppHeader({ view, onAdd }: { view: CoinView; onAdd: () => void }) {
  const title =
    navigation.find((item) => item.view === view)?.label ?? "Overview"

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
                <AvatarFallback>CO</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Local profile</DropdownMenuLabel>
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
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 items-center rounded-2xl border bg-background/95 px-2 py-2 shadow-xl shadow-foreground/10 backdrop-blur-xl md:hidden"
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
  const Icon = item.view === "settings" ? MoreHorizontalIcon : item.icon
  return (
    <Link
      to={item.to}
      preload="render"
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 touch-manipulation flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[0.66rem] font-medium text-muted-foreground active:bg-secondary active:text-foreground",
        active && "bg-secondary text-foreground"
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span className="truncate">{item.shortLabel}</span>
    </Link>
  )
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
  const [chartsReady, setChartsReady] = useState(false)
  const summary = useMemo(() => summarizeLedger(transactions), [transactions])
  const series = useMemo(
    () => (chartsReady ? buildCashFlowSeries(transactions) : []),
    [chartsReady, transactions]
  )
  const spending = useMemo(
    () => (chartsReady ? buildCategorySpending(transactions, categories) : []),
    [categories, chartsReady, transactions]
  )
  const budget = useMemo(
    () => calculateBudgetProgress(transactions, budgets),
    [transactions, budgets]
  )
  const topCategoryName = spending.length > 0 ? spending[0].name : "No expenses"

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      startTransition(() => {
        setChartsReady(true)
      })
    }, 160)

    return () => window.clearTimeout(timeout)
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <PageHeading eyebrow="Today" />

      <section
        aria-label="Financial summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Card className="overflow-hidden bg-primary text-primary-foreground sm:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Recorded net</CardTitle>
            <CardDescription className="text-primary-foreground/65">
              Income minus expenses
            </CardDescription>
            <CardAction>
              <ChartNoAxesCombinedIcon aria-hidden="true" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-[-0.04em] tabular-nums sm:text-4xl">
              {formatRupiah(summary.net)}
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
              {chartsReady ? (
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
              {chartsReady ? (
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
              {chartsReady ? (
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
                  ? "This month’s selected limits."
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

function SpendingSkeleton() {
  return (
    <Skeleton
      data-testid="spending-skeleton"
      role="status"
      aria-label="Loading spending chart"
      className="mx-auto size-44 rounded-full"
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
}: {
  categories: Category[]
  transactions: FinanceTransaction[]
  onDelete: (id: string) => Promise<void>
  compact?: boolean
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
                {transaction.note || formatTransactionDate(transaction.date)}
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
                {transaction.type === "income" ? "+" : "−"}
                {formatCompactRupiah(transaction.amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatTransactionDate(transaction.date)}
              </p>
            </div>
            <DeleteTransactionButton
              transaction={transaction}
              onDelete={onDelete}
            />
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
}: FinanceViewProps & { onBudget: () => void }) {
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
          <Button onClick={onBudget}>
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
                <Button variant="ghost" size="sm" onClick={onBudget}>
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
              <Button onClick={onBudget}>Set the first budget</Button>
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

function SettingsView({ categories }: { categories: Category[] }) {
  const expenseCategories = categories.filter(
    (category) => category.type === "expense"
  )
  const incomeCategories = categories.filter(
    (category) => category.type === "income"
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Preferences"
        title="Categories & settings"
        description="Review the structure behind your local ledger."
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              Built-in and personal labels used by transactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <CategoryGroup
              title="Expense categories"
              categories={expenseCategories}
            />
            <CategoryGroup
              title="Income categories"
              categories={incomeCategories}
            />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Currency</CardTitle>
              <CardDescription>MVP display preference</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-xl bg-muted p-3">
                <span className="text-sm font-medium">Indonesian rupiah</span>
                <Badge variant="outline">IDR</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Storage</CardTitle>
              <CardDescription>Private for this phase</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="text-sm font-medium">Local browser database</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Authentication and private synchronization can be connected
                later without changing the finance rules.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function CategoryGroup({
  title,
  categories,
}: {
  title: string
  categories: Category[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-col gap-1">
        {categories.map((category) => {
          const Icon = getCategoryIcon(category.name)
          return (
            <div
              key={category.id}
              className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-secondary">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {category.name}
              </span>
              {category.isCustom && <Badge variant="outline">Custom</Badge>}
            </div>
          )
        })}
      </div>
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
