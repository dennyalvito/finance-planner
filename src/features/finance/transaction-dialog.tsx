import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type {
  Category,
  FinanceTransaction,
  NewTransaction,
  TransactionType,
} from "@/domain/finance"
import { useAuth } from "@/features/auth/auth-provider"
import { getCategoryIcon } from "@/features/finance/category-icon"
import {
  formatIdrAmountInput,
  parseIdrAmount,
  sanitizeIdrAmount,
} from "@/features/finance/idr-amount"
import { useIsMobile } from "@/hooks/use-mobile"

const createCategoryValue = "__create_category__"
const formId = "coin-transaction-form"

function today() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")
}

function preferredCategoryId(categories: Category[], type: TransactionType) {
  const preferredId = type === "expense" ? "food" : "salary"
  const matching = categories.filter((category) => category.type === type)
  return (
    matching.find((category) => category.id === preferredId)?.id ??
    matching.at(0)?.id ??
    ""
  )
}

type TransactionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  transaction?: FinanceTransaction
  disabled?: boolean
  onCreateCategory: (name: string, type: TransactionType) => Promise<Category>
  onSubmit: (transaction: NewTransaction) => Promise<void>
}

export function TransactionDialog({
  open,
  onOpenChange,
  categories,
  transaction,
  disabled = false,
  onCreateCategory,
  onSubmit,
}: TransactionDialogProps) {
  const isMobile = useIsMobile()
  const auth = useAuth()
  const canCreateCategory = auth.status === "authenticated"
  const [type, setType] = useState<TransactionType>("expense")
  const [amount, setAmount] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [customCategory, setCustomCategory] = useState("")
  const [date, setDate] = useState(today())
  const [note, setNote] = useState("")
  const [showDetails, setShowDetails] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const availableCategories = categories.filter(
    (category) => category.type === type
  )
  const numericAmount = parseIdrAmount(amount)
  const amountInvalid = submitted && (!numericAmount || numericAmount < 1)
  const categoryInvalid = submitted && !categoryId
  const customCategoryInvalid =
    submitted &&
    categoryId === createCategoryValue &&
    customCategory.trim().length < 2

  useEffect(() => {
    if (!open) return
    const initialType = transaction?.type ?? "expense"
    setType(initialType)
    setAmount(transaction ? String(transaction.amount) : "")
    setCategoryId(
      transaction?.categoryId ?? preferredCategoryId(categories, initialType)
    )
    setCustomCategory("")
    setDate(transaction?.date ?? today())
    setNote(transaction?.note ?? "")
    setShowDetails(Boolean(transaction))
    setSubmitted(false)
  }, [categories, open, transaction])

  function reset() {
    setType("expense")
    setAmount("")
    setCategoryId(preferredCategoryId(categories, "expense"))
    setCustomCategory("")
    setDate(today())
    setNote("")
    setShowDetails(false)
    setSubmitted(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)

    if (
      !numericAmount ||
      !categoryId ||
      amountInvalid ||
      categoryInvalid ||
      customCategoryInvalid
    ) {
      return
    }

    setSaving(true)
    try {
      if (categoryId === createCategoryValue && !canCreateCategory) {
        throw new Error("Sign in to create a personal category.")
      }

      const resolvedCategoryId =
        categoryId === createCategoryValue
          ? (await onCreateCategory(customCategory, type)).id
          : categoryId

      await onSubmit({
        type,
        amount: numericAmount,
        categoryId: resolvedCategoryId,
        date,
        note: note.trim(),
      })
      toast.success(transaction ? "Transaction updated" : "Transaction added", {
        description: transaction
          ? "Your changes are reflected across the ledger."
          : "Your ledger has been updated.",
      })
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error("Could not save transaction", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  const form = (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="min-h-0 flex-1 overflow-y-auto px-4 pb-3"
    >
      {isMobile ? (
        <FieldGroup>
          <Field>
            <FieldLabel id="transaction-type">Transaction type</FieldLabel>
            <ToggleGroup
              type="single"
              value={type}
              onValueChange={(value) => {
                if (!value) return
                const nextType = value as TransactionType
                setType(nextType)
                setCategoryId(preferredCategoryId(categories, nextType))
                setCustomCategory("")
              }}
              variant="selection"
              spacing={2}
              aria-labelledby="transaction-type"
              className="grid w-full grid-cols-2"
            >
              <ToggleGroupItem value="expense" className="w-full">
                <ArrowUpRightIcon data-icon="inline-start" />
                Expense
              </ToggleGroupItem>
              <ToggleGroupItem value="income" className="w-full">
                <ArrowDownLeftIcon data-icon="inline-start" />
                Income
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field data-invalid={amountInvalid}>
            <FieldLabel htmlFor="transaction-amount">Amount</FieldLabel>
            <Input
              id="transaction-amount"
              name="amount"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Rp 0"
              value={formatIdrAmountInput(amount)}
              onChange={(event) =>
                setAmount(sanitizeIdrAmount(event.target.value))
              }
              aria-invalid={amountInvalid}
              className="h-14 px-4 text-2xl font-semibold tracking-[-0.03em] tabular-nums md:text-2xl"
              autoFocus
            />
            {amountInvalid && (
              <FieldError>Enter an amount above zero.</FieldError>
            )}
          </Field>

          <Field data-invalid={categoryInvalid}>
            <FieldLabel id="quick-category">Category</FieldLabel>
            <ToggleGroup
              type="single"
              value={categoryId}
              onValueChange={(value) => {
                if (value) setCategoryId(value)
              }}
              variant="selection"
              aria-labelledby="quick-category"
              aria-invalid={categoryInvalid}
              className="flex w-full flex-wrap justify-start"
            >
              {availableCategories.slice(0, 6).map((category) => {
                const Icon = getCategoryIcon(category.name)
                return (
                  <ToggleGroupItem key={category.id} value={category.id}>
                    <Icon data-icon="inline-start" />
                    {category.name}
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            {categoryInvalid && <FieldError>Choose a category.</FieldError>}
          </Field>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setShowDetails((current) => !current)}
          >
            <PlusIcon data-icon="inline-start" />
            {showDetails
              ? "Hide details"
              : canCreateCategory
                ? "More or custom category"
                : "More details"}
          </Button>

          {showDetails && (
            <>
              <Field>
                <FieldLabel htmlFor="transaction-category">
                  All categories
                </FieldLabel>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="transaction-category" className="w-full">
                    <SelectValue placeholder="Choose another category" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectGroup>
                      <SelectLabel>
                        {type === "income" ? "Income" : "Expense"} categories
                      </SelectLabel>
                      {availableCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {canCreateCategory && (
                      <SelectGroup>
                        <SelectLabel>Personalize</SelectLabel>
                        <SelectItem value={createCategoryValue}>
                          Create a custom category
                        </SelectItem>
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </Field>

              {categoryId === createCategoryValue && (
                <Field data-invalid={customCategoryInvalid}>
                  <FieldLabel htmlFor="custom-category">
                    Custom category name
                  </FieldLabel>
                  <Input
                    id="custom-category"
                    value={customCategory}
                    onChange={(event) => setCustomCategory(event.target.value)}
                    placeholder="Pet care"
                    aria-invalid={customCategoryInvalid}
                  />
                  {customCategoryInvalid && (
                    <FieldError>Use at least two characters.</FieldError>
                  )}
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="transaction-date">Date</FieldLabel>
                <Input
                  id="transaction-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="transaction-note">
                  Note (optional)
                </FieldLabel>
                <Input
                  id="transaction-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add context only if useful"
                  maxLength={80}
                />
              </Field>
            </>
          )}
        </FieldGroup>
      ) : (
        <FieldGroup>
          <Field>
            <FieldLabel id="transaction-type">Transaction type</FieldLabel>
            <ToggleGroup
              type="single"
              value={type}
              onValueChange={(value) => {
                if (!value) return
                const nextType = value as TransactionType
                setType(nextType)
                setCategoryId(preferredCategoryId(categories, nextType))
                setCustomCategory("")
              }}
              variant="selection"
              spacing={2}
              aria-labelledby="transaction-type"
            >
              <ToggleGroupItem value="expense">
                <ArrowUpRightIcon data-icon="inline-start" />
                Expense
              </ToggleGroupItem>
              <ToggleGroupItem value="income">
                <ArrowDownLeftIcon data-icon="inline-start" />
                Income
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>

          <Field data-invalid={amountInvalid}>
            <FieldLabel htmlFor="transaction-amount">Amount in IDR</FieldLabel>
            <Input
              id="transaction-amount"
              name="amount"
              inputMode="numeric"
              autoComplete="off"
              placeholder="1.250.000"
              value={formatIdrAmountInput(amount)}
              onChange={(event) =>
                setAmount(sanitizeIdrAmount(event.target.value))
              }
              aria-invalid={amountInvalid}
              autoFocus
            />
            <FieldDescription>
              Enter whole rupiah without decimal values.
            </FieldDescription>
            {amountInvalid && (
              <FieldError>Enter an amount above zero.</FieldError>
            )}
          </Field>

          <Field data-invalid={categoryInvalid}>
            <FieldLabel htmlFor="transaction-category">Category</FieldLabel>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger
                id="transaction-category"
                className="w-full"
                aria-invalid={categoryInvalid}
              >
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectGroup>
                  <SelectLabel>
                    {type === "income" ? "Income" : "Expense"} categories
                  </SelectLabel>
                  {availableCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
                {canCreateCategory && (
                  <SelectGroup>
                    <SelectLabel>Personalize</SelectLabel>
                    <SelectItem value={createCategoryValue}>
                      Create a custom category
                    </SelectItem>
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            {categoryInvalid && <FieldError>Choose a category.</FieldError>}
          </Field>

          {categoryId === createCategoryValue && (
            <Field data-invalid={customCategoryInvalid}>
              <FieldLabel htmlFor="custom-category">
                Custom category name
              </FieldLabel>
              <Input
                id="custom-category"
                value={customCategory}
                onChange={(event) => setCustomCategory(event.target.value)}
                placeholder="Pet care"
                aria-invalid={customCategoryInvalid}
              />
              {customCategoryInvalid && (
                <FieldError>Use at least two characters.</FieldError>
              )}
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="transaction-date">Date</FieldLabel>
            <Input
              id="transaction-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="transaction-note">Note</FieldLabel>
            <Input
              id="transaction-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional context"
              maxLength={80}
            />
          </Field>
        </FieldGroup>
      )}
    </form>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          data-testid="transaction-drawer"
          className="data-[vaul-drawer-direction=bottom]:max-h-[78svh]"
        >
          <DrawerHeader>
            <DrawerTitle>
              {transaction ? "Edit transaction" : "Add transaction"}
            </DrawerTitle>
            <DrawerDescription>
              {transaction
                ? "Update the details for this ledger entry."
                : "Amount and category are all you need."}
            </DrawerDescription>
          </DrawerHeader>
          {form}
          <DrawerFooter className="border-t">
            <Button type="submit" form={formId} disabled={saving || disabled}>
              {transaction ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <PlusIcon data-icon="inline-start" />
              )}
              {saving
                ? "Saving..."
                : transaction
                  ? "Save changes"
                  : "Save transaction"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Edit transaction" : "Add a transaction"}
          </DialogTitle>
          <DialogDescription>
            {transaction
              ? "Update this entry without changing its place in the ledger."
              : "Record money moving in or out of the unified ledger."}
          </DialogDescription>
        </DialogHeader>
        {form}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={saving || disabled}>
            {transaction ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <PlusIcon data-icon="inline-start" />
            )}
            {saving
              ? "Saving..."
              : transaction
                ? "Save changes"
                : "Add transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
