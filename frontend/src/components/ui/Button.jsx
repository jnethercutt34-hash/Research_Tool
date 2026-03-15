import { cn } from '@/lib/utils'
import { cva } from 'class-variance-authority'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-maroon text-white hover:bg-maroon-light',
        secondary: 'bg-surface-light text-gray-200 hover:bg-gray-700',
        ghost: 'text-gray-400 hover:text-white hover:bg-surface-light',
        outline: 'border border-white/10 text-gray-200 hover:bg-surface-light',
        gold: 'bg-gold text-gray-900 hover:bg-gold-light font-semibold',
      },
      size: {
        default: 'h-10 px-4 text-sm',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export function Button({ className, variant, size, children, ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </button>
  )
}
