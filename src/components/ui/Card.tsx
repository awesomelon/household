// src/components/ui/Card.tsx
import React from 'react';

const Card = ({
  children,
  title,
  className = '',
  actions,
  noPadding = false,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
  actions?: React.ReactNode;
  noPadding?: boolean;
}) => (
  <div className={`bg-white rounded-xl shadow-lg ${className}`}>
    {(title || actions) && (
      <div className='px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex justify-between items-center'>
        {title && <h3 className='text-base sm:text-lg font-semibold text-gray-800'>{title}</h3>}
        {actions && <div className='flex items-center gap-2'>{actions}</div>}
      </div>
    )}
    <div className={noPadding ? '' : 'p-4 sm:p-6'}>{children}</div>
  </div>
);

export default Card;
