import { useState } from "react"
import type { FormEvent } from "react"
import { GaugeIcon } from "lucide-react"
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
import type { Category } from "@/domain/finance"
import { useIsMobile } from "@/hooks/use-mobile"

const formId = "coin-budget-form"

type BudgetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  onSubmit: (categoryId: string, amount: number) => Promise<void>
}

export function BudgetDialog({
  open,
  onOpenChange,
  categories,
  onSubmit,
}: BudgetDialogProps) {
  const isMobile = useIsMobile()
  const [categoryId, setCategoryId] = useState("")
  const [amount, setAmount] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const numericAmount = Number(amount.replace(/\D/g, ""))
  const amountInvalid = submitted && numericAmount < 1
  const categoryInvalid = submitted && !categoryId

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
          <Select value={categoryId} onValueChange={setCategoryId}>
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
            value={amount}
            onChange={(event) =>
              setAmount(event.target.value.replace(/\D/g, ""))
            }
            placeholder="1500000"
            aria-invalid={amountInvalid}
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
