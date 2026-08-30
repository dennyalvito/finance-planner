import { startTransition, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
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
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatCompactRupiah } from "@/domain/finance"
import type {
  Category,
  CategoryCashFlow,
  FinanceTransaction,
  LedgerSummary,
} from "@/domain/finance"
import { TransactionsView } from "@/features/finance/transactions/transaction-history"
import {
  dateFromKey,
  dateKey,
  formatPeriodDate,
  periodOptions,
} from "@/features/finance/finance-view-types"
import type {
  DateRange,
  PeriodPreset,
} from "@/features/finance/finance-view-types"
import { getCategoryIcon } from "@/features/finance/category-icon"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

const chartDotClasses = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
]

export function CategoryFlowLegend({
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

export function ResponsiveOverlay({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  persistentScrollbar = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  children: ReactNode
  className?: string
  persistentScrollbar?: boolean
}) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className="flex h-[min(92svh,48rem)] max-h-[92svh] flex-col gap-0 overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[92svh]"
          data-testid="responsive-drawer"
        >
          <DrawerHeader className="shrink-0 pb-3">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          {persistentScrollbar ? (
            <ScrollArea
              type="always"
              data-testid="responsive-overlay-scroll"
              data-vaul-no-drag
              className="min-h-0 flex-1"
            >
              <div
                className={cn(
                  "px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
                  className
                )}
              >
                {children}
              </div>
            </ScrollArea>
          ) : (
            <div
              data-testid="responsive-overlay-scroll"
              data-vaul-no-drag
              className={cn(
                "coin-overlay-scroll min-h-0 flex-1 touch-pan-y overflow-y-scroll overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
                className
              )}
            >
              {children}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88svh,48rem)] max-h-[88svh] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {persistentScrollbar ? (
          <ScrollArea
            type="always"
            data-testid="responsive-overlay-scroll"
            className="min-h-0 flex-1"
          >
            <div className={className}>{children}</div>
          </ScrollArea>
        ) : (
          <div
            data-testid="responsive-overlay-scroll"
            className={cn(
              "coin-overlay-scroll min-h-0 flex-1 overflow-y-scroll",
              className
            )}
          >
            {children}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function CategoryDetailOverlay({
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
      persistentScrollbar
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

export function ActivityHistoryOverlay({
  open,
  onOpenChange,
  categories,
  transactions,
  onAdd,
  onEdit,
  onDelete,
  onClearDemo,
  canMutate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  transactions: FinanceTransaction[]
  onAdd: () => void
  onEdit: (transaction: FinanceTransaction) => void
  onDelete: (id: string) => Promise<void>
  onClearDemo: () => Promise<void>
  canMutate: boolean
}) {
  const [contentReady, setContentReady] = useState(false)

  useEffect(() => {
    if (!open) {
      setContentReady(false)
      return
    }

    let secondFrame = 0
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        startTransition(() => setContentReady(true))
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
    }
  }, [open])

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Ledger activity"
      description="Review, filter, edit, or delete every recorded entry."
      className="pb-4"
    >
      {open && contentReady ? (
        <TransactionsView
          categories={categories}
          transactions={transactions}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onClearDemo={onClearDemo}
          canMutate={canMutate}
          embedded
          progressive
        />
      ) : open ? (
        <ActivityHistoryPlaceholder />
      ) : null}
    </ResponsiveOverlay>
  )
}

function ActivityHistoryPlaceholder() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-label="Loading ledger activity"
      role="status"
    >
      <Skeleton className="h-30 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  )
}

export function PeriodFilterDrawer({
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
          className="flex max-h-[92svh] flex-col gap-0 overflow-hidden"
        >
          <DrawerHeader className="shrink-0 pb-3">
            <DrawerTitle>Choose a period</DrawerTitle>
            <DrawerDescription>
              The summary, category chart, and recent activity update together.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
                <DateRangeButtons
                  range={draftRange}
                  onFieldChange={setActiveDateField}
                />
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
                <DateRangeButtons
                  range={draftRange}
                  onFieldChange={setActiveDateField}
                />
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

function DateRangeButtons({
  range,
  onFieldChange,
}: {
  range: DateRange
  onFieldChange: (field: "from" | "to") => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-auto min-w-0 flex-col items-start gap-1 px-3 py-2.5"
        aria-label={
          "Select from date, currently " + formatPeriodDate(range.from)
        }
        onClick={() => onFieldChange("from")}
      >
        <span className="text-xs font-normal text-muted-foreground">From</span>
        <span className="w-full truncate text-left font-medium">
          {formatPeriodDate(range.from)}
        </span>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-w-0 flex-col items-start gap-1 px-3 py-2.5"
        aria-label={"Select to date, currently " + formatPeriodDate(range.to)}
        onClick={() => onFieldChange("to")}
      >
        <span className="text-xs font-normal text-muted-foreground">To</span>
        <span className="w-full truncate text-left font-medium">
          {formatPeriodDate(range.to)}
        </span>
      </Button>
    </div>
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
