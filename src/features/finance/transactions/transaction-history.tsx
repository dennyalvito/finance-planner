import { useEffect, useMemo, useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import {
  Card,
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
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  PlusIcon,
  ReceiptTextIcon,
} from "lucide-react"

import {
  formatCompactRupiah,
  formatRupiah,
  summarizeLedger,
} from "@/domain/finance"
import type { Category, FinanceTransaction } from "@/domain/finance"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  dateFromKey,
  dateKey,
  formatPeriodDate,
  getPeriodLabel,
  getPeriodRange,
  transactionPeriodOptions,
} from "@/features/finance/finance-view-types"
import type {
  DateRange,
  TransactionPeriod,
} from "@/features/finance/finance-view-types"
import { TransactionList } from "@/features/finance/transactions/transaction-list"

export function TransactionsView({
  categories,
  transactions,
  onAdd,
  onEdit,
  onDelete,
  onClearDemo,
  canMutate,
  embedded = false,
  progressive = false,
}: {
  categories: Category[]
  transactions: FinanceTransaction[]
  onAdd: () => void
  onEdit: (transaction: FinanceTransaction) => void
  onDelete: (id: string) => Promise<void>
  onClearDemo: () => Promise<void>
  canMutate: boolean
  embedded?: boolean
  progressive?: boolean
}) {
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">(
    "all"
  )
  const [period, setPeriod] = useState<TransactionPeriod>("all")
  const [dateFilterOpen, setDateFilterOpen] = useState(false)
  const [customRange, setCustomRange] = useState<DateRange>(() =>
    getPeriodRange("month", { from: "", to: "" })
  )
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
              readOnly={!canMutate}
              progressive={progressive}
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
                  <Button size="sm" onClick={onAdd} disabled={!canMutate}>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearDemo}
              disabled={!canMutate}
            >
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
