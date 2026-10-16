import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={`btn btn-${variant} ${className}`} {...props} />;
}
export function ButtonLink({
  to,
  children,
  variant = 'primary',
  className = '',
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  return (
    <Link className={`btn btn-${variant} ${className}`} to={to}>
      {children}
    </Link>
  );
}
