import { cn } from '@/lib/utils'

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-white/10 bg-surface p-6 shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }) {
  return <div className={cn('mb-4', className)} {...props}>{children}</div>
}

export function CardTitle({ className, children, ...props }) {
  return <h3 className={cn('text-lg font-semibold text-white', className)} {...props}>{children}</h3>
}

export function CardDescription({ className, children, ...props }) {
  return <p className={cn('text-sm text-gray-400', className)} {...props}>{children}</p>
}

export function CardContent({ className, children, ...props }) {
  return <div className={cn('', className)} {...props}>{children}</div>
}
