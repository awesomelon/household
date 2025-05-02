// API 라우트 핸들러: /api/workspaces/[workspaceId]/budgets/[budgetId]
import { deleteBudget } from "@/services/budgetService";
import {
  BudgetIdParamSchema,
  WorkspaceIdParamSchema,
} from "@/lib/schemas/commonApiSchemas";
import {
  withAuth,
  type AuthenticatedApiHandlerWithParams,
} from "@/lib/authUtils";
import { validateData } from "@/lib/validationUtils";
import { handleApiSuccess, handleApiError } from "@/lib/apiResponse";

interface SingleBudgetParams {
  workspaceId: string;
  budgetId: string;
}

const deleteSingleBudgetHandler: AuthenticatedApiHandlerWithParams<
  SingleBudgetParams
> = async (request, context, userId) => {
  // workspaceId와 budgetId를 미리 추출하여 catch 블록에서도 사용할 수 있도록 함
  let workspaceIdForLog: string | undefined;
  let budgetIdForLog: string | undefined;

  try {
    const params = await context.params;
    const { workspaceId, budgetId: rawBudgetId } = params;
    workspaceIdForLog = workspaceId; // 로깅을 위해 할당 (params에서 가져옴)
    budgetIdForLog = rawBudgetId; // 로깅을 위해 할당 (params에서 가져옴)

    const { workspaceId: validatedWorkspaceId } = validateData(
      { workspaceId },
      WorkspaceIdParamSchema,
      "잘못된 워크스페이스 ID 형식입니다."
    );
    const { id: validatedBudgetId } = validateData(
      { id: rawBudgetId },
      BudgetIdParamSchema,
      "잘못된 예산 ID 형식입니다."
    );

    await deleteBudget(userId, validatedWorkspaceId, validatedBudgetId);
    return handleApiSuccess({
      success: true,
      message: "예산이 성공적으로 삭제되었습니다.",
    });
  } catch (error) {
    // context.params 대신 try 블록에서 추출한 변수 사용
    console.error(
      `[API DELETE /api/workspaces/${
        workspaceIdForLog || "{unknown_ws}"
      }/budgets/${budgetIdForLog || "{unknown_b}"}] specific error log:`,
      error
    );
    return handleApiError(error, "예산 삭제 중 오류가 발생했습니다.");
  }
};

export const DELETE = withAuth<SingleBudgetParams>(deleteSingleBudgetHandler);
