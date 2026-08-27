import {
  lazy,
  startTransition,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GaugeIcon,
  PlusIcon,
  WalletCardsIcon,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

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
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  buildCashFlowSeries,
  buildCategoryCashFlow,
  calculateBudgetProgress,
  formatCompactRupiah,
  formatRupiah,
  summarizeLedger,
} from "@/domain/finance"
import type {
  Category,
  CategoryCashFlow,
  FinanceTransaction,
  LedgerSummary,
} from "@/domain/finance"
import {
  ActivityHistoryOverlay,
  CategoryDetailOverlay,
  CategoryFlowLegend,
  PeriodFilterDrawer,
} from "@/features/finance/overview/overview-overlays"
import type {
  DateRange,
  FinanceViewProps,
  PeriodPreset,
} from "@/features/finance/finance-view-types"
import {
  getPeriodLabel,
  getPeriodRange,
} from "@/features/finance/finance-view-types"
import { TransactionList } from "@/features/finance/transactions/transaction-list"
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

export function OverviewView({
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
