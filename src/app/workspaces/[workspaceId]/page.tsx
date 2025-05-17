'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WorkspaceRole } from '@prisma/client';

// API 응답 타입 (예시)
interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: any; // 상세 오류 정보
}

// User 인터페이스 (API 응답과 일치하도록)
interface User {
  id: string;
  name: string | null; // name은 null일 수 있음
  email: string | null; // email은 null일 수 있음
  role: WorkspaceRole; // 역할
  // image?: string | null; // 필요하다면 사용자 이미지
}

interface Workspace {
  id: string;
  name: string;
  currentUserRole?: WorkspaceRole; // 현재 사용자의 역할
}

interface InvitedBy {
  id: string;
  name: string | null;
  email: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: string; // 'PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED', 'EXPIRED' 등
  createdAt: string; // 또는 Date
  expiresAt: string; // 또는 Date
  invitedBy?: InvitedBy; // 초대한 사용자 정보 (선택적)
}

// Generic API fetch 함수
async function fetchApi<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, options);
    const responseData = await response.json().catch(() => ({})); // JSON 파싱 실패 대비

    if (!response.ok) {
      return {
        error:
          responseData.message || responseData.error || `HTTP error! status: ${response.status}`,
        details: responseData.details,
      };
    }
    // Prisma 등에서 data 필드 없이 직접 객체를 반환하는 경우 data 키가 없을 수 있음
    // success true/false로 구분하는 경우도 있음
    return { data: responseData.data !== undefined ? responseData.data : responseData };
  } catch (error) {
    console.error('API call failed:', error);
    return {
      error: error instanceof Error ? error.message : '알 수 없는 네트워크 오류가 발생했습니다.',
    };
  }
}

export default function WorkspaceManagePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params?.workspaceId as string;

  const [workspaceName, setWorkspaceName] = useState('');
  const [originalWorkspaceName, setOriginalWorkspaceName] = useState('');
  const [members, setMembers] = useState<User[]>([]);
  const [emailToInvite, setEmailToInvite] = useState('');
  const [roleToInvite, setRoleToInvite] = useState<WorkspaceRole>(WorkspaceRole.MEMBER);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      console.error('워크스페이스 ID가 URL에 없습니다.');
      alert('유효하지 않은 접근입니다. 워크스페이스 ID가 필요합니다.');
      router.push('/dashboard');
      return;
    }

    const fetchWorkspaceData = async () => {
      setIsLoading(true);

      const workspaceRes = await fetchApi<Workspace>(`/api/workspaces/${workspaceId}`);
      if (workspaceRes.error || !workspaceRes.data) {
        alert(`워크스페이스 정보 로딩 실패: ${workspaceRes.error || '데이터 없음'}`);
        setCurrentWorkspace(null);
        setIsLoading(false);
        return;
      }
      const workspaceData = workspaceRes.data;
      setCurrentWorkspace(workspaceData);
      setWorkspaceName(workspaceData.name);
      setOriginalWorkspaceName(workspaceData.name);

      const membersRes = await fetchApi<User[]>(`/api/workspaces/${workspaceId}/users`);
      if (membersRes.error || !membersRes.data) {
        alert(`멤버 목록 로딩 실패: ${membersRes.error || '데이터 없음'}`);
        setMembers([]);
      } else {
        setMembers(membersRes.data);
      }

      if (workspaceData.currentUserRole === WorkspaceRole.ADMIN) {
        const invitationsRes = await fetchApi<Invitation[]>(
          `/api/workspaces/${workspaceId}/invitations`
        );
        if (invitationsRes.error || !invitationsRes.data) {
          alert(`초대 목록 로딩 실패: ${invitationsRes.error || '데이터 없음'}`);
          setPendingInvitations([]);
        } else {
          setPendingInvitations(invitationsRes.data);
        }
      }

      setIsLoading(false);
    };

    fetchWorkspaceData();
  }, [workspaceId, router]);

  const handleUpdateWorkspaceName = async () => {
    if (
      !currentWorkspace ||
      !workspaceName.trim() ||
      workspaceName.trim() === originalWorkspaceName
    ) {
      alert('새 워크스페이스 이름을 입력해주세요 또는 변경된 내용이 없습니다.');
      return;
    }
    setIsSubmitting(true);
    const result = await fetchApi<Workspace>(`/api/workspaces/${currentWorkspace.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: workspaceName.trim() }),
    });
    setIsSubmitting(false);

    if (result.error || !result.data) {
      alert(`워크스페이스 이름 수정 실패: ${result.error || '응답 없음'}`);
    } else {
      alert('워크스페이스 이름이 수정되었습니다.');
      setCurrentWorkspace(result.data);
      setOriginalWorkspaceName(result.data.name);
      setWorkspaceName(result.data.name);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace || deleteConfirmName !== originalWorkspaceName) {
      alert('워크스페이스 이름이 일치하지 않습니다.');
      return;
    }

    const confirmed = confirm(
      `정말로 '${originalWorkspaceName}' 워크스페이스를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
    );
    if (!confirmed) {
      setDeleteConfirmName('');
      return;
    }

    setIsSubmitting(true);
    const result = await fetchApi<void>(`/api/workspaces/${currentWorkspace.id}`, {
      method: 'DELETE',
    });
    setIsSubmitting(false);

    if (result.error) {
      alert(`워크스페이스 삭제 실패: ${result.error}`);
    } else {
      alert('워크스페이스가 삭제되었습니다.');
      router.push('/dashboard');
    }
  };

  const handleInviteUser = async () => {
    if (!currentWorkspace || !emailToInvite.trim()) {
      alert('초대할 사용자의 이메일을 입력해주세요.');
      return;
    }

    const trimmedEmail = emailToInvite.trim();
    console.log('Trimmed email for validation:', `'${trimmedEmail}'`); // 실제 값 확인을 위해 ``으로 감쌈

    const emailRegex = new RegExp(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // RegExp 객체 사용

    if (!emailRegex.test(trimmedEmail)) {
      alert('유효한 이메일 주소를 입력해주세요. 입력값: ' + trimmedEmail);
      return;
    }

    setIsSubmitting(true);
    const result = await fetchApi<Invitation>(
      `/api/workspaces/${currentWorkspace.id}/invitations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, role: roleToInvite }),
      }
    );
    setIsSubmitting(false);

    if (result.error || !result.data) {
      alert(
        `사용자 초대 실패: ${result.error || '응답 없음'}\n${
          result.details ? JSON.stringify(result.details) : ''
        }`
      );
    } else {
      alert(`'${trimmedEmail}'님에게 초대를 보냈습니다. 역할: ${roleToInvite}`);
      setEmailToInvite('');
      setPendingInvitations((prev) => [result.data!, ...prev]);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!currentWorkspace || currentWorkspace.currentUserRole !== WorkspaceRole.ADMIN) {
      alert('초대를 취소할 권한이 없습니다.');
      return;
    }
    const invitationToRevoke = pendingInvitations.find((inv) => inv.id === invitationId);
    if (!invitationToRevoke) return;

    const confirmed = confirm(
      `정말로 '${invitationToRevoke.email}'님에게 보낸 초대를 취소하시겠습니까?`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    const result = await fetchApi<void>(`/api/invitations/${invitationId}`, { method: 'DELETE' });
    setIsSubmitting(false);

    if (result.error) {
      alert(`초대 취소 실패: ${result.error}`);
    } else {
      alert('초대가 성공적으로 취소되었습니다.');
      setPendingInvitations(pendingInvitations.filter((inv) => inv.id !== invitationId));
    }
  };

  const handleRemoveUser = async (userIdToRemove: string) => {
    if (!currentWorkspace) return;

    const userToRemove = members.find((u) => u.id === userIdToRemove);
    if (!userToRemove) return;

    if (userToRemove.id === currentWorkspace.currentUserRole) {
    }

    const confirmed = confirm(
      `정말로 '${
        userToRemove.name || userToRemove.email
      }' 사용자를 워크스페이스에서 제외하시겠습니까?`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    const result = await fetchApi<void>(
      `/api/workspaces/${currentWorkspace.id}/users/${userIdToRemove}`,
      { method: 'DELETE' }
    );
    setIsSubmitting(false);

    if (result.error) {
      alert(`사용자 제외 실패: ${result.error}`);
    } else {
      setMembers(members.filter((user) => user.id !== userIdToRemove));
      alert('사용자가 워크스페이스에서 제외되었습니다.');
    }
  };

  if (isLoading) {
    return <div className='container mx-auto p-8 text-center'>로딩 중...</div>;
  }

  if (!currentWorkspace) {
    return (
      <div className='container mx-auto p-8 text-center'>
        <p className='text-red-500'>워크스페이스 정보를 불러오지 못했습니다.</p>
        <Button onClick={() => router.push('/dashboard')} className='mt-4'>
          대시보드로 돌아가기
        </Button>
      </div>
    );
  }

  const isAdmin = currentWorkspace.currentUserRole === WorkspaceRole.ADMIN;

  return (
    <div className='container mx-auto p-4 md:p-8'>
      <h1 className='text-3xl font-bold mb-8'>워크스페이스 관리: {originalWorkspaceName}</h1>

      <section className='mb-12'>
        <h2 className='text-2xl font-semibold mb-4'>워크스페이스 설정</h2>
        <div className='space-y-4 max-w-md'>
          <div>
            <Label htmlFor='workspaceName'>워크스페이스 이름</Label>
            <Input
              id='workspaceName'
              type='text'
              value={workspaceName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setWorkspaceName(e.target.value)}
              className='mt-1'
              disabled={!isAdmin || isSubmitting}
            />
          </div>
          <Button
            onClick={handleUpdateWorkspaceName}
            disabled={
              !isAdmin ||
              isSubmitting ||
              workspaceName.trim() === originalWorkspaceName ||
              !workspaceName.trim()
            }
          >
            {isSubmitting ? '저장 중...' : '이름 변경 저장'}
          </Button>
        </div>
      </section>

      <Separator className='my-8' />

      {isAdmin && (
        <section className='mb-12'>
          <h2 className='text-2xl font-semibold mb-4'>멤버 초대</h2>
          <div className='space-y-4 max-w-md'>
            <div>
              <Label htmlFor='emailToInvite'>이메일 주소</Label>
              <Input
                id='emailToInvite'
                type='email'
                placeholder='초대할 사용자의 이메일'
                value={emailToInvite}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailToInvite(e.target.value)}
                disabled={isSubmitting}
                className='mt-1'
              />
            </div>
            <div>
              <Label htmlFor='roleToInvite'>역할</Label>
              <select
                id='roleToInvite'
                value={roleToInvite}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setRoleToInvite(e.target.value as WorkspaceRole)
                }
                disabled={isSubmitting}
                className='mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white'
              >
                <option value={WorkspaceRole.ADMIN}>Admin</option>
                <option value={WorkspaceRole.MEMBER}>Member</option>
              </select>
            </div>
            <Button onClick={handleInviteUser} disabled={isSubmitting || !emailToInvite.trim()}>
              {isSubmitting ? '초대 중...' : '초대 보내기'}
            </Button>
          </div>
        </section>
      )}
      {isAdmin && <Separator className='my-8' />}

      {isAdmin && pendingInvitations.length > 0 && (
        <section className='mb-12'>
          <h2 className='text-2xl font-semibold mb-4'>
            처리 대기중인 초대 ({pendingInvitations.length}건)
          </h2>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이메일</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>초대일</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead>초대한 사람</TableHead>
                  <TableHead className='text-right'>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>{invitation.role}</TableCell>
                    <TableCell>{invitation.status}</TableCell>
                    <TableCell>{new Date(invitation.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(invitation.expiresAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {invitation.invitedBy?.name || invitation.invitedBy?.email || '-'}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleRevokeInvitation(invitation.id)}
                        disabled={isSubmitting}
                      >
                        초대 취소
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
      {isAdmin && pendingInvitations.length > 0 && <Separator className='my-8' />}

      <section className='mb-12'>
        <h2 className='text-2xl font-semibold mb-4'>멤버 관리 ({members.length}명)</h2>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>역할</TableHead>
                {isAdmin && <TableHead className='text-right'>작업</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length > 0 ? (
                members.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name || '-'}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    {isAdmin && (
                      <TableCell className='text-right'>
                        <Button
                          variant='destructive'
                          size='sm'
                          onClick={() => handleRemoveUser(user.id)}
                          disabled={isSubmitting || !isAdmin}
                        >
                          {isSubmitting ? '처리 중...' : '내보내기'}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 4 : 3} className='text-center'>
                    워크스페이스에 멤버가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Separator className='my-8' />

      {isAdmin && (
        <section>
          <h2 className='text-2xl font-semibold mb-4'>워크스페이스 삭제</h2>
          <div className='p-4 border border-destructive/50 rounded-lg bg-destructive/5'>
            <p className='text-sm text-destructive mb-4'>
              이 작업은 되돌릴 수 없습니다. 워크스페이스를 삭제하면 모든 관련 데이터가 영구적으로
              제거됩니다.
            </p>
            <Dialog onOpenChange={(open) => !open && setDeleteConfirmName('')}>
              <DialogTrigger asChild>
                <Button variant='destructive' disabled={isSubmitting}>
                  워크스페이스 삭제
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>정말로 워크스페이스를 삭제하시겠습니까?</DialogTitle>
                  <DialogDescription>
                    이 작업은 되돌릴 수 없습니다. 워크스페이스와 관련된 모든 데이터가 영구적으로
                    삭제됩니다. 진행하려면 아래에 워크스페이스 이름{' '}
                    <span className='font-semibold text-foreground'>{originalWorkspaceName}</span>
                    을(를) 정확히 입력해주세요.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  type='text'
                  value={deleteConfirmName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setDeleteConfirmName(e.target.value)
                  }
                  placeholder={originalWorkspaceName}
                  className='my-4'
                  disabled={isSubmitting}
                />
                <DialogFooter>
                  <Button
                    variant='outline'
                    onClick={() => {
                      const closeButton = document.querySelector(
                        '[data-radix-dialog-default-open="true"] button[aria-label="Close"]'
                      ) as HTMLElement;
                      if (closeButton) closeButton.click();
                    }}
                    disabled={isSubmitting}
                  >
                    취소
                  </Button>
                  <Button
                    variant='destructive'
                    onClick={handleDeleteWorkspace}
                    disabled={isSubmitting || deleteConfirmName !== originalWorkspaceName}
                  >
                    {isSubmitting ? '삭제 중...' : '삭제 확인'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>
      )}
    </div>
  );
}
