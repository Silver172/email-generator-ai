import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface BaseProps {
  label?: string
  error?: string
  hint?: string
}

export interface InputProps extends BaseProps, InputHTMLAttributes<HTMLInputElement> {}
export interface TextareaProps extends BaseProps, TextareaHTMLAttributes<HTMLTextAreaElement> {}

const fieldClass = (error?: string, extra?: string) =>
  cn(
    'w-full rounded-lg border bg-white/5 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500',
    'transition-colors duration-150 outline-none',
    error
      ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/10'
      : 'border-white/10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10',
    extra,
  )

function FieldWrapper({
  label,
  id,
  error,
  hint,
  children,
}: {
  label?: string
  id?: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-zinc-300">
          {label}
        </label>
      )}
      {children}
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-red-400">
          <span className="shrink-0">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 10.5a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm.75-3.75a.75.75 0 0 1-1.5 0V5.75a.75.75 0 0 1 1.5 0v2z" />
            </svg>
          </span>
          {error}
        </p>
      )}
      {hint && !error && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => (
    <FieldWrapper label={label} id={id} error={error} hint={hint}>
      <input id={id} ref={ref} className={fieldClass(error, className)} {...props} />
    </FieldWrapper>
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => (
    <FieldWrapper label={label} id={id} error={error} hint={hint}>
      <textarea id={id} ref={ref} className={fieldClass(error, cn('resize-none', className))} {...props} />
    </FieldWrapper>
  ),
)
Textarea.displayName = 'Textarea'
