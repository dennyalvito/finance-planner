import { useState } from "react"
import type { FormEvent } from "react"
import { LockIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Category, TransactionType } from "@/domain/finance"
import { getCategoryIcon } from "@/features/finance/category-icon"
import { useIsMobile } from "@/hooks/use-mobile"

const formId = "coin-category-form"

type CategoryManagerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  canCustomize: boolean
  onSignIn: () => void
  onCreateCategory: (name: string, type: TransactionType) => Promise<Category>
}

export function CategoryManager({
  open,
  onOpenChange,
  categories,
  canCustomize,
  onSignIn,
  onCreateCategory,
}: CategoryManagerProps) {
  const isMobile = useIsMobile()
  const [type, setType] = useState<TransactionType>("expense")
  const [name, setName] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const nameInvalid = submitted && name.trim().length < 2

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (!canCustomize || name.trim().length < 2) return

    setSaving(true)
    try {
      await onCreateCategory(name.trim(), type)
      setName("")
      setSubmitted(false)
      toast.success("Category added")
    } catch (error) {
      toast.error("Could not add category", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  const content = (
    <div className="min-h-0 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col gap-5">
        {(["expense", "income"] as const).map((categoryType) => (
          <div key={categoryType} className="flex flex-col gap-2">
            <p className="text-sm font-medium capitalize">
              {categoryType} categories
            </p>
            <div className="overflow-hidden rounded-xl border">
              {categories
                .filter((category) => category.type === categoryType)
                .map((category, index) => {
                  const Icon = getCategoryIcon(category.id)
                  return (
                    <div key={category.id}>
                      {index > 0 && <Separator />}
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                          <Icon aria-hidden="true" className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {category.name}
                        </span>
                        {category.isCustom && (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        ))}

        <Separator />

        {canCustomize ? (
          <form id={formId} onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel id="new-category-type">Category type</FieldLabel>
                <ToggleGroup
                  type="single"
                  value={type}
                  onValueChange={(value) => {
                    if (value) setType(value as TransactionType)
                  }}
                  variant="selection"
                  spacing={2}
                  aria-labelledby="new-category-type"
                  className="grid grid-cols-2"
                >
                  <ToggleGroupItem value="expense" className="w-full">
                    Expense
                  </ToggleGroupItem>
                  <ToggleGroupItem value="income" className="w-full">
                    Income
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field data-invalid={nameInvalid}>
                <FieldLabel htmlFor="new-category-name">
                  New category
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="new-category-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Pet care"
                    maxLength={40}
                    aria-invalid={nameInvalid}
                  />
                  <Button type="submit" disabled={saving}>
                    <PlusIcon data-icon="inline-start" />
                    {saving ? "Adding…" : "Add"}
                  </Button>
                </div>
                {nameInvalid && (
                  <FieldError>Use at least two characters.</FieldError>
                )}
              </Field>
            </FieldGroup>
          </form>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-muted p-4">
            <div className="flex items-center gap-2 font-medium">
              <LockIcon aria-hidden="true" className="size-4" />
              Personal categories
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Guest mode includes Coin&apos;s starter categories. Sign in to add
              categories that sync with your account.
            </p>
            <Button variant="outline" onClick={onSignIn}>
              Sign in to customize
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="overflow-hidden data-[vaul-drawer-direction=bottom]:max-h-[88svh]">
          <DrawerHeader>
            <DrawerTitle>Categories</DrawerTitle>
            <DrawerDescription>
              Labels available when adding transactions.
            </DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>
            Labels available when adding transactions.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
