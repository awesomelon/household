import { GetInsightsQuerySchema } from "@/lib/schemas/insightApiSchemas";
import { WorkspaceIdParamSchema } from "@/lib/schemas/commonApiSchemas";

import insightGenerationService from "@/services/insightGenerationService";

import {
  withAuth,
  type AuthenticatedApiHandlerWithParams,
} from "@/lib/authUtils";
import { validateData } from "@/lib/validationUtils";
import { handleApiSuccess, handleApiError } from "@/lib/apiResponse";

interface WorkspaceInsightsParams {
  workspaceId: string;
}

const getWorkspaceInsightsHandler: AuthenticatedApiHandlerWithParams<
  WorkspaceInsightsParams
> = async (request, context, userId) => {
  try {
    const params = await context.params;
    const { workspaceId } = validateData(
      params,
      WorkspaceIdParamSchema,
      "잘못된 워크스페이스 ID 형식입니다."
    );

    const { searchParams } = new URL(request.url);
    const { month } = validateData(
      Object.fromEntries(searchParams.entries()),
      GetInsightsQuerySchema,
      "요청 파라미터가 유효하지 않습니다."
    );

    const insights = await insightGenerationService.generateInsights(
      userId,
      workspaceId,
      month
    );
    return handleApiSuccess({ insights });
  } catch (error) {
    const routeWorkspaceId = "unknown";
    console.error(
      `[API GET /api/workspaces/${routeWorkspaceId}/insights] specific error log:`,
      error
    );
    return handleApiError(error, "인사이트 조회 중 오류가 발생했습니다.");
  }
};

export const GET = withAuth<WorkspaceInsightsParams>(
  getWorkspaceInsightsHandler
);
