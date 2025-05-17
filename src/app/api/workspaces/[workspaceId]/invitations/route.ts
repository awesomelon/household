import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError, handleApiSuccess } from '@/lib/apiResponse';
import { createInvitation, getPendingInvitationsForWorkspace } from '@/services/invitationService';
import { z } from 'zod';
import { validateData } from '@/lib/validationUtils';
import { WorkspaceRole } from '@prisma/client'; // WorkspaceRole enum import

interface WorkspaceInvitationsRouteParams {
  workspaceId: string;
}

const CreateInvitationSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력해주세요.'),
  role: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.MEMBER), // 기본 역할 MEMBER
});

// 워크스페이스에 사용자 초대
export const POST = withAuth<WorkspaceInvitationsRouteParams>(
  async (
    request: Request,
    context: { params: Promise<WorkspaceInvitationsRouteParams> },
    inviterId: string
  ) => {
    try {
      const { workspaceId } = await context.params;
      if (!workspaceId) {
        return handleApiError({ message: '워크스페이스 ID가 필요합니다.', statusCode: 400 });
      }

      const body = await request.json();
      const validationResult = validateData(body, CreateInvitationSchema);

      const validatedData = validationResult;

      const { email, role } = validatedData;

      const invitation = await createInvitation(inviterId, workspaceId, email, role);
      return handleApiSuccess(invitation, 201);
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// 워크스페이스의 보류 중인 초대 목록 조회
export const GET = withAuth<WorkspaceInvitationsRouteParams>(
  async (
    request: Request,
    context: { params: Promise<WorkspaceInvitationsRouteParams> },
    userId: string
  ) => {
    try {
      const { workspaceId } = await context.params;
      if (!workspaceId) {
        return handleApiError({ message: '워크스페이스 ID가 필요합니다.', statusCode: 400 });
      }

      // userId는 현재 로그인한 사용자 ID (권한 검사용)
      const pendingInvitations = await getPendingInvitationsForWorkspace(workspaceId, userId);
      return handleApiSuccess(pendingInvitations);
    } catch (error) {
      return handleApiError(error);
    }
  }
);
