import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Progress({ value = 0, className, ...props }: HTMLAttributes<HTMLDivElement> & { value?: number }) {
  const safeValue = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]', className)}
      {...props}
    >
      <div className="h-full rounded-full bg-gradient-to-r from-[var(--yellow)] to-[var(--acc)] transition-[width] duration-500 ease-out" style={{ width: `${safeValue}%` }} />
    </div>
  )
}
