import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError, handleApiSuccess } from '@/lib/apiResponse';
import { getWorkspaceUsers } from '@/services/workspaceService';

interface WorkspaceUsersRouteParams {
  workspaceId: string;
}

// 워크스페이스 멤버 목록 조회
export const GET = withAuth<WorkspaceUsersRouteParams>(
  async (
    request: Request,
    context: { params: Promise<WorkspaceUsersRouteParams> },
    userId: string
  ) => {
    try {
      const { workspaceId } = await context.params;
      if (!workspaceId) {
        return handleApiError({ message: '워크스페이스 ID가 필요합니다.', statusCode: 400 });
      }

      const users = await getWorkspaceUsers(workspaceId, userId);
      return handleApiSuccess(users);
    } catch (error) {
      return handleApiError(error);
    }
  }
);
