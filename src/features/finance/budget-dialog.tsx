import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { GaugeIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Budget, Category } from "@/domain/finance"
import { monthKey } from "@/domain/finance"
import {
  formatIdrAmountInput,
  parseIdrAmount,
  sanitizeIdrAmount,
} from "@/features/finance/idr-amount"
import { useIsMobile } from "@/hooks/use-mobile"

const formId = "coin-budget-form"

type BudgetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  budgets: Budget[]
  initialCategoryId?: string
  onSubmit: (categoryId: string, amount: number) => Promise<void>
  onDelete: (categoryId: string, month: string) => Promise<void>
}

export function BudgetDialog({
  open,
  onOpenChange,
  categories,
  budgets,
  initialCategoryId,
  onSubmit,
  onDelete,
}: BudgetDialogProps) {
  const isMobile = useIsMobile()
  const [categoryId, setCategoryId] = useState("")
  const [amount, setAmount] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const currentMonth = monthKey(new Date())
  const selectedBudget = budgets.find(
    (budget) =>
      budget.month === currentMonth && budget.categoryId === categoryId
  )
  const numericAmount = parseIdrAmount(amount)
  const amountInvalid = submitted && numericAmount < 1
  const categoryInvalid = submitted && !categoryId

  useEffect(() => {
    if (!open) return
    const expenseCategories = categories.filter(
      (category) => category.type === "expense"
    )
    const preferredCategory =
      expenseCategories.find((category) => category.id === initialCategoryId) ??
      expenseCategories.find((category) => category.id === "food") ??
      expenseCategories.at(0)

    const preferredCategoryId = preferredCategory?.id ?? ""
    const existingBudget = budgets.find(
      (budget) =>
        budget.month === currentMonth &&
        budget.categoryId === preferredCategoryId
    )
    setCategoryId(preferredCategoryId)
    setAmount(existingBudget ? String(existingBudget.amount) : "")
    setSubmitted(false)
  }, [budgets, categories, currentMonth, initialCategoryId, open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (!categoryId || numericAmount < 1) return

    setSaving(true)
    try {
      await onSubmit(categoryId, numericAmount)
      toast.success("Budget saved", {
        description: "This month now has a clear spending limit.",
      })
      setCategoryId("")
      setAmount("")
      setSubmitted(false)
      onOpenChange(false)
    } catch (error) {
      toast.error("Could not save budget", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedBudget) return
    setDeleting(true)
    try {
      await onDelete(selectedBudget.categoryId, selectedBudget.month)
      toast.success("Budget removed", {
        description: "This category is now unbudgeted for the month.",
      })
      onOpenChange(false)
    } catch (error) {
      toast.error("Could not remove budget", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setDeleting(false)
    }
  }

  const deleteButton = selectedBudget ? (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="destructive"
          disabled={saving || deleting}
        >
          <Trash2Icon data-icon="inline-start" />
          Remove budget
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>Remove this monthly budget?</AlertDialogTitle>
          <AlertDialogDescription>
            Transactions stay unchanged. This category will become unbudgeted
            for {currentMonth}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={(event) => {
              event.preventDefault()
              void handleDelete()
            }}
          >
            <Trash2Icon data-icon="inline-start" />
            {deleting ? "Removing..." : "Remove budget"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null

  const form = (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className={
        isMobile ? "min-h-0 flex-1 overflow-y-auto px-4 pb-3" : undefined
      }
    >
      <FieldGroup>
        <Field data-invalid={categoryInvalid}>
          <FieldLabel htmlFor="budget-category">Expense category</FieldLabel>
          <Select
            value={categoryId}
            onValueChange={(nextCategoryId) => {
              setCategoryId(nextCategoryId)
              const budget = budgets.find(
                (item) =>
                  item.month === currentMonth &&
                  item.categoryId === nextCategoryId
              )
              setAmount(budget ? String(budget.amount) : "")
            }}
          >
            <SelectTrigger
              id="budget-category"
              className="w-full"
              aria-invalid={categoryInvalid}
            >
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                <SelectLabel>Track a category</SelectLabel>
                {categories
                  .filter((category) => category.type === "expense")
                  .map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {categoryInvalid && <FieldError>Choose a category.</FieldError>}
        </Field>
        <Field data-invalid={amountInvalid}>
          <FieldLabel htmlFor="budget-amount">Monthly limit in IDR</FieldLabel>
          <Input
            id="budget-amount"
            inputMode="numeric"
            value={formatIdrAmountInput(amount)}
            onChange={(event) =>
              setAmount(sanitizeIdrAmount(event.target.value))
            }
            placeholder="1.500.000"
            aria-invalid={amountInvalid}
            autoFocus
          />
          <FieldDescription>
            Saving again replaces the limit for this category.
          </FieldDescription>
          {amountInvalid && <FieldError>Enter a limit above zero.</FieldError>}
        </Field>
      </FieldGroup>
    </form>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          data-testid="budget-drawer"
          className="data-[vaul-drawer-direction=bottom]:max-h-[65svh]"
        >
          <DrawerHeader>
            <DrawerTitle>Set a monthly budget</DrawerTitle>
            <DrawerDescription>
              Choose a category and set its monthly limit.
            </DrawerDescription>
          </DrawerHeader>
          {form}
          <DrawerFooter className="border-t">
            {deleteButton}
            <Button type="submit" form={formId} disabled={saving}>
              <GaugeIcon data-icon="inline-start" />
              {saving ? "Saving..." : "Save budget"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a monthly budget</DialogTitle>
          <DialogDescription>
            Add only the limits you want. Categories without a budget stay
            unmetered.
          </DialogDescription>
        </DialogHeader>
        {form}
        <DialogFooter>
          {deleteButton}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={saving}>
            <GaugeIcon data-icon="inline-start" />
            {saving ? "Saving..." : "Save budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
