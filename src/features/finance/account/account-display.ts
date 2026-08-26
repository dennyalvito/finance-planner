export function accountLabel(email?: string) {
  return email ?? "Cloud account"
}

export function accountInitials(value?: string) {
  if (!value) return "CO"
  return value.slice(0, 2).toUpperCase()
}
