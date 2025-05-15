import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError } from '@/lib/apiResponse';
import { revokeInvitation } from '@/services/invitationService';

interface WorkspaceInvitationActionRouteParams {
  workspaceId: string; // 사용되지는 않지만, 경로 구조상 존재
  invitationId: string;
}

// 특정 초대 취소(철회)
export const DELETE = withAuth<WorkspaceInvitationActionRouteParams>(
  async (
    request: Request,
    context: { params: Promise<WorkspaceInvitationActionRouteParams> },
    userId: string // currentUserId로 사용 (권한 검사용)
  ) => {
    try {
      const { invitationId } = await context.params;
      // const { workspaceId } = await context.params; // 필요시 사용

      if (!invitationId) {
        return handleApiError({ message: '초대 ID가 필요합니다.', statusCode: 400 });
      }

      await revokeInvitation(invitationId, userId);
      return new NextResponse(null, { status: 204 }); // 204 No Content
    } catch (error) {
      return handleApiError(error);
    }
  }
);
