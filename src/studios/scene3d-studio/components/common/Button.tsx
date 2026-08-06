import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'soft' | 'ghost' | 'clay' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`uk-btn uk-btn--${variant} ${size === 'sm' ? 'uk-btn--sm' : size === 'lg' ? 'uk-btn--lg' : ''} ${
        loading ? 'uk-btn--loading' : ''
      } ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {icon && <span className="uk-btn__icon">{icon}</span>}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Tooltip text   " mandatory on all icon buttons (Doc 05   2). */
  tooltip: string;
  active?: boolean;
  children: ReactNode;
}

export function IconButton({ tooltip, active, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      /* SSOT canonical class is .icon-btn; .uk-iconbtn kept for legacy selectors. */
      className={`icon-btn uk-iconbtn ${active ? 'active uk-iconbtn--active' : ''} ${className}`}
      data-tooltip={tooltip}
      aria-label={tooltip}
      /* only a genuine toggle exposes pressed state */
      aria-pressed={active === undefined ? undefined : active}
      {...rest}
    />
  );
}
