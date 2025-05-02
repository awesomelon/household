import {
  UpdateTransactionSchema,
  TransactionIdParamSchema,
} from "@/lib/schemas/transactionsApiSchemas";
import { WorkspaceIdParamSchema } from "@/lib/schemas/commonApiSchemas";
import {
  updateTransaction,
  deleteTransaction,
  getTransactionById,
} from "@/services/transactionService";
import {
  withAuth,
  type AuthenticatedApiHandlerWithParams,
} from "@/lib/authUtils";
import { validateData } from "@/lib/validationUtils";
import { handleApiSuccess, handleApiError } from "@/lib/apiResponse";

interface SingleTransactionParams {
  workspaceId: string;
  transactionId: string;
}

const getSingleTransactionHandler: AuthenticatedApiHandlerWithParams<
  SingleTransactionParams
> = async (request, context, userId) => {
  try {
    const params = await context.params;
    const { workspaceId, transactionId: rawTransactionId } = params;
    const { workspaceId: validatedWorkspaceId } = validateData(
      { workspaceId },
      WorkspaceIdParamSchema,
      "잘못된 워크스페이스 ID 형식입니다."
    );
    const { id: validatedTransactionId } = validateData(
      { id: rawTransactionId },
      TransactionIdParamSchema,
      "잘못된 거래 ID 형식입니다."
    );
    const transaction = await getTransactionById(
      userId,
      validatedWorkspaceId,
      validatedTransactionId
    );
    return handleApiSuccess(transaction);
  } catch (error) {
    const routeWorkspaceId = "unknown";
    const routeTransactionId = "unknown";
    console.error(
      `[API GET /api/workspaces/${routeWorkspaceId}/transactions/${routeTransactionId}] specific error log:`,
      error
    );
    return handleApiError(error, "거래 내역 조회 중 오류가 발생했습니다.");
  }
};
export const GET = withAuth<SingleTransactionParams>(
  getSingleTransactionHandler
);

const putSingleTransactionHandler: AuthenticatedApiHandlerWithParams<
  SingleTransactionParams
> = async (request, context, userId) => {
  try {
    const params = await context.params;
    const { workspaceId, transactionId: rawTransactionId } = params;
    const { workspaceId: validatedWorkspaceId } = validateData(
      { workspaceId },
      WorkspaceIdParamSchema,
      "잘못된 워크스페이스 ID 형식입니다."
    );
    const { id: validatedTransactionId } = validateData(
      { id: rawTransactionId },
      TransactionIdParamSchema,
      "잘못된 내역 ID 형식입니다."
    );
    const validatedBody = validateData(
      await request.json(),
      UpdateTransactionSchema,
      "요청 본문이 유효하지 않습니다."
    );
    const updatedData = await updateTransaction(
      userId,
      validatedWorkspaceId,
      validatedTransactionId,
      validatedBody
    );
    return handleApiSuccess(updatedData);
  } catch (error) {
    const routeWorkspaceId = "unknown";
    const routeTransactionId = "unknown";
    console.error(
      `[API PUT /api/workspaces/${routeWorkspaceId}/transactions/${routeTransactionId}] specific error log:`,
      error
    );
    return handleApiError(error, "거래 내역 수정 중 오류가 발생했습니다.");
  }
};
export const PUT = withAuth<SingleTransactionParams>(
  putSingleTransactionHandler
);

const deleteSingleTransactionHandler: AuthenticatedApiHandlerWithParams<
  SingleTransactionParams
> = async (request, context, userId) => {
  try {
    const params = await context.params;
    const { workspaceId, transactionId: rawTransactionId } = params;
    const { workspaceId: validatedWorkspaceId } = validateData(
      { workspaceId },
      WorkspaceIdParamSchema,
      "잘못된 워크스페이스 ID 형식입니다."
    );
    const { id: validatedTransactionId } = validateData(
      { id: rawTransactionId },
      TransactionIdParamSchema,
      "잘못된 내역 ID 형식입니다."
    );
    await deleteTransaction(
      userId,
      validatedWorkspaceId,
      validatedTransactionId
    );
    return handleApiSuccess({
      success: true,
      message: "내역이 성공적으로 삭제되었습니다.",
    });
  } catch (error) {
    const routeWorkspaceId = "unknown";
    const routeTransactionId = "unknown";
    console.error(
      `[API DELETE /api/workspaces/${routeWorkspaceId}/transactions/${routeTransactionId}] specific error log:`,
      error
    );
    return handleApiError(error, "거래 내역 삭제 중 오류가 발생했습니다.");
  }
};
export const DELETE = withAuth<SingleTransactionParams>(
  deleteSingleTransactionHandler
);
