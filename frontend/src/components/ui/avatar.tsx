import type { HTMLAttributes, ImgHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Avatar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-[var(--surface-2)]', className)} {...props} />
}

export function AvatarImage({ className, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return <img className={cn('aspect-square h-full w-full object-cover', className)} {...props} />
}

export function AvatarFallback({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex h-full w-full items-center justify-center bg-[var(--acc-soft)] text-sm font-bold text-[var(--acc)]', className)} {...props} />
}
