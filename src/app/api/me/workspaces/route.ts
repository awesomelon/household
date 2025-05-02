import { getUserWorkspaces } from "@/services/workspaceService";

import {
  withAuth,
  type AuthenticatedApiHandlerWithParams,
} from "@/lib/authUtils";
import { handleApiSuccess, handleApiError } from "@/lib/apiResponse";

const getMyWorkspacesHandler: AuthenticatedApiHandlerWithParams<
  object
> = async (
  request, // 사용하지 않지만 시그니처 유지를 위해 포함
  context, // 사용하지 않지만 시그니처 유지를 위해 포함
  userId // withAuth를 통해 주입된 사용자 ID
) => {
  try {
    const workspaces = await getUserWorkspaces(userId);
    return handleApiSuccess(workspaces);
  } catch (error) {
    console.error("[API GET /api/me/workspaces] specific error log:", error);
    return handleApiError(
      error,
      "워크스페이스 목록 조회 중 오류가 발생했습니다."
    );
  }
};

export const GET = withAuth<object>(getMyWorkspacesHandler);
