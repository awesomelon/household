import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError, handleApiSuccess } from '@/lib/apiResponse';
import { createInvitation, getPendingInvitationsForWorkspace } from '@/services/invitationService';
import { z } from 'zod';
import { validateData } from '@/lib/validationUtils';
import { WorkspaceRole } from '@prisma/client'; // WorkspaceRole Enum 가져오기

interface WorkspaceInvitationsRouteParams {
  workspaceId: string;
}

const CreateInvitationSchema = z.object({
  inviteeEmail: z.string().email('유효한 이메일 주소를 입력해주세요.'),
  role: z.nativeEnum(WorkspaceRole), // Prisma Enum 사용
});

// 새 초대 생성 및 이메일 발송
export const POST = withAuth<WorkspaceInvitationsRouteParams>(
  async (
    request: Request,
    context: { params: Promise<WorkspaceInvitationsRouteParams> },
    userId: string // inviterId로 사용
  ) => {
    try {
      const { workspaceId } = await context.params;
      if (!workspaceId) {
        return handleApiError({ message: '워크스페이스 ID가 필요합니다.', statusCode: 400 });
      }

      const body = await request.json();
      const validationResult = validateData(CreateInvitationSchema, body);

      if (!validationResult.success) {
        return handleApiError({
          message: '잘못된 요청입니다.',
          details: validationResult.errors,
          statusCode: 400,
        });
      }

      const { inviteeEmail, role } = validationResult.data;

      const newInvitation = await createInvitation(userId, workspaceId, inviteeEmail, role);
      return handleApiSuccess(newInvitation, 201); // 201 Created
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// 해당 워크스페이스의 PENDING 상태인 초대 목록 조회 (ADMIN 전용)
export const GET = withAuth<WorkspaceInvitationsRouteParams>(
  async (
    request: Request,
    context: { params: Promise<WorkspaceInvitationsRouteParams> },
    userId: string // currentUserId로 사용 (권한 검사용)
  ) => {
    try {
      const { workspaceId } = await context.params;
      if (!workspaceId) {
        return handleApiError({ message: '워크스페이스 ID가 필요합니다.', statusCode: 400 });
      }

      const pendingInvitations = await getPendingInvitationsForWorkspace(workspaceId, userId);
      return handleApiSuccess(pendingInvitations);
    } catch (error) {
      return handleApiError(error);
    }
  }
);
