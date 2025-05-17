// src/components/ui/Button.tsx
import React from 'react';

const Button = ({
  children,
  type = 'button',
  onClick,
  variant = 'ghost',
  className = '',
  disabled = false,
  icon: Icon,
  size = 'md',
  ariaLabel,
}: {
  type?: 'button' | 'submit' | 'reset';
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'outline' | 'link';
  className?: string;
  disabled?: boolean;
  icon?: React.ElementType;
  size?: 'sm' | 'md' | 'lg' | 'icon';
  ariaLabel?: string;
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150';
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2',
  };
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-400 shadow-none',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    destructive: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    outline:
      'border border-gray-300 hover:bg-gray-100 text-gray-700 focus:ring-gray-400 bg-transparent shadow-none',
    link: 'text-blue-600 hover:underline focus:ring-blue-500 shadow-none bg-transparent',
  };
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';

  const currentBaseStyles =
    variant === 'link'
      ? 'inline-flex items-center justify-center font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150'
      : baseStyles;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${currentBaseStyles} ${sizeStyles[size]} ${
        variantStyles[variant || 'ghost']
      } ${disabledStyles} ${className}`}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
    >
      {Icon && <Icon className={`h-5 w-5 ${children ? 'mr-2' : ''}`} />}
      {children}
    </button>
  );
};

export default Button;
