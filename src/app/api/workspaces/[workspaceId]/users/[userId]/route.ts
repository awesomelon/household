import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError } from '@/lib/apiResponse';
import { removeUserFromWorkspace } from '@/services/workspaceService';

interface WorkspaceUserActionRouteParams {
  workspaceId: string;
  userId: string; // 제거 대상 사용자 ID
}

// 워크스페이스에서 사용자 제거
export const DELETE = withAuth<WorkspaceUserActionRouteParams>(
  async (
    request: Request,
    context: { params: Promise<WorkspaceUserActionRouteParams> },
    currentUserId: string
  ) => {
    try {
      const { workspaceId, userId: userIdToRemove } = await context.params;
      if (!workspaceId || !userIdToRemove) {
        return handleApiError({
          message: '워크스페이스 ID와 사용자 ID는 필수입니다.',
          statusCode: 400,
        });
      }

      await removeUserFromWorkspace(workspaceId, userIdToRemove, currentUserId);
      return new NextResponse(null, { status: 204 }); // 성공 시 204 No Content
    } catch (error) {
      return handleApiError(error);
    }
  }
);
