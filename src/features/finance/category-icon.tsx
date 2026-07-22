import type { LucideIcon } from "lucide-react"
import {
  BriefcaseBusinessIcon,
  BusFrontIcon,
  CircleDollarSignIcon,
  GiftIcon,
  HeartPulseIcon,
  HouseIcon,
  ShoppingBagIcon,
  SoupIcon,
  SparklesIcon,
  TagIcon,
} from "lucide-react"

export function getCategoryIcon(categoryId: string): LucideIcon {
  switch (categoryId) {
    case "salary":
      return BriefcaseBusinessIcon
    case "freelance":
      return CircleDollarSignIcon
    case "gift":
      return GiftIcon
    case "food":
      return SoupIcon
    case "transport":
      return BusFrontIcon
    case "housing":
      return HouseIcon
    case "shopping":
      return ShoppingBagIcon
    case "health":
      return HeartPulseIcon
    case "leisure":
      return SparklesIcon
    default:
      return TagIcon
  }
}
