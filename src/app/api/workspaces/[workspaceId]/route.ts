import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError, handleApiSuccess } from '@/lib/apiResponse';
import { getWorkspaceById, updateWorkspace, deleteWorkspace } from '@/services/workspaceService';
import { z } from 'zod';
import { validateData } from '@/lib/validationUtils';

const UpdateWorkspaceSchema = z.object({
  name: z.string().min(1, '워크스페이스 이름은 필수입니다.'),
});

interface WorkspaceRouteParams {
  workspaceId: string;
}

// 워크스페이스 상세 정보 조회
export const GET = withAuth<WorkspaceRouteParams>(
  async (request: Request, context: { params: Promise<WorkspaceRouteParams> }, userId: string) => {
    try {
      const { workspaceId } = await context.params;
      if (!workspaceId) {
        return handleApiError({ message: '워크스페이스 ID가 필요합니다.', statusCode: 400 });
      }

      const workspace = await getWorkspaceById(userId, workspaceId);
      if (!workspace) {
        return handleApiError({
          message: '워크스페이스를 찾을 수 없거나 접근 권한이 없습니다.',
          statusCode: 404,
        });
      }
      return handleApiSuccess(workspace);
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// 워크스페이스 이름 변경
export const PUT = withAuth<WorkspaceRouteParams>(
  async (request: Request, context: { params: Promise<WorkspaceRouteParams> }, userId: string) => {
    try {
      const { workspaceId } = await context.params;
      if (!workspaceId) {
        return handleApiError({ message: '워크스페이스 ID가 필요합니다.', statusCode: 400 });
      }

      const body = await request.json();
      const validationResult = validateData(UpdateWorkspaceSchema, body);

      if (!validationResult.success) {
        return handleApiError({
          message: '잘못된 요청입니다.',
          details: validationResult.errors,
          statusCode: 400,
        });
      }

      const { name } = validationResult.data;

      const updatedWorkspace = await updateWorkspace(userId, workspaceId, name);
      return handleApiSuccess(updatedWorkspace);
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// 워크스페이스 삭제
export const DELETE = withAuth<WorkspaceRouteParams>(
  async (
    request: Request, // request 파라미터는 사용하지 않지만, withAuth 시그니처를 위해 유지
    context: { params: Promise<WorkspaceRouteParams> },
    userId: string
  ) => {
    try {
      const { workspaceId } = await context.params;
      if (!workspaceId) {
        return handleApiError({ message: '워크스페이스 ID가 필요합니다.', statusCode: 400 });
      }

      await deleteWorkspace(userId, workspaceId);
      // 성공 시 204 No Content 응답
      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return handleApiError(error);
    }
  }
);
