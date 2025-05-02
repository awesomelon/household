import {
  CreateTransactionSchema,
  GetTransactionsQuerySchema,
} from "@/lib/schemas/transactionsApiSchemas";
import {
  createTransaction,
  getTransactions,
} from "@/services/transactionService";
import { WorkspaceIdParamSchema } from "@/lib/schemas/commonApiSchemas";
import {
  withAuth,
  type AuthenticatedApiHandlerWithParams,
} from "@/lib/authUtils";
import { validateData } from "@/lib/validationUtils";
import { handleApiSuccess, handleApiError } from "@/lib/apiResponse";

interface WorkspaceTransactionsParams {
  workspaceId: string;
}

const getWorkspaceTransactionsHandler: AuthenticatedApiHandlerWithParams<
  WorkspaceTransactionsParams
> = async (request, context, userId) => {
  try {
    const params = await context.params;
    const { workspaceId } = validateData(
      params,
      WorkspaceIdParamSchema,
      "잘못된 워크스페이스 ID 형식입니다."
    );

    const { searchParams } = new URL(request.url);
    const query = validateData(
      Object.fromEntries(searchParams.entries()),
      GetTransactionsQuerySchema,
      "요청 파라미터가 유효하지 않습니다."
    );

    const transactions = await getTransactions(userId, workspaceId, query);
    return handleApiSuccess(transactions);
  } catch (error) {
    const routeWorkspaceId = "unknown";
    console.error(
      `[API GET /api/workspaces/${routeWorkspaceId}/transactions] specific error log:`,
      error
    );
    return handleApiError(error, "거래 내역 조회 중 오류가 발생했습니다.");
  }
};

export const GET = withAuth<WorkspaceTransactionsParams>(
  getWorkspaceTransactionsHandler
);

const postWorkspaceTransactionsHandler: AuthenticatedApiHandlerWithParams<
  WorkspaceTransactionsParams
> = async (request, context, userId) => {
  try {
    const params = await context.params;
    const { workspaceId } = validateData(
      params,
      WorkspaceIdParamSchema,
      "잘못된 워크스페이스 ID 형식입니다."
    );

    const body = await request.json();
    const validatedBody = validateData(
      body,
      CreateTransactionSchema,
      "요청 본문이 유효하지 않습니다."
    );

    const createdTransaction = await createTransaction(
      userId,
      workspaceId,
      validatedBody
    );
    return handleApiSuccess(createdTransaction, 201);
  } catch (error) {
    const routeWorkspaceId = "unknown";
    console.error(
      `[API POST /api/workspaces/${routeWorkspaceId}/transactions] specific error log:`,
      error
    );
    return handleApiError(error, "거래 내역 생성 중 오류가 발생했습니다.");
  }
};

export const POST = withAuth<WorkspaceTransactionsParams>(
  postWorkspaceTransactionsHandler
);
