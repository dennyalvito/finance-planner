import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  formatCompactRupiah,
  formatRupiah,
  summarizeLedger,
} from "@/domain/finance"
import type { Category, FinanceTransaction } from "@/domain/finance"
import { getCategoryIcon } from "@/features/finance/category-icon"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  MoreHorizontalIcon,
  PencilIcon,
  ReceiptTextIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { dateKey } from "@/features/finance/finance-view-types"

export function TransactionList({
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
  const [deleteTarget, setDeleteTarget] = useState<FinanceTransaction>()
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )

  useEffect(() => {
    if (!swipedTransactionId) return

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest("[data-swipe-row]")) {
        return
      }
      setSwipedTransactionId(null)
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown, {
      passive: true,
    })
    return () =>
      document.removeEventListener("pointerdown", handleOutsidePointerDown)
  }, [swipedTransactionId])

  const handleSwipeChange = useCallback(
    (transactionId: string, open: boolean) => {
      setSwipedTransactionId(open ? transactionId : null)
    },
    []
  )
  const handleRequestDelete = useCallback((transaction: FinanceTransaction) => {
    setSwipedTransactionId(null)
    setDeleteTarget(transaction)
  }, [])

  const groups = useMemo(() => {
    if (!groupByDate) return []

    return transactions.reduce<
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
  }, [groupByDate, transactions])

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
        const category = categoriesById.get(transaction.categoryId)
        const categoryName = category?.name ?? "Other"
        const Icon = getCategoryIcon(categoryName)
        const row = (
          <div
            data-transaction-row
            className="group flex min-w-0 items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{categoryName}</p>
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
                categoryName={categoryName}
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
            onOpenChange={handleSwipeChange}
            transaction={transaction}
            categoryName={categoryName}
            onEdit={onEdit}
            onRequestDelete={handleRequestDelete}
          >
            {row}
          </SwipeableTransactionRow>
        ) : (
          <div key={transaction.id}>{row}</div>
        )
      })}
    </div>
  )

  const listContent = !groupByDate ? (
    renderRows(transactions)
  ) : (
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

  return (
    <>
      {listContent}
      {deleteTarget && (
        <DeleteTransactionDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(undefined)
          }}
          transaction={deleteTarget}
          onDelete={onDelete}
        />
      )}
    </>
  )
}

const SwipeableTransactionRow = memo(
  function SwipeableTransactionRowInner({
    children,
    open,
    onOpenChange,
    transaction,
    categoryName,
    onEdit,
    onRequestDelete,
  }: {
    children: ReactNode
    open: boolean
    onOpenChange: (transactionId: string, open: boolean) => void
    transaction: FinanceTransaction
    categoryName: string
    onEdit?: (transaction: FinanceTransaction) => void
    onRequestDelete: (transaction: FinanceTransaction) => void
  }) {
    const pointerStart = useRef<{ x: number; y: number } | null>(null)

    return (
      <div data-swipe-row className="relative overflow-hidden rounded-xl">
        <div
          aria-hidden={!open}
          className={cn(
            "absolute inset-y-0 right-0 flex w-36 items-stretch gap-1 bg-muted/40 p-1",
            open ? "pointer-events-auto" : "pointer-events-none"
          )}
        >
          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              tabIndex={open ? 0 : -1}
              className="h-full flex-1 flex-col gap-1 rounded-lg bg-background/90 px-2 text-foreground hover:bg-accent"
              onClick={() => {
                onOpenChange(transaction.id, false)
                onEdit(transaction)
              }}
            >
              <PencilIcon data-icon="inline-start" />
              Edit
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tabIndex={open ? 0 : -1}
            className="h-full flex-1 flex-col gap-1 rounded-lg bg-background/90 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={"Delete " + categoryName + " transaction"}
            onClick={() => {
              onOpenChange(transaction.id, false)
              onRequestDelete(transaction)
            }}
          >
            <Trash2Icon data-icon="inline-start" />
            Delete
          </Button>
        </div>
        <div
          className={cn(
            "relative transform-gpu touch-pan-y bg-background transition-transform duration-150 ease-out will-change-transform",
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
              onOpenChange(transaction.id, deltaX < 0)
              return
            }

            if (open && Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) {
              onOpenChange(transaction.id, false)
            }
          }}
        >
          {children}
        </div>
      </div>
    )
  },
  (previous, next) =>
    previous.open === next.open &&
    previous.transaction === next.transaction &&
    previous.categoryName === next.categoryName &&
    previous.onOpenChange === next.onOpenChange &&
    previous.onEdit === next.onEdit &&
    previous.onRequestDelete === next.onRequestDelete
)

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

function formatTransactionDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
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
  trigger?: ReactNode
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
