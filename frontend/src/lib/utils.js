import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** Format a number with commas */
export function formatNumber(n) {
  if (n == null) return '—'
  return n.toLocaleString()
}

/** Format a date string */
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
