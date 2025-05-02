import { createWorkspace } from "@/services/workspaceService";
import { CreateWorkspaceSchema } from "@/lib/schemas/workspaceApiSchemas"; // Zod 스키마 경로

import {
  withAuth,
  type AuthenticatedApiHandlerWithParams,
} from "@/lib/authUtils";
import { validateData } from "@/lib/validationUtils"; // 추가
import { handleApiSuccess, handleApiError } from "@/lib/apiResponse"; // 추가

const postWorkspacesHandler: AuthenticatedApiHandlerWithParams<object> = async (
  request,
  context, // context.params를 사용하지 않지만, AuthenticatedApiHandlerWithParams 시그니처에 맞춤
  userId // withAuth를 통해 주입된 사용자 ID
) => {
  try {
    const body = await request.json();

    const { name } = validateData(
      body,
      CreateWorkspaceSchema,
      "요청 본문이 유효하지 않습니다."
    );

    const newWorkspace = await createWorkspace(userId, name); // userId 사용

    return handleApiSuccess(newWorkspace, 201);
  } catch (error) {
    console.error("[API POST /api/workspaces] specific error log:", error);

    return handleApiError(error, "워크스페이스 생성 중 오류가 발생했습니다."); // 기본 메시지 커스터마이징 가능
  }
};

export const POST = withAuth<object>(postWorkspacesHandler);
