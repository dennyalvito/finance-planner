import { useState } from "react"
import type { FormEvent } from "react"
import {
  LockIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  readOnly?: boolean
  onSignIn: () => void
  onCreateCategory: (name: string, type: TransactionType) => Promise<Category>
  onUpdateCategory: (id: string, name: string) => Promise<void>
  onDeleteCategory: (id: string) => Promise<void>
}

export function CategoryManager({
  open,
  onOpenChange,
  categories,
  canCustomize,
  readOnly = false,
  onSignIn,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}: CategoryManagerProps) {
  const isMobile = useIsMobile()
  const [type, setType] = useState<TransactionType>("expense")
  const [name, setName] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [renameCategory, setRenameCategory] = useState<Category>()
  const [renameName, setRenameName] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [deleteCategory, setDeleteCategory] = useState<Category>()
  const [deleting, setDeleting] = useState(false)
  const nameInvalid = submitted && name.trim().length < 2

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
    if (!canCustomize || readOnly || name.trim().length < 2) return

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

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!renameCategory || renameName.trim().length < 2) return
    setRenaming(true)
    try {
      await onUpdateCategory(renameCategory.id, renameName.trim())
      toast.success("Category renamed")
      setRenameCategory(undefined)
    } catch (error) {
      toast.error("Could not rename category", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setRenaming(false)
    }
  }

  async function handleDelete() {
    if (!deleteCategory) return
    setDeleting(true)
    try {
      await onDeleteCategory(deleteCategory.id)
      toast.success("Category deleted")
      setDeleteCategory(undefined)
    } catch (error) {
      toast.error("Could not delete category", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setDeleting(false)
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
                        {category.isCustom && canCustomize && !readOnly && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Manage ${category.name}`}
                              >
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    setRenameName(category.name)
                                    setRenameCategory(category)
                                  }}
                                >
                                  <PencilIcon />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => setDeleteCategory(category)}
                                >
                                  <Trash2Icon />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
              <Field data-disabled={readOnly}>
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
                  disabled={readOnly}
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
              <Field data-invalid={nameInvalid} data-disabled={readOnly}>
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
                    disabled={readOnly}
                  />
                  <Button type="submit" disabled={saving || readOnly}>
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
              categories stored in your account.
            </p>
            <Button variant="outline" onClick={onSignIn}>
              Sign in to customize
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  const managementDialogs = (
    <>
      <Dialog
        open={renameCategory !== undefined}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setRenameCategory(undefined)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename category</DialogTitle>
            <DialogDescription>
              Transactions and budgets keep the same category ID.
            </DialogDescription>
          </DialogHeader>
          <form id="rename-category-form" onSubmit={handleRename}>
            <FieldGroup>
              <Field data-invalid={renameName.trim().length < 2}>
                <FieldLabel htmlFor="rename-category-name">
                  Category name
                </FieldLabel>
                <Input
                  id="rename-category-name"
                  value={renameName}
                  onChange={(event) => setRenameName(event.target.value)}
                  maxLength={40}
                  aria-invalid={renameName.trim().length < 2}
                  autoFocus
                />
                {renameName.trim().length < 2 && (
                  <FieldError>Use at least two characters.</FieldError>
                )}
              </Field>
            </FieldGroup>
          </form>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={renaming}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form="rename-category-form"
              disabled={renaming || renameName.trim().length < 2}
            >
              <PencilIcon data-icon="inline-start" />
              {renaming ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteCategory !== undefined}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteCategory(undefined)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2Icon />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCategory?.name} can only be deleted when no transactions or
              budgets use it. This action cannot be undone.
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
              {deleting ? "Deleting..." : "Delete category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  if (isMobile) {
    return (
      <>
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
        {managementDialogs}
      </>
    )
  }

  return (
    <>
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
      {managementDialogs}
    </>
  )
}
