import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const variants = {
  default: 'bg-[var(--acc)] text-[var(--on-acc)] shadow-[0_12px_30px_-12px_var(--acc)] hover:brightness-105',
  secondary: 'bg-[var(--surface-2)] text-[var(--label)] hover:bg-[var(--surface-3)]',
  outline: 'border border-[var(--sep-op)] bg-[var(--surface)] text-[var(--label)] hover:bg-[var(--surface-2)]',
  ghost: 'text-[var(--label-2)] hover:bg-[var(--surface-2)] hover:text-[var(--label)]',
  destructive: 'bg-[var(--orange)] text-black shadow-[0_12px_30px_-12px_var(--orange)] hover:brightness-105',
} as const

const sizes = {
  default: 'h-12 px-5 text-sm',
  sm: 'h-9 rounded-xl px-3.5 text-xs',
  lg: 'h-14 rounded-2xl px-6 text-base',
  icon: 'h-11 w-11 rounded-2xl p-0',
} as const

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'default', size = 'default', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl font-semibold tracking-[-0.01em] transition-all duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--acc)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})
