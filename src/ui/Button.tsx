import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  block?: boolean;
}

export function Button({ variant = 'primary', size = 'md', block, className, type = 'button', ...rest }: ButtonProps) {
  const classes = [
    'ui-btn',
    `ui-btn--${variant}`,
    size === 'sm' ? 'ui-btn--sm' : '',
    block ? 'ui-btn--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}

export function IconButton({ className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`ui-iconbtn${className ? ` ${className}` : ''}`} {...rest} />;
}
