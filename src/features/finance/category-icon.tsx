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

export function getCategoryIcon(category: string): LucideIcon {
  const normalized = category.toLowerCase()

  switch (normalized) {
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
      if (normalized.includes("food") || normalized.includes("dining")) {
        return SoupIcon
      }
      if (normalized.includes("transport")) return BusFrontIcon
      if (normalized.includes("house") || normalized.includes("housing")) {
        return HouseIcon
      }
      if (normalized.includes("shop")) return ShoppingBagIcon
      if (normalized.includes("health")) return HeartPulseIcon
      if (normalized.includes("salary") || normalized.includes("work")) {
        return BriefcaseBusinessIcon
      }
      return TagIcon
  }
}
