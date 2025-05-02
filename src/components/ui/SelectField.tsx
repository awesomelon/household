// src/components/ui/SelectField.tsx
import React from 'react';

type Option = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  id: string;
  name: string;
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Option[];
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export default function SelectField({
  id,
  name,
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  error,
  className = '',
}: SelectFieldProps) {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label htmlFor={id} className='block text-gray-700 mb-2'>
          {label}
          {required && <span className='text-red-500 ml-1'>*</span>}
        </label>
      )}
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
          ${
            error
              ? 'border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
        `}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className='mt-1 text-sm text-red-500'>{error}</p>}
    </div>
  );
}
