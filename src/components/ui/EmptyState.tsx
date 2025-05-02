// src/components/ui/EmptyState.tsx
import React from 'react';
import Button from './Button';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
};

export default function EmptyState({
  title,
  description,
  icon,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div className='text-center py-12 bg-gray-50 rounded-lg'>
      {icon && <div className='mb-4 text-gray-400'>{icon}</div>}
      <h3 className='text-lg font-medium text-gray-900'>{title}</h3>
      {description && <p className='mt-2 text-sm text-gray-500'>{description}</p>}
      {actionText && onAction && (
        <div className='mt-4'>
          <Button onClick={onAction} variant='primary'>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
}
