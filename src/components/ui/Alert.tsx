// src/components/ui/Alert.tsx
import React from 'react';
import Button from './Button';

type AlertProps = {
  children: React.ReactNode;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
  className?: string;
};

export default function Alert({ children, type, onClose, className = '' }: AlertProps) {
  // 타입에 따른 스타일
  const typeStyles = {
    success: 'bg-green-100 border-green-400 text-green-700',
    error: 'bg-red-100 border-red-400 text-red-700',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700',
    info: 'bg-blue-100 border-blue-400 text-blue-700',
  };

  return (
    <div className={`border px-4 py-3 rounded mb-4 ${typeStyles[type]} ${className}`}>
      <div className='flex justify-between items-center'>
        <div>{children}</div>
        {onClose && (
          <Button
            onClick={onClose}
            className='ml-4 text-sm opacity-70 hover:opacity-100'
            aria-label='닫기'
          >
            ×
          </Button>
        )}
      </div>
    </div>
  );
}
