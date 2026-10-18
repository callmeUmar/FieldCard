import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonVariants } from './buttonStyles'

export function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants
  children: ReactNode
}) {
  return (
    <button type="button" className={`${buttonVariants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
