// src/components/ui/Toast.tsx
import React, { useEffect } from 'react';
import Button from './Button';

type ToastProps = {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
};

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  // 타입에 따른 스타일
  const typeStyles = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  // 지정된 시간 후 토스트 닫기
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className='fixed bottom-4 right-4 z-50 animate-fade-in-up'>
      <div
        className={`${typeStyles[type]} text-white py-2 px-4 rounded-md shadow-lg flex items-center`}
      >
        <span>{message}</span>
        <Button
          onClick={onClose}
          className='ml-3 text-white text-xl font-bold opacity-70 hover:opacity-100'
          aria-label='닫기'
        >
          ×
        </Button>
      </div>
    </div>
  );
}
