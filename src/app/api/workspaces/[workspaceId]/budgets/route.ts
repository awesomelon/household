import {
  BudgetSchema,
  GetBudgetsQuerySchema,
} from "@/lib/schemas/budgetApiSchemas";
import { WorkspaceIdParamSchema } from "@/lib/schemas/commonApiSchemas";
import { getBudgetsByMonth, upsertBudget } from "@/services/budgetService";

import {
  withAuth,
  type AuthenticatedApiHandlerWithParams,
} from "@/lib/authUtils";
import { validateData } from "@/lib/validationUtils";
import { handleApiSuccess, handleApiError } from "@/lib/apiResponse";

interface WorkspaceBudgetsParams {
  workspaceId: string;
}

const getWorkspaceBudgetsHandler: AuthenticatedApiHandlerWithParams<
  WorkspaceBudgetsParams
> = async (request, context, userId) => {
  try {
    const params = await context.params; // context.params를 await으로 추출
    const { workspaceId } = validateData(
      params, // 수정: context.params -> params
      WorkspaceIdParamSchema,
      "잘못된 워크스페이스 ID 형식입니다."
    );

    const { searchParams } = new URL(request.url);

    const { month } = validateData(
      Object.fromEntries(searchParams), // URLSearchParams를 객체로 변환하여 전달
      GetBudgetsQuerySchema,
      "쿼리 파라미터가 유효하지 않습니다."
    );

    const budgets = await getBudgetsByMonth(userId, workspaceId, month);
    return handleApiSuccess(budgets);
  } catch (error) {
    const routeWorkspaceId = "unknown";
    console.error(
      `[API GET /api/workspaces/${routeWorkspaceId}/budgets] specific error log:`, // 수정: context.params.workspaceId 제거 또는 안전하게 가져오도록 변경
      error
    );
    return handleApiError(error, "예산 조회 중 오류가 발생했습니다.");
  }
};

export const GET = withAuth<WorkspaceBudgetsParams>(getWorkspaceBudgetsHandler);

const postWorkspaceBudgetsHandler: AuthenticatedApiHandlerWithParams<
  WorkspaceBudgetsParams
> = async (request, context, userId) => {
  try {
    const params = await context.params; // context.params를 await으로 추출
    const { workspaceId } = validateData(
      params, // 수정: context.params -> params
      WorkspaceIdParamSchema,
      "잘못된 워크스페이스 ID 형식입니다."
    );

    const body = await request.json();

    // validateData 사용
    const validatedBody = validateData(
      body,
      BudgetSchema,
      "요청 본문이 유효하지 않습니다."
    );

    const budget = await upsertBudget(userId, workspaceId, validatedBody);
    return handleApiSuccess(budget, 201);
  } catch (error) {
    const routeWorkspaceId = "unknown";

    console.error(
      `[API POST /api/workspaces/${routeWorkspaceId}/budgets] specific error log:`, // 수정: context.params.workspaceId 제거 또는 안전하게 가져오도록 변경
      error
    );
    return handleApiError(error, "예산 저장 중 오류가 발생했습니다.");
  }
};

export const POST = withAuth<WorkspaceBudgetsParams>(
  postWorkspaceBudgetsHandler
);
