// src/components/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';
import Button from './ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className='p-4 bg-red-50 border border-red-200 rounded-lg'>
          <h2 className='text-lg font-medium text-red-600 mb-2'>오류가 발생했습니다</h2>
          <p className='text-red-500 text-sm'>
            {this.state.error?.message ||
              '알 수 없는 오류가 발생했습니다. 페이지를 새로고침해 주세요.'}
          </p>
          <Button
            onClick={() => this.setState({ hasError: false })}
            className='mt-3 px-4 py-2 bg-red-100 text-red-600 text-sm rounded hover:bg-red-200'
          >
            다시 시도
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
