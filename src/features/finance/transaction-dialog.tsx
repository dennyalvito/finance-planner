import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { ArrowDownLeftIcon, ArrowUpRightIcon, PlusIcon } from "lucide-react"
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
  NewTransaction,
  TransactionType,
} from "@/domain/finance"
import { getCategoryIcon } from "@/features/finance/category-icon"
import { useIsMobile } from "@/hooks/use-mobile"

const createCategoryValue = "__create_category__"
const formId = "coin-transaction-form"

function today() {
  return new Date().toISOString().slice(0, 10)
}

type TransactionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  onCreateCategory: (name: string, type: TransactionType) => Promise<Category>
  onSubmit: (transaction: NewTransaction) => Promise<void>
}

export function TransactionDialog({
  open,
  onOpenChange,
  categories,
  onCreateCategory,
  onSubmit,
}: TransactionDialogProps) {
  const isMobile = useIsMobile()
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
  const numericAmount = Number(amount.replace(/\D/g, ""))
  const amountInvalid = submitted && (!numericAmount || numericAmount < 1)
  const categoryInvalid = submitted && !categoryId
  const customCategoryInvalid =
    submitted &&
    categoryId === createCategoryValue &&
    customCategory.trim().length < 2

  useEffect(() => {
    setCategoryId("")
    setCustomCategory("")
  }, [type])

  function reset() {
    setType("expense")
    setAmount("")
    setCategoryId("")
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
      toast.success("Transaction added", {
        description: "Your local ledger has been updated.",
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
                if (value) setType(value as TransactionType)
              }}
              variant="outline"
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
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value.replace(/\D/g, ""))
              }
              aria-invalid={amountInvalid}
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
              variant="outline"
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
            {showDetails ? "Hide details" : "More or custom category"}
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
                    <SelectGroup>
                      <SelectLabel>Personalize</SelectLabel>
                      <SelectItem value={createCategoryValue}>
                        Create a custom category
                      </SelectItem>
                    </SelectGroup>
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
                if (value) setType(value as TransactionType)
              }}
              variant="outline"
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
              placeholder="125000"
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value.replace(/\D/g, ""))
              }
              aria-invalid={amountInvalid}
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
                <SelectGroup>
                  <SelectLabel>Personalize</SelectLabel>
                  <SelectItem value={createCategoryValue}>
                    Create a custom category
                  </SelectItem>
                </SelectGroup>
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
            <DrawerTitle>Add transaction</DrawerTitle>
            <DrawerDescription>
              Amount and category are all you need.
            </DrawerDescription>
          </DrawerHeader>
          {form}
          <DrawerFooter className="border-t">
            <Button type="submit" form={formId} disabled={saving}>
              <PlusIcon data-icon="inline-start" />
              {saving ? "Saving..." : "Save transaction"}
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
          <DialogTitle>Add a transaction</DialogTitle>
          <DialogDescription>
            Record money moving in or out of the unified ledger.
          </DialogDescription>
        </DialogHeader>
        {form}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form={formId} disabled={saving}>
            <PlusIcon data-icon="inline-start" />
            {saving ? "Saving..." : "Add transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
