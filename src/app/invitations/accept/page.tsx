'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { postFetcher } from '@/lib/fetchers';

type Status = 'loading' | 'success' | 'error';

interface AcceptInvitationApiResponse {
  workspaceId?: string;
  message: string;
}

export default function AcceptInvitationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('유효하지 않은 토큰입니다.');
      return;
    }

    const accept = async () => {
      setStatus('loading');
      try {
        const apiResponse = await postFetcher<AcceptInvitationApiResponse, { token: string }>(
          '/api/invitations/accept',
          { arg: { token } }
        );

        setStatus('success');
        setMessage(apiResponse.message);
        setWorkspaceId(apiResponse.workspaceId);
      } catch (error: any) {
        setStatus('error');
        const errorMessage =
          error?.info?.message || error?.message || '초대 수락 중 오류가 발생했습니다.';
        setMessage(errorMessage);
        console.error('Failed to accept invitation:', error);
      }
    };

    accept();
  }, [token]);

  const handleGoToWorkspace = () => {
    if (workspaceId) {
      router.push(`/workspaces/${workspaceId}`);
    } else {
      router.push('/workspaces');
    }
  };

  const handleGoToLogin = () => {
    router.push('/auth/signin');
  };

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4'>
      <div className='bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center'>
        {status === 'loading' && (
          <>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto'></div>
            <p className='mt-4 text-lg font-semibold'>초대 수락 중...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <h1 className='text-2xl font-bold text-green-600 mb-4'>초대 수락 완료!</h1>
            <p className='text-gray-700 mb-6'>{message}</p>
            <Button onClick={handleGoToWorkspace} className='w-full'>
              워크스페이스로 이동
            </Button>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className='text-2xl font-bold text-red-600 mb-4'>오류 발생</h1>
            <p className='text-gray-700 mb-6'>{message}</p>
            <Button onClick={handleGoToLogin} className='w-full'>
              로그인 페이지로 이동
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
