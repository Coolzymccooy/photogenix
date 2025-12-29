
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  // Rule 6.1: Sharp corners (rounded-sm). Rule 7.2: Fast transitions.
  const baseStyles = "inline-flex items-center justify-center rounded-sm font-medium transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-signal disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wide font-mono text-xs";
  
  // Rule 3.1: Roles. Signal (Indigo) for primary. Line (Zinc 800) for secondary.
  const variants = {
    primary: "bg-signal text-white hover:bg-indigo-600 border border-transparent",
    secondary: "bg-transparent text-zinc-300 border border-line hover:border-zinc-500 hover:text-white hover:bg-surface",
    ghost: "bg-transparent hover:bg-surface text-zinc-500 hover:text-zinc-200 border border-transparent",
    danger: "bg-red-950/50 text-red-400 border border-red-900 hover:bg-red-900",
  };

  const sizes = {
    sm: "px-3 py-2",
    md: "px-5 py-3",
    lg: "px-8 py-4",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 bg-current rounded-sm animate-spin"></span>
          WAIT
        </span>
      ) : icon ? (
        <span className="mr-2 opacity-80">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};
