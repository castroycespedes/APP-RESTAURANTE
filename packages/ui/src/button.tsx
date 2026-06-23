import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function Button({ children, style, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      style={{
        minHeight: 40,
        border: 0,
        borderRadius: 'var(--radius-md, 8px)',
        background: 'var(--color-button, var(--color-primary, #0f766e))',
        color: 'var(--color-primary-contrast, #ffffff)',
        padding: '0 16px',
        font: 'inherit',
        fontWeight: 700,
        cursor: 'pointer',
        ...style
      }}
    >
      {children}
    </button>
  );
}
