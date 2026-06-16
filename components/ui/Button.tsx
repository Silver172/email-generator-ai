import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 font-medium rounded-lg',
        'transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0f]',
        'disabled:opacity-40 disabled:cursor-not-allowed select-none',

        variant === 'primary' && [
          'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700',
          'focus:ring-indigo-500',
        ],
        variant === 'secondary' && [
          'bg-white/5 border border-white/10 text-zinc-200',
          'hover:bg-white/10 hover:border-white/20',
          'focus:ring-zinc-500',
        ],
        variant === 'ghost' && [
          'text-zinc-400 hover:text-zinc-200 hover:bg-white/5',
          'focus:ring-zinc-500',
        ],
        variant === 'danger' && [
          'bg-red-600/10 border border-red-500/20 text-red-400',
          'hover:bg-red-600 hover:text-white hover:border-transparent',
          'focus:ring-red-500',
        ],

        size === 'sm' && 'px-3 py-1.5 text-xs',
        size === 'md' && 'px-4 py-2 text-sm',
        size === 'lg' && 'px-5 py-2.5 text-sm w-full',

        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
