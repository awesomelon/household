# src 폴더

```ts
/* ./src/app/api/auth/[...nextauth]/route.ts */
// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions"; // 수정된 경로에서 authOptions를 가져옵니다.

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

```ts
/* ./src/app/api/invitations/[invitationId]/route.ts */
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError } from '@/lib/apiResponse';
import { revokeInvitation } from '@/services/invitationService';

interface InvitationActionRouteParams {
  invitationId: string;
}

// 초대 철회(삭제)
export const DELETE = withAuth<InvitationActionRouteParams>(
  async (
    request: Request,
    context: { params: Promise<InvitationActionRouteParams> },
    currentUserId: string
  ) => {
    try {
      const { invitationId } = await context.params;
      if (!invitationId) {
        return handleApiError({ message: '초대 ID가 필요합니다.', statusCode: 400 });
      }

      await revokeInvitation(invitationId, currentUserId);
      return new NextResponse(null, { status: 204 }); // 성공 시 204 No Content
    } catch (error) {
      return handleApiError(error);
    }
  }
);
```

```ts
/* ./src/app/api/invitations/accept/route.ts */
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError, handleApiSuccess } from '@/lib/apiResponse';
import { acceptInvitation } from '@/services/invitationService';
import { z } from 'zod';
import { validateData } from '@/lib/validationUtils';

const AcceptInvitationSchema = z.object({
  token: z.string().uuid('유효하지 않은 토큰 형식입니다.'),
});

// 초대 수락
export const POST = withAuth(async (request: Request, context: {}, acceptingUserId: string) => {
  try {
    const body = await request.json();
    const validationResult = validateData(body, AcceptInvitationSchema);
    const { token } = validationResult; // Zod 스키마에서 data를 직접 사용

    if (!acceptingUserId) {
      // 이 경우는 withAuth를 통과했으므로 발생하기 어렵지만, 안전장치
      return handleApiError({ message: '로그인이 필요합니다.', statusCode: 401 });
    }

    const workspaceUser = await acceptInvitation(token, acceptingUserId);

    // 성공 시, 사용자가 참여하게 된 워크스페이스 정보 등을 포함하여 반환 가능
    return handleApiSuccess({
      message: '초대를 성공적으로 수락했습니다.',
      workspaceId: workspaceUser.workspaceId,
      role: workspaceUser.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
```

```ts
/* ./src/app/api/invitations/decline/route.ts */
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError, handleApiSuccess } from '@/lib/apiResponse';
import { declineInvitation } from '@/services/invitationService';
import { z } from 'zod';
import { validateData } from '@/lib/validationUtils';

const DeclineInvitationSchema = z.object({
  token: z.string().uuid('유효한 토큰 형식이 아닙니다.'),
});

// 초대 거절
export const POST = withAuth(
  async (
    request: Request,
    context: {}, // 이 라우트는 URL 파라미터가 없습니다.
    userId: string // decliningUserId로 사용
  ) => {
    try {
      const body = await request.json();
      const validationResult = validateData(DeclineInvitationSchema, body);

      if (!validationResult.success) {
        return handleApiError({
          message: '잘못된 요청입니다.',
          details: validationResult.errors,
          statusCode: 400,
        });
      }

      const { token } = validationResult.data;

      const updatedInvitation = await declineInvitation(token, userId);
      return handleApiSuccess(updatedInvitation);
    } catch (error) {
      return handleApiError(error);
    }
  }
);
```

```ts
/* ./src/app/api/me/workspaces/route.ts */
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
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/budgets/[budgetId]/route.ts */
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
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/budgets/route.ts */
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
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/categories/route.ts */
import { NextResponse } from 'next/server';
import { WorkspaceIdParamSchema } from '@/lib/schemas/commonApiSchemas';
import { getAllCategories, createCategory } from '@/services/categoryService';
import { z } from 'zod';
import { withAuth, type AuthenticatedApiHandlerWithParams } from '@/lib/authUtils';
import { validateData } from '@/lib/validationUtils';
import { handleApiError } from '@/lib/apiResponse';

interface WorkspaceCategoriesParams {
  workspaceId: string;
}

// 카테고리 생성 요청 본문 스키마는 파일 상단에 이미 정의되어 있음
const CreateCategorySchema = z.object({
  name: z
    .string()
    .min(1, '카테고리 이름은 필수입니다.')
    .max(50, '카테고리 이름은 50자를 넘을 수 없습니다.'),
  type: z.enum(['income', 'expense'], {
    message: "카테고리 유형은 'income' 또는 'expense'여야 합니다.",
  }),
});

const getWorkspaceCategoriesHandler: AuthenticatedApiHandlerWithParams<
  WorkspaceCategoriesParams
> = async (request, context, userId) => {
  let params: WorkspaceCategoriesParams;
  try {
    params = await context.params;
    const { workspaceId } = validateData(
      params,
      WorkspaceIdParamSchema,
      '잘못된 워크스페이스 ID 형식입니다.'
    );
    const categories = await getAllCategories(userId, workspaceId);

    const response = NextResponse.json(categories);
    response.headers.set('Cache-Control', 'public, max-age=3600');
    return response;
  } catch (error) {
    params = await context.params;
    const routeWorkspaceId = params?.workspaceId || 'unknown';

    console.error(
      `[API GET /api/workspaces/${routeWorkspaceId}/categories] specific error log:`,
      error
    );
    return handleApiError(error, '카테고리 조회 중 오류가 발생했습니다.');
  }
};

export const GET = withAuth<WorkspaceCategoriesParams>(getWorkspaceCategoriesHandler);

const postWorkspaceCategoriesHandler: AuthenticatedApiHandlerWithParams<
  WorkspaceCategoriesParams
> = async (request, context, userId) => {
  let params: WorkspaceCategoriesParams;
  try {
    params = await context.params;
    const { workspaceId } = validateData(
      params,
      WorkspaceIdParamSchema,
      '잘못된 워크스페이스 ID 형식입니다.'
    );
    const validatedBody = validateData(
      await request.json(),
      CreateCategorySchema,
      '요청 본문이 유효하지 않습니다.'
    );
    const newCategory = await createCategory(userId, workspaceId, validatedBody);
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    params = await context.params;
    const routeWorkspaceId = params?.workspaceId || 'unknown';
    console.error(
      `[API POST /api/workspaces/${routeWorkspaceId}/categories] specific error log:`,
      error
    );
    return handleApiError(error, '카테고리 생성 중 오류가 발생했습니다.');
  }
};

export const POST = withAuth<WorkspaceCategoriesParams>(postWorkspaceCategoriesHandler);
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/insights/route.ts */
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
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/invitations/route.ts */
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/authUtils';
import { handleApiError, handleApiSuccess } from '@/lib/apiResponse';
import { createInvitation, getPendingInvitationsForWorkspace } from '@/services/invitationService';
import { z } from 'zod';
import { validateData } from '@/lib/validationUtils';
import { WorkspaceRole } from '@prisma/client'; // WorkspaceRole enum import

interface WorkspaceInvitationsRouteParams {
  workspaceId: string;
}

const CreateInvitationSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력해주세요.'),
  role: z.nativeEnum(WorkspaceRole).default(WorkspaceRole.MEMBER), // 기본 역할 MEMBER
});

// 워크스페이스에 사용자 초대
export const POST = withAuth<WorkspaceInvitationsRouteParams>(
  async (
    request: Request,
    context: { params: Promise<WorkspaceInvitationsRouteParams> },
    inviterId: string
  ) => {
    try {
      const { workspaceId } = await context.params;
      if (!workspaceId) {
        return handleApiError({ message: '워크스페이스 ID가 필요합니다.', statusCode: 400 });
      }

      const body = await request.json();
      const validationResult = validateData(body, CreateInvitationSchema);

      const validatedData = validationResult;

      const { email, role } = validatedData;

      const invitation = await createInvitation(inviterId, workspaceId, email, role);
      return handleApiSuccess(invitation, 201);
    } catch (error) {
      return handleApiError(error);
    }
  }
);

// 워크스페이스의 보류 중인 초대 목록 조회
export const GET = withAuth<WorkspaceInvitationsRouteParams>(
  async (
    request: Request,
    context: { params: Promise<WorkspaceInvitationsRouteParams> },
    userId: string
  ) => {
    try {
      const { workspaceId } = await context.params;
      if (!workspaceId) {
        return handleApiError({ message: '워크스페이스 ID가 필요합니다.', statusCode: 400 });
      }

      // userId는 현재 로그인한 사용자 ID (권한 검사용)
      const pendingInvitations = await getPendingInvitationsForWorkspace(workspaceId, userId);
      return handleApiSuccess(pendingInvitations);
    } catch (error) {
      return handleApiError(error);
    }
  }
);
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/route.ts */
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
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/stats/route.ts */
import { StatsApiQuerySchema } from "@/lib/schemas/statsApiSchemas";
import { ApiError /* ValidationError */ } from "@/services/apiError";
import {
  getDailyStatsService,
  getMonthlyStatsService,
  getYearlyStatsService,
  getCategoryStatsService,
  getTrendStatsService,
  getKpiStatsService,
  getSpendingPatternStatsService,
  getIncomeSourceStatsService,
  getBudgetVsActualStatsService,
  getDetailStatsService,
} from "@/services/statisticsService";
import { format, subMonths } from "date-fns";
import { WorkspaceIdParamSchema } from "@/lib/schemas/commonApiSchemas";
import {
  withAuth,
  type AuthenticatedApiHandlerWithParams,
} from "@/lib/authUtils";
import { validateData } from "@/lib/validationUtils";
import { handleApiSuccess, handleApiError } from "@/lib/apiResponse";

interface WorkspaceStatsParams {
  workspaceId: string;
}

const getWorkspaceStatsHandler: AuthenticatedApiHandlerWithParams<
  WorkspaceStatsParams
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
      Object.fromEntries(searchParams),
      StatsApiQuerySchema,
      "요청 파라미터가 유효하지 않습니다."
    );

    let result;

    switch (query.type) {
      case "daily":
        result = await getDailyStatsService(
          userId,
          workspaceId,
          query.date,
          query.compare
        );
        break;
      case "monthly":
        result = await getMonthlyStatsService(
          userId,
          workspaceId,
          query.month,
          query.compare
        );
        break;
      case "yearly":
        result = await getYearlyStatsService(
          userId,
          workspaceId,
          query.year,
          query.compare
        );
        break;
      case "category":
        const categoryReference =
          query.period === "year" ? query.year : query.month;
        result = await getCategoryStatsService(
          userId,
          workspaceId,
          categoryReference,
          query.period as "month" | "year"
        );
        break;
      case "trend":
        result = await getTrendStatsService(
          userId,
          workspaceId,
          query.period as "day" | "month" | "year",
          query.month,
          query.year
        );
        break;
      case "kpi":
        result = await getKpiStatsService(
          userId,
          workspaceId,
          query.period as "month" | "year",
          query.month,
          query.year
        );
        break;
      case "detail":
        const startDate =
          query.startDate || format(subMonths(new Date(), 1), "yyyy-MM-dd");
        const endDate = query.endDate || format(new Date(), "yyyy-MM-dd");
        result = await getDetailStatsService(
          userId,
          workspaceId,
          startDate,
          endDate
        );
        break;
      case "spendingPattern":
        result = await getSpendingPatternStatsService(
          userId,
          workspaceId,
          query.month
        );
        break;
      case "incomeSource":
        result = await getIncomeSourceStatsService(
          userId,
          workspaceId,
          query.month,
          query.compare
        );
        break;
      case "budgetVsActual":
        result = await getBudgetVsActualStatsService(
          userId,
          workspaceId,
          query.month
        );
        break;
      default:
        const exhaustiveCheck: never = query.type;
        throw new ApiError(
          `지원하지 않는 통계 유형입니다: ${exhaustiveCheck}`,
          400
        );
    }
    return handleApiSuccess(result);
  } catch (error) {
    const routeWorkspaceId = "unknown";
    console.error(
      `[API GET /api/workspaces/${routeWorkspaceId}/stats] specific error log:`,
      error
    );
    return handleApiError(error, "통계 데이터 조회 중 오류가 발생했습니다.");
  }
};

export const GET = withAuth<WorkspaceStatsParams>(getWorkspaceStatsHandler);
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/transactions/[transactionId]/route.ts */
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
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/transactions/route.ts */
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
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/users/[userId]/route.ts */
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
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/users/route.ts */
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
```

```ts
/* ./src/app/api/workspaces/route.ts */
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
```

```ts
/* ./src/constants/apiEndpoints.ts */
// src/constants/apiEndpoints.ts

export const API_BASE_URL = "/api";

// 워크스페이스 자체에 대한 엔드포인트
export const WORKSPACES_ENDPOINT = `${API_BASE_URL}/workspaces`;
export const MY_WORKSPACES_ENDPOINT = `${API_BASE_URL}/me/workspaces`; // 현재 사용자의 워크스페이스 목록

// 특정 워크스페이스 내의 리소스에 대한 엔드포인트 (workspaceId를 인자로 받음)
export const CATEGORIES_ENDPOINT = (workspaceId: string) =>
  `${WORKSPACES_ENDPOINT}/${workspaceId}/categories`;

export const TRANSACTIONS_ENDPOINT = (workspaceId: string) =>
  `${WORKSPACES_ENDPOINT}/${workspaceId}/transactions`;
export const TRANSACTION_BY_ID_ENDPOINT = (
  workspaceId: string,
  transactionId: number | string
) => `${TRANSACTIONS_ENDPOINT(workspaceId)}/${transactionId}`;

export const BUDGETS_ENDPOINT = (workspaceId: string) =>
  `${WORKSPACES_ENDPOINT}/${workspaceId}/budgets`;
export const BUDGET_BY_ID_ENDPOINT = (
  workspaceId: string,
  budgetId: number | string
) => `${BUDGETS_ENDPOINT(workspaceId)}/${budgetId}`;

export const STATS_ENDPOINT = (workspaceId: string) =>
  `${WORKSPACES_ENDPOINT}/${workspaceId}/stats`;

export const INSIGHTS_ENDPOINT = (workspaceId: string) =>
  `${WORKSPACES_ENDPOINT}/${workspaceId}/insights`;

// 인증 관련 엔드포인트 (워크스페이스와 무관)
export const AUTH_ENDPOINT = `${API_BASE_URL}/auth`;
```

```ts
/* ./src/constants/cardIssuers.ts */
/* ./src/constants/cardIssuers.ts */
// 할부 거래 시 사용될 카드 발급사 목록을 정의합니다.
import type { CardIssuer } from "@/types/commonTypes"; // CardIssuer 타입 경로 수정 필요시 확인

/**
 * 지원되는 카드 발급사 목록
 * TransactionForm, TransactionEditModal, financeUtils 등에서 공통으로 사용됩니다.
 */
export const SUPPORTED_CARD_ISSUERS: CardIssuer[] = [
  "현대카드",
  "기타",
] as const;

/**
 * 카드사별 할부 수수료율 정보 (예시 데이터)
 * 주의: 이 데이터는 실제 금융 정보와 다를 수 있으며, 주기적인 업데이트가 필요합니다.
 * 실제 서비스에서는 API를 통해 최신 정보를 받아오거나, 신뢰할 수 있는 출처의 데이터를 사용해야 합니다.
 * (기존 financeUtils.ts 에서 이동)
 */
export const CARD_INSTALLMENT_RATES_INFO: Record<
  string,
  { minApr: number; maxApr: number; referenceDate: string }
> = {
  현대카드: { minApr: 7.9, maxApr: 19.9, referenceDate: "2024-11-01" },
  기타: { minApr: 10.0, maxApr: 19.9, referenceDate: "N/A" },
};
```

```ts
/* ./src/constants/chartColors.ts */
/* ./src/constants/chartColors.ts */
// 차트 및 UI 요소에서 사용될 색상 팔레트를 정의합니다.
// 애플리케이션 전체의 시각적 일관성을 유지하는 데 도움이 됩니다.

/**
 * 수입 관련 항목에 사용될 기본 색상 팔레트
 */
export const INCOME_COLORS = [
  '#4CAF50',
  '#81C784',
  '#A5D6A7',
  '#C8E6C9',
  '#E8F5E9',
  '#2E7D32',
  '#388E3C',
  '#43A047',
  '#66BB6A',
  '#D4E157',
];

/**
 * 지출 관련 항목에 사용될 기본 색상 팔레트
 * (CategoryDistributionChart.tsx 에서 가져온 색상)
 */
export const EXPENSE_COLORS = [
  'rgb(191, 225, 246)',
  'rgb(255, 207, 201)',
  'rgb(255, 229, 160)',
  'rgb(232, 234, 237)',
  'rgb(71, 56, 34)',
  'rgb(17, 115, 75)',
  'rgb(177, 2, 2)',
  'rgb(255, 200, 170)',
  'rgb(10, 83, 168)',
  'rgb(230, 207, 242)',
  'rgb(90, 50, 134)',
];

/**
 * KPI 카드 디자인에 사용되는 색상 클래스 정의
 * (KpiCardRedesign.tsx 에서 가져온 Tailwind CSS 클래스 기반 정의)
 */
export const KPI_CARD_COLOR_CLASSES = {
  blue: { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-500' },
  green: { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-500' },
  red: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-500' },
  yellow: { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-500' },
  purple: { text: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-500' },
  gray: { text: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-500' },
};

/**
 * 일반적인 UI 상태에 따른 색상 (예: 성공, 경고, 오류)
 */
export const STATUS_COLORS = {
  success: '#4CAF50', // Green
  warning: '#FFC107', // Amber
  error: '#F44336', // Red
  info: '#2196F3', // Blue
  neutral: '#9E9E9E', // Grey
};
```

```ts
/* ./src/constants/uiTexts.ts */
/* ./src/constants/uiTexts.ts */
// UI에 표시되는 공통 텍스트 메시지, 레이블 등을 정의합니다.
// 다국어 지원 시 이 파일을 기반으로 언어별 파일을 생성할 수 있습니다.

export const COMMON_LABELS = {
  date: '날짜',
  amount: '금액',
  type: '유형',
  category: '카테고리',
  description: '내용',
  installment: '할부',
  actions: '관리',
  // ... 기타 공통 레이블
};

export const BUTTON_TEXTS = {
  add: '추가',
  edit: '수정',
  delete: '삭제',
  save: '저장',
  cancel: '취소',
  confirm: '확인',
  applyFilter: '필터 적용',
  resetFilter: '초기화',
  apply: '적용',
  // ... 기타 버튼 텍스트
};

export const MESSAGES = {
  loading: '데이터를 불러오는 중입니다...',
  noData: '표시할 데이터가 없습니다.',
  errorOccurred: '오류가 발생했습니다.',
  deleteConfirm: (itemName: string = '항목') => `정말로 이 ${itemName}을(를) 삭제하시겠습니까?`,
  saveSuccess: '성공적으로 저장되었습니다.',
  deleteSuccess: '성공적으로 삭제되었습니다.',
  wait: '잠시만 기다려주세요...',
};

export const CHART_TITLES = {
  monthlyTrend: '월간 수입/지출 트렌드 (일별)',
  categoryDistribution: (type: '수입' | '지출') => `카테고리별 ${type} 분포`,
  spendingPattern: '소비 패턴 분석',
  incomeSource: '수입원 분석',
  budgetVsActual: '예산 대비 지출',
  // ... 기타 차트 제목
};

export const KPI_TITLES = {
  carryOverBalance: '이월 잔액',
  currentMonthIncome: '수입',
  currentMonthExpense: '지출',
  finalBalance: '잔액',
  // ... 기타 KPI 제목
};
```

```ts
/* ./src/hooks/useDashboardData.ts */
import useSWR from 'swr';
import { fetcher } from '@/lib/fetchers'; // 에러 처리가 포함된 fetcher 사용
import type { KpiData } from '@/types/kpiTypes';
import type {
  MonthlyStatsData,
  CategoryStatsData,
  SpendingPatternStats, // 타입 경로 수정 가능성 있음
  IncomeSourceStats, // 타입 경로 수정 가능성 있음
  BudgetVsActualStats, // 타입 경로 수정 가능성 있음
} from '@/types/statisticsTypes'; // 구체적인 통계 타입 사용
import type { TransactionResponse } from '@/types/transactionTypes';
import type { CategoryOption } from '@/types/categoryTypes';
import type { TrendChartItemData } from '@/types/chartTypes'; // TrendChartItemData 타입 사용
import {
  STATS_ENDPOINT,
  TRANSACTIONS_ENDPOINT,
  CATEGORIES_ENDPOINT,
  INSIGHTS_ENDPOINT,
} from '@/constants/apiEndpoints'; // API 엔드포인트 상수 사용
import { InsightsApiResponse } from '@/types/insightTypes';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Trend API 응답 타입 (예시, 실제 API 응답 구조에 맞게 정의 필요)
// statisticsService.getTrendStats의 반환 타입과 일치해야 함
export interface TrendApiResponse {
  period: 'day' | 'month' | 'year';
  month?: string; // period 'day'
  year?: string; // period 'month'
  startYear?: string; // period 'year'
  endYear?: string; // period 'year'
  trend: TrendChartItemData[];
}

/**
 * useDashboardData 훅의 Props 인터페이스
 */
export interface UseDashboardDataProps {
  selectedMonth: string; // YYYY-MM 형식
  compareWithPrevious: boolean;
  appliedFilters: {
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    type: string; // 'income', 'expense', or ''
    categoryId: string; // category ID or ''
  };
  includeExtraStats?: boolean; // 추가 분석 통계 포함 여부
}

export const getKpiSWRKey = (
  workspaceId: string,
  selectedMonth: string,
  compareWithPrevious: boolean
) =>
  workspaceId
    ? `${STATS_ENDPOINT(
        workspaceId
      )}?type=kpi&month=${selectedMonth}&compare=${compareWithPrevious}`
    : null;

export const getMonthlyStatsSWRKey = (
  workspaceId: string,
  selectedMonth: string,
  compareWithPrevious: boolean
) =>
  workspaceId
    ? `${STATS_ENDPOINT(
        workspaceId
      )}?type=monthly&month=${selectedMonth}&compare=${compareWithPrevious}`
    : null;

export const getCategoryStatsSWRKey = (
  workspaceId: string,
  selectedMonth: string,
  period: 'month' | 'year' = 'month'
) =>
  workspaceId
    ? `${STATS_ENDPOINT(workspaceId)}?type=category&${
        period === 'month' ? `month=${selectedMonth}` : `year=${selectedMonth.substring(0, 4)}`
      }&period=${period}`
    : null;

export const getTransactionsSWRKey = (
  workspaceId: string,
  filters: UseDashboardDataProps['appliedFilters']
) => {
  if (!workspaceId) return null;
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    sortBy: 'date',
    sortOrder: 'desc',
  });
  if (filters.type) params.append('type', filters.type);
  if (filters.categoryId) params.append('categoryId', filters.categoryId);
  return `${TRANSACTIONS_ENDPOINT(workspaceId)}?${params.toString()}`;
};

export const getCategoryOptionsSWRKey = (workspaceId: string) =>
  workspaceId ? CATEGORIES_ENDPOINT(workspaceId) : null;

export const getTrendDataSWRKey = (workspaceId: string, selectedMonth: string) =>
  workspaceId
    ? `${STATS_ENDPOINT(workspaceId)}?type=trend&period=day&month=${selectedMonth}`
    : null;

export const getSpendingPatternSWRKey = (workspaceId: string, selectedMonth: string) =>
  workspaceId ? `${STATS_ENDPOINT(workspaceId)}?type=spendingPattern&month=${selectedMonth}` : null;

export const getIncomeSourceSWRKey = (
  workspaceId: string,
  selectedMonth: string,
  compareWithPrevious: boolean
) =>
  workspaceId
    ? `${STATS_ENDPOINT(
        workspaceId
      )}?type=incomeSource&month=${selectedMonth}&compare=${compareWithPrevious}`
    : null;

export const getBudgetVsActualSWRKey = (workspaceId: string, selectedMonth: string) =>
  workspaceId ? `${STATS_ENDPOINT(workspaceId)}?type=budgetVsActual&month=${selectedMonth}` : null;

export const getInsightsSWRKey = (workspaceId: string, selectedMonth: string) =>
  workspaceId ? `${INSIGHTS_ENDPOINT(workspaceId)}?month=${selectedMonth}` : null;

export function useDashboardData({
  selectedMonth,
  compareWithPrevious,
  appliedFilters,
  includeExtraStats = false,
}: UseDashboardDataProps) {
  const { activeWorkspaceId } = useWorkspaceStore(); // Zustand 스토어에서 activeWorkspaceId 가져오기

  // KPI 데이터 페칭
  const {
    data: kpiData,
    error: kpiError,
    isLoading: kpiIsLoading,
    mutate: mutateKpiData,
  } = useSWR<KpiData>(
    activeWorkspaceId ? getKpiSWRKey(activeWorkspaceId, selectedMonth, compareWithPrevious) : null,
    fetcher
  );

  // 월별 통계 데이터 페칭
  const {
    data: monthlyStats,
    error: monthlyStatsError,
    isLoading: monthlyStatsIsLoading,
    mutate: mutateMonthlyStats,
  } = useSWR<MonthlyStatsData>(
    activeWorkspaceId
      ? getMonthlyStatsSWRKey(activeWorkspaceId, selectedMonth, compareWithPrevious)
      : null,
    fetcher
  );

  // 카테고리별 통계 데이터 페칭 (월 기준)
  const {
    data: categoryStats,
    error: categoryStatsError,
    isLoading: categoryStatsIsLoading,
    mutate: mutateCategoryStats,
  } = useSWR<CategoryStatsData>(
    activeWorkspaceId ? getCategoryStatsSWRKey(activeWorkspaceId, selectedMonth, 'month') : null,
    fetcher
  );

  // 트렌드 데이터 페칭
  const {
    data: trendStatsData,
    error: trendDataError,
    isLoading: trendStatsIsLoading,
    mutate: mutateTrendStatsData,
  } = useSWR<TrendApiResponse>(
    activeWorkspaceId ? getTrendDataSWRKey(activeWorkspaceId, selectedMonth) : null,
    fetcher
  );

  // 거래 내역 데이터 페칭
  const {
    data: transactionsResponse,
    error: transactionsError,
    isLoading: transactionsIsLoading,
    mutate: mutateTransactions,
  } = useSWR<TransactionResponse>(
    activeWorkspaceId ? getTransactionsSWRKey(activeWorkspaceId, appliedFilters) : null,
    fetcher
  );

  // 카테고리 옵션 데이터 페칭
  const {
    data: categoryOptions,
    error: categoryOptionsError,
    isLoading: categoryOptionsIsLoading,
    mutate: mutateCategoryOptions,
  } = useSWR<CategoryOption[]>(
    activeWorkspaceId ? getCategoryOptionsSWRKey(activeWorkspaceId) : null,
    fetcher,
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  // 추가 분석 통계 데이터 페칭
  const {
    data: spendingPatternData,
    error: spendingPatternError,
    isLoading: spendingPatternIsLoading,
    mutate: mutateSpendingPattern,
  } = useSWR<SpendingPatternStats>(
    includeExtraStats && activeWorkspaceId
      ? getSpendingPatternSWRKey(activeWorkspaceId, selectedMonth)
      : null,
    fetcher
  );

  const {
    data: incomeSourceData,
    error: incomeSourceError,
    isLoading: incomeSourceIsLoading,
    mutate: mutateIncomeSource,
  } = useSWR<IncomeSourceStats>(
    includeExtraStats && activeWorkspaceId
      ? getIncomeSourceSWRKey(activeWorkspaceId, selectedMonth, compareWithPrevious)
      : null,
    fetcher
  );

  const {
    data: budgetVsActualData,
    error: budgetVsActualError,
    isLoading: budgetVsActualIsLoading,
    mutate: mutateBudgetVsActual,
  } = useSWR<BudgetVsActualStats>(
    includeExtraStats && activeWorkspaceId
      ? getBudgetVsActualSWRKey(activeWorkspaceId, selectedMonth)
      : null,
    fetcher
  );

  const {
    data: insightsResponse,
    error: insightsError,
    isLoading: insightsIsLoading,
    mutate: mutateInsights,
  } = useSWR<InsightsApiResponse>(
    activeWorkspaceId ? getInsightsSWRKey(activeWorkspaceId, selectedMonth) : null,
    fetcher
  );

  const insightsData = insightsResponse?.insights;

  // 집계된 로딩 및 에러 상태
  const isAnyPrimaryDataLoading =
    kpiIsLoading ||
    monthlyStatsIsLoading ||
    categoryStatsIsLoading ||
    transactionsIsLoading ||
    categoryOptionsIsLoading ||
    insightsIsLoading;

  const isAnyExtraStatsLoading = includeExtraStats
    ? spendingPatternIsLoading || incomeSourceIsLoading || budgetVsActualIsLoading
    : false;

  const combinedError =
    kpiError ||
    monthlyStatsError ||
    categoryStatsError ||
    trendDataError ||
    transactionsError ||
    categoryOptionsError ||
    spendingPatternError ||
    incomeSourceError ||
    budgetVsActualError ||
    insightsError;

  // 모든 mutate 함수를 하나의 객체로 묶어 반환 (선택적)
  const mutateFunctions = {
    mutateKpiData,
    mutateMonthlyStats,
    mutateCategoryStats,
    mutateTrendStatsData,
    mutateTransactions,
    mutateCategoryOptions,
    mutateSpendingPattern,
    mutateIncomeSource,
    mutateBudgetVsActual,
    mutateInsights,
  };

  // console.log("transactionsResponse", transactionsResponse);

  return {
    // 기본 데이터
    kpiData,
    monthlyStats,
    categoryStats,
    trendStatsData,
    transactions: transactionsResponse?.transactions,
    transactionsTotalCount: transactionsResponse?.totalCount,
    categoryOptions,

    // 추가 분석 데이터 (조건부)
    spendingPatternData,
    incomeSourceData,
    budgetVsActualData,

    insightsData,
    insightsIsLoading,
    insightsError,

    // 개별 로딩 상태
    kpiIsLoading,
    monthlyStatsIsLoading,
    categoryStatsIsLoading,
    trendStatsIsLoading,
    transactionsIsLoading,
    categoryOptionsIsLoading,
    spendingPatternIsLoading,
    incomeSourceIsLoading,
    budgetVsActualIsLoading,

    // 개별 에러 상태
    kpiError,
    monthlyStatsError,
    categoryStatsError,
    trendDataError,
    transactionsError,
    categoryOptionsError,
    spendingPatternError,
    incomeSourceError,
    budgetVsActualError,

    // 집계 로딩/에러 상태
    isAnyPrimaryDataLoading,
    isAnyExtraStatsLoading,
    isLoading: isAnyPrimaryDataLoading || isAnyExtraStatsLoading, // 전체 로딩 상태
    error: combinedError, // 첫 번째 발생 에러 또는 사용자 정의 에러 객체

    // Mutate 함수들
    mutateFunctions, // 개별 mutate 함수 그룹
  };
}
```

```ts
/* ./src/hooks/useDashboardManager.ts */
import { useState, useCallback, useMemo, useEffect } from "react";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
} from "date-fns";
import { useSWRConfig } from "swr";
import type { TransactionData } from "@/types/transactionTypes"; // 타입 경로 수정
import {
  getKpiSWRKey,
  getMonthlyStatsSWRKey,
  getCategoryStatsSWRKey,
  getTransactionsSWRKey,
  getSpendingPatternSWRKey,
  getIncomeSourceSWRKey,
  getBudgetVsActualSWRKey,
  getCategoryOptionsSWRKey,
  getInsightsSWRKey, // 카테고리 옵션 키 추가
} from "./useDashboardData"; // SWR 키 생성 함수 임포트
import { useWorkspaceStore } from "@/stores/workspaceStore";

/**
 * 필터 상태를 위한 인터페이스
 */
export interface FiltersState {
  startDate: string;
  endDate: string;
  type: string; // 'income', 'expense', 또는 '' (전체)
  categoryId: string; // 카테고리 ID 또는 '' (전체)
}

/**
 * 대시보드에서 활성화될 수 있는 탭의 타입
 */
export type ActiveTabType = "overview" | "transactions" | "analysis"; // 예시 탭, 실제 탭에 맞게 조정

/**
 * 대시보드의 UI 상태 및 사용자 인터랙션을 관리하는 커스텀 훅입니다.
 * - 선택된 월, 활성 탭, 필터 상태 등을 관리합니다.
 * - 데이터 변경 후 관련 SWR 캐시를 무효화하여 데이터 리프레시를 트리거합니다.
 */
export function useDashboardManager() {
  const { activeWorkspaceId } = useWorkspaceStore(); // Zustand 스토어에서 activeWorkspaceId 가져오기

  // 현재 날짜를 기준으로 초기 선택 월 설정 (YYYY-MM 형식)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );
  // 활성 탭 상태 (기본값 'overview')
  const [activeTab, setActiveTab] = useState<ActiveTabType>("overview");
  // 이전 기간과 비교 여부 상태 (기본값 true)
  const [compareWithPrevious, setCompareWithPrevious] = useState(true);
  // 수정 중인 거래 데이터 상태
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionData | null>(null);
  // 거래 추가/수정 폼 표시 여부 상태
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  // 모바일 메뉴 표시 여부 상태
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const { mutate } = useSWRConfig(); // SWR 캐시 수동 업데이트를 위한 mutate 함수

  // 선택된 월의 시작일과 종료일을 계산 (메모이제이션 적용)
  const currentMonthDateRange = useMemo(() => {
    const monthDate = parseISO(`${selectedMonth}-01`);
    return {
      startDate: format(startOfMonth(monthDate), "yyyy-MM-dd"),
      endDate: format(endOfMonth(monthDate), "yyyy-MM-dd"),
    };
  }, [selectedMonth]);

  // 필터 UI에서 사용자가 설정하는 임시 필터 상태
  const [localFilters, setLocalFilters] = useState<FiltersState>({
    ...currentMonthDateRange,
    type: "",
    categoryId: "",
  });

  // 실제 API 요청에 적용되는 필터 상태
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>({
    ...currentMonthDateRange,
    type: "",
    categoryId: "",
  });

  // selectedMonth가 변경될 때 localFilters와 appliedFilters를 해당 월의 기본값으로 초기화
  useEffect(() => {
    setLocalFilters({
      ...currentMonthDateRange,
      type: "",
      categoryId: "",
    });
    setAppliedFilters({
      ...currentMonthDateRange,
      type: "",
      categoryId: "",
    });
  }, [selectedMonth, currentMonthDateRange]);

  // 월 변경 핸들러
  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month);
  }, []);

  // 이전/다음 달 이동 핸들러
  const moveMonth = useCallback(
    (direction: "prev" | "next") => {
      const currentDate = parseISO(`${selectedMonth}-01`);
      const newDate =
        direction === "prev"
          ? subMonths(currentDate, 1)
          : addMonths(currentDate, 1);
      handleMonthChange(format(newDate, "yyyy-MM"));
    },
    [selectedMonth, handleMonthChange]
  );

  // 로컬 필터 변경 핸들러
  const handleLocalFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setLocalFilters((prev) => ({
        ...prev,
        [name]: value,
        // 거래 유형(type) 변경 시 카테고리 선택 초기화
        ...(name === "type" && { categoryId: "" }),
      }));
    },
    []
  );

  // 필터 적용 핸들러: 로컬 필터를 적용된 필터로 설정
  const applyFilters = useCallback(() => {
    setAppliedFilters(localFilters);
  }, [localFilters]);

  // 필터 초기화 핸들러: 현재 선택된 월 기준으로 필터 초기화
  const resetFilters = useCallback(() => {
    const defaultFiltersForMonth = {
      ...currentMonthDateRange,
      type: "",
      categoryId: "",
    };
    setLocalFilters(defaultFiltersForMonth);
    setAppliedFilters(defaultFiltersForMonth);
  }, [currentMonthDateRange]);

  // 이전 기간 비교 토글 핸들러
  const toggleCompareWithPrevious = useCallback(() => {
    setCompareWithPrevious((prev) => !prev);
  }, []);

  // 활성 탭 변경 핸들러
  const handleSetActiveTab = useCallback((tab: ActiveTabType) => {
    setActiveTab(tab);
  }, []);

  // 수정할 거래 데이터 설정 핸들러
  const handleSetEditingTransaction = useCallback(
    (transaction: TransactionData | null) => {
      setEditingTransaction(transaction);
    },
    []
  );

  // 거래 폼 표시 여부 설정 핸들러
  const handleSetShowTransactionForm = useCallback((show: boolean) => {
    setShowTransactionForm(show);
  }, []);

  // 모바일 메뉴 토글 핸들러
  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  // 관련된 모든 SWR 키를 갱신하여 데이터 리프레시
  const mutateAllRelevantStats = useCallback(() => {
    if (!activeWorkspaceId) {
      return;
    }
    // appliedFilters와 selectedMonth, compareWithPrevious를 사용하여 각 SWR 키 생성
    mutate(getTransactionsSWRKey(activeWorkspaceId, appliedFilters));
    mutate(getKpiSWRKey(activeWorkspaceId, selectedMonth, compareWithPrevious));
    mutate(
      getMonthlyStatsSWRKey(
        activeWorkspaceId,
        selectedMonth,
        compareWithPrevious
      )
    );
    mutate(getCategoryStatsSWRKey(activeWorkspaceId, selectedMonth)); // period는 'month'로 가정
    mutate(getSpendingPatternSWRKey(activeWorkspaceId, selectedMonth));
    mutate(
      getIncomeSourceSWRKey(
        activeWorkspaceId,
        selectedMonth,
        compareWithPrevious
      )
    );
    mutate(getBudgetVsActualSWRKey(activeWorkspaceId, selectedMonth));
    mutate(getCategoryOptionsSWRKey(activeWorkspaceId)); // 카테고리 옵션도 갱신 (필요시)

    mutate(getInsightsSWRKey(activeWorkspaceId, selectedMonth));

    console.log(
      "Mutated all relevant stats by useDashboardManager for month:",
      selectedMonth,
      "compare:",
      compareWithPrevious,
      "filters:",
      appliedFilters
    );
  }, [
    appliedFilters,
    selectedMonth,
    compareWithPrevious,
    mutate,
    activeWorkspaceId,
  ]);

  return {
    selectedMonth,
    activeTab,
    compareWithPrevious,
    editingTransaction,
    showTransactionForm,
    localFilters, // 필터 모달에 전달될 임시 필터
    appliedFilters, // 실제 데이터 페칭에 사용될 필터
    isMobileMenuOpen,
    // 핸들러 함수들
    handleMonthChange,
    moveMonth,
    handleLocalFilterChange,
    applyFilters,
    resetFilters,
    toggleCompareWithPrevious,
    handleSetActiveTab,
    handleSetEditingTransaction,
    handleSetShowTransactionForm,
    mutateAllRelevantStats,
    toggleMobileMenu,
  };
}
```

```ts
/* ./src/lib/apiResponse.ts */
import { NextResponse } from "next/server";
import { ApiError } from "@/services/apiError"; // ApiError 정의 경로

/**
 * API 성공 응답을 생성합니다.
 * @param data 응답 데이터
 * @param status HTTP 상태 코드 (기본값: 200)
 * @returns NextResponse 객체
 */
export function handleApiSuccess<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * API 에러 응답을 생성합니다.
 * ApiError 인스턴스인 경우 해당 정보를 사용하고, 그렇지 않으면 기본 메시지와 상태 코드를 사용합니다.
 * @param error 발생한 에러 객체
 * @param defaultMessage ApiError가 아닐 경우 사용할 기본 에러 메시지
 * @param defaultStatus ApiError가 아닐 경우 사용할 기본 HTTP 상태 코드
 * @returns NextResponse 객체
 */
export function handleApiError(
  error: unknown,
  defaultMessage: string = "요청 처리 중 서버 내부 오류가 발생했습니다.", // 기본 메시지 수정
  defaultStatus: number = 500
): NextResponse {
  if (error instanceof ApiError) {
    const errorResponse: { error: string; details?: unknown } = {
      error: error.message,
    };
    if (error.details) {
      errorResponse.details = error.details;
    }
    return NextResponse.json(errorResponse, { status: error.statusCode });
  }

  console.error("[Unhandled API Error]:", error);

  return NextResponse.json(
    { error: defaultMessage },
    { status: defaultStatus }
  );
}
```

```ts
/* ./src/lib/authOptions.ts */
// src/lib/authOptions.ts
import { NextAuthOptions, User as NextAuthUser } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { Adapter } from "next-auth/adapters"; // Adapter 타입을 명시적으로 가져옴
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma"; // prisma 클라이언트 경로 확인

export const authOptions: NextAuthOptions = {
  // Prisma 어댑터 설정
  // PrismaAdapter 타입 캐스팅 추가 (필요시 유지, 보통은 자동 추론)
  adapter: PrismaAdapter(prisma) as Adapter,

  // 사용할 인증 프로바이더 설정 (Google)
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // 요청할 스코프 (기본값: openid email profile)
      // authorization: { params: { scope: "openid email profile" } },
    }),
    // 다른 프로바이더 (예: Kakao, Naver)도 여기에 추가 가능
  ],

  // 세션 관리 전략
  session: {
    strategy: "jwt", // JWT (JSON Web Token) 사용을 권장
    // maxAge: 30 * 24 * 60 * 60, // 30일 (선택 사항)
    // updateAge: 24 * 60 * 60, // 24시간마다 업데이트 (선택 사항)
  },

  // 콜백 함수 설정
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      // 기본적으로 모든 로그인 허용
      console.log("signIn", { user, account, profile, email, credentials });
      return true;
    },
    async redirect({ url, baseUrl }) {
      // 기본 동작 유지
      return url.startsWith(baseUrl) ? url : baseUrl;
    },

    // user
    async session({ session, token, user }) {
      console.log("session", { session, token, user });

      // 클라이언트로 전송될 세션 객체를 커스터마이징합니다.
      if (token && session.user) {
        // Prisma User 모델의 ID (cuid 또는 uuid)를 세션에 포함
        (session.user as NextAuthUser & { id: string }).id =
          token.sub as string;
        // 필요한 경우 다른 정보도 추가 (예: 역할)
        // (session.user as any).role = token.role;
      }
      return session;
    },

    async jwt({ token, user, account, profile, isNewUser }) {
      console.log("jwt", { token, user, account, profile, isNewUser });

      // JWT가 생성되거나 업데이트될 때마다 호출됩니다.
      if (user) {
        // 로그인 시 사용자 ID(token.sub)는 NextAuth가 자동으로 user.id로 설정합니다.
        // 필요한 경우 사용자 역할(role) 등의 정보를 token에 추가할 수 있습니다.
        // const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        // if (dbUser?.role) { // User 모델에 role 필드가 있다면
        //   token.role = dbUser.role;
        // }
      }
      return token;
    },
  },

  // 디버깅 (개발 환경에서만 유용)
  debug: process.env.NODE_ENV === "development",

  // NextAuth.js가 사용하는 시크릿 값 (JWT 서명 등에 사용)
  secret: process.env.NEXTAUTH_SECRET,

  // 커스텀 페이지 (선택 사항)
  pages: {
    signIn: "/auth/signin",
    // signOut: '/auth/signout', // 필요시 주석 해제
    // error: '/auth/error', // 필요시 주석 해제
    // verifyRequest: '/auth/verify-request', // 이메일 인증 시 필요
    // newUser: '/auth/new-user' // 새 사용자 등록 후 리디렉션 (주의: 자동 생성 아님)
  },

  // 이벤트 (선택 사항)
  // events: {
  //   async signIn(message) { /* 사용자 로그인 시 */ },
  //   async signOut(message) { /* 사용자 로그아웃 시 */ },
  //   async createUser(message) { /* 사용자 최초 생성 시 (DB 어댑터 사용) */ },
  //   async updateUser(message) { /* 사용자 정보 업데이트 시 (DB 어댑터 사용) */ },
  //   async linkAccount(message) { /* 계정 연결 시 */ },
  //   async session(message) { /* 세션 조회 시 */ },
  // },
};
```

```ts
/* ./src/lib/authUtils.ts */
import { getServerSession, type Session } from "next-auth";
import { type User as NextAuthUser } from "next-auth"; // 중복된 Session import를 제거하고 User만 가져옵니다.
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/authOptions";

// NextAuthUser에 id 속성이 있다고 가정합니다.
// 실제 User 타입 정의에 따라 수정 필요할 수 있습니다.
interface UserWithId extends NextAuthUser {
  id: string;
}

// 인증이 필요한 API 핸들러 타입 (userId 포함, context.params 제네릭)
// context.params가 Promise를 반환하도록 수정
export type AuthenticatedApiHandlerWithParams<P = unknown> = (
  request: Request,
  context: { params: Promise<P> }, // 수정: P -> Promise<P>
  userId: string
) => Promise<NextResponse> | NextResponse;

/**
 * API 라우트 핸들러를 위한 고차 함수입니다.
 * 요청을 가로채 먼저 인증을 수행하고, 성공 시 핸들러 함수에 userId를 전달합니다.
 * 인증 실패 시 401 Unauthorized 응답을 반환합니다.
 * 핸들러 내부에서 발생하는 에러는 핸들러가 직접 ApiError 등을 사용하여 처리하고
 * NextResponse.json()으로 반환하도록 기대합니다.
 * @param handler 인증된 사용자 ID를 필요로 하는 API 핸들러 함수
 * @returns Next.js API 라우트 핸들러 함수
 */
export function withAuth<P = unknown>(
  handler: AuthenticatedApiHandlerWithParams<P>
) {
  // 반환되는 함수의 context.params도 Promise를 반환하도록 수정
  return async (
    request: Request,
    context: { params: Promise<P> } // 수정: P -> Promise<P>
  ): Promise<NextResponse> => {
    const session: Session | null = await getServerSession(authOptions);

    if (!session || !session.user || !(session.user as UserWithId).id) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }

    const userId = (session.user as UserWithId).id;

    return handler(request, context, userId);
  };
}
```

```ts
/* ./src/lib/db/categoriesDb.ts */
import { prisma } from "@/lib/prisma";

/**
 * 모든 카테고리 목록을 이름 오름차순으로 조회합니다.
 * @returns 카테고리 목록 배열
 */
export async function getAllCategoriesDb(workspaceId: string) {
  return prisma.category.findMany({
    where: { workspaceId }, // workspaceId로 필터링
    orderBy: { name: "asc" },
  });
}
```

```ts
/* ./src/lib/db/statsDb.ts */
// src/lib/db/statsDb.ts
import { prisma } from "@/lib/prisma";
import { format, eachMonthOfInterval } from "date-fns";

/**
 * 주어진 날짜 범위와 워크스페이스 내의 수입과 지출 합계를 계산합니다.
 * @param workspaceId 대상 워크스페이스 ID
 * @param start - 시작 날짜
 * @param end - 종료 날짜
 * @returns 수입, 지출, 잔액 객체
 */
export async function getStatsByDateRangeDb(
  workspaceId: string,
  start: Date,
  end: Date
) {
  const incomeSum = await prisma.transaction.aggregate({
    where: {
      workspaceId, // 추가
      date: { gte: start, lte: end },
      type: "income",
    },
    _sum: {
      amount: true,
    },
  });

  const expenseSum = await prisma.transaction.aggregate({
    where: {
      workspaceId, // 추가
      date: { gte: start, lte: end },
      type: "expense",
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
    },
    _sum: {
      amount: true,
    },
  });

  const income = incomeSum._sum.amount || 0;
  const expense = expenseSum._sum.amount || 0;
  const balance = income - expense;

  return {
    income,
    expense,
    balance,
  };
}

/**
 * 특정 월 시작일 이전의 모든 거래를 바탕으로 이월 잔액을 계산합니다.
 * @param currentMonthStart - 현재 월의 시작 날짜
 * @returns 이월 잔액
 */
export async function getCarryOverBalanceDb(
  workspaceId: string,
  currentMonthStart: Date
) {
  const prevIncomeSum = await prisma.transaction.aggregate({
    where: {
      workspaceId,
      date: { lt: currentMonthStart },
      type: "income",
    },
    _sum: { amount: true },
  });

  const prevExpenseSum = await prisma.transaction.aggregate({
    where: {
      workspaceId,
      date: { lt: currentMonthStart },
      type: "expense",
      // --- 할부 원거래 제외 로직 추가 ---
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
      // ----------------------------------
    },
    _sum: { amount: true },
  });

  return (prevIncomeSum._sum.amount || 0) - (prevExpenseSum._sum.amount || 0);
}

/**
 * 주어진 날짜 범위 내의 일별 수입/지출 트렌드를 데이터베이스에서 조회합니다.
 * @param start - 시작 날짜
 * @param end - 종료 날짜
 * @returns 일별 트렌드 데이터 배열 (날짜, 지출, 수입 포함)
 */
export async function getDailyTrendInRangeDb(
  workspaceId: string,
  start: Date,
  end: Date
) {
  const dailyExpenses = await prisma.transaction.groupBy({
    by: ["date"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "expense",
      // --- 할부 원거래 제외 로직 추가 ---
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
      // ----------------------------------
    },
    _sum: { amount: true },
    orderBy: { date: "asc" },
  });

  const dailyIncomes = await prisma.transaction.groupBy({
    by: ["date"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "income",
    },
    _sum: { amount: true },
    orderBy: { date: "asc" },
  });

  // 데이터베이스 결과를 기반으로 트렌드 데이터 조합 (서비스 계층 또는 유틸리티로 이동 가능)
  // 여기서는 DB 계층에 두지만, 조합 로직이 복잡해지면 분리 고려
  const daysInPeriod: {
    [key: string]: { date: string; expense: number; income: number };
  } = {};
  const currentDate = new Date(start); // 원본 start를 변경하지 않도록 복사
  while (currentDate <= end) {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    daysInPeriod[dateStr] = { date: dateStr, expense: 0, income: 0 };
    currentDate.setDate(currentDate.getDate() + 1);
  }

  dailyExpenses.forEach((item) => {
    const dateStr = format(item.date, "yyyy-MM-dd");
    if (daysInPeriod[dateStr]) {
      daysInPeriod[dateStr].expense = item._sum.amount || 0;
    }
  });

  dailyIncomes.forEach((item) => {
    const dateStr = format(item.date, "yyyy-MM-dd");
    if (daysInPeriod[dateStr]) {
      daysInPeriod[dateStr].income = item._sum.amount || 0;
    }
  });

  return Object.values(daysInPeriod).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/**
 * 주어진 날짜 범위 내의 월별 수입/지출 트렌드를 데이터베이스에서 조회합니다.
 * @param start - 시작 날짜
 * @param end - 종료 날짜
 * @returns 월별 트렌드 데이터 배열 (날짜, 지출, 수입 포함)
 */
export async function getMonthlyTrendInRangeDb(
  workspaceId: string,
  start: Date,
  end: Date
) {
  // 월별 수입 집계
  const monthlyIncomesPromise = prisma.transaction.groupBy({
    by: ["date"], // Prisma에서는 날짜 필드를 직접 사용하고, JS에서 월별로 포맷팅합니다.
    // 실제 DB에서는 date_trunc('month', date) 등을 사용할 수 있지만, Prisma groupBy는 필드명 직접 사용
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "income",
    },
    _sum: { amount: true },
    orderBy: { date: "asc" },
  });

  // 월별 지출 집계
  const monthlyExpensesPromise = prisma.transaction.groupBy({
    by: ["date"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "expense",
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
    },
    _sum: { amount: true },
    orderBy: { date: "asc" },
  });

  const [monthlyIncomes, monthlyExpenses] = await Promise.all([
    monthlyIncomesPromise,
    monthlyExpensesPromise,
  ]);

  // 결과를 월별로 집계하고 병합 (JS에서 처리)
  const trendMap: Map<
    string,
    { date: string; income: number; expense: number }
  > = new Map();

  // 모든 관련 월을 순회하기 위해 기준 월 목록 생성
  const monthsInInterval = eachMonthOfInterval({ start, end });
  monthsInInterval.forEach((monthDate) => {
    const monthStr = format(monthDate, "yyyy-MM");
    trendMap.set(monthStr, { date: monthStr, income: 0, expense: 0 });
  });

  monthlyIncomes.forEach((item) => {
    const monthStr = format(item.date, "yyyy-MM"); // item.date는 Date 객체
    if (trendMap.has(monthStr)) {
      trendMap.get(monthStr)!.income = item._sum.amount || 0;
    }
  });

  monthlyExpenses.forEach((item) => {
    const monthStr = format(item.date, "yyyy-MM");
    if (trendMap.has(monthStr)) {
      trendMap.get(monthStr)!.expense = item._sum.amount || 0;
    }
  });

  return Array.from(trendMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/**
 * 주어진 날짜 범위 내의 연도별 수입/지출 트렌드를 데이터베이스에서 조회합니다.
 * @param start - 시작 날짜
 * @param end - 종료 날짜
 * @returns 연도별 트렌드 데이터 배열 (연도, 지출, 수입 포함)
 */
export async function getYearlyTrendInRangeDb(
  workspaceId: string,
  start: Date,
  end: Date
) {
  // 연도별 수입 집계
  const yearlyIncomesPromise = prisma.transaction.groupBy({
    by: ["date"], // Prisma에서는 날짜 필드를 직접 사용하고, JS에서 연도별로 포맷팅합니다.
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "income",
    },
    _sum: { amount: true },
    orderBy: { date: "asc" }, // 정렬은 그룹화된 'date' 기준
  });

  // 연도별 지출 집계
  const yearlyExpensesPromise = prisma.transaction.groupBy({
    by: ["date"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "expense",
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
    },
    _sum: { amount: true },
    orderBy: { date: "asc" },
  });

  const [yearlyIncomes, yearlyExpenses] = await Promise.all([
    yearlyIncomesPromise,
    yearlyExpensesPromise,
  ]);

  // 결과를 연도별로 집계하고 병합 (JS에서 처리)
  const trendMap: Map<
    string,
    { year: string; income: number; expense: number }
  > = new Map();

  // 모든 관련 연도를 순회하기 위해 기준 연도 목록 생성 (start와 end를 기준으로)
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  for (let year = startYear; year <= endYear; year++) {
    const yearStr = year.toString();
    trendMap.set(yearStr, { year: yearStr, income: 0, expense: 0 });
  }

  yearlyIncomes.forEach((item) => {
    const yearStr = format(item.date, "yyyy"); // item.date는 Date 객체
    if (trendMap.has(yearStr)) {
      trendMap.get(yearStr)!.income = item._sum.amount || 0;
    }
  });

  yearlyExpenses.forEach((item) => {
    const yearStr = format(item.date, "yyyy");
    if (trendMap.has(yearStr)) {
      trendMap.get(yearStr)!.expense = item._sum.amount || 0;
    }
  });

  return Array.from(trendMap.values()).sort((a, b) =>
    a.year.localeCompare(b.year)
  );
}

/**
 * 주어진 날짜 범위 내의 카테고리별 지출 및 수입 데이터를 데이터베이스에서 조회합니다.
 * @param start - 시작 날짜
 * @param end - 종료 날짜
 * @returns 카테고리별 지출 데이터, 수입 데이터, 총 지출, 총 수입 객체
 */
export async function getCategoryDataInRangeDb(
  workspaceId: string,
  start: Date,
  end: Date
) {
  const expenseByCategoryPromise = prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "expense",
      NOT: {
        isInstallment: true,
        originalTransactionId: null,
      },
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  const incomeByCategoryPromise = prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      workspaceId,
      date: { gte: start, lte: end },
      type: "income",
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  const [expenseByCategory, incomeByCategory] = await Promise.all([
    expenseByCategoryPromise,
    incomeByCategoryPromise,
  ]);

  const allCategoryIds = [
    ...expenseByCategory.map((item) => item.categoryId),
    ...incomeByCategory.map((item) => item.categoryId),
  ].filter((id): id is number => id !== null && id !== undefined);

  const categoryMap = new Map<number, string>();

  if (allCategoryIds.length > 0) {
    const categoriesData = await prisma.category.findMany({
      where: { id: { in: allCategoryIds } },
      select: { id: true, name: true },
    });
    categoriesData.forEach((cat) => categoryMap.set(cat.id, cat.name));
  }

  const totalExpense = expenseByCategory.reduce(
    (sum, item) => sum + (item._sum.amount || 0),
    0
  );
  const totalIncome = incomeByCategory.reduce(
    (sum, item) => sum + (item._sum.amount || 0),
    0
  );

  const expenseData = expenseByCategory
    .map((item) => {
      const amount = item._sum.amount || 0;
      const categoryName = item.categoryId
        ? categoryMap.get(item.categoryId) || "알 수 없음"
        : "카테고리 없음";
      return {
        categoryId: item.categoryId,
        categoryName: categoryName,
        amount,
        percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const incomeData = incomeByCategory
    .map((item) => {
      const amount = item._sum.amount || 0;
      const categoryName = item.categoryId
        ? categoryMap.get(item.categoryId) || "알 수 없음"
        : "카테고리 없음";
      return {
        categoryId: item.categoryId,
        categoryName: categoryName,
        amount,
        percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return {
    expenseData,
    incomeData,
    totalExpense,
    totalIncome,
  };
}
```

```ts
/* ./src/lib/db/transactionsDb.ts */
/* ./src/lib/db/transactionsDb.ts */
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import type {
  CreateTransactionPayload,
  UpdateTransactionPayload,
  GetTransactionsQuery,
} from '@/lib/schemas/transactionsApiSchemas';
import { calculateEstimatedInstallmentFee } from '@/lib/financeUtils';
// 새로 추가된 유틸리티 함수 임포트 (경로는 실제 프로젝트 구조에 맞게 조정)
import {
  calculateInstallmentAmounts,
  calculateNthInstallmentPaymentDate,
  calculateNthInstallmentFeeOnly,
} from '@/lib/financeUtils'; // 기졸 financeUtils.ts에 추가 가정
import { startOfDay } from 'date-fns';

import type { TransactionData } from '@/types/transactionTypes';
import { CardIssuer } from '@/types/commonTypes';

interface CreateTransactionDbPayload extends CreateTransactionPayload {
  workspaceId: string;
  createdById: string; // 로그인한 사용자 ID
}

/**
 * 거래 내역을 생성합니다.
 * 할부 원거래의 경우, 개별 할부금 레코드들을 "다음 달 10일" 기준으로 자동 생성합니다.
 * @param data - 생성할 거래 데이터 (CreateTransactionPayload 타입)
 * @returns 생성된 거래 객체 (할부 원거래의 경우 원거래 객체)
 */
export async function createTransactionDb(data: CreateTransactionDbPayload) {
  return prisma.$transaction(async (tx) => {
    const {
      date: purchaseDateString,
      amount,
      type,
      description,
      categoryId,
      isInstallment,
      installmentMonths,
      totalInstallmentAmount,
      installmentCardIssuer,
      workspaceId,
      createdById,
    } = data;

    const purchaseDate = new Date(purchaseDateString);

    // 할부 원거래의 경우, 'amount' 필드에 'totalInstallmentAmount'를 사용.
    // 'totalInstallmentAmount'가 없으면 API 요청의 'amount'를 총액으로 간주.
    const actualTotalInstallmentAmount = isInstallment ? totalInstallmentAmount || amount : amount;

    let estimatedFee: number | null = null;
    if (
      isInstallment &&
      type === 'expense' &&
      actualTotalInstallmentAmount &&
      installmentMonths &&
      installmentMonths >= 2
    ) {
      estimatedFee = calculateEstimatedInstallmentFee(
        actualTotalInstallmentAmount,
        installmentMonths,
        purchaseDate,
        installmentCardIssuer,
        'max'
      );
    }

    // 1. 할부 원거래 또는 일반 거래 생성
    const originalTransaction = await tx.transaction.create({
      data: {
        date: purchaseDate,
        amount: actualTotalInstallmentAmount,
        type,
        description,
        category: { connect: { id: categoryId } },
        isInstallment: isInstallment || false,
        installmentMonths: isInstallment ? installmentMonths : null,
        currentInstallmentNumber: null,
        totalInstallmentAmount: isInstallment ? actualTotalInstallmentAmount : null,
        originalTransactionId: null,
        installmentCardIssuer: isInstallment ? installmentCardIssuer : null,
        estimatedInstallmentFee: isInstallment ? estimatedFee : null,
        workspace: { connect: { id: workspaceId } }, // 워크스페이스 연결
        createdBy: { connect: { id: createdById } }, // 작성자 연결
      },
    });

    // 2. 할부 원거래이고, 지출 타입이며, 할부 조건이 유효한 경우 개별 할부금 레코드 생성
    if (
      isInstallment &&
      type === 'expense' &&
      installmentMonths &&
      installmentMonths > 0 &&
      actualTotalInstallmentAmount &&
      actualTotalInstallmentAmount > 0
    ) {
      const installmentAmounts = calculateInstallmentAmounts(
        actualTotalInstallmentAmount,
        installmentMonths,
        purchaseDate,
        installmentCardIssuer,
        'max'
      );

      const installmentDataToCreate: Prisma.TransactionCreateManyInput[] = [];
      for (let i = 0; i < installmentMonths; i++) {
        const paymentDate = calculateNthInstallmentPaymentDate(purchaseDate, i + 1);
        const singleInstallmentAmount = installmentAmounts[i];

        installmentDataToCreate.push({
          date: paymentDate,
          amount: singleInstallmentAmount,
          type,
          description: `${description || '할부'} (${i + 1}/${installmentMonths}회)`,
          categoryId,
          isInstallment: true,
          installmentMonths,
          currentInstallmentNumber: i + 1,
          totalInstallmentAmount: actualTotalInstallmentAmount,
          originalTransactionId: originalTransaction.id,
          installmentCardIssuer,
          estimatedInstallmentFee: null,
          workspaceId,
          createdById,
        });
      }

      if (installmentDataToCreate.length > 0) {
        await tx.transaction.createMany({
          data: installmentDataToCreate,
        });
      }
    }
    return originalTransaction; // 할부 원거래 또는 일반 거래 객체 반환
  });
}

// 스키마(transactionsApiSchemas.ts) UpdateTransactionPayload에 workspaceId가 추가되었다고 가정 (권한 검증용)
interface UpdateTransactionDbPayload extends UpdateTransactionPayload {
  workspaceId: string; // 권한 검증 및 데이터 격리
  // userId?: string; // 수정 권한자 ID (선택적, 서비스 계층에서 처리)
}

/**
 * 거래 내역을 데이터베이스에서 수정합니다.
 * 할부 조건 변경 시, 연결된 개별 할부금 레코드들을 삭제 후 재생성합니다.
 * @param id - 수정할 거래 ID (주로 할부 원거래의 ID)
 * @param data - 수정할 거래 데이터 (UpdateTransactionPayload 타입)
 * @returns 수정된 거래 객체 (원거래 객체)
 */
export async function updateTransactionDb(id: number, data: UpdateTransactionDbPayload) {
  const { workspaceId, ...updatePayload } = data;

  return prisma.$transaction(async (tx) => {
    // 1. 기존 거래 정보 조회
    const existingTransaction = await tx.transaction.findUnique({
      where: { id, workspaceId }, // workspaceId 조건 추가
    });

    if (!existingTransaction) {
      console.error(`[updateTransactionDb] Transaction not found for ID: ${id}`);
      throw new Error(`수정할 거래(ID: ${id})를 찾을 수 없습니다.`);
    }
    console.log(`[updateTransactionDb] Found existing transaction:`, existingTransaction);

    // 2. 이 거래가 '할부 원거래'였는지 확인
    const wasOriginalInstallment =
      existingTransaction.isInstallment && !existingTransaction.originalTransactionId;
    console.log(`[updateTransactionDb] Was original installment? ${wasOriginalInstallment}`); // <<-- 로그 추가 (3)

    // 3. '할부 원거래'였다면, 연결된 기존 개별 할부금 레코드들을 먼저 삭제
    if (wasOriginalInstallment) {
      console.log(
        `[updateTransactionDb] Attempting to delete child installments for original ID: ${id}`
      );
      const deleteResult = await tx.transaction.deleteMany({
        // deleteResult 변수 추가
        where: { originalTransactionId: id, workspaceId },
      });
      console.log(`[updateTransactionDb] Deleted ${deleteResult.count} child installments.`); // <<-- 로그 추가 (4) - 삭제된 개수 확인
    }

    // 4. 업데이트 데이터 준비 (기존 로직과 동일)
    const updateDataForTarget: Prisma.TransactionUpdateInput = {};

    if (updatePayload.date) updateDataForTarget.date = new Date(updatePayload.date);
    if (updatePayload.type) updateDataForTarget.type = updatePayload.type;
    if (updatePayload.description !== undefined) updateDataForTarget.description = data.description;

    if (updatePayload.categoryId !== undefined) {
      updateDataForTarget.category = {
        connect: { id: updatePayload.categoryId },
      };
    }

    const newIsInstallment =
      updatePayload.isInstallment !== undefined
        ? updatePayload.isInstallment
        : existingTransaction.isInstallment;
    const newInstallmentMonths =
      updatePayload.installmentMonths !== undefined
        ? updatePayload.installmentMonths
        : existingTransaction.installmentMonths;
    let newTotalInstallmentAmount =
      updatePayload.totalInstallmentAmount !== undefined
        ? updatePayload.totalInstallmentAmount
        : existingTransaction.totalInstallmentAmount;
    const newInstallmentCardIssuer =
      updatePayload.installmentCardIssuer !== undefined
        ? updatePayload.installmentCardIssuer
        : existingTransaction.installmentCardIssuer;

    if (
      newIsInstallment &&
      newTotalInstallmentAmount === undefined &&
      updatePayload.amount !== undefined
    ) {
      newTotalInstallmentAmount = updatePayload.amount;
    }

    if (newIsInstallment) {
      // 기존 거래가 '개별 할부금'이었는지 확인
      if (
        existingTransaction.originalTransactionId &&
        !updatePayload.originalTransactionId &&
        updatePayload.originalTransactionId !== null
      ) {
        // --- 개별 할부금 내용만 수정하는 경우 (예: 설명 변경) ---
        // 이 경우, 주요 할부 정보는 기존 값을 유지해야 합니다.
        // TransactionEditModal에서 description만 보내므로, data 객체에는 isInstallment, amount 등이 없을 것입니다.
        // 따라서 existingTransaction의 값을 최대한 활용합니다.

        updateDataForTarget.isInstallment = true; // 할부 상태 유지
        // 필수 할부 정보는 기존 거래에서 가져옴 (payload에 없으면)
        updateDataForTarget.installmentMonths =
          updatePayload.installmentMonths !== undefined
            ? updatePayload.installmentMonths
            : existingTransaction.installmentMonths;
        updateDataForTarget.totalInstallmentAmount =
          updatePayload.totalInstallmentAmount !== undefined
            ? updatePayload.totalInstallmentAmount
            : existingTransaction.totalInstallmentAmount;
        updateDataForTarget.installmentCardIssuer =
          updatePayload.installmentCardIssuer !== undefined
            ? updatePayload.installmentCardIssuer
            : existingTransaction.installmentCardIssuer;

        // 개별 할부금의 amount, currentInstallmentNumber, originalTransactionId는 변경하지 않거나,
        // 명시적으로 payload에 해당 필드가 있을 때만 업데이트하도록 처리해야 합니다.
        // 현재 TransactionEditModal은 설명만 보내므로, 아래는 기존 값을 유지하는 방향입니다.
        updateDataForTarget.amount =
          updatePayload.amount !== undefined ? updatePayload.amount : existingTransaction.amount; // 기존 회차 금액 유지
        updateDataForTarget.currentInstallmentNumber =
          updatePayload.currentInstallmentNumber !== undefined
            ? updatePayload.currentInstallmentNumber
            : existingTransaction.currentInstallmentNumber; // 기존 회차 정보 유지
        updateDataForTarget.originalTransactionId = existingTransaction.originalTransactionId; // 기존 원거래 ID 유지

        // 개별 할부금 수정 시에는 estimatedInstallmentFee를 원거래 기준으로 재계산하지 않거나, null로 설정합니다.
        updateDataForTarget.estimatedInstallmentFee = existingTransaction.estimatedInstallmentFee; // 또는 null
      } else {
        // --- 할부 원거래를 생성 또는 수정하는 경우 ---
        if ((updatePayload.type || existingTransaction.type) === 'income') {
          throw new Error('수입 거래는 할부로 설정할 수 없습니다.');
        }
        // installmentMonths, totalInstallmentAmount, installmentCardIssuer 유효성 검사는 스키마 및 API 핸들러에서 처리됨을 가정합니다.
        if (!newInstallmentMonths || newInstallmentMonths < 2) {
          throw new Error('할부 개월수는 2개월 이상이어야 합니다.');
        }
        if (!newTotalInstallmentAmount || newTotalInstallmentAmount <= 0) {
          throw new Error('총 할부 금액은 0보다 커야 합니다.');
        }
        // 카드사 정보는 newInstallmentCardIssuer를 사용 (payload에 없으면 existingTransaction 값)

        updateDataForTarget.isInstallment = true;
        updateDataForTarget.installmentMonths = newInstallmentMonths;
        updateDataForTarget.totalInstallmentAmount = newTotalInstallmentAmount;
        updateDataForTarget.installmentCardIssuer = newInstallmentCardIssuer;
        updateDataForTarget.amount = newTotalInstallmentAmount; // 원거래 amount는 총액
        updateDataForTarget.currentInstallmentNumber = null; // 원거래는 회차 정보 없음
        updateDataForTarget.originalTransactionId = null; // 원거래는 스스로가 원거래

        // effectivePurchaseDate를 결정 (업데이트 시 날짜가 변경될 수 있으므로)
        const effectivePurchaseDateForFee = updatePayload.date
          ? new Date(updatePayload.date)
          : existingTransaction.date;

        updateDataForTarget.estimatedInstallmentFee = calculateEstimatedInstallmentFee(
          newTotalInstallmentAmount!,
          newInstallmentMonths!,
          effectivePurchaseDateForFee,
          newInstallmentCardIssuer,
          'max'
        );
        // 이 경우, 연결된 기존 개별 할부금 삭제 및 재생성 로직(shouldRegenerateChildren)이 뒤따릅니다.
      }
    } else {
      // 일반 거래로 설정/수정
      updateDataForTarget.isInstallment = false;
      updateDataForTarget.installmentMonths = null;
      updateDataForTarget.totalInstallmentAmount = null;
      updateDataForTarget.currentInstallmentNumber = null;
      updateDataForTarget.originalTransactionId = null; // 만약 개별 할부금이었다면 연결 끊기
      updateDataForTarget.installmentCardIssuer = null;
      updateDataForTarget.estimatedInstallmentFee = null;
      if (data.amount !== undefined) {
        updateDataForTarget.amount = data.amount;
      } else if (!newIsInstallment && existingTransaction.isInstallment) {
        // 할부에서 일반으로 변경 시 amount 처리 (기존 총액 사용 또는 에러 필요)
        updateDataForTarget.amount =
          existingTransaction.totalInstallmentAmount || existingTransaction.amount;
      }
    }

    console.log(`[updateTransactionDb] Prepared update data for ID ${id}:`, updateDataForTarget); // <<-- 로그 추가 (5)

    // 5. 전달된 ID의 레코드 업데이트 실행
    const updatedTransaction = await tx.transaction.update({
      where: { id },
      data: updateDataForTarget,
    });
    console.log('Updated transaction (ID:%s):', id, updatedTransaction);

    // 6. 새로운 조건으로 개별 할부금 레코드 재생성 (조건 수정됨)
    const shouldRegenerateChildren =
      updatedTransaction.isInstallment &&
      updatedTransaction.type === 'expense' &&
      updatedTransaction.installmentMonths &&
      updatedTransaction.installmentMonths > 0 &&
      updatedTransaction.totalInstallmentAmount &&
      updatedTransaction.totalInstallmentAmount > 0 &&
      !updatedTransaction.originalTransactionId; // <<-- 핵심 조건!

    if (shouldRegenerateChildren) {
      console.log('Regenerating child installments for original ID:', updatedTransaction.id);
      const basePurchaseDateForRegeneration = updatedTransaction.date;

      const installmentAmounts = calculateInstallmentAmounts(
        updatedTransaction.totalInstallmentAmount as number,
        updatedTransaction.installmentMonths as number,
        basePurchaseDateForRegeneration,
        updatedTransaction.installmentCardIssuer,
        'max'
      );

      const installmentDataToCreate: Prisma.TransactionCreateManyInput[] = [];
      for (let i = 0; i < (updatedTransaction.installmentMonths as number); i++) {
        const paymentDate = calculateNthInstallmentPaymentDate(
          basePurchaseDateForRegeneration,
          i + 1
        );
        const singleInstallmentAmount = installmentAmounts[i];

        installmentDataToCreate.push({
          date: paymentDate,
          amount: singleInstallmentAmount,
          type: updatedTransaction.type,
          description: `${updatedTransaction.description || '할부'} (${i + 1}/${
            updatedTransaction.installmentMonths
          }회)`,
          categoryId: updatedTransaction.categoryId,
          isInstallment: true,
          installmentMonths: updatedTransaction.installmentMonths as number,
          currentInstallmentNumber: i + 1,
          totalInstallmentAmount: updatedTransaction.totalInstallmentAmount as number,
          originalTransactionId: updatedTransaction.id,
          installmentCardIssuer: updatedTransaction.installmentCardIssuer,
          estimatedInstallmentFee: null,
          workspaceId: workspaceId,
          createdById: existingTransaction.createdById!,
        });
      }

      if (installmentDataToCreate.length > 0) {
        await tx.transaction.createMany({
          data: installmentDataToCreate,
        });
      }
    }

    // 수정된 레코드(원거래 또는 개별 할부금 또는 일반거래) 반환
    return updatedTransaction;
  });
}

// --- findTransactionByIdDb, deleteTransactionDb, getTransactionsDb, findCategoryByIdDb 함수는 이전과 동일 ---
// deleteTransactionDb는 할부 원거래 삭제 시 연결된 개별 할부금도 함께 삭제하도록 이미 $transaction을 사용하고 있습니다.

export async function findTransactionByIdDb(id: number, workspaceId: string) {
  return prisma.transaction.findUnique({
    where: { id, workspaceId }, // workspaceId 조건 추가
    include: {
      category: true,
    },
  });
}

export async function deleteTransactionDb(id: number, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    const transactionToDelete = await tx.transaction.findUnique({
      where: { id, workspaceId }, // workspaceId 조건 추가
      select: {
        isInstallment: true,
        originalTransactionId: true,
        workspaceId: true,
      },
    });

    if (!transactionToDelete || transactionToDelete.workspaceId !== workspaceId) {
      throw new Error(`삭제할 거래(ID: ${id})를 찾을 수 없거나 권한이 없습니다.`);
    }

    if (transactionToDelete.isInstallment && !transactionToDelete.originalTransactionId) {
      await tx.transaction.deleteMany({
        where: { originalTransactionId: id, workspaceId }, // workspaceId 조건 추가
      });
    }

    const deletedTransaction = await tx.transaction.delete({
      where: { id, workspaceId }, // workspaceId 조건 추가
    });

    return deletedTransaction;
  });
}

interface GetTransactionsDbQuery extends GetTransactionsQuery {
  workspaceId: string;
}

export async function getTransactionsDb(query: GetTransactionsDbQuery) {
  const {
    workspaceId,
    type,
    startDate,
    endDate,
    categoryId,
    keyword,
    minAmount,
    maxAmount,
    sortBy = 'date',
    sortOrder = 'desc',
    isInstallment,
    originalTransactionId,
  } = query;

  const filter: Prisma.TransactionWhereInput = {
    workspaceId,
  };

  if (type) filter.type = type;
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.gte = startOfDay(new Date(startDate));
    if (endDate) {
      const endOfDay = new Date(new Date(endDate));
      endOfDay.setHours(23, 59, 59, 999);
      filter.date.lte = endOfDay;
    }
  }
  if (categoryId) filter.categoryId = categoryId;
  if (keyword) {
    filter.description = { contains: keyword };
  }

  if (minAmount !== undefined) {
    if (!filter.amount || typeof filter.amount !== 'object') {
      filter.amount = {};
    }
    (filter.amount as Prisma.FloatFilter).gte = minAmount;
  }
  if (maxAmount !== undefined) {
    if (!filter.amount || typeof filter.amount !== 'object') {
      filter.amount = {};
    }
    (filter.amount as Prisma.FloatFilter).lte = maxAmount;
  }

  if (isInstallment !== undefined) filter.isInstallment = isInstallment;
  if (originalTransactionId !== undefined) filter.originalTransactionId = originalTransactionId;

  const prismaTransactions = await prisma.transaction.findMany({
    where: filter,
    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      category: true,
    },
  });

  const totalCount = await prisma.transaction.count({
    where: filter,
  });

  // 월별 할부 수수료 계산을 위해 원거래 정보 조회
  const originalTransactionIds = prismaTransactions
    .filter((tx) => tx.isInstallment && tx.originalTransactionId)
    .map((tx) => tx.originalTransactionId as number);

  const originalTransactionsMap = new Map<
    number,
    {
      id: number;
      estimatedInstallmentFee: number | null;
      totalInstallmentAmount: number | null;
      installmentMonths: number | null;
      date: Date;
      installmentCardIssuer: string | null;
    }
  >();
  if (originalTransactionIds.length > 0) {
    const uniqueOriginalTransactionIds = Array.from(new Set(originalTransactionIds));
    const fetchedOriginalTransactions = await prisma.transaction.findMany({
      where: {
        id: { in: uniqueOriginalTransactionIds },
        workspaceId,
      },
      select: {
        id: true,
        estimatedInstallmentFee: true,
        totalInstallmentAmount: true,
        installmentMonths: true,
        date: true,
        installmentCardIssuer: true,
      },
    });
    fetchedOriginalTransactions.forEach((otx) => {
      if (
        otx.totalInstallmentAmount !== null &&
        otx.installmentMonths !== null &&
        otx.date !== null
      ) {
        originalTransactionsMap.set(otx.id, {
          id: otx.id,
          estimatedInstallmentFee: otx.estimatedInstallmentFee,
          totalInstallmentAmount: otx.totalInstallmentAmount,
          installmentMonths: otx.installmentMonths,
          date: otx.date,
          installmentCardIssuer: otx.installmentCardIssuer,
        });
      }
    });
  }

  // Prisma 결과를 TransactionData[] 타입으로 매핑
  const transactions: TransactionData[] = prismaTransactions.map((tx) => {
    const isOriginalInstallment = tx.isInstallment && !tx.originalTransactionId;
    const isChildInstallment = tx.isInstallment && tx.originalTransactionId;

    let monthlyFee: number | null = null;
    if (isChildInstallment && tx.originalTransactionId && tx.currentInstallmentNumber) {
      const originalTxData = originalTransactionsMap.get(tx.originalTransactionId);
      if (
        originalTxData &&
        originalTxData.totalInstallmentAmount &&
        originalTxData.installmentMonths &&
        originalTxData.date
      ) {
        monthlyFee = calculateNthInstallmentFeeOnly(
          originalTxData.totalInstallmentAmount,
          originalTxData.installmentMonths,
          tx.currentInstallmentNumber,
          originalTxData.date,
          originalTxData.installmentCardIssuer,
          'max'
        );
      }
    }

    const categoryData = tx.category
      ? {
          id: tx.category.id,
          name: tx.category.name,
          type: tx.category.type as 'income' | 'expense',
        }
      : {
          id: tx.categoryId,
          name: '미분류',
          type: 'expense' as 'income' | 'expense',
        };

    return {
      id: tx.id,
      date: tx.date.toISOString(),
      amount: tx.amount,
      type: tx.type as 'income' | 'expense',
      description: tx.description || '',
      categoryId: categoryData.id,
      category: categoryData,
      isInstallment: tx.isInstallment,
      installmentMonths: tx.installmentMonths,
      currentInstallmentNumber: tx.currentInstallmentNumber,
      totalInstallmentAmount: tx.totalInstallmentAmount,
      originalTransactionId: tx.originalTransactionId,
      installmentCardIssuer: tx.installmentCardIssuer as CardIssuer,
      estimatedInstallmentFee: isOriginalInstallment ? tx.estimatedInstallmentFee : null,
      monthlyInstallmentFee: monthlyFee,
    };
  });

  return {
    transactions,
    totalCount,
  };
}

export async function findCategoryByIdDb(categoryId: number) {
  return prisma.category.findUnique({ where: { id: categoryId } });
}
```

```ts
/* ./src/lib/emailService.ts */
import nodemailer from 'nodemailer';
import { WorkspaceRole } from '@prisma/client';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Nodemailer transporter 설정
// 실제 프로덕션에서는 더 강력한 에러 처리 및 로깅, 설정 검증이 필요합니다.
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // tls: {
  //   ciphers:'SSLv3' // 간혹 TLS 협상 문제시 필요할 수 있음
  // }
});

console.log({
  host: 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // tls: {
  //   ciphers:'SSLv3' // 간혹 TLS 협상 문제시 필요할 수 있음
  // }
});

/**
 * 이메일을 발송합니다.
 * @param mailOptions 이메일 옵션 (to, subject, html 등)
 */
async function sendMail(mailOptions: MailOptions): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error(
      'SMTP 설정이 환경 변수에 올바르게 구성되지 않았습니다. 이메일을 발송할 수 없습니다.'
    );
    // 개발 환경에서는 에러를 던지는 대신 콘솔에만 출력하고,
    // 실제 발송이 필요한 경우 throw new Error('SMTP 미설정'); 등으로 처리할 수 있습니다.
    // 여기서는 로컬 개발 편의성을 위해 에러를 던지지 않습니다.
    return;
  }
  try {
    await transporter.sendMail({
      ...mailOptions,
      from: process.env.EMAIL_FROM || 'noreply@gmail.com', // 발신자 주소
    });
    console.log('Email sent successfully to:', mailOptions.to);
  } catch (error) {
    console.error('Error sending email:', error);
    // 프로덕션에서는 더 견고한 에러 로깅 및 처리 필요
    throw new Error(`Failed to send email: ${(error as Error).message}`);
  }
}

/**
 * 멤버 초대 이메일을 발송합니다.
 * @param inviteeEmail 초대받는 사람의 이메일 주소
 * @param inviterName 초대한 사람의 이름
 * @param workspaceName 워크스페이스 이름
 * @param invitationLink 초대 수락 링크
 * @param role 부여될 역할
 */
export async function sendInvitationEmail(
  inviteeEmail: string,
  inviterName: string,
  workspaceName: string,
  invitationLink: string,
  role: WorkspaceRole
): Promise<void> {
  const subject = `${inviterName}님이 ${workspaceName} 워크스페이스에 초대합니다.`;
  const text = `안녕하세요, ${inviteeEmail}님.\n\n${inviterName}님이 당신을 [${workspaceName}] 워크스페이스의 ${role} 역할로 초대했습니다.\n초대를 수락하려면 다음 링크를 클릭하세요: ${invitationLink}\n\n이 링크는 7일 후에 만료됩니다.\n\n이 초대를 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.`;
  const html = `
    <p>안녕하세요, ${inviteeEmail}님.</p>
    <p>${inviterName}님이 당신을 <strong>${workspaceName}</strong> 워크스페이스의 <strong>${role}</strong> 역할로 초대했습니다.</p>
    <p>초대를 수락하려면 아래 버튼을 클릭하세요:</p>
    <p><a href="${invitationLink}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px;">초대 수락하기</a></p>
    <p>또는 다음 링크를 브라우저에 복사하여 붙여넣으세요: <a href="${invitationLink}">${invitationLink}</a></p>
    <p><em>이 링크는 7일 후에 만료됩니다.</em></p>
    <hr>
    <p style="font-size: 0.9em; color: #666;">이 초대를 요청하지 않으셨다면 이 이메일을 무시하셔도 됩니다.</p>
  `;

  await sendMail({ to: inviteeEmail, subject, text, html });
}

// 이메일 서버 연결 상태 확인 (선택 사항)
if (process.env.NODE_ENV !== 'test') {
  // 테스트 환경에서는 실행하지 않음
  transporter.verify((error, success) => {
    if (error) {
      console.error('SMTP 서버 연결 실패:', error);
    } else {
      console.log('SMTP 서버가 성공적으로 연결되었습니다. 이메일 발송 준비 완료.');
    }
  });
}
```

```ts
/* ./src/lib/fetchers.ts */
// src/lib/fetchers.ts

// 커스텀 에러 타입 정의
interface FetchError extends Error {
  status?: number;
  info?: unknown; // 혹은 더 구체적인 타입으로 정의 가능
}

/**
 * SWR을 위한 기본 fetcher 함수입니다.
 * 주어진 URL로 GET 요청을 보내고, 응답을 JSON 형태로 파싱합니다.
 * 오류 발생 시 에러를 throw합니다.
 * @param url - 요청할 API 엔드포인트 URL
 * @returns 파싱된 JSON 데이터
 * @throws 네트워크 오류 또는 JSON 파싱 오류 시 Error 객체
 */
export const fetcher = async <T = unknown>(url: string): Promise<T> => {
  const res = await fetch(url);

  // 응답 상태 코드가 2xx가 아니면 오류로 처리
  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ message: "오류 응답을 파싱할 수 없습니다." }));
    const error = new Error(
      errorData.message || "API 요청 중 오류가 발생했습니다."
    ) as FetchError;
    // 추가적인 오류 정보를 error 객체에 포함시킬 수 있습니다.
    error.status = res.status;
    error.info = errorData;
    throw error;
  }

  return res.json();
};

/**
 * SWR을 위한 POST 요청 fetcher 함수입니다. (필요시 사용)
 * @param url - 요청할 API 엔드포인트 URL
 * @param body - POST 요청 본문
 * @returns 파싱된 JSON 데이터
 */
export const postFetcher = async <T = unknown, B = unknown>(
  url: string,
  { arg }: { arg: B }
): Promise<T> => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(arg),
  });

  if (!res.ok) {
    const errorData = await res
      .json()
      .catch(() => ({ message: "오류 응답을 파싱할 수 없습니다." }));
    const error = new Error(
      errorData.message || "API POST 요청 중 오류가 발생했습니다."
    ) as FetchError;
    error.status = res.status;
    error.info = errorData;
    throw error;
  }
  return res.json();
};
```

```ts
/* ./src/lib/financeUtils.ts */
// src/lib/financeUtils.ts (예시 파일)

import { CARD_INSTALLMENT_RATES_INFO } from "@/constants/cardIssuers";
import {
  addMonths,
  setDate,
  startOfDay,
  differenceInCalendarDays,
  getDaysInYear,
  parseISO,
} from "date-fns";

/**
 * 선택된 카드사와 할부 정보, 구매일에 기반하여 *일할 계산된* 예상 총 할부 수수료를 계산합니다.
 * @param principal 할부 원금 (totalInstallmentAmount)
 * @param months 할부 개월 수
 * @param purchaseDate 원거래 구매일 (Date 객체 또는 ISO 문자열)
 * @param cardIssuer 선택된 카드사 이름
 * @param estimationMethod 사용할 수수료율 ( 'max', 'average', 'min' 등) - 현대카드 외 타 카드사 수수료율 결정에 사용
 * @returns 계산된 예상 할부 수수료 (소수점 반올림)
 */
export function calculateEstimatedInstallmentFee(
  principal: number,
  months: number,
  purchaseDateInput: Date | string,
  cardIssuer?: string | null,
  estimationMethod: "max" | "average" | "min" = "max"
): number {
  if (principal <= 0 || months < 2) {
    return 0;
  }
  const purchaseDate =
    typeof purchaseDateInput === "string"
      ? parseISO(purchaseDateInput)
      : purchaseDateInput;

  let annualRate: number;
  if (cardIssuer === "현대카드") {
    if (months >= 2 && months <= 3) annualRate = 0;
    else if (months >= 4 && months <= 5) annualRate = 12;
    else if (months >= 6 && months <= 9) annualRate = 15;
    else if (months >= 10 && months <= 12) annualRate = 19;
    else return 0; // 현대카드지만 지원 범위 외 (예: 1개월 또는 12개월 초과)
  } else if (cardIssuer && CARD_INSTALLMENT_RATES_INFO[cardIssuer]) {
    const rateInfo = CARD_INSTALLMENT_RATES_INFO[cardIssuer];
    switch (estimationMethod) {
      case "min":
        annualRate = rateInfo.minApr;
        break;
      case "average":
        annualRate = (rateInfo.minApr + rateInfo.maxApr) / 2;
        break;
      default:
        annualRate = rateInfo.maxApr;
    }
  } else {
    return 0; // 카드사 정보 없거나 미지원
  }

  if (annualRate < 0) return 0;
  if (annualRate === 0) return 0; // 무이자

  // 원금 분할 계산 (매월 상환할 원금)
  const principalPortions = new Array(months).fill(0);
  const averagePrincipalPerMonth = principal / months;
  let accumulatedPrincipal = 0;
  for (let i = 0; i < months - 1; i++) {
    principalPortions[i] = Math.floor(averagePrincipalPerMonth);
    accumulatedPrincipal += principalPortions[i];
  }
  principalPortions[months - 1] = principal - accumulatedPrincipal;

  let totalCalculatedFee = 0;
  let outstandingPrincipalForFeeCalc = principal;

  for (let k = 0; k < months; k++) {
    const currentInstallmentNumber = k + 1;
    const periodPaymentDate = calculateNthInstallmentPaymentDate(
      purchaseDate,
      currentInstallmentNumber
    );
    const periodStartDate =
      k === 0
        ? purchaseDate
        : calculateNthInstallmentPaymentDate(purchaseDate, k);

    const daysInPeriod = differenceInCalendarDays(
      periodPaymentDate,
      periodStartDate
    );
    if (daysInPeriod <= 0) continue; // 혹시 모를 오류 방지

    const daysInYearForPeriod = getDaysInYear(periodPaymentDate); // 해당 기간 종료일 기준 연도 일수

    const feeForThisPeriod =
      outstandingPrincipalForFeeCalc *
      (annualRate / 100) *
      (daysInPeriod / daysInYearForPeriod);
    totalCalculatedFee += feeForThisPeriod;

    outstandingPrincipalForFeeCalc -= principalPortions[k]; // 다음 기간 계산을 위해 현재 회차 원금 차감
    if (outstandingPrincipalForFeeCalc < 0) outstandingPrincipalForFeeCalc = 0;
  }

  return Math.round(totalCalculatedFee);
}

// 카드사 목록 반환 함수 (프론트엔드에서 사용)
export function getSupportedCardIssuers(): string[] {
  return Object.keys(CARD_INSTALLMENT_RATES_INFO);
}

/**
 * 구매일로부터 N번째 할부금의 납부일(다음 달 10일 기준)을 계산합니다.
 * @param purchaseDate 원거래 구매일 (Date 객체 또는 ISO 문자열)
 * @param installmentNumber 할부 회차 (1부터 시작)
 * @returns N번째 할부금 납부일 (Date 객체, 시간은 00:00:00으로 설정)
 */
export function calculateNthInstallmentPaymentDate(
  purchaseDate: Date | string,
  installmentNumber: number
): Date {
  const baseDate =
    typeof purchaseDate === "string" ? new Date(purchaseDate) : purchaseDate;
  // 첫 번째 할부금은 구매일이 속한 달의 다음 달 10일입니다.
  // 따라서, (회차)만큼 월을 더한 후 10일로 설정합니다.
  const paymentMonthDate = addMonths(baseDate, installmentNumber);
  return startOfDay(setDate(paymentMonthDate, 10));
}

/**
 * 총 할부 금액, 개월 수, 구매일, 카드사 정보에 기반하여 각 회차별 납부 금액(원금+일할계산수수료) 배열을 반환합니다.
 * @param totalAmount 총 할부 금액
 * @param months 할부 개월 수
 * @param purchaseDate 원거래 구매일 (Date 객체 또는 ISO 문자열)
 * @param cardIssuer 선택된 카드사 이름
 * @param estimationMethod 사용할 수수료율 ( 'max', 'average', 'min' 등)
 * @returns 각 회차별 납부 금액 배열 (원금 + 수수료)
 */
export function calculateInstallmentAmounts(
  totalAmount: number,
  months: number,
  purchaseDateInput: Date | string,
  cardIssuer?: string | null,
  estimationMethod: "max" | "average" | "min" = "max"
): number[] {
  if (months <= 0 || totalAmount < 0) {
    // 0원 할부는 의미 없으므로 < 0 으로 변경
    return Array(months > 0 ? months : 0).fill(0);
  }
  if (totalAmount === 0) return Array(months).fill(0);

  const purchaseDate =
    typeof purchaseDateInput === "string"
      ? parseISO(purchaseDateInput)
      : purchaseDateInput;

  let annualRate = 0;
  if (cardIssuer === "현대카드") {
    if (months >= 2 && months <= 3) annualRate = 0;
    else if (months >= 4 && months <= 5) annualRate = 12;
    else if (months >= 6 && months <= 9) annualRate = 15;
    else if (months >= 10 && months <= 12) annualRate = 19;
    // 현대카드라도 지원 범위 외 개월 수는 수수료율 0 (위에서 처리됨, 또는 여기서도 방어적으로 else { annualRate = 0; })
  } else if (cardIssuer && CARD_INSTALLMENT_RATES_INFO[cardIssuer]) {
    const rateInfo = CARD_INSTALLMENT_RATES_INFO[cardIssuer];
    switch (estimationMethod) {
      case "min":
        annualRate = rateInfo.minApr;
        break;
      case "average":
        annualRate = (rateInfo.minApr + rateInfo.maxApr) / 2;
        break;
      default:
        annualRate = rateInfo.maxApr;
    }
  }
  if (annualRate < 0) annualRate = 0;

  const principalPortions = new Array(months).fill(0);
  const averagePrincipalPerMonth = totalAmount / months;
  let accumulatedPrincipal = 0;
  for (let i = 0; i < months - 1; i++) {
    principalPortions[i] = Math.floor(averagePrincipalPerMonth);
    accumulatedPrincipal += principalPortions[i];
  }
  principalPortions[months - 1] = totalAmount - accumulatedPrincipal;

  const finalInstallments = new Array(months).fill(0);
  let outstandingPrincipalForFeeCalc = totalAmount;

  for (let i = 0; i < months; i++) {
    const principalComponent = principalPortions[i];
    let feeComponent = 0;

    if (annualRate > 0 && outstandingPrincipalForFeeCalc > 0) {
      const currentInstallmentNumber = i + 1;
      const periodPaymentDate = calculateNthInstallmentPaymentDate(
        purchaseDate,
        currentInstallmentNumber
      );
      const periodStartDate =
        i === 0
          ? purchaseDate
          : calculateNthInstallmentPaymentDate(purchaseDate, i);

      const daysInPeriod = differenceInCalendarDays(
        periodPaymentDate,
        periodStartDate
      );
      if (daysInPeriod > 0) {
        const daysInYearForPeriod = getDaysInYear(periodPaymentDate);
        feeComponent =
          outstandingPrincipalForFeeCalc *
          (annualRate / 100) *
          (daysInPeriod / daysInYearForPeriod);
      }
    }
    finalInstallments[i] = principalComponent + Math.round(feeComponent);
    outstandingPrincipalForFeeCalc -= principalComponent;
    if (outstandingPrincipalForFeeCalc < 0) outstandingPrincipalForFeeCalc = 0;
  }
  return finalInstallments;
}

/**
 * 특정 할부 회차의 수수료(이자) 부분만 계산합니다.
 * @param principal 전체 할부 원금 (totalInstallmentAmount)
 * @param totalMonths 총 할부 개월 수
 * @param nthMonth 계산하려는 회차 (1부터 시작)
 * @param purchaseDateInput 원거래 구매일 (Date 객체 또는 ISO 문자열)
 * @param cardIssuer 선택된 카드사 이름
 * @param estimationMethod 사용할 수수료율 ('max', 'average', 'min' 등)
 * @returns N번째 회차의 예상 할부 수수료 (소수점 반올림)
 */
export function calculateNthInstallmentFeeOnly(
  principal: number,
  totalMonths: number,
  nthMonth: number, // 계산하려는 회차 (1부터 시작)
  purchaseDateInput: Date | string,
  cardIssuer?: string | null,
  estimationMethod: "max" | "average" | "min" = "max"
): number {
  if (
    principal <= 0 ||
    totalMonths < 1 || // 1개월 할부는 일반적으로 없지만, 방어적으로 1 이상
    nthMonth < 1 ||
    nthMonth > totalMonths
  ) {
    return 0;
  }

  const purchaseDate =
    typeof purchaseDateInput === "string"
      ? parseISO(purchaseDateInput)
      : purchaseDateInput;

  let annualRate = 0;
  // 카드사별 연이율 결정 로직 (calculateInstallmentAmounts와 동일하게 적용)
  if (cardIssuer === "현대카드") {
    if (totalMonths >= 2 && totalMonths <= 3) annualRate = 0; // 2-3개월 무이자
    else if (totalMonths >= 4 && totalMonths <= 5) annualRate = 12;
    else if (totalMonths >= 6 && totalMonths <= 9) annualRate = 15;
    else if (totalMonths >= 10 && totalMonths <= 12) annualRate = 19;
    else return 0; // 현대카드지만 지원 범위 외 (예: 1개월 또는 12개월 초과)
  } else if (cardIssuer && CARD_INSTALLMENT_RATES_INFO[cardIssuer]) {
    const rateInfo = CARD_INSTALLMENT_RATES_INFO[cardIssuer];
    switch (estimationMethod) {
      case "min":
        annualRate = rateInfo.minApr;
        break;
      case "average":
        annualRate = (rateInfo.minApr + rateInfo.maxApr) / 2;
        break;
      default: // 'max'
        annualRate = rateInfo.maxApr;
    }
  } else {
    // 카드사 정보 없거나 미지원 카드사, 또는 totalMonths가 범위를 벗어난 경우 (위 현대카드 로직에서 처리)
    // 기본적으로 유이자 할부로 간주하지 않거나, 기본값을 설정할 수 있음. 여기서는 0으로 처리.
    return 0;
  }

  if (annualRate <= 0) return 0; // 무이자인 경우 수수료 0

  // 각 회차별 원금 상환액 계산 (calculateInstallmentAmounts와 동일)
  const principalPortions = new Array(totalMonths).fill(0);
  const averagePrincipalPerMonth = principal / totalMonths;
  let accumulatedPrincipal = 0;
  for (let i = 0; i < totalMonths - 1; i++) {
    principalPortions[i] = Math.floor(averagePrincipalPerMonth);
    accumulatedPrincipal += principalPortions[i];
  }
  principalPortions[totalMonths - 1] = principal - accumulatedPrincipal;

  // N번째 회차 시작 시점의 잔여 원금 계산
  let outstandingPrincipalForFeeCalc = principal;
  for (let i = 0; i < nthMonth - 1; i++) {
    // (nthMonth - 1) 회차까지의 원금 상환액을 차감
    outstandingPrincipalForFeeCalc -= principalPortions[i];
  }

  // 이미 원금이 모두 상환되었거나 음수가 된 경우 (오류 방지)
  if (outstandingPrincipalForFeeCalc <= 0) {
    return 0;
  }

  let feeComponent = 0;
  // N번째 회차의 납부일과 그 직전 납부일(또는 구매일)을 기준으로 기간 계산
  const periodPaymentDate = calculateNthInstallmentPaymentDate(
    purchaseDate,
    nthMonth
  );
  const periodStartDate =
    nthMonth === 1
      ? purchaseDate // 첫 회차는 구매일부터 시작
      : calculateNthInstallmentPaymentDate(purchaseDate, nthMonth - 1); // 이전 회차 납부일

  const daysInPeriod = differenceInCalendarDays(
    periodPaymentDate,
    periodStartDate
  );

  if (daysInPeriod > 0) {
    const daysInYearForPeriod = getDaysInYear(periodPaymentDate); // 해당 기간 종료일 기준 연도 일수
    feeComponent =
      outstandingPrincipalForFeeCalc *
      (annualRate / 100) *
      (daysInPeriod / daysInYearForPeriod);
  }

  return Math.round(feeComponent);
}
```

```ts
/* ./src/lib/formatters.ts */
/**
 * 숫자를 통화 형식(만원 단위)으로 변환합니다.
 * @param value 변환할 숫자 또는 문자열
 * @param currencySymbol 통화 기호 (기본값: '만원')
 * @returns 포맷팅된 통화 문자열
 */
export const formatCurrencyKrwInTenThousand = (
  value: string | number,
  currencySymbol: string = "만원"
): string => {
  if (typeof value === "number") {
    const valueInTenThousand = value / 10000;
    return `${valueInTenThousand.toLocaleString("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })}${currencySymbol}`;
  }
  return String(value); // 숫자형이 아닐 경우 원래 값 반환
};

/**
 * 숫자를 퍼센트 형식으로 변환합니다.
 * @param value 변환할 숫자 또는 문자열
 * @returns 포맷팅된 퍼센트 문자열
 */
export const formatPercent = (value: string | number): string => {
  if (typeof value === "number") {
    return `${value.toFixed(1)}%`;
  }
  return String(value);
};

/**
 * 숫자를 일반적인 숫자 형식(세 자리마다 콤마)으로 변환합니다.
 * @param value 변환할 숫자 또는 문자열
 * @returns 포맷팅된 숫자 문자열
 */
export const formatNumber = (value: string | number): string => {
  if (typeof value === "number") {
    return value.toLocaleString("ko-KR");
  }
  return String(value);
};
```

```ts
/* ./src/lib/localStorageUtils.ts */
// src/lib/localStorageUtils.ts

const DISMISSED_INSIGHTS_KEY = "dismissedInsightIds";

/**
 * localStorage에서 숨김 처리된 인사이트 ID 목록을 가져옵니다.
 * @returns string[] 숨겨진 인사이트 ID 배열
 */
export const getDismissedInsightIds = (): string[] => {
  if (typeof window === "undefined") {
    return []; // 서버 사이드에서는 localStorage 접근 불가
  }
  try {
    const storedIds = window.localStorage.getItem(DISMISSED_INSIGHTS_KEY);
    return storedIds ? JSON.parse(storedIds) : [];
  } catch (error) {
    console.error("Error reading dismissed insights from localStorage:", error);
    return [];
  }
};

/**
 * 특정 인사이트 ID를 localStorage의 숨김 목록에 추가합니다.
 * @param insightId 숨김 처리할 인사이트 ID
 */
export const addDismissedInsightId = (insightId: string): void => {
  if (typeof window === "undefined") return;
  try {
    const currentIds = getDismissedInsightIds();
    if (!currentIds.includes(insightId)) {
      const newIds = [...currentIds, insightId];
      window.localStorage.setItem(
        DISMISSED_INSIGHTS_KEY,
        JSON.stringify(newIds)
      );
    }
  } catch (error) {
    console.error("Error saving dismissed insight to localStorage:", error);
  }
};

/**
 * (선택 사항) 특정 인사이트 ID를 localStorage의 숨김 목록에서 제거합니다.
 * (예: '숨김 해제' 기능 추가 시 사용)
 * @param insightId 숨김 해제할 인사이트 ID
 */
export const removeDismissedInsightId = (insightId: string): void => {
  if (typeof window === "undefined") return;
  try {
    const currentIds = getDismissedInsightIds();
    const newIds = currentIds.filter((id) => id !== insightId);
    window.localStorage.setItem(DISMISSED_INSIGHTS_KEY, JSON.stringify(newIds));
  } catch (error) {
    console.error("Error removing dismissed insight from localStorage:", error);
  }
};

/**
 * (선택 사항) localStorage의 모든 숨김 처리된 인사이트 ID 목록을 초기화합니다.
 * (예: 설정에서 '모든 숨김 인사이트 다시 보기' 기능)
 */
export const clearDismissedInsightIds = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DISMISSED_INSIGHTS_KEY);
  } catch (error) {
    console.error(
      "Error clearing dismissed insights from localStorage:",
      error
    );
  }
};
```

```ts
/* ./src/lib/prisma.ts */
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

```ts
/* ./src/lib/schemas/budgetApiSchemas.ts */
// src/lib/schemas/budgetApiSchemas.ts

import { z } from "zod";

// 월 형식 (YYYY-MM) 검증을 위한 정규식
const monthFormatRegex = /^\d{4}-\d{2}$/;

export const BudgetSchema = z.object({
  month: z
    .string()
    .regex(monthFormatRegex, { message: "월 형식은 YYYY-MM이어야 합니다." })
    .describe("예산 기준월 (YYYY-MM 형식)"),
  categoryId: z
    .number()
    .int()
    .positive({ message: "카테고리 ID는 양의 정수여야 합니다." }),
  amount: z.number().positive({ message: "예산 금액은 0보다 커야 합니다." }),
});

export type BudgetPayload = z.infer<typeof BudgetSchema>;

export const BudgetParamSchema = z.object({
  id: z
    .string() // 경로 파라미터는 문자열로 들어오므로, 먼저 문자열로 받고 변환
    .regex(/^\d+$/, "ID는 숫자 형식이어야 합니다.") // 숫자로만 구성된 문자열인지 확인
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "ID는 유효한 양의 숫자여야 합니다.",
    }),
});

export type BudgetParam = z.infer<typeof BudgetParamSchema>;

// GET /api/workspaces/[workspaceId]/budgets 쿼리 파라미터 스키마
export const GetBudgetsQuerySchema = z.object({
  month: z
    .string()
    .regex(monthFormatRegex, { message: "월 형식은 YYYY-MM이어야 합니다." })
    .describe("조회할 예산 기준월 (YYYY-MM 형식)"),
  // 필요하다면 다른 필터링을 위한 쿼리 파라미터 추가 가능
  // 예: categoryId: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
});

export type GetBudgetsQuery = z.infer<typeof GetBudgetsQuerySchema>;
```

```ts
/* ./src/lib/schemas/commonApiSchemas.ts */
import { z } from "zod";

export const WorkspaceIdParamSchema = z.object({
  workspaceId: z
    .string()
    .cuid({ message: "워크스페이스 ID 형식이 올바르지 않습니다." }),
});

export const BudgetIdParamSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(
      z.number().int().positive({ message: "예산 ID는 양의 정수여야 합니다." })
    ),
});

export const TransactionIdParamSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(
      z.number().int().positive({ message: "거래 ID는 양의 정수여야 합니다." })
    ),
});
```

```ts
/* ./src/lib/schemas/insightApiSchemas.ts */
import { z } from "zod";
import { format } from "date-fns";

// 월 형식 (YYYY-MM) 검증을 위한 정규식
const monthFormatRegex = /^\d{4}-\d{2}$/;

export const GetInsightsQuerySchema = z.object({
  month: z
    .string()
    .regex(monthFormatRegex, { message: "월 형식은 YYYY-MM이어야 합니다." })
    .optional()
    .default(format(new Date(), "yyyy-MM")) // 기본값: 현재 월
    .describe("조회 기준 월 (YYYY-MM 형식)"),
  // userId는 서버에서 인증 정보를 통해 가져오므로, 쿼리 파라미터 스키마에는 포함하지 않음.
});

export type GetInsightsQuery = z.infer<typeof GetInsightsQuerySchema>;
```

```ts
/* ./src/lib/schemas/statsApiSchemas.ts */
// src/lib/schemas/statsApiSchemas.ts
import { z } from "zod";
import { format } from "date-fns";

// 날짜 형식 (YYYY-MM-DD) 검증을 위한 정규식
const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
// 월 형식 (YYYY-MM) 검증을 위한 정규식
const monthFormatRegex = /^\d{4}-\d{2}$/;
// 연도 형식 (YYYY) 검증을 위한 정규식
const yearFormatRegex = /^\d{4}$/;

export const StatsApiQuerySchema = z
  .object({
    type: z
      .enum([
        "daily",
        "monthly",
        "yearly",
        "category",
        "trend",
        "kpi",
        "detail",
        "spendingPattern",
        "incomeSource",
        "budgetVsActual",
      ])
      .optional()
      .default("monthly")
      .describe(
        "통계 유형: 'daily', 'monthly', 'yearly', 'category', 'trend', 'kpi', 'detail'. 기본값: 'monthly'"
      ),
    date: z
      .string()
      .regex(dateFormatRegex, { message: "날짜 형식은 YYYY-MM-DD여야 합니다." })
      .optional()
      .default(format(new Date(), "yyyy-MM-dd"))
      .describe(
        "조회 기준 날짜 (YYYY-MM-DD). 'daily' 유형에 사용됩니다. 기본값: 오늘 날짜"
      ),
    month: z
      .string()
      .regex(monthFormatRegex, { message: "월 형식은 YYYY-MM여야 합니다." })
      .optional()
      .default(format(new Date(), "yyyy-MM"))
      .describe(
        "조회 기준 월 (YYYY-MM). 'monthly', 'category', 'kpi', 'trend' (period='day') 유형에 사용됩니다. 기본값: 현재 월"
      ),
    year: z
      .string()
      .regex(yearFormatRegex, { message: "연도 형식은 YYYY여야 합니다." })
      .optional()
      .default(format(new Date(), "yyyy"))
      .describe(
        "조회 기준 연도 (YYYY). 'yearly', 'category' (period='year'), 'kpi' (period='year'), 'trend' (period='month' 또는 'year') 유형에 사용됩니다. 기본값: 현재 연도"
      ),
    period: z
      .enum(["day", "month", "year"])
      .optional()
      .default("month")
      .describe(
        "기간 단위: 'day', 'month', 'year'. 'category', 'trend', 'kpi' 유형에 사용됩니다. 기본값: 'month'"
      ),
    compare: z
      .string()
      .transform((value) => value === "true")
      .optional()
      .default("false") // Zod 기본값은 변환 전 문자열이어야 합니다.
      .describe(
        "이전 기간과 비교할지 여부 ('true' 또는 'false'). 기본값: 'false'"
      ),
    startDate: z
      .string()
      .regex(dateFormatRegex, {
        message: "시작 날짜 형식은 YYYY-MM-DD여야 합니다.",
      })
      .optional()
      .describe("조회 시작 날짜 (YYYY-MM-DD). 'detail' 유형에 사용됩니다."),
    endDate: z
      .string()
      .regex(dateFormatRegex, {
        message: "종료 날짜 형식은 YYYY-MM-DD여야 합니다.",
      })
      .optional()
      .describe("조회 종료 날짜 (YYYY-MM-DD). 'detail' 유형에 사용됩니다."),
  })
  .refine(
    (data) => {
      // 'detail' 타입일 경우 startDate와 endDate가 모두 제공되었는지, 그리고 startDate가 endDate보다 이전인지 확인
      if (data.type === "detail") {
        if (!data.startDate || !data.endDate) {
          // 기본값을 여기서 설정하거나, API 라우트에서 처리할 수 있습니다.
          // 여기서는 스키마 레벨에서 필수로 만들지 않고, 라우트에서 기본값을 설정하는 것으로 가정합니다.
          // 만약 스키마 레벨에서 필수로 하고 싶다면, .optional()을 제거하고 default도 제거해야 합니다.
          return true; // 혹은 false로 처리하여 에러 발생
        }
        if (data.startDate && data.endDate) {
          try {
            const start = new Date(data.startDate);
            const end = new Date(data.endDate);
            return start <= end;
          } catch {
            return false; // 유효하지 않은 날짜 형식일 경우
          }
        }
      }
      return true;
    },
    {
      message:
        "'detail' 유형의 경우, startDate는 endDate보다 이전이거나 같아야 하며, 두 날짜 모두 유효해야 합니다.",
      path: ["startDate", "endDate"], // 오류 발생 시 해당 필드들을 가리킴
    }
  );

// 스키마로부터 TypeScript 타입 추론
export type StatsApiQuery = z.infer<typeof StatsApiQuerySchema>;
```

```ts
/* ./src/lib/schemas/transactionsApiSchemas.ts */
// src/lib/schemas/transactionsApiSchemas.ts
import { SUPPORTED_CARD_ISSUERS } from '@/constants/cardIssuers';
import { z } from 'zod';

// 날짜 형식 (YYYY-MM-DD) 검증을 위한 정규식
const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;
export const TransactionTypeSchema = z.enum(['income', 'expense'], {
  errorMap: () => ({
    message: "거래 유형은 'income' 또는 'expense'여야 합니다.",
  }),
});

const CardIssuerSchema = z.enum(SUPPORTED_CARD_ISSUERS as [string, ...string[]]);

// 기본 거래 데이터 스키마 (생성 및 수정 시 공통)
export const BaseTransactionSchema = z.object({
  date: z.string().regex(dateFormatRegex, { message: '날짜 형식은 YYYY-MM-DD여야 합니다.' }),
  amount: z.number().positive({ message: '금액은 0보다 커야 합니다.' }),
  type: TransactionTypeSchema,
  description: z.string().optional().default(''),
  categoryId: z.number().int().positive({ message: '카테고리 ID는 양의 정수여야 합니다.' }),
  isInstallment: z.boolean().optional().default(false),
  installmentMonths: z.number().int().min(2).optional(),
  currentInstallmentNumber: z.number().int().positive().optional(),
  totalInstallmentAmount: z.number().positive().optional(),
  originalTransactionId: z.number().int().positive().optional(),
  installmentCardIssuer: CardIssuerSchema.optional(), // <<-- 카드사 필드 추가
});

// 거래 생성 시 요청 본문 스키마
export const CreateTransactionSchema = BaseTransactionSchema.refine(
  (data) => {
    if (data.isInstallment && data.type === 'expense') {
      // 할부 원거래 시: 개월수, 총액, 카드사 필수
      if (!data.originalTransactionId) {
        return (
          data.installmentMonths !== undefined &&
          data.installmentMonths >= 2 &&
          data.totalInstallmentAmount !== undefined &&
          data.installmentCardIssuer !== undefined // <<-- 카드사 선택 검증 추가
        );
      }
      // 개별 할부금 시: 회차, 원거래ID, (카드사 정보는 원거래에 따름)
      else {
        return data.currentInstallmentNumber !== undefined && data.currentInstallmentNumber >= 1;
      }
    }
    return true;
  },
  {
    message:
      "할부 거래 정보가 올바르지 않습니다. 할부 원거래의 경우 '총 할부 개월수(2 이상)'와 '총 할부 금액'이 필요하며, 개별 할부금의 경우 '현재 할부 회차(1 이상)', '원거래 ID'가 필요합니다.",
    // path를 명시적으로 지정하기 어려우므로, API 응답에서 더 구체적인 에러 메시지를 제공하는 것이 좋을 수 있습니다.
  }
).refine(
  (data) => {
    // currentInstallmentNumber가 installmentMonths를 초과할 수 없음
    if (data.isInstallment && data.installmentMonths && data.currentInstallmentNumber) {
      return data.currentInstallmentNumber <= data.installmentMonths;
    }
    return true;
  },
  {
    message:
      "할부 원거래의 경우 '총 할부 개월수(2 이상)', '총 할부 금액', '카드사'가 필요하며, 개별 할부금의 경우 '현재 할부 회차(1 이상)', '원거래 ID'가 필요합니다.",
    path: ['currentInstallmentNumber'],
  }
);
export type CreateTransactionPayload = z.infer<typeof CreateTransactionSchema>;

// 거래 수정 시 요청 본문 스키마
export const UpdateTransactionSchema = BaseTransactionSchema.partial()
  .refine(
    (data) => Object.keys(data).length > 0, // 최소 하나 이상의 필드가 존재해야 함
    { message: '수정할 내용을 하나 이상 입력해주세요.' }
  )
  .refine(
    (data) => {
      // isInstallment 상태가 변경되거나, 할부 관련 정보가 수정될 때의 일관성 체크
      if (data.isInstallment === true) {
        // 할부 원거래로 변경/수정하는 경우

        if (!data.originalTransactionId) {
          if (data.installmentCardIssuer === undefined) return false;

          if (data.originalTransactionId === null) {
            // 원거래 ID가 없거나 null로 명시적으로 온 경우 (신규 할부 원거래 또는 기존 일반 거래를 할부 원거래로 변경)
            if (data.installmentMonths !== undefined && data.installmentMonths < 2) return false; // installmentMonths는 2 이상이어야 함
            if (data.totalInstallmentAmount === undefined) return false; // totalInstallmentAmount는 필수
          }
        }

        // 개별 할부금으로 변경/수정하는 경우
        else if (data.originalTransactionId !== undefined && data.originalTransactionId > 0) {
          if (data.currentInstallmentNumber === undefined || data.currentInstallmentNumber < 1)
            return false; // currentInstallmentNumber는 1 이상이어야 함
          // installmentMonths도 함께 와서 currentInstallmentNumber <= installmentMonths 검증
        }
      }
      // 할부를 일반 거래로 변경 (isInstallment: false)하는 경우,
      // API 핸들러에서 나머지 할부 필드(installmentMonths, currentInstallmentNumber, totalInstallmentAmount, originalTransactionId)를 null로 처리해야 함.
      // 스키마 레벨에서 이를 강제하기는 어려울 수 있음.
      return true;
    },
    {
      message: '수정될 할부 정보(카드사 포함)가 올바르지 않습니다.',
    }
  )
  .refine(
    (data) => {
      if (data.installmentMonths !== undefined && data.currentInstallmentNumber !== undefined) {
        if (data.installmentMonths === null && data.currentInstallmentNumber !== null) return false; // installmentMonths가 null인데 currentInstallmentNumber가 있는 경우 방지
        if (
          data.installmentMonths !== null &&
          data.currentInstallmentNumber !== null &&
          data.currentInstallmentNumber > data.installmentMonths
        ) {
          return false; // 현재 할부 회차가 총 할부 개월수 초과 방지
        }
      }
      return true;
    },
    {
      message:
        '현재 할부 회차는 총 할부 개월수를 초과할 수 없으며, 할부 개월수 정보가 유효해야 합니다.',
      path: ['currentInstallmentNumber', 'installmentMonths'],
    }
  );
export type UpdateTransactionPayload = z.infer<typeof UpdateTransactionSchema>;

// 거래 ID 경로 파라미터 스키마
export const TransactionIdParamSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
});

export type TransactionIdParam = z.infer<typeof TransactionIdParamSchema>;

// 거래 목록 조회(GET) 시 쿼리 파라미터 스키마
export const GetTransactionsQuerySchema = z
  .object({
    type: TransactionTypeSchema.optional(),
    startDate: z
      .string()
      .regex(dateFormatRegex, {
        message: '시작 날짜 형식은 YYYY-MM-DD여야 합니다.',
      })
      .optional(),
    endDate: z
      .string()
      .regex(dateFormatRegex, {
        message: '종료 날짜 형식은 YYYY-MM-DD여야 합니다.',
      })
      .optional(),
    categoryId: z
      .string()
      .transform((val) => parseInt(val, 10))
      .refine((val) => !isNaN(val) && val > 0, {
        message: '카테고리 ID는 유효한 양의 숫자여야 합니다.',
      })
      .optional(),
    keyword: z.string().optional(),
    minAmount: z
      .string()
      .transform((val) => parseFloat(val))
      .refine((val) => !isNaN(val) && val >= 0, {
        message: '최소 금액은 0 이상의 숫자여야 합니다.',
      })
      .optional(),
    maxAmount: z
      .string()
      .transform((val) => parseFloat(val))
      .refine((val) => !isNaN(val) && val >= 0, {
        message: '최대 금액은 0 이상의 숫자여야 합니다.',
      })
      .optional(),
    sortBy: z
      .enum(['date', 'amount', 'category.name', 'isInstallment']) // 정렬 기준에 isInstallment 추가 가능
      .default('date')
      .optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),

    // --- 할부 관련 조회 필터 스키마 시작 ---
    isInstallment: z
      .string()
      .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined))
      .optional(),
    originalTransactionId: z
      .string()
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().int().positive())
      .optional(),
    // --- 할부 관련 조회 필터 스키마 끝 ---
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        try {
          const start = new Date(data.startDate);
          const end = new Date(data.endDate);
          return start <= end;
        } catch {
          return false;
        }
      }
      return true;
    },
    {
      message: 'startDate는 endDate보다 이전이거나 같아야 하며, 두 날짜 모두 유효해야 합니다.',
      path: ['startDate', 'endDate'],
    }
  )
  .refine(
    (data) => {
      if (data.minAmount !== undefined && data.maxAmount !== undefined) {
        return data.minAmount <= data.maxAmount;
      }
      return true;
    },
    {
      message: '최소 금액은 최대 금액보다 작거나 같아야 합니다.',
      path: ['minAmount', 'maxAmount'],
    }
  );

export type GetTransactionsQuery = z.infer<typeof GetTransactionsQuerySchema>;
```

```ts
/* ./src/lib/schemas/workspaceApiSchemas.ts */
// src/lib/schemas/workspaceApiSchemas.ts
import { z } from "zod";

// 워크스페이스 생성 요청 본문 스키마
export const CreateWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, { message: "워크스페이스 이름은 필수입니다." })
    .max(100, { message: "워크스페이스 이름은 100자를 초과할 수 없습니다." }),
});
export type CreateWorkspacePayload = z.infer<typeof CreateWorkspaceSchema>;

// 워크스페이스 데이터 응답 타입 (Prisma 모델과 유사하게 정의)
export const WorkspaceDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  createdAt: z.date(), // 또는 z.string().datetime() 후 변환
  updatedAt: z.date(), // 또는 z.string().datetime() 후 변환
  // 필요시 멤버 수 등의 추가 정보 포함 가능
});
export type WorkspaceData = z.infer<typeof WorkspaceDataSchema>;
```

```ts
/* ./src/lib/statsUtils.ts */
// src/lib/statsUtils.ts
// 이 파일은 이제 데이터베이스에 직접 접근하지 않는 순수 계산 유틸리티 함수를 포함합니다.

/**
 * 현재 기간과 이전 기간의 통계 데이터를 비교하여 변화량과 변화율을 계산합니다.
 * @param current - 현재 기간 통계 데이터 { income: number; expense: number; balance: number }
 * @param previous - 이전 기간 통계 데이터 { income: number; expense: number; balance: number }
 * @returns 수입, 지출, 잔액에 대한 변화량 및 변화율 객체
 */
export function calculateComparison(
  current: { income: number; expense: number; balance: number },
  previous: { income: number; expense: number; balance: number }
) {
  const incomeChange = current.income - previous.income;
  const incomeChangePercent =
    previous.income !== 0 ? (incomeChange / previous.income) * 100 : current.income > 0 ? 100 : 0;

  const expenseChange = current.expense - previous.expense;
  const expenseChangePercent =
    previous.expense !== 0
      ? (expenseChange / previous.expense) * 100
      : current.expense > 0
      ? 100
      : 0;

  const balanceChange = current.balance - previous.balance;
  const balanceChangePercent =
    previous.balance !== 0
      ? (balanceChange / Math.abs(previous.balance)) * 100
      : current.balance > 0
      ? 100
      : current.balance < 0
      ? -100
      : 0;

  return {
    incomeChange,
    incomeChangePercent,
    expenseChange,
    expenseChangePercent,
    balanceChange,
    balanceChangePercent,
  };
}

/**
 * 현재 카테고리 데이터와 이전 카테고리 데이터를 비교하여 변화량을 계산합니다.
 * @param currentData - 현재 카테고리 데이터 배열
 * @param previousData - 이전 카테고리 데이터 배열
 * @returns 변화량이 포함된 카테고리 데이터 배열
 */
export function calculateCategoryChange(
  currentData: Array<{
    categoryId: number | string;
    categoryName: string;
    amount: number;
    percentage: number;
  }>,
  previousData: Array<{
    categoryId: number | string;
    categoryName: string;
    amount: number;
    percentage: number;
  }>
) {
  return currentData.map((current) => {
    const previous = previousData.find((prev) => prev.categoryId === current.categoryId);
    if (previous) {
      const change = current.amount - previous.amount;
      const changePercent =
        previous.amount !== 0 ? (change / previous.amount) * 100 : current.amount > 0 ? 100 : 0;
      return {
        ...current,
        previousAmount: previous.amount,
        change,
        changePercent,
      };
    } else {
      return {
        ...current,
        previousAmount: 0,
        change: current.amount,
        changePercent: 100,
      };
    }
  });
}
```

```ts
/* ./src/lib/utils.ts */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

```ts
/* ./src/lib/validationUtils.ts */
import { z, type ZodTypeAny } from 'zod';
import { ValidationError } from '@/services/apiError'; // ApiError와 ValidationError가 정의된 경로

/**
 * 주어진 데이터를 Zod 스키마를 사용하여 유효성 검사합니다.
 * 유효성 검사에 실패하면 ValidationError를 발생시킵니다.
 * @param data 검증할 데이터 (예: params, query, body)
 * @param schema Zod 스키마
 * @param errorMessage 유효성 검사 실패 시 기본 에러 메시지
 * @returns 유효성 검사를 통과한 데이터
 * @throws ValidationError 유효성 검사 실패 시
 */
export function validateData<T extends ZodTypeAny>(
  data: unknown, // 다양한 타입의 입력 데이터를 받기 위해 unknown 사용
  schema: T,
  errorMessage: string = '입력값이 유효하지 않습니다.' // 기본 에러 메시지
): z.infer<T> {
  console.log('[validateData] typeof schema:', typeof schema);
  console.log('[validateData] schema object:', schema);
  console.log('[validateData] schema instanceof z.ZodType:', schema instanceof z.ZodType);
  console.log('[validateData] schema.safeParse exists?:', typeof schema?.safeParse === 'function');

  // if (!(schema instanceof z.ZodType)) {
  //   console.error('[validateData] Error: Provided schema is not a Zod schema instance.');
  //   throw new ValidationError('잘못된 스키마 형식입니다.', { internal: 'Schema is not a Zod instance' });
  // }

  const result = schema.safeParse(data);

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    console.error('[validateData] Validation failed:', fieldErrors);
    throw new ValidationError(errorMessage, fieldErrors);
  }

  return result.data;
}
```

```ts
/* ./src/middleware.ts */
// middleware.ts (또는 src/middleware.ts)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NextAuth.js 내부 API 경로 및 커스텀 로그인 페이지는 제외
  if (pathname.startsWith("/api/auth/") || pathname === "/auth/signin") {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  const token = await getToken({ req: request, secret });
  const isAuthenticated = !!token;

  // 보호할 주요 경로 (예: 대시보드)
  // 루트('/')를 대시보드로 사용하므로, '/'도 보호
  const protectedPaths = ["/", "/dashboard", "/settings"];

  const isAccessingProtectedPath = protectedPaths.some((p) =>
    pathname.startsWith(p)
  );

  // 인증되지 않았고, 보호된 경로에 접근하려 한다면 로그인 페이지로 리디렉션
  // 이때 리디렉션 대상은 NextAuth.js가 내부적으로 처리하는 /api/auth/signin 이어야
  // authOptions.ts에 설정된 pages.signIn으로 올바르게 라우팅됩니다.
  if (!isAuthenticated && isAccessingProtectedPath) {
    const loginUrl = new URL("/api/auth/signin", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.href); // 로그인 후 돌아올 경로
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/trpc|_next/static|_next/image|favicon.ico|images).*)", // public/images 등 정적 리소스 제외
  ],
};
```

```ts
/* ./src/services/apiError.ts */
// API 서비스 및 라우트에서 사용할 커스텀 에러 클래스를 정의합니다.

/**
 * API 요청 처리 중 발생하는 일반적인 에러
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown; // Zod 에러 등의 상세 정보

  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype); // 에러 프로토타입 체인 복원
  }
}

/**
 * 요청 데이터 유효성 검사 실패 시 발생하는 에러
 */
export class ValidationError extends ApiError {
  constructor(message: string = '입력값이 올바르지 않습니다.', details?: unknown) {
    super(message, 400, details);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 요청한 리소스를 찾을 수 없을 때 발생하는 에러
 */
export class NotFoundError extends ApiError {
  constructor(message: string = '요청한 리소스를 찾을 수 없습니다.') {
    super(message, 404);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 권한이 없는 요청에 대한 에러 (예시)
 */
export class ForbiddenError extends ApiError {
  constructor(message: string = '요청에 대한 권한이 없습니다.') {
    super(message, 403);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

/**
 * 이미 존재하는 리소스 생성 시도 시 에러 (예시)
 */
export class ConflictError extends ApiError {
  constructor(message: string = '이미 존재하는 리소스입니다.') {
    super(message, 409);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}
```

```ts
/* ./src/services/budgetService.ts */
// src/services/budgetService.ts
import { prisma } from "@/lib/prisma";
import type { BudgetPayload } from "@/lib/schemas/budgetApiSchemas"; // BudgetPayload에 workspaceId가 포함되지 않는다고 가정
import {
  ApiError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "./apiError";
import { Prisma, type Budget, type Category } from "@prisma/client"; // Prisma 생성 타입

interface BudgetWithCategory
  extends Omit<Budget, "categoryId" | "workspaceId"> {
  category: Category;
}

/**
 * 특정 워크스페이스의 특정 월 예산 목록을 조회합니다.
 * @param userId 현재 사용자 ID
 * @param workspaceId 조회할 워크스페이스 ID
 * @param month 조회할 월 (YYYY-MM 형식)
 * @returns 해당 월의 예산 목록 (카테고리 정보 포함)
 */
export async function getBudgetsByMonth(
  userId: string,
  workspaceId: string,
  month: string
): Promise<BudgetWithCategory[]> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 예산을 조회할 권한이 없습니다."
    );
  }

  try {
    const budgets = await prisma.budget.findMany({
      where: { month, workspaceId }, // DB 조회 시 workspaceId 사용
      include: { category: true },
      orderBy: { category: { name: "asc" } },
    });
    // Prisma 반환 타입에서 categoryId, workspaceId를 제외하고 category 객체를 포함하도록 매핑
    return budgets.map((budget) => {
      const { categoryId, workspaceId, ...rest } = budget;

      console.log("categoryId", categoryId);
      console.log("workspaceId", workspaceId);
      return rest;
    }) as BudgetWithCategory[];
  } catch (error) {
    console.error("[BudgetService] getBudgetsByMonth error:", error);
    throw new ApiError("예산 조회 중 오류가 발생했습니다.");
  }
}

/**
 * 새 예산을 등록하거나 기존 예산을 수정합니다 (Upsert).
 * @param userId 현재 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param payload 등록/수정할 예산 데이터 (BudgetPayload)
 * @returns 생성 또는 수정된 예산 객체
 */
export async function upsertBudget(
  userId: string,
  workspaceId: string,
  payload: BudgetPayload
): Promise<BudgetWithCategory> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스에 예산을 설정할 권한이 없습니다."
    );
  }
  // TODO: 역할(role) 기반 권한 확인 (예: MEMBER 이상만 가능)

  const { month, categoryId, amount } = payload;

  // 카테고리 존재 여부 및 유형, 그리고 워크스페이스 소속 여부 확인
  const category = await prisma.category.findUnique({
    where: { id: categoryId, workspaceId: workspaceId }, // workspaceId 조건 추가
  });

  if (!category) {
    throw new ValidationError(
      `ID가 ${categoryId}인 카테고리를 현재 워크스페이스에서 찾을 수 없습니다.`
    );
  }
  if (category.type !== "expense") {
    throw new ValidationError("지출 카테고리에만 예산을 설정할 수 있습니다.");
  }

  try {
    const budget = await prisma.budget.upsert({
      where: {
        workspaceId_month_categoryId: { workspaceId, month, categoryId }, // 복합 고유키에 workspaceId 포함 (스키마 수정 필요)
        // 또는 Prisma 스키마에서 @@unique([month, categoryId, workspaceId])로 정의
      },
      update: { amount },
      create: { month, categoryId, amount, workspaceId }, // 생성 시 workspaceId 연결
      include: { category: true },
    });
    const {
      categoryId: _categoryId,
      workspaceId: _workspaceId,
      ...rest
    } = budget;

    console.log("categoryId", _categoryId);
    console.log("workspaceId", _workspaceId);

    return rest as BudgetWithCategory;
  } catch (error: unknown) {
    console.error("[BudgetService] upsertBudget error:", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ValidationError(
        "이미 해당 월, 카테고리, 워크스페이스에 대한 예산이 존재합니다."
      );
    }
    throw new ApiError("예산 저장 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 ID의 예산을 삭제합니다. (해당 워크스페이스 소속인지 확인)
 * @param userId 현재 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param budgetId 삭제할 예산 ID
 */
export async function deleteBudget(
  userId: string,
  workspaceId: string,
  budgetId: number
): Promise<void> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 예산을 삭제할 권한이 없습니다."
    );
  }
  // TODO: 역할(role) 기반 권한 확인

  // 삭제 전 해당 예산이 이 워크스페이스에 속하는지 확인
  const existingBudget = await prisma.budget.findUnique({
    where: { id: budgetId, workspaceId: workspaceId }, // workspaceId 조건 추가
  });

  if (!existingBudget) {
    throw new NotFoundError(
      `ID가 ${budgetId}인 예산을 현재 워크스페이스에서 찾을 수 없습니다.`
    );
  }

  try {
    await prisma.budget.delete({
      where: { id: budgetId, workspaceId: workspaceId }, // workspaceId 조건 추가
    });
  } catch (error) {
    console.error("[BudgetService] deleteBudget error:", error);
    throw new ApiError("예산 삭제 중 오류가 발생했습니다.");
  }
}
```

```ts
/* ./src/services/categoryService.ts */
// src/services/categoryService.ts
import { getAllCategoriesDb } from "@/lib/db/categoriesDb"; // DB 함수가 workspaceId를 받도록 수정되었다고 가정
import { prisma } from "@/lib/prisma";
import type { Category } from "@/types/categoryTypes";
import { ApiError, ForbiddenError, ValidationError } from "./apiError";
import { Prisma } from "@prisma/client";

/**
 * 특정 워크스페이스의 모든 카테고리 목록을 조회합니다.
 * @param userId 현재 사용자 ID
 * @param workspaceId 조회할 워크스페이스 ID
 * @returns 카테고리 목록 배열
 */
export async function getAllCategories(
  userId: string,
  workspaceId: string
): Promise<Category[]> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 카테고리를 조회할 권한이 없습니다."
    );
  }

  try {
    // getAllCategoriesDb 함수가 workspaceId를 인자로 받도록 수정되었다고 가정
    const categories = await getAllCategoriesDb(workspaceId);
    return categories as Category[];
  } catch (error) {
    console.error("[CategoryService] getAllCategories error:", error);
    throw new ApiError("카테고리 조회 중 오류가 발생했습니다.");
  }
}

// 카테고리 생성, 수정, 삭제를 위한 서비스 함수가 있다면,
// 아래와 유사한 패턴으로 userId, workspaceId를 받고, 권한 검증 후
// DB 함수 호출 시 workspaceId를 전달하고, 생성/수정 시 데이터에 workspaceId를 포함해야 합니다.

export async function createCategory(
  userId: string,
  workspaceId: string,
  payload: { name: string; type: "income" | "expense" }
): Promise<Category> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스에 카테고리를 생성할 권한이 없습니다."
    );
  }
  // TODO: 역할(role) 기반 권한 확인

  try {
    const newCategory = await prisma.category.create({
      data: {
        ...payload,
        workspaceId, // 생성 시 workspaceId 연결
      },
    });
    return newCategory as Category;
  } catch (error: unknown) {
    console.error("[CategoryService] createCategory error:", error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ValidationError(
        "이미 해당 워크스페이스에 동일한 이름과 유형의 카테고리가 존재합니다."
      );
    }
    throw new ApiError("카테고리 생성 중 오류가 발생했습니다.");
  }
}
```

```ts
/* ./src/services/insightGenerationService.ts */
// src/services/InsightGenerationService.ts
import { prisma } from '@/lib/prisma';
import {
  getMonthlyStatsService,
  getBudgetVsActualStatsService,
} from '@/services/statisticsService';
import { getTransactions } from '@/services/transactionService';
import type { MonthlyStatsData, BudgetVsActualStats } from '@/types/statisticsTypes';
import type { TransactionData } from '@/types/transactionTypes';
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  addDays,
  parseISO,
  differenceInDays,
  getDate,
} from 'date-fns';
import { v4 as uuidv4 } from 'uuid'; // 고유 ID 생성을 위해 uuid 추가
import { ForbiddenError } from './apiError';
import type { GetTransactionsQuery } from '@/lib/schemas/transactionsApiSchemas'; // 추가

// Define the response type for getTransactions based on provided structure
interface TransactionResponse {
  totalCount: number;
  transactions: TransactionData[];
}

// 인사이트 타입 정의 (초기)
export interface Insight {
  id: string; // 고유 식별자 (예: uuid)
  type: InsightType; // 인사이트 종류 (예: 'BUDGET_OVERRUN_WARNING')
  severity: 'info' | 'warning' | 'critical'; // 심각도
  title: string; // 인사이트 제목
  message: string; // 사용자에게 보여질 메시지
  detailsLink?: string; // 관련 상세 정보 페이지 링크 (선택)
  data?: Record<string, unknown>; // 인사이트 생성에 사용된 추가 데이터 (선택)
  generatedAt: string; // 생성 시각 (ISO 문자열)
}

export enum InsightType {
  // MVP
  CATEGORY_SPENDING_INCREASE = 'CATEGORY_SPENDING_INCREASE',
  CATEGORY_SPENDING_DECREASE = 'CATEGORY_SPENDING_DECREASE',
  BUDGET_NEARING_LIMIT = 'BUDGET_NEARING_LIMIT',
  BUDGET_OVERRUN_WARNING = 'BUDGET_OVERRUN_WARNING',
  RECENT_HIGH_SPENDING_ALERT = 'RECENT_HIGH_SPENDING_ALERT',
  // Post-MVP (구현 대상)
  INCOME_SPIKE_ALERT = 'INCOME_SPIKE_ALERT', // 수입 급증 알림
  POSITIVE_MONTHLY_BALANCE = 'POSITIVE_MONTHLY_BALANCE', // 월간 긍정적 잔액 (SAVING_GOAL_PROGRESS 단순화)
  POTENTIAL_SUBSCRIPTION_REMINDER = 'POTENTIAL_SUBSCRIPTION_REMINDER', // 구독 결제일 알림 (추정 기반)
}

// 주요 지출 카테고리 (예시, 추후 설정 또는 동적 분석으로 변경 가능)
const MAJOR_EXPENSE_CATEGORIES = ['식비', '교통비', '생활용품']; // 카테고리 이름 또는 ID
const HIGH_SPENDING_THRESHOLD_AMOUNT = 100000; // 고액 지출 기준 (10만원)
const HIGH_SPENDING_CHECK_DAYS = 7; // 최근 N일
const BUDGET_USAGE_WARNING_THRESHOLD = 0.8; // 예산 80% 사용 시 경고

// 신규 인사이트 관련 상수
const INCOME_SPIKE_PERCENTAGE_THRESHOLD = 50; // 이전 대비 50% 이상 수입 증가 시 알림
const INCOME_SPIKE_MIN_AMOUNT_THRESHOLD = 100000; // 최소 10만원 이상 수입 증가 시 알림
const POSITIVE_BALANCE_MIN_AMOUNT = 300000; // 30만원 이상 월간 흑자 시 격려
const SUBSCRIPTION_REMINDER_LOOKAHEAD_DAYS = 5; // 결제일 5일 전 알

const SUBSCRIPTION_AMOUNT_DEVIATION_PERCENT = 10; // 금액 변동 허용 범위 (10%)

class InsightGenerationService {
  /**
   * 지정된 월에 대한 모든 금융 인사이트를 생성합니다.
   * @param userId 사용자 ID
   * @param month 조회할 월 (YYYY-MM 형식)
   * @returns 생성된 Insight 객체 배열 Promise
   */
  public async generateInsights(
    userId: string,
    workspaceId: string, // 추가
    month: string // YYYY-MM
  ): Promise<Insight[]> {
    const insights: Insight[] = [];
    const today = new Date();
    const currentIsoString = today.toISOString();
    const currentMonthDate = parseISO(`${month}-01`);
    const MAX_PAGE_SIZE = 10000; // 충분히 큰 페이지 크기로 모든 관련 데이터를 가져오도록 설정

    const membership = await prisma.workspaceUser.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) {
      throw new ForbiddenError('이 워크스페이스의 인사이트를 생성할 권한이 없습니다.');
    }

    try {
      // 1. 필요한 데이터 페칭 (Promise.all로 병렬 처리)
      const monthlyStatsPromise = getMonthlyStatsService(userId, workspaceId, month, true);
      const budgetVsActualDataPromise = getBudgetVsActualStatsService(userId, workspaceId, month);

      const recentTransactionsQuery = {
        startDate: format(subDays(today, HIGH_SPENDING_CHECK_DAYS - 1), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
        type: 'expense' as const, // "expense"로 타입 명시
        sortBy: 'date' as const,
        sortOrder: 'desc' as const,
        page: 1,
        pageSize: MAX_PAGE_SIZE,
      };
      const recentTransactionsPromise: Promise<TransactionResponse> = getTransactions(
        userId,
        workspaceId,
        recentTransactionsQuery as GetTransactionsQuery & {
          page: number;
          pageSize: number;
        }
      );

      const currentMonthTransactionsQuery = {
        startDate: format(startOfMonth(currentMonthDate), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(currentMonthDate), 'yyyy-MM-dd'),
        type: 'expense' as const,
        page: 1,
        pageSize: MAX_PAGE_SIZE,
      };
      const currentMonthTransactionsPromise: Promise<TransactionResponse> = getTransactions(
        userId,
        workspaceId,
        currentMonthTransactionsQuery as GetTransactionsQuery & {
          page: number;
          pageSize: number;
        }
      );

      const previousMonthStartDate = startOfMonth(subDays(startOfMonth(currentMonthDate), 1));
      const previousMonthEndDate = endOfMonth(previousMonthStartDate);
      const previousMonthTransactionsQuery = {
        startDate: format(previousMonthStartDate, 'yyyy-MM-dd'),
        endDate: format(previousMonthEndDate, 'yyyy-MM-dd'),
        type: 'expense' as const,
        page: 1,
        pageSize: MAX_PAGE_SIZE,
      };
      const previousMonthTransactionsPromise: Promise<TransactionResponse> = getTransactions(
        userId,
        workspaceId,
        previousMonthTransactionsQuery as GetTransactionsQuery & {
          page: number;
          pageSize: number;
        }
      );

      const [
        monthlyStats,
        budgetVsActualData,
        recentTransactionsResult,
        currentMonthTransactionsResult,
        previousMonthTransactionsResult,
      ] = await Promise.all([
        monthlyStatsPromise,
        budgetVsActualDataPromise,
        recentTransactionsPromise,
        currentMonthTransactionsPromise,
        previousMonthTransactionsPromise,
      ]);

      // 2. 각 인사이트 생성 로직 호출
      insights.push(
        ...this._generateBudgetOverrunInsights(budgetVsActualData, currentIsoString, month)
      );
      insights.push(
        ...this._generateCategorySpendingChangeInsights(monthlyStats, currentIsoString)
      );
      insights.push(
        ...this._generateRecentHighSpendingInsights(
          recentTransactionsResult.transactions,
          currentIsoString
        )
      );

      // --- TODO 완료: 다른 인사이트 생성 로직 추가 ---
      insights.push(...this._generateIncomeSpikeAlerts(monthlyStats, currentIsoString));
      insights.push(
        ...this._generatePositiveMonthlyBalanceAlerts(monthlyStats, currentIsoString, month)
      );
      insights.push(
        ...this._generatePotentialSubscriptionReminders(
          currentMonthTransactionsResult.transactions,
          previousMonthTransactionsResult.transactions,
          currentIsoString,
          month
        )
      );
      // --- TODO 완료 끝 ---

      return insights
        .filter((insight) => insight != null) // null인 인사이트 제거
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    } catch (error) {
      console.error(`[InsightService] Error generating insights for ${month}:`, error);
      return [];
    }
  }

  private _generateBudgetOverrunInsights(
    budgetData: BudgetVsActualStats,
    generatedAt: string,
    month: string
  ): Insight[] {
    const insights: Insight[] = [];
    if (!budgetData || !budgetData.budgetVsActualByCategory) return insights;

    budgetData.budgetVsActualByCategory.forEach((item) => {
      if (item.budget > 0) {
        const usageRatio = item.actual / item.budget;
        if (usageRatio > 1) {
          insights.push({
            id: uuidv4(),
            type: InsightType.BUDGET_OVERRUN_WARNING,
            severity: 'critical',
            title: `${item.category} 예산 초과!`,
            message: `${item.category} 예산을 ${Math.abs(
              item.difference
            ).toLocaleString()}원 초과했습니다. (사용률: ${(usageRatio * 100).toFixed(0)}%)`,
            detailsLink: `/settings/budget?month=${month}`,
            data: {
              category: item.category,
              budget: item.budget,
              actual: item.actual,
              difference: item.difference,
            },
            generatedAt,
          });
        } else if (usageRatio >= BUDGET_USAGE_WARNING_THRESHOLD) {
          insights.push({
            id: uuidv4(),
            type: InsightType.BUDGET_NEARING_LIMIT,
            severity: 'warning',
            title: `${item.category} 예산 소진 임박`,
            message: `${item.category} 예산의 ${(usageRatio * 100).toFixed(
              0
            )}%를 사용했습니다. 남은 예산: ${(item.budget - item.actual).toLocaleString()}원`,
            detailsLink: `/settings/budget?month=${month}`,
            data: {
              category: item.category,
              budget: item.budget,
              actual: item.actual,
              remaining: item.budget - item.actual,
            },
            generatedAt,
          });
        }
      }
    });
    return insights;
  }

  private _generateCategorySpendingChangeInsights(
    monthlyStats: MonthlyStatsData,
    generatedAt: string
  ): Insight[] {
    const insights: Insight[] = [];
    if (
      !monthlyStats?.categoryData?.expenseData ||
      !monthlyStats?.previous?.categoryData?.expenseData
    ) {
      return insights;
    }

    const currentExpenses = monthlyStats.categoryData.expenseData;
    const previousExpenses = monthlyStats.previous.categoryData.expenseData;

    MAJOR_EXPENSE_CATEGORIES.forEach((categoryName) => {
      const currentCategory = currentExpenses.find((c) => c.categoryName === categoryName);
      const previousCategory = previousExpenses.find((c) => c.categoryName === categoryName);

      if (currentCategory && previousCategory && previousCategory.amount > 0) {
        const change = currentCategory.amount - previousCategory.amount;
        const percentageChange = (change / previousCategory.amount) * 100;

        if (Math.abs(percentageChange) >= 20 && Math.abs(change) >= 30000) {
          const type =
            change > 0
              ? InsightType.CATEGORY_SPENDING_INCREASE
              : InsightType.CATEGORY_SPENDING_DECREASE;
          const title = `${categoryName} 지출 ${change > 0 ? '증가' : '감소'}`;
          const message = `지난 달 대비 ${categoryName} 지출이 ${percentageChange.toFixed(
            0
          )}% (${change.toLocaleString()}원) ${
            change > 0 ? '증가했습니다' : '감소했습니다'
          }. 현재 ${currentCategory.amount.toLocaleString()}원 / 이전 ${previousCategory.amount.toLocaleString()}원`;

          insights.push({
            id: uuidv4(),
            type,
            severity: 'info',
            title,
            message,
            detailsLink: `/dashboard/transactions?categoryId=${currentCategory.categoryId}&month=${monthlyStats.month}`,
            data: {
              categoryName,
              currentAmount: currentCategory.amount,
              previousAmount: previousCategory.amount,
              change,
              percentageChange,
            },
            generatedAt,
          });
        }
      }
    });
    return insights;
  }

  private _generateRecentHighSpendingInsights(
    transactions: TransactionData[],
    generatedAt: string
  ): Insight[] {
    const insights: Insight[] = [];
    const highSpends = transactions.filter((tx) => tx.amount >= HIGH_SPENDING_THRESHOLD_AMOUNT);

    if (highSpends.length > 0) {
      const totalHighSpendingAmount = highSpends.reduce((sum, tx) => sum + tx.amount, 0);
      insights.push({
        id: uuidv4(),
        type: InsightType.RECENT_HIGH_SPENDING_ALERT,
        severity: 'warning',
        title: `최근 ${HIGH_SPENDING_CHECK_DAYS}일간 고액 지출 발생`,
        message: `최근 ${HIGH_SPENDING_CHECK_DAYS}일 동안 ${HIGH_SPENDING_THRESHOLD_AMOUNT.toLocaleString()}원 이상 지출이 ${
          highSpends.length
        }건 (총 ${totalHighSpendingAmount.toLocaleString()}원) 발생했습니다.`,
        detailsLink: `/dashboard/transactions?startDate=${format(
          subDays(new Date(), HIGH_SPENDING_CHECK_DAYS - 1),
          'yyyy-MM-dd'
        )}&endDate=${format(new Date(), 'yyyy-MM-dd')}&minAmount=${HIGH_SPENDING_THRESHOLD_AMOUNT}`,
        data: {
          count: highSpends.length,
          totalAmount: totalHighSpendingAmount,
          threshold: HIGH_SPENDING_THRESHOLD_AMOUNT,
          periodDays: HIGH_SPENDING_CHECK_DAYS,
          transactions: highSpends.slice(0, 3),
        },
        generatedAt,
      });
    }
    return insights;
  }

  // --- 신규 인사이트 생성 로직 ---

  /**
   * 월별 수입 급증 알림 인사이트를 생성합니다.
   * @param monthlyStats 현재 월 및 이전 월 통계 데이터
   * @param generatedAt 생성 시각
   */
  private _generateIncomeSpikeAlerts(
    monthlyStats: MonthlyStatsData,
    generatedAt: string
  ): Insight[] {
    const insights: Insight[] = [];
    if (!monthlyStats.previous || monthlyStats.previous.income === 0) {
      // 이전 달 수입이 0이면 비교 무의미
      return insights;
    }

    const currentIncome = monthlyStats.income;
    const previousIncome = monthlyStats.previous.income;
    const incomeChange = currentIncome - previousIncome;
    const incomeChangePercentage = (incomeChange / previousIncome) * 100;

    if (
      incomeChangePercentage >= INCOME_SPIKE_PERCENTAGE_THRESHOLD &&
      incomeChange >= INCOME_SPIKE_MIN_AMOUNT_THRESHOLD
    ) {
      insights.push({
        id: uuidv4(),
        type: InsightType.INCOME_SPIKE_ALERT,
        severity: 'info',
        title: '🎉 월 수입 증가!',
        message: `이번 달 수입이 지난 달 대비 ${incomeChangePercentage.toFixed(
          0
        )}% (${incomeChange.toLocaleString()}원) 증가한 ${currentIncome.toLocaleString()}원입니다! 멋진데요!`,
        detailsLink: `/dashboard/stats?type=monthly&month=${monthlyStats.month}`, // 예시: 월별 통계 상세 페이지
        data: {
          currentIncome,
          previousIncome,
          incomeChange,
          incomeChangePercentage,
        },
        generatedAt,
      });
    }
    return insights;
  }

  /**
   * 월간 긍정적 잔액 (저축 격려) 알림 인사이트를 생성합니다.
   * @param monthlyStats 현재 월 통계 데이터
   * @param generatedAt 생성 시각
   * @param month 현재 월 (YYYY-MM)
   */
  private _generatePositiveMonthlyBalanceAlerts(
    monthlyStats: MonthlyStatsData,
    generatedAt: string,
    month: string
  ): Insight[] {
    const insights: Insight[] = [];
    // monthlyStats.balance는 당월 (수입 - 지출)
    if (monthlyStats.balance >= POSITIVE_BALANCE_MIN_AMOUNT) {
      insights.push({
        id: uuidv4(),
        type: InsightType.POSITIVE_MONTHLY_BALANCE,
        severity: 'info',
        title: '👍 훌륭한 저축 진행!',
        message: `이번 달 ${monthlyStats.balance.toLocaleString()}원의 흑자를 기록했습니다! 목표 달성을 향해 순항 중이시네요.`,
        detailsLink: `/dashboard/stats?type=kpi&month=${month}`, // KPI 페이지
        data: {
          monthlyBalance: monthlyStats.balance,
          income: monthlyStats.income,
          expense: monthlyStats.expense,
        },
        generatedAt,
      });
    }
    return insights;
  }

  /**
   * 잠재적 구독 결제 알림 인사이트를 생성합니다. (단순 추정 기반)
   * @param currentMonthTransactions 이번 달 거래 내역
   * @param previousMonthTransactions 지난 달 거래 내역
   * @param generatedAt 생성 시각
   * @param currentReportMonth 현재 리포트 대상 월 (YYYY-MM)
   */
  private _generatePotentialSubscriptionReminders(
    currentMonthTransactions: TransactionData[],
    previousMonthTransactions: TransactionData[],
    generatedAt: string,
    currentReportMonth: string // YYYY-MM
  ): Insight[] {
    const insights: Insight[] = [];
    const today = new Date();
    const reminderStartDate = today;
    const reminderEndDate = addDays(today, SUBSCRIPTION_REMINDER_LOOKAHEAD_DAYS);

    const currentMonthTxMapByDescAmount = new Map<string, Map<number, TransactionData>>();
    currentMonthTransactions.forEach((tx) => {
      if (tx.description) {
        if (!currentMonthTxMapByDescAmount.has(tx.description)) {
          currentMonthTxMapByDescAmount.set(tx.description, new Map<number, TransactionData>());
        }
        currentMonthTxMapByDescAmount.get(tx.description)!.set(tx.amount, tx);
      }
    });

    const alertedPrevTxDescriptions: Set<string> = new Set();

    for (const prevTx of previousMonthTransactions) {
      if (
        prevTx.type === 'expense' &&
        prevTx.description &&
        !(!prevTx.isInstallment || prevTx.originalTransactionId) &&
        !alertedPrevTxDescriptions.has(prevTx.description)
      ) {
        const prevTxDayOfMonth = getDate(parseISO(prevTx.date));
        const expectedPaymentDateThisMonth = parseISO(
          `${currentReportMonth}-${String(prevTxDayOfMonth).padStart(2, '0')}`
        );

        if (
          differenceInDays(expectedPaymentDateThisMonth, reminderStartDate) >= 0 &&
          differenceInDays(expectedPaymentDateThisMonth, reminderEndDate) <= 0
        ) {
          let alreadyPaidThisMonthSimilarAmount = false;
          const similarTxsMap = currentMonthTxMapByDescAmount.get(prevTx.description);
          if (similarTxsMap) {
            for (const currentTxAmount of similarTxsMap.keys()) {
              if (
                prevTx.amount > 0 &&
                (Math.abs(currentTxAmount - prevTx.amount) / prevTx.amount) * 100 <=
                  SUBSCRIPTION_AMOUNT_DEVIATION_PERCENT
              ) {
                alreadyPaidThisMonthSimilarAmount = true;
                break;
              }
            }
          }

          if (!alreadyPaidThisMonthSimilarAmount) {
            insights.push({
              id: uuidv4(),
              type: InsightType.POTENTIAL_SUBSCRIPTION_REMINDER,
              severity: 'info',
              title: '🔔 정기 결제 예정 알림 (추정)',
              message: `[${prevTx.description}] 항목이 ${format(
                expectedPaymentDateThisMonth,
                'M월 d일'
              )}경 결제될 것으로 예상됩니다. (지난 달 ${prevTx.amount.toLocaleString()}원 기준)`,
              detailsLink: `/dashboard/transactions?keyword=${encodeURIComponent(
                prevTx.description
              )}`,
              data: {
                description: prevTx.description,
                lastAmount: prevTx.amount,
                expectedDate: format(expectedPaymentDateThisMonth, 'yyyy-MM-dd'),
                prevTxDate: prevTx.date,
              },
              generatedAt,
            });
            alertedPrevTxDescriptions.add(prevTx.description);
          }
        }
      }
    }
    return insights;
  }
}

const insightGenerationService = new InsightGenerationService();
export default insightGenerationService;
```

```ts
/* ./src/services/invitationService.ts */
import { prisma } from '@/lib/prisma';
import { WorkspaceRole, type Invitation, type WorkspaceUser, type User } from '@prisma/client';
import { ApiError, ForbiddenError, ValidationError, ConflictError } from './apiError';
import { sendInvitationEmail } from '@/lib/emailService';
import { v4 as uuidv4 } from 'uuid';

/**
 * 새 멤버를 워크스페이스로 초대합니다.
 * @param inviterId 초대를 보내는 사용자 ID (현재 로그인한 사용자)
 * @param workspaceId 초대가 이루어질 워크스페이스 ID
 * @param inviteeEmail 초대받는 사람의 이메일 주소
 * @param role 초대받는 사람에게 부여될 역할
 * @returns 생성된 Invitation 객체
 */
export async function createInvitation(
  inviterId: string,
  workspaceId: string,
  inviteeEmail: string,
  role: WorkspaceRole
): Promise<Invitation> {
  if (!inviterId || !workspaceId || !inviteeEmail || !role) {
    throw new ValidationError(
      '초대자 ID, 워크스페이스 ID, 초대받는 사람 이메일, 역할은 모두 필수입니다.'
    );
  }

  const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g; // 간단한 이메일 정규식
  if (!emailRegex.test(inviteeEmail)) {
    throw new ValidationError('유효하지 않은 이메일 주소 형식입니다.');
  }

  try {
    const inviterWorkspaceUser = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: inviterId,
          workspaceId: workspaceId,
        },
      },
      include: {
        workspace: true,
        user: true,
      },
    });

    if (!inviterWorkspaceUser || inviterWorkspaceUser.role !== 'ADMIN') {
      throw new ForbiddenError('멤버를 초대할 권한이 없습니다.');
    }

    const workspaceName = inviterWorkspaceUser.workspace.name;
    const inviterName =
      inviterWorkspaceUser.user.name || inviterWorkspaceUser.user.email || '관리자';

    // 2.1. inviteeEmail을 가진 사용자가 이미 해당 워크스페이스의 멤버인지 확인
    const invitee = await prisma.user.findUnique({
      where: { email: inviteeEmail },
      include: {
        workspaceUsers: {
          // User 모델의 workspaceUsers 관계 사용
          where: { workspaceId: workspaceId },
        },
      },
    });

    if (invitee && invitee.workspaceUsers.length > 0) {
      throw new ConflictError('이미 해당 워크스페이스의 멤버입니다.');
    }

    const existingPendingInvitation = await prisma.invitation.findFirst({
      where: {
        workspaceId: workspaceId,
        email: inviteeEmail,
        status: 'PENDING',
      },
    });

    if (existingPendingInvitation) {
      throw new ConflictError('이미 처리 대기 중인 초대가 존재합니다. 잠시 후 다시 시도해주세요.');
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const newInvitation = await prisma.invitation.create({
      data: {
        workspaceId: workspaceId,
        invitedById: inviterId,
        email: inviteeEmail,
        role: role,
        token: token,
        expiresAt: expiresAt,
        status: 'PENDING',
      },
    });

    const invitationLink = `${process.env.NEXTAUTH_URL}/invitations/accept?token=${token}`;

    await sendInvitationEmail(inviteeEmail, inviterName, workspaceName, invitationLink, role);

    return newInvitation;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[InvitationService] createInvitation error:', error);
    throw new ApiError('멤버 초대 중 오류가 발생했습니다.');
  }
}

/**
 * 초대를 수락하고 사용자를 워크스페이스 멤버로 추가합니다.
 * @param token 초대 수락 토큰
 * @param acceptingUserId 초대를 수락하는 사용자 ID (현재 로그인한 사용자)
 * @returns 생성된 WorkspaceUser 객체 (멤버십 정보)
 */
export async function acceptInvitation(
  token: string,
  acceptingUserId: string
): Promise<WorkspaceUser> {
  if (!token || !acceptingUserId) {
    throw new ValidationError('토큰과 수락하는 사용자 ID는 필수입니다.');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. 토큰 검증: PENDING 상태이고 만료되지 않은 초대 검색
      const invitation = await tx.invitation.findFirst({
        where: {
          token: token,
          status: 'PENDING',
          expiresAt: { gt: new Date() }, // 만료 시간이 현재 시간보다 큰 경우
        },
        include: {
          workspace: true, // 워크스페이스 정보 (이름 등)
        },
      });

      if (!invitation) {
        throw new ApiError('유효하지 않거나 만료된 초대 토큰입니다.', 400);
      }

      // 2. 사용자 검증: 초대의 이메일과 수락하는 사용자의 이메일이 일치하는지 확인
      //    (acceptingUserId로 User를 찾아 email을 비교)
      const acceptingUser = await tx.user.findUnique({
        where: { id: acceptingUserId },
      });

      if (!acceptingUser || acceptingUser.email !== invitation.email) {
        throw new ForbiddenError('초대 대상 사용자가 아닙니다.');
      }

      // 3. 멤버십 확인: 사용자가 이미 해당 워크스페이스의 멤버인지 확인
      const existingMembership = await tx.workspaceUser.findUnique({
        where: {
          userId_workspaceId: {
            userId: acceptingUserId,
            workspaceId: invitation.workspaceId,
          },
        },
      });

      if (existingMembership) {
        // 이미 멤버인 경우, 초대는 ACCEPTED로 처리하고 기존 멤버십 정보를 반환하거나,
        // 아니면 ConflictError를 발생시킬 수 있습니다. 여기서는 이미 멤버임을 알리고 성공 처리합니다.
        // 초대를 ACCEPTED로 업데이트 하는 것은 중복 작업을 피하기 위해 아래 로직에서 함께 처리됩니다.
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED' },
        });
        // console.log('이미 멤버이므로 기존 멤버십 정보를 반환합니다.');
        return existingMembership;
        // throw new ConflictError('이미 해당 워크스페이스의 멤버입니다.');
      }

      // 4. 데이터베이스 트랜잭션:
      // 4.1. WorkspaceUser 테이블에 멤버 추가
      const newWorkspaceUser = await tx.workspaceUser.create({
        data: {
          userId: acceptingUserId,
          workspaceId: invitation.workspaceId,
          role: invitation.role, // 초대에 명시된 역할 부여
        },
      });

      // 4.2. Invitation 레코드 상태를 'ACCEPTED'로 업데이트
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      // TODO: 필요한 경우 사용자에게 알림 (예: "[워크스페이스 이름]에 성공적으로 참여했습니다.")

      return newWorkspaceUser;
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[InvitationService] acceptInvitation error:', error);
    throw new ApiError('초대 수락 중 오류가 발생했습니다.');
  }
}

/**
 * 초대를 거절합니다.
 * @param token 초대 거절 토큰
 * @param decliningUserId 초대를 거절하는 사용자 ID (현재 로그인한 사용자)
 * @returns 업데이트된 Invitation 객체
 */
export async function declineInvitation(
  token: string,
  decliningUserId: string // 이 파라미터는 초대가 해당 사용자에게 온 것인지 확인하는 데 사용될 수 있습니다.
): Promise<Invitation> {
  if (!token || !decliningUserId) {
    throw new ValidationError('토큰과 거절하는 사용자 ID는 필수입니다.');
  }

  try {
    // 1. 토큰 검증: PENDING 상태이고 만료되지 않은 초대 검색
    const invitation = await prisma.invitation.findFirst({
      where: {
        token: token,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      throw new ApiError('유효하지 않거나 만료된 초대 토큰입니다.', 400);
    }

    // 2. 사용자 검증 (선택적): 초대가 decliningUserId에게 온 것인지 확인
    const decliningUser = await prisma.user.findUnique({
      where: { id: decliningUserId },
    });

    if (!decliningUser || decliningUser.email !== invitation.email) {
      // 다른 사람의 초대를 거절하려고 시도하는 경우
      throw new ForbiddenError('이 초대를 거절할 권한이 없습니다.');
    }

    // 3. 초대 상태를 'DECLINED'로 업데이트
    const updatedInvitation = await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'DECLINED' },
    });

    // TODO: 필요한 경우 초대한 사람에게 알림 (예: "[사용자 이메일]님이 초대를 거절했습니다.")

    return updatedInvitation;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[InvitationService] declineInvitation error:', error);
    throw new ApiError('초대 거절 중 오류가 발생했습니다.');
  }
}

/**
 * 특정 워크스페이스의 PENDING 상태인 초대 목록을 조회합니다.
 * @param workspaceId 워크스페이스 ID
 * @param currentUserId 현재 사용자 ID (권한 검사용)
 * @returns Invitation 객체 배열
 */
export async function getPendingInvitationsForWorkspace(
  workspaceId: string,
  currentUserId: string
): Promise<Invitation[]> {
  if (!workspaceId || !currentUserId) {
    throw new ValidationError('워크스페이스 ID와 현재 사용자 ID는 필수입니다.');
  }

  try {
    // 1. 권한 검증: currentUserId가 해당 workspaceId의 ADMIN인지 확인
    const workspaceUser = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: currentUserId,
          workspaceId: workspaceId,
        },
      },
    });

    if (!workspaceUser || workspaceUser.role !== 'ADMIN') {
      throw new ForbiddenError('보류 중인 초대 목록을 조회할 권한이 없습니다.');
    }

    // 2. PENDING 상태의 초대 목록 조회 (invitedBy 사용자 정보 포함)
    const pendingInvitations = await prisma.invitation.findMany({
      where: {
        workspaceId: workspaceId,
        status: 'PENDING',
        expiresAt: { gt: new Date() }, // 만료되지 않은 초대만
      },
      include: {
        invitedBy: {
          // 초대한 사용자 정보 포함
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // 최근 초대 순으로 정렬
      },
    });

    return pendingInvitations;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[InvitationService] getPendingInvitationsForWorkspace error:', error);
    throw new ApiError('보류 중인 초대 목록 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 특정 초대를 철회(삭제)합니다.
 * @param invitationId 철회할 초대의 ID
 * @param currentUserId 현재 사용자 ID (권한 검사용)
 * @returns Promise<void>
 */
export async function revokeInvitation(invitationId: string, currentUserId: string): Promise<void> {
  if (!invitationId || !currentUserId) {
    throw new ValidationError('초대 ID와 현재 사용자 ID는 필수입니다.');
  }

  try {
    // 1. 초대 정보 조회
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        workspace: {
          // 권한 확인을 위해 워크스페이스 정보 포함
          select: {
            ownerId: true, // 워크스페이스 소유주 확인용 (선택적)
            users: {
              // 현재 사용자가 ADMIN인지 확인용
              where: { userId: currentUserId },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!invitation) {
      throw new ApiError('철회할 초대를 찾을 수 없습니다.', 404);
    }

    // 2. 권한 검증:
    // 현재 사용자가 초대를 보낸 사람(invitedById)이거나,
    // 또는 해당 워크스페이스의 ADMIN인지 확인
    const isInviter = invitation.invitedById === currentUserId;
    const isAdminInWorkspace =
      invitation.workspace.users.length > 0 && invitation.workspace.users[0].role === 'ADMIN';

    if (!isInviter && !isAdminInWorkspace) {
      throw new ForbiddenError('초대를 철회할 권한이 없습니다.');
    }

    // 3. 초대 삭제 (또는 상태를 'REVOKED'로 변경할 수도 있음)
    await prisma.invitation.delete({
      where: { id: invitationId },
    });

    // TODO: 필요한 경우 사용자에게 알림 (예: "초대가 성공적으로 철회되었습니다.")
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[InvitationService] revokeInvitation error:', error);
    throw new ApiError('초대 철회 중 오류가 발생했습니다.');
  }
}

// 여기에 revokeInvitation 등의 함수들이 추가될 예정입니다.
```

```ts
/* ./src/services/statisticsService.ts */
import { prisma } from "@/lib/prisma";
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  parseISO,
  format,
  subMonths,
  differenceInDays,
  startOfYear,
  endOfYear,
  subYears,
  eachDayOfInterval,
  getDay,
  subDays, // getDailyStatsService에서 사용
} from "date-fns";
import {
  getStatsByDateRangeDb,
  getCarryOverBalanceDb,
  getDailyTrendInRangeDb,
  getCategoryDataInRangeDb,
  getMonthlyTrendInRangeDb,
  getYearlyTrendInRangeDb,
} from "@/lib/db/statsDb";
import { calculateComparison, calculateCategoryChange } from "@/lib/statsUtils";
import { getTransactionsDb } from "@/lib/db/transactionsDb";
import type { GetTransactionsQuery } from "@/lib/schemas/transactionsApiSchemas";
import type {
  DailyStatsData,
  MonthlyStatsData,
  YearlyStatsData,
  CategoryStatsData,
  SpendingPatternStats,
  IncomeSourceStats,
  BudgetVsActualStats,
  DetailStatsData,
} from "@/types/statisticsTypes";
import type { KpiData, KpiTrendValue } from "@/types/kpiTypes";
import type { TrendApiResponse } from "@/hooks/useDashboardData"; // 이 타입은 API 응답에 더 적합하게 재정의될 수 있음
import { ApiError, ForbiddenError } from "./apiError";
import { TrendChartItemData } from "@/types/chartTypes";

/**
 * 일별 통계 데이터를 계산합니다.
 * @param dateStr - 'yyyy-MM-dd' 형식의 날짜 문자열
 * @param compareWithPrevious - 이전 기간과 비교할지 여부
 * @returns 일별 통계 데이터
 * @throws ApiError 데이터베이스 작업 실패 시
 */
export async function getDailyStatsService(
  userId: string,
  workspaceId: string,
  dateStr: string,
  compareWithPrevious = false
): Promise<DailyStatsData> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 일별 통계를 조회할 권한이 없습니다."
    );
  }

  try {
    const date = parseISO(dateStr);
    const start = startOfDay(date);
    const end = endOfDay(date);

    const currentStats = await getStatsByDateRangeDb(workspaceId, start, end);

    let previousStatsData = null;
    if (compareWithPrevious) {
      const previousDay = subDays(date, 1); // 이전 '일'과 비교
      const previousStart = startOfDay(previousDay);
      const previousEnd = endOfDay(previousDay);
      previousStatsData = await getStatsByDateRangeDb(
        workspaceId,
        previousStart,
        previousEnd
      );
    }

    return {
      date: dateStr,
      current: currentStats,
      previous: previousStatsData,
      comparison: previousStatsData
        ? calculateComparison(currentStats, previousStatsData)
        : null,
    };
  } catch (error) {
    console.error("[StatisticsService] getDailyStatsService error:", error);
    throw new ApiError("일별 통계 조회 중 오류가 발생했습니다.");
  }
}

/**
 * 월별 통계 데이터를 계산합니다.
 * @param monthStr - 'yyyy-MM' 형식의 월 문자열
 * @param compareWithPrevious - 이전 기간과 비교할지 여부
 * @returns 월별 통계 데이터
 * @throws ApiError 데이터베이스 작업 실패 시
 */
export async function getMonthlyStatsService(
  userId: string,
  workspaceId: string,
  monthStr: string,
  compareWithPrevious = false
): Promise<MonthlyStatsData> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 월별 통계를 조회할 권한이 없습니다."
    );
  }

  try {
    const date = parseISO(`${monthStr}-01`);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    // DB 함수 호출 시 workspaceId 전달
    const currentStats = await getStatsByDateRangeDb(workspaceId, start, end);
    const dailyTrend = await getDailyTrendInRangeDb(workspaceId, start, end);
    const categoryDataResult = await getCategoryDataInRangeDb(
      workspaceId,
      start,
      end
    );
    const carryOverBalance = await getCarryOverBalanceDb(workspaceId, start);

    let previousStats = null;
    let previousDailyTrend = null;
    let previousCategoryDataResult = null;
    let previousMonthStr = null;

    if (compareWithPrevious) {
      const previousMonthDate = subMonths(date, 1);
      previousMonthStr = format(previousMonthDate, "yyyy-MM");
      const previousStart = startOfMonth(previousMonthDate);
      const previousEnd = endOfMonth(previousMonthDate);

      previousStats = await getStatsByDateRangeDb(
        workspaceId,
        previousStart,
        previousEnd
      );
      previousDailyTrend = await getDailyTrendInRangeDb(
        workspaceId,
        previousStart,
        previousEnd
      );
      previousCategoryDataResult = await getCategoryDataInRangeDb(
        workspaceId,
        previousStart,
        previousEnd
      );
    }

    const totalBalance = carryOverBalance + currentStats.balance;
    const daysInMonth = differenceInDays(end, start) + 1;

    const result: MonthlyStatsData = {
      month: monthStr,
      previousMonth: compareWithPrevious ? previousMonthStr : null,
      income: currentStats.income,
      expense: currentStats.expense,
      balance: currentStats.balance,
      carryOverBalance,
      totalBalance,
      averageDailyExpense:
        daysInMonth > 0 ? currentStats.expense / daysInMonth : 0,
      averageDailyIncome:
        daysInMonth > 0 ? currentStats.income / daysInMonth : 0,
      expenseRatio:
        currentStats.income > 0
          ? (currentStats.expense / currentStats.income) * 100
          : currentStats.expense > 0
          ? Infinity
          : 0,
      dailyTrend: dailyTrend as TrendChartItemData[], // 타입 단언
      categoryData: {
        expenseData: categoryDataResult.expenseData.map((d) => ({
          ...d,
          categoryId: d.categoryId || 0,
        })),
        incomeData: categoryDataResult.incomeData.map((d) => ({
          ...d,
          categoryId: d.categoryId || 0,
        })),
        totalExpense: categoryDataResult.totalExpense,
        totalIncome: categoryDataResult.totalIncome,
      },
      previous:
        compareWithPrevious &&
        previousStats &&
        previousCategoryDataResult &&
        previousDailyTrend
          ? {
              income: previousStats.income,
              expense: previousStats.expense,
              balance: previousStats.balance,
              dailyTrend: previousDailyTrend as TrendChartItemData[],
              categoryData: {
                expenseData: previousCategoryDataResult.expenseData.map(
                  (d) => ({ ...d, categoryId: d.categoryId || 0 })
                ),
                incomeData: previousCategoryDataResult.incomeData.map((d) => ({
                  ...d,
                  categoryId: d.categoryId || 0,
                })),
              },
            }
          : null,
      comparison: previousStats
        ? calculateComparison(currentStats, previousStats)
        : null,
    };
    return result;
  } catch (error) {
    console.error("[StatisticsService] getMonthlyStatsService error:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError("월별 통계 조회 중 오류가 발생했습니다.");
  }
}

/**
 * 연간 통계 데이터를 계산합니다.
 * @param yearStr - 'yyyy' 형식의 연도 문자열
 * @param compareWithPrevious - 이전 기간과 비교할지 여부
 * @returns 연간 통계 데이터
 * @throws ApiError 데이터베이스 작업 실패 시
 */
export async function getYearlyStatsService(
  userId: string,
  workspaceId: string,
  yearStr: string,
  compareWithPrevious = false
): Promise<YearlyStatsData> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 연간 통계를 조회할 권한이 없습니다."
    );
  }

  try {
    const date = parseISO(`${yearStr}-01-01`);
    const start = startOfYear(date);
    const end = endOfYear(date);

    // 1. 현재 연도 데이터 병렬 조회
    const [currentStats, monthlyTrend, categoryDataResult] = await Promise.all([
      getStatsByDateRangeDb(workspaceId, start, end),
      getMonthlyTrendInRangeDb(workspaceId, start, end),
      getCategoryDataInRangeDb(workspaceId, start, end),
    ]);

    let previousStatsData = null;
    let previousMonthlyTrend = null;
    let previousCategoryDataResult = null;
    let previousYearStr = null;

    if (compareWithPrevious) {
      const previousYearDate = subYears(date, 1);
      previousYearStr = format(previousYearDate, "yyyy");
      const previousStart = startOfYear(previousYearDate);
      const previousEnd = endOfYear(previousYearDate);

      // 2. 이전 연도 데이터 병렬 조회
      const [prevStats, prevMonthlyTrend, prevCategoryData] = await Promise.all(
        [
          getStatsByDateRangeDb(workspaceId, previousStart, previousEnd),
          getMonthlyTrendInRangeDb(workspaceId, previousStart, previousEnd),
          getCategoryDataInRangeDb(workspaceId, previousStart, previousEnd),
        ]
      );
      previousStatsData = prevStats;
      previousMonthlyTrend = prevMonthlyTrend;
      previousCategoryDataResult = prevCategoryData;
    }

    // 3. 데이터 조합 및 계산 (기존 로직과 동일)
    return {
      year: yearStr,
      previousYear: previousYearStr,
      income: currentStats.income,
      expense: currentStats.expense,
      balance: currentStats.balance,
      averageMonthlyExpense: currentStats.expense / 12,
      averageMonthlyIncome: currentStats.income / 12,
      expenseRatio:
        currentStats.income > 0
          ? (currentStats.expense / currentStats.income) * 100
          : currentStats.expense > 0
          ? Infinity
          : 0,
      monthlyTrend, // 이미 TrendChartItemData[] 또는 그에 준하는 타입이어야 함
      categoryData: {
        expenseData: categoryDataResult.expenseData.map((d) => ({
          ...d,
          categoryId: d.categoryId || 0,
        })),
        incomeData: categoryDataResult.incomeData.map((d) => ({
          ...d,
          categoryId: d.categoryId || 0,
        })),
        // totalExpense, totalIncome은 categoryDataResult에 이미 포함되어 있을 것으로 예상
      },
      previous:
        previousStatsData && previousMonthlyTrend && previousCategoryDataResult
          ? {
              income: previousStatsData.income,
              expense: previousStatsData.expense,
              balance: previousStatsData.balance,
              monthlyTrend: previousMonthlyTrend,
              categoryData: {
                expenseData: previousCategoryDataResult.expenseData.map(
                  (d) => ({
                    ...d,
                    categoryId: d.categoryId || 0,
                  })
                ),
                incomeData: previousCategoryDataResult.incomeData.map((d) => ({
                  ...d,
                  categoryId: d.categoryId || 0,
                })),
              },
            }
          : null,
      comparison: previousStatsData
        ? calculateComparison(currentStats, previousStatsData)
        : null,
    };
  } catch (error) {
    console.error("[StatisticsService] getYearlyStatsService error:", error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("연간 통계 조회 중 오류가 발생했습니다.");
  }
}

/**
 * 카테고리별 통계 데이터를 계산합니다.
 * @param referenceStr - 'yyyy-MM' (period='month') 또는 'yyyy' (period='year')
 * @param period - 'month' 또는 'year'
 * @returns 카테고리별 통계 데이터
 * @throws ApiError 데이터베이스 작업 실패 시
 */
export async function getCategoryStatsService(
  userId: string,
  workspaceId: string,
  referenceStr: string,
  period: "month" | "year" = "month"
): Promise<CategoryStatsData> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 카테고리별 통계를 조회할 권한이 없습니다."
    );
  }

  try {
    let start: Date, end: Date;
    const dateToParse =
      period === "year" ? `${referenceStr}-01-01` : `${referenceStr}-01`;
    const parsedRefDate = parseISO(dateToParse);

    if (period === "month") {
      start = startOfMonth(parsedRefDate);
      end = endOfMonth(parsedRefDate);
    } else {
      // period === 'year'
      start = startOfYear(parsedRefDate);
      end = endOfYear(parsedRefDate);
    }

    const { expenseData, incomeData } = await getCategoryDataInRangeDb(
      workspaceId,
      start,
      end
    );

    // 카테고리 데이터 포맷팅 (ChartCategoryData 타입 준수)
    const formattedExpenseData = expenseData.map((item) => ({
      categoryId: item.categoryId || 0, // null일 경우 기본값 처리
      categoryName: item.categoryName,
      amount: item.amount,
      percentage: item.percentage,
    }));
    const formattedIncomeData = incomeData.map((item) => ({
      categoryId: item.categoryId || 0,
      categoryName: item.categoryName,
      amount: item.amount,
      percentage: item.percentage,
    }));

    let expenseChangeData: CategoryStatsData["expenseChangeData"] = [];
    let incomeChangeData: CategoryStatsData["incomeChangeData"] = [];

    if (period === "month") {
      const previousMonthDate = subMonths(parsedRefDate, 1);
      const previousStart = startOfMonth(previousMonthDate);
      const previousEnd = endOfMonth(previousMonthDate);
      const { expenseData: prevExpenseData, incomeData: prevIncomeData } =
        await getCategoryDataInRangeDb(workspaceId, previousStart, previousEnd);

      const formattedPrevExpenseData = prevExpenseData.map((item) => ({
        categoryId: item.categoryId || 0,
        categoryName: item.categoryName,
        amount: item.amount,
        percentage: item.percentage,
      }));
      const formattedPrevIncomeData = prevIncomeData.map((item) => ({
        categoryId: item.categoryId || 0,
        categoryName: item.categoryName,
        amount: item.amount,
        percentage: item.percentage,
      }));

      expenseChangeData = calculateCategoryChange(
        formattedExpenseData,
        formattedPrevExpenseData
      );
      incomeChangeData = calculateCategoryChange(
        formattedIncomeData,
        formattedPrevIncomeData
      );
    }

    return {
      period,
      date: referenceStr,
      expenseData: formattedExpenseData,
      incomeData: formattedIncomeData,
      expenseChangeData: period === "month" ? expenseChangeData : undefined, // undefined로 명시적 처리
      incomeChangeData: period === "month" ? incomeChangeData : undefined,
      topExpenseCategories: formattedExpenseData.slice(0, 5),
      topIncomeCategories: formattedIncomeData.slice(0, 5),
    };
  } catch (error) {
    console.error("[StatisticsService] getCategoryStatsService error:", error);
    throw new ApiError("카테고리별 통계 조회 중 오류가 발생했습니다.");
  }
}

/**
 * 트렌드 통계 데이터를 계산합니다.
 * @param period - 'day', 'month', 또는 'year'
 * @param monthParam - 'yyyy-MM' (period='day')
 * @param yearParam - 'yyyy' (period='month' 또는 'year')
 * @returns 트렌드 통계 데이터 (TrendApiResponse 형식)
 * @throws ApiError 데이터베이스 작업 실패 시
 */
export async function getTrendStatsService(
  userId: string,
  workspaceId: string,
  period: "day" | "month" | "year" = "month",
  monthParam?: string,
  yearParam?: string
): Promise<TrendApiResponse> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 트렌드 통계를 조회할 권한이 없습니다."
    );
  }

  try {
    let start: Date, end: Date;
    let response: TrendApiResponse;

    if (period === "day") {
      const date = parseISO(
        `${monthParam || format(new Date(), "yyyy-MM")}-01`
      );
      start = startOfMonth(date);
      end = endOfMonth(date);
      const dailyTrend = await getDailyTrendInRangeDb(workspaceId, start, end);
      response = {
        period: "day",
        month: format(date, "yyyy-MM"),
        trend: dailyTrend,
      };
    } else if (period === "month") {
      const date = parseISO(`${yearParam || format(new Date(), "yyyy")}-01-01`);
      start = startOfYear(date);
      end = endOfYear(date);
      const monthlyTrend = await getMonthlyTrendInRangeDb(
        workspaceId,
        start,
        end
      );
      response = {
        period: "month",
        year: format(date, "yyyy"),
        trend: monthlyTrend,
      };
    } else {
      // period === 'year'
      const currentYear = new Date().getFullYear();
      // 예시: 최근 5년 트렌드
      const startYearNum = currentYear - 4; // 올해 포함 5년
      start = startOfYear(new Date(startYearNum, 0, 1));
      end = endOfYear(new Date()); // 올해 말까지
      const yearlyTrend = await getYearlyTrendInRangeDb(
        workspaceId,
        start,
        end
      ).then((trends) =>
        trends.map((t) => ({
          date: t.year,
          income: t.income,
          expense: t.expense,
        }))
      );
      response = {
        period: "year",
        startYear: startYearNum.toString(),
        endYear: currentYear.toString(),
        trend: yearlyTrend,
      };
    }
    return response;
  } catch (error) {
    console.error("[StatisticsService] getTrendStatsService error:", error);
    throw new ApiError("트렌드 통계 조회 중 오류가 발생했습니다.");
  }
}

// getKpiStatsService, getSpendingPatternStatsService, getIncomeSourceStatsService,
// getBudgetVsActualStatsService, getDetailStatsService 함수들은
// 이전 단계에서 이미 ApiError 처리 및 타입 명시가 잘 되어 있으므로, 여기서는 그대로 사용합니다.
// (단, 내부 로직에서 사용하는 DB 함수나 유틸리티 함수의 반환 타입 변경에 따른 조정이 필요할 수 있습니다.)

export async function getKpiStatsService(
  userId: string,
  workspaceId: string,
  period = "month",
  monthParam?: string,
  yearParam?: string
): Promise<KpiData> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 KPI 통계를 조회할 권한이 없습니다."
    );
  }

  try {
    let start: Date, end: Date, previousStart: Date, previousEnd: Date;
    const defaultMonthDate = parseISO(
      `${monthParam || format(new Date(), "yyyy-MM")}-01`
    );
    const defaultYearDate = parseISO(
      `${yearParam || format(new Date(), "yyyy")}-01-01`
    );

    if (period === "month") {
      start = startOfMonth(defaultMonthDate);
      end = endOfMonth(defaultMonthDate);
      previousStart = startOfMonth(subMonths(defaultMonthDate, 1));
      previousEnd = endOfMonth(subMonths(defaultMonthDate, 1));
    } else {
      // period === 'year'
      start = startOfYear(defaultYearDate);
      end = endOfYear(defaultYearDate);
      previousStart = startOfYear(subYears(defaultYearDate, 1));
      previousEnd = endOfYear(subYears(defaultYearDate, 1));
    }

    const promises = [
      getStatsByDateRangeDb(workspaceId, start, end), // currentStats
      getStatsByDateRangeDb(workspaceId, previousStart, previousEnd), // previousStats
      getCarryOverBalanceDb(workspaceId, start), // currentCarryOverBalance
      getCarryOverBalanceDb(workspaceId, previousStart), // previousCarryOverBalance
      period === "month"
        ? getDailyTrendInRangeDb(workspaceId, start, end) // netTrendData (일별)
        : getMonthlyTrendInRangeDb(workspaceId, start, end), // netTrendData (월별)
    ] as const;

    const [
      currentStatsResolved,
      previousStatsResolved,
      currentCarryOverBalanceResolved,
      previousCarryOverBalanceResolved,
      netTrendDataResolved,
    ] = await Promise.all(promises);

    const currentStats = currentStatsResolved as {
      income: number;
      expense: number;
      balance: number;
    };
    const previousStats = previousStatsResolved as {
      income: number;
      expense: number;
      balance: number;
    };
    const currentCarryOverBalance = currentCarryOverBalanceResolved as number;
    const previousCarryOverBalance = previousCarryOverBalanceResolved as number;
    const netTrendData = netTrendDataResolved as TrendChartItemData[]; // TrendChartItemData 타입은 이미 정의되어 있을 것입니다.

    const typedCurrentStats = currentStats as {
      income: number;
      expense: number;
      balance: number;
    };
    const typedPreviousStats = previousStats as {
      income: number;
      expense: number;
      balance: number;
    };
    const typedCurrentCarryOverBalance = currentCarryOverBalance as number;
    const typedNetTrendData = netTrendData as TrendChartItemData[];

    const currentTotalBalance = currentCarryOverBalance + currentStats.balance;
    const previousTotalBalance =
      previousCarryOverBalance + previousStats.balance;

    const totalBalanceChange = currentTotalBalance - previousTotalBalance;
    const totalBalanceChangePercent =
      previousTotalBalance !== 0
        ? (totalBalanceChange / Math.abs(previousTotalBalance)) * 100
        : currentTotalBalance !== 0
        ? currentTotalBalance > 0
          ? 100
          : -100
        : 0;

    const periodLength =
      period === "month" ? differenceInDays(end, start) + 1 : 12;
    const avgExpense =
      periodLength > 0 ? currentStats.expense / periodLength : 0;
    const previousPeriodLength =
      period === "month"
        ? differenceInDays(previousEnd, previousStart) + 1
        : 12;

    const comparison = calculateComparison(currentStats, previousStats);

    let totalBalanceTrend: KpiTrendValue[] = [];
    if (period === "month") {
      const dailyTrends = typedNetTrendData; // dailyTrends는 TrendChartItemData[] 타입
      let cumulativeBalance = typedCurrentCarryOverBalance; // cumulativeBalance는 number 타입

      totalBalanceTrend = dailyTrends.map((dayTrend) => {
        // dayTrend.income과 dayTrend.expense가 string일 수 있으므로 숫자로 변환
        const incomeValue = parseFloat(String(dayTrend.income ?? 0));
        const expenseValue = parseFloat(String(dayTrend.expense ?? 0));

        // parseFloat 결과가 NaN일 경우 0으로 처리
        const dailyNetChange =
          (isNaN(incomeValue) ? 0 : incomeValue) -
          (isNaN(expenseValue) ? 0 : expenseValue);

        cumulativeBalance += dailyNetChange;
        return { date: dayTrend.date, value: cumulativeBalance };
      });
    } else {
      // period === 'year'
      const monthlyTrends = typedNetTrendData; // monthlyTrends는 TrendChartItemData[] 타입
      totalBalanceTrend = monthlyTrends.map((monthTrend) => {
        const incomeValue = parseFloat(String(monthTrend.income ?? 0));
        const expenseValue = parseFloat(String(monthTrend.expense ?? 0));
        const monthlyNet =
          (isNaN(incomeValue) ? 0 : incomeValue) -
          (isNaN(expenseValue) ? 0 : expenseValue);
        return {
          date: monthTrend.date, // monthTrend.date는 이미 string
          value: monthlyNet,
        };
      });
    }

    // KPI 객체 생성 시에도 동일한 숫자 변환 로직 적용
    const kpiIncomeTrend = typedNetTrendData.map((d) => {
      const val = parseFloat(String(d.income ?? 0));
      return { date: d.date, value: isNaN(val) ? 0 : val };
    });
    const kpiExpenseTrend = typedNetTrendData.map((d) => {
      const val = parseFloat(String(d.expense ?? 0));
      return { date: d.date, value: isNaN(val) ? 0 : val };
    });
    const kpiBalanceTrend = typedNetTrendData.map((d) => {
      const incomeVal = parseFloat(String(d.income ?? 0));
      const expenseVal = parseFloat(String(d.expense ?? 0));
      return {
        date: d.date,
        value:
          (isNaN(incomeVal) ? 0 : incomeVal) -
          (isNaN(expenseVal) ? 0 : expenseVal),
      };
    });

    return {
      period,
      date:
        period === "month" ? format(start, "yyyy-MM") : format(start, "yyyy"),
      kpi: {
        income: {
          value: typedCurrentStats.income,
          trend: kpiIncomeTrend,
          change: comparison.incomeChange,
          changePercent: comparison.incomeChangePercent,
          previous: typedPreviousStats.income,
        },
        expense: {
          value: typedCurrentStats.expense,
          trend: kpiExpenseTrend,
          change: comparison.expenseChange,
          changePercent: comparison.expenseChangePercent,
          previous: typedPreviousStats.expense,
        },
        balance: {
          // 당월/당해 순수입/지출
          value: typedCurrentStats.balance,
          trend: kpiBalanceTrend,
          change: comparison.balanceChange,
          changePercent: comparison.balanceChangePercent,
          previous: typedPreviousStats.balance,
        },
        totalBalance: {
          // 이월 포함 최종 잔액
          value: currentTotalBalance, // 이 값은 totalBalanceTrend의 마지막 요소의 value와 일치해야 합니다. (누적 계산 시)
          // 만약 totalBalanceTrend가 기간별 순변동액이라면 이 값은 그대로 사용합니다.
          // 현재 로직(period === 'month')에서는 누적 잔액이므로 totalBalanceTrend.slice(-1)[0]?.value 가 더 정확할 수 있습니다.
          // 다만, 간단하게 currentTotalBalance를 사용해도 큰 문제는 없을 수 있습니다.
          previous: previousTotalBalance,
          change: totalBalanceChange,
          changePercent: totalBalanceChangePercent,
          trend: totalBalanceTrend,
        },
        expenseToIncomeRatio: {
          value:
            currentStats.income > 0
              ? (currentStats.expense / currentStats.income) * 100
              : currentStats.expense > 0
              ? Infinity
              : 0,
          previous:
            previousStats.income > 0
              ? (previousStats.expense / previousStats.income) * 100
              : previousStats.expense > 0
              ? Infinity
              : 0,
        },
        avgDailyExpense: {
          value: avgExpense,
          previous:
            previousPeriodLength > 0
              ? previousStats.expense / previousPeriodLength
              : 0,
        },
      },
    };
  } catch (error) {
    console.error("[StatisticsService] getKpiStatsService error:", error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("KPI 통계 조회 중 오류가 발생했습니다.");
  }
}

export async function getSpendingPatternStatsService(
  userId: string,
  workspaceId: string,
  monthStr: string
): Promise<SpendingPatternStats> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 소비 패턴 통계를 조회할 권한이 없습니다."
    );
  }

  try {
    const date = parseISO(`${monthStr}-01`);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const allDays = eachDayOfInterval({ start, end });
    const dayPatternInitial = Array.from({ length: 7 }, (_, i) => ({
      day: i.toString(),
      amount: 0,
      count: 0,
      avgAmount: 0,
    }));

    const transactions = await prisma.transaction.findMany({
      where: {
        workspaceId,
        date: { gte: start, lte: end },
        type: "expense",
        NOT: { isInstallment: true, originalTransactionId: null },
      },
      orderBy: { date: "asc" },
    });

    const dayPatternMap = transactions.reduce((acc, tx) => {
      const dayOfWeek = getDay(new Date(tx.date));
      acc[dayOfWeek].amount += tx.amount;
      acc[dayOfWeek].count += 1;
      return acc;
    }, dayPatternInitial);

    const dayPattern = dayPatternMap.map((day) => ({
      ...day,
      avgAmount: day.count > 0 ? day.amount / day.count : 0,
    }));

    const topCategoriesResult = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        workspaceId,
        date: { gte: start, lte: end },
        type: "expense",
        NOT: { isInstallment: true, originalTransactionId: null },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    });

    const categoryIds = topCategoriesResult
      .map((c) => c.categoryId)
      .filter((id) => id !== null) as number[];
    const categories =
      categoryIds.length > 0
        ? await prisma.category.findMany({ where: { id: { in: categoryIds } } })
        : [];

    const topCategories = topCategoriesResult.map((c) => {
      const category = categories.find((cat) => cat.id === c.categoryId);
      return {
        categoryId: c.categoryId as number,
        name: category?.name || "알 수 없음",
        amount: c._sum.amount || 0,
      };
    });

    const totalExpense = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const averageDailyExpense =
      allDays.length > 0 ? totalExpense / allDays.length : 0;

    return {
      totalExpense,
      averageDailyExpense,
      dayPattern,
      topCategories,
      transactionCount: transactions.length,
    };
  } catch (error) {
    console.error(
      "[StatisticsService] getSpendingPatternStatsService error:",
      error
    );
    throw new ApiError("소비 패턴 분석 중 오류가 발생했습니다.");
  }
}

export async function getIncomeSourceStatsService(
  userId: string,
  workspaceId: string,
  monthStr: string,
  compareWithPrevious = false
): Promise<IncomeSourceStats> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 수입원 분석 통계를 조회할 권한이 없습니다."
    );
  }

  try {
    const date = parseISO(`${monthStr}-01`);
    const startCurrentMonth = startOfMonth(date);
    const endCurrentMonth = endOfMonth(date);

    const incomeByCategoryPromise = prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        workspaceId,
        date: { gte: startCurrentMonth, lte: endCurrentMonth },
        type: "income",
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    });

    // Promise 체인을 사용하여 categoryIds를 얻고, 이를 바탕으로 categories를 조회합니다.
    const categoriesPromise = incomeByCategoryPromise.then(
      async (incomeData) => {
        const categoryIds = incomeData
          .map((c) => c.categoryId)
          .filter((id) => id !== null) as number[];
        if (categoryIds.length > 0) {
          return prisma.category.findMany({
            where: { id: { in: categoryIds } },
          });
        }
        return Promise.resolve([]);
      }
    );

    const [incomeByCategory, categories] = await Promise.all([
      incomeByCategoryPromise, // incomeByCategoryPromise는 여기서 직접 사용됩니다.
      categoriesPromise,
    ]);

    const totalIncome = incomeByCategory.reduce(
      (sum, item) => sum + (item._sum.amount || 0),
      0
    );

    const incomeSources = incomeByCategory.map((item) => {
      const category = categories.find((c) => c.id === item.categoryId);
      const amount = item._sum.amount || 0;
      return {
        categoryId: item.categoryId as number,
        name: category?.name || "알 수 없음",
        value: amount,
        percentage: totalIncome > 0 ? (amount / totalIncome) * 100 : 0,
      };
    });

    let previousData = null;
    if (compareWithPrevious) {
      const previousMonthStr = format(subMonths(date, 1), "yyyy-MM");
      const prevMonthStats = await getIncomeSourceStatsService(
        userId,
        workspaceId,
        previousMonthStr,
        false
      );
      previousData = prevMonthStats;
    }

    const trendEndDate = endOfMonth(date);
    const trendStartDate = startOfMonth(subMonths(date, 5));
    const monthlyIncomeTrend = await getMonthlyTrendInRangeDb(
      workspaceId,
      trendStartDate,
      trendEndDate
    );

    const trendData = monthlyIncomeTrend.map((monthData) => ({
      month: monthData.date,
      income: monthData.income,
    }));

    const diversityScore = Math.min(100, incomeSources.length * 20);

    return {
      totalIncome,
      incomeSources,
      trendData,
      diversityScore,
      previous: previousData,
      incomeSourceCount: incomeSources.length,
    };
  } catch (error) {
    console.error(
      "[StatisticsService] getIncomeSourceStatsService error:",
      error
    );
    if (error instanceof ApiError) throw error;
    throw new ApiError("수입원 분석 중 오류가 발생했습니다.");
  }
}

export async function getBudgetVsActualStatsService(
  userId: string,
  workspaceId: string,
  monthStr: string
): Promise<BudgetVsActualStats> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 예산 대비 지출 통계를 조회할 권한이 없습니다."
    );
  }

  try {
    const date = parseISO(`${monthStr}-01`);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const budgetsPromise = prisma.budget.findMany({
      where: { workspaceId, month: monthStr },
      include: { category: true },
    });

    const expensesByCategoryPromise = prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        workspaceId,
        date: { gte: start, lte: end },
        type: "expense",
        NOT: { isInstallment: true, originalTransactionId: null },
      },
      _sum: { amount: true },
    });

    const [budgets, expensesByCategory] = await Promise.all([
      budgetsPromise,
      expensesByCategoryPromise,
    ]);

    const budgetVsActualByCategory = budgets.map((budget) => {
      const actualExpense = expensesByCategory.find(
        (e) => e.categoryId === budget.categoryId
      );
      const actualAmount = actualExpense?._sum.amount || 0;
      const percentage =
        budget.amount > 0
          ? (actualAmount / budget.amount) * 100
          : actualAmount > 0
          ? Infinity
          : 0;
      return {
        budgetId: budget.id,
        category: budget.category.name,
        categoryId: budget.categoryId,
        budget: budget.amount,
        actual: actualAmount,
        difference: budget.amount - actualAmount,
        percentage,
      };
    });

    const budgetedCategoryIds = budgets.map((b) => b.categoryId);
    const nonBudgetedExpenses = expensesByCategory.filter(
      (e) =>
        e.categoryId !== null &&
        !budgetedCategoryIds.includes(e.categoryId as number)
    );

    // nonBudgetedResults의 타입에서 budgetId를 number | null로 명시적으로 정의합니다.
    // BudgetVsActualItem과 유사한 구조를 가지지만 budgetId 타입만 다릅니다.
    type NonBudgetedResultItem = Omit<
      (typeof budgetVsActualByCategory)[0],
      "budgetId"
    > & { budgetId: number | null };
    let nonBudgetedResults: NonBudgetedResultItem[] = [];

    if (nonBudgetedExpenses.length > 0) {
      const nonBudgetedCategoryIds = nonBudgetedExpenses.map(
        (e) => e.categoryId as number
      );
      const categoriesForNonBudgeted = await prisma.category.findMany({
        where: { id: { in: nonBudgetedCategoryIds } },
        select: { id: true, name: true },
      });
      const categoryMap = new Map(
        categoriesForNonBudgeted.map((c) => [c.id, c.name])
      );

      nonBudgetedResults = nonBudgetedExpenses.map((e) => {
        const actualAmount = e._sum.amount || 0;
        return {
          budgetId: null, // null로 설정
          category: categoryMap.get(e.categoryId as number) || "알 수 없음",
          categoryId: e.categoryId as number,
          budget: 0,
          actual: actualAmount,
          difference: -actualAmount,
          percentage: Infinity,
        };
      });
    }

    const combinedData: NonBudgetedResultItem[] = [
      ...budgetVsActualByCategory,
      ...nonBudgetedResults,
    ];

    const totalBudget = combinedData.reduce(
      (sum, item) => sum + item.budget,
      0
    );
    const totalActual = expensesByCategory.reduce(
      (sum, item) => sum + (item._sum.amount || 0),
      0
    );
    const totalPercentage =
      totalBudget > 0
        ? (totalActual / totalBudget) * 100
        : totalActual > 0
        ? Infinity
        : 0;

    const overBudgetCategories = combinedData
      .filter(
        (item) => item.percentage === Infinity || (item.percentage ?? 0) > 100
      )
      .sort((a, b) => {
        const percA = a.percentage ?? -1;
        const percB = b.percentage ?? -1;
        if (percA === Infinity && percB !== Infinity) return -1;
        if (percA !== Infinity && percB === Infinity) return 1;
        if (percA === Infinity && percB === Infinity)
          return b.actual - a.actual;
        return percB - percA;
      });

    return {
      totalBudget,
      totalActual,
      difference: totalBudget - totalActual,
      totalPercentage,
      budgetVsActualByCategory: combinedData.sort(
        (a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)
      ),
      overBudgetCategories,
      hasBudget: budgets.length > 0,
    };
  } catch (error) {
    console.error(
      "[StatisticsService] getBudgetVsActualStatsService error:",
      error
    );
    throw new ApiError("예산 대비 지출 분석 중 오류가 발생했습니다.");
  }
}

export async function getDetailStatsService(
  userId: string,
  workspaceId: string,
  startDateStr: string,
  endDateStr: string
): Promise<DetailStatsData> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 상세 통계를 조회할 권한이 없습니다."
    );
  }

  try {
    const parsedStartDate = parseISO(startDateStr);
    const parsedEndDate = parseISO(endDateStr);

    const transactionsQuery: GetTransactionsQuery = {
      startDate: format(startOfDay(parsedStartDate), "yyyy-MM-dd"),
      endDate: format(endOfDay(parsedEndDate), "yyyy-MM-dd"),
      sortBy: "date",
      sortOrder: "desc",
    };
    const transactions = await getTransactionsDb({
      ...transactionsQuery,
      workspaceId,
    });

    const rangeStart = startOfDay(parsedStartDate);
    const rangeEnd = endOfDay(parsedEndDate);

    const dailySummary = await getDailyTrendInRangeDb(
      workspaceId,
      rangeStart,
      rangeEnd
    );
    const categoryDataResult = await getCategoryDataInRangeDb(
      workspaceId,
      rangeStart,
      rangeEnd
    );
    const totals = await getStatsByDateRangeDb(
      workspaceId,
      rangeStart,
      rangeEnd
    );

    return {
      startDate: startDateStr,
      endDate: endDateStr,
      transactions:
        transactions as unknown as import("@/types/transactionTypes").TransactionData[],
      dailySummary,
      categoryData: {
        expense: categoryDataResult.expenseData.map((d) => ({
          ...d,
          categoryId: d.categoryId || 0,
        })),
        income: categoryDataResult.incomeData.map((d) => ({
          ...d,
          categoryId: d.categoryId || 0,
        })),
      },
      totals,
    };
  } catch (error) {
    console.error("[StatisticsService] getDetailStatsService error:", error);
    throw new ApiError("상세 통계 조회 중 오류가 발생했습니다.");
  }
}
```

```ts
/* ./src/services/transactionService.ts */
// src/services/transactionService.ts
import {
  createTransactionDb,
  getTransactionsDb,
  findTransactionByIdDb,
  updateTransactionDb,
  deleteTransactionDb,
  // findCategoryByIdDb, // Prisma 직접 사용으로 변경 또는 workspaceId를 받는 버전으로 수정 필요
} from "@/lib/db/transactionsDb"; // DB 함수 경로
import { prisma } from "@/lib/prisma"; // Prisma 클라이언트 직접 사용 (권한 확인 및 카테고리 검증 등)
import type {
  CreateTransactionPayload,
  UpdateTransactionPayload,
  GetTransactionsQuery,
} from "@/lib/schemas/transactionsApiSchemas"; // Zod 스키마에서 파생된 타입
import type {
  TransactionData,
  TransactionResponse,
} from "@/types/transactionTypes";
import {
  ApiError,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "./apiError";

// DB 함수에 전달하기 위한 페이로드 타입 (workspaceId, createdById 포함)
interface CreateTransactionDbPayloadInternal extends CreateTransactionPayload {
  workspaceId: string;
  createdById: string;
}

/**
 * 새 거래 내역을 생성합니다.
 * @param userId 현재 로그인한 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param payload 생성할 거래 데이터 (CreateTransactionPayload)
 * @returns 생성된 거래 객체
 */
export async function createTransaction(
  userId: string,
  workspaceId: string,
  payload: CreateTransactionPayload
): Promise<TransactionData> {
  // 1. 사용자가 워크스페이스 멤버인지 확인
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스에 거래 내역을 생성할 권한이 없습니다."
    );
  }
  // TODO: 멤버의 역할(role)에 따라 생성 권한을 추가로 제한할 수 있습니다 (예: 'VIEWER'는 생성 불가)

  // 2. 카테고리 유효성 검사 (해당 워크스페이스 소속 카테고리인지)
  const category = await prisma.category.findUnique({
    where: { id: payload.categoryId, workspaceId: workspaceId },
  });
  if (!category) {
    throw new ValidationError(
      `ID가 ${payload.categoryId}인 카테고리를 현재 워크스페이스에서 찾을 수 없습니다.`
    );
  }
  if (category.type !== payload.type) {
    throw new ValidationError("거래 유형과 카테고리 유형이 일치하지 않습니다.");
  }

  // 3. 할부 거래 관련 유효성 검사 (지출 유형만 허용)
  if (payload.isInstallment && payload.type !== "expense") {
    throw new ValidationError("할부 거래는 지출 유형만 가능합니다.");
  }
  // CreateTransactionSchema의 refine 로직에서 기본적인 할부 필드 조합 유효성은 이미 검사되었다고 가정합니다.

  try {
    const dataForDb: CreateTransactionDbPayloadInternal = {
      ...payload,
      workspaceId,
      createdById: userId, // 거래 생성자는 현재 로그인한 사용자
    };
    const createdTransaction = await createTransactionDb(dataForDb);
    return createdTransaction as unknown as TransactionData; // 타입 단언
  } catch (error) {
    console.error("[TransactionService] createTransaction error:", error);
    if (error instanceof ApiError) throw error; // ApiError는 그대로 throw
    throw new ApiError("거래 내역 생성 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 워크스페이스의 거래 목록을 조회합니다.
 * @param userId 현재 로그인한 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param query 조회 필터 및 정렬 조건 (GetTransactionsQuery)
 * @returns 거래 목록 배열
 */
export async function getTransactions(
  userId: string,
  workspaceId: string,
  query: GetTransactionsQuery
): Promise<TransactionResponse> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 거래 내역을 조회할 권한이 없습니다."
    );
  }

  try {
    // getTransactionsDb가 이미 TransactionResponse를 반환하도록 수정되었으므로,
    // 추가적인 타입 단언 없이 결과를 바로 반환합니다.
    const result = await getTransactionsDb({ ...query, workspaceId });
    return result; // result는 TransactionResponse 타입으로 추론되어야 함
  } catch (error) {
    console.error("[TransactionService] getTransactions error:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError("거래 목록 조회 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 ID의 거래 내역을 조회합니다. (해당 워크스페이스 소속인지 확인)
 * @param userId 현재 로그인한 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param transactionId 조회할 거래 ID
 * @returns 거래 객체
 */
export async function getTransactionById(
  userId: string,
  workspaceId: string,
  transactionId: number
): Promise<TransactionData> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 거래 내역을 조회할 권한이 없습니다."
    );
  }

  try {
    // DB 함수 호출 시 workspaceId도 전달하여 해당 워크스페이스의 거래만 조회
    const transaction = await findTransactionByIdDb(transactionId, workspaceId);
    if (!transaction) {
      throw new NotFoundError(
        `ID가 ${transactionId}인 거래 내역을 현재 워크스페이스에서 찾을 수 없습니다.`
      );
    }
    return transaction as unknown as TransactionData;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("[TransactionService] getTransactionById error:", error);
    throw new ApiError("거래 내역 조회 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 ID의 거래 내역을 수정합니다.
 * @param userId 현재 로그인한 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param transactionId 수정할 거래 ID
 * @param payload 수정할 거래 데이터 (UpdateTransactionPayload)
 * @returns 수정된 거래 객체
 */
export async function updateTransaction(
  userId: string,
  workspaceId: string,
  transactionId: number,
  payload: UpdateTransactionPayload
): Promise<TransactionData> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 거래 내역을 수정할 권한이 없습니다."
    );
  }

  // 수정 대상 거래가 현재 워크스페이스에 속하는지 먼저 확인
  const existingTransaction = await prisma.transaction.findUnique({
    where: { id: transactionId, workspaceId },
  });
  if (!existingTransaction) {
    throw new NotFoundError(
      `ID가 ${transactionId}인 거래 내역을 현재 워크스페이스에서 찾을 수 없습니다.`
    );
  }
  // TODO: 추가적인 수정 권한 확인 (예: 본인이 생성한 거래만, 또는 ADMIN 역할만 등)
  // if (existingTransaction.createdById !== userId && membership.role !== 'ADMIN') {
  //   throw new ForbiddenError('이 거래 내역을 수정할 권한이 없습니다.');
  // }

  // 카테고리 변경 시 유효성 검사 (해당 워크스페이스 소속 카테고리인지)
  if (payload.categoryId !== undefined) {
    const category = await prisma.category.findUnique({
      where: { id: payload.categoryId, workspaceId: workspaceId },
    });
    if (!category) {
      throw new ValidationError(
        `ID가 ${payload.categoryId}인 카테고리를 현재 워크스페이스에서 찾을 수 없습니다.`
      );
    }
    const transactionTypeForCategoryCheck =
      payload.type || existingTransaction.type;
    if (category.type !== transactionTypeForCategoryCheck) {
      throw new ValidationError(
        "거래 유형과 카테고리 유형이 일치하지 않습니다."
      );
    }
  }

  const finalType = payload.type || existingTransaction.type;
  if (payload.isInstallment === true && finalType !== "expense") {
    throw new ValidationError("할부 거래는 지출 유형만 가능합니다.");
  }
  if (
    payload.isInstallment === undefined &&
    existingTransaction.isInstallment &&
    finalType === "income"
  ) {
    throw new ValidationError(
      "할부 거래를 수입 유형으로 변경하려면, 할부 설정을 해제해야 합니다."
    );
  }

  try {
    // updateTransactionDb 함수는 workspaceId를 내부적으로 사용하지 않으므로,
    // 위에서 existingTransaction 조회를 통해 이미 해당 워크스페이스의 거래임을 확인했습니다.
    // 필요하다면 updateTransactionDb 함수 시그니처에 workspaceId를 추가하여 명시적으로 전달할 수 있습니다.
    const updatedTransaction = await updateTransactionDb(transactionId, {
      ...payload,
      workspaceId,
    }); // DB 함수에 workspaceId 전달 (db 함수 수정 필요)
    return updatedTransaction as unknown as TransactionData;
  } catch (error) {
    console.error("[TransactionService] updateTransaction error:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError("거래 내역 수정 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 ID의 거래 내역을 삭제합니다.
 * @param userId 현재 로그인한 사용자 ID
 * @param workspaceId 작업 대상 워크스페이스 ID
 * @param transactionId 삭제할 거래 ID
 */
export async function deleteTransaction(
  userId: string,
  workspaceId: string,
  transactionId: number
): Promise<void> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 거래 내역을 삭제할 권한이 없습니다."
    );
  }

  // 삭제 대상 거래가 현재 워크스페이스에 속하는지 먼저 확인
  const existingTransaction = await prisma.transaction.findUnique({
    where: { id: transactionId, workspaceId },
  });
  if (!existingTransaction) {
    throw new NotFoundError(
      `ID가 ${transactionId}인 거래 내역을 현재 워크스페이스에서 찾을 수 없습니다.`
    );
  }
  // TODO: 추가적인 삭제 권한 확인
  // if (existingTransaction.createdById !== userId && membership.role !== 'ADMIN') {
  //   throw new ForbiddenError('이 거래 내역을 삭제할 권한이 없습니다.');
  // }

  try {
    // deleteTransactionDb 함수에 workspaceId를 전달하여 해당 워크스페이스의 거래만 삭제하도록 함
    await deleteTransactionDb(transactionId, workspaceId);
  } catch (error) {
    console.error("[TransactionService] deleteTransaction error:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError("거래 내역 삭제 중 오류가 발생했습니다.");
  }
}
```

```ts
/* ./src/services/workspaceService.ts */
// src/services/workspaceService.ts
import { prisma } from '@/lib/prisma'; // Prisma 클라이언트 경로 확인
import { Workspace, WorkspaceRole, User, InvitationStatus } from '@prisma/client'; // Prisma 생성 타입, WorkspaceRole 가져오기, User, InvitationStatus 추가
import { ApiError, ForbiddenError, ValidationError } from './apiError'; // 기존 에러 클래스 활용

// 제안 DTO
export interface MyWorkspaceDto {
  // export 하여 다른 곳에서도 타입 참조 가능하게
  id: string;
  name: string;
  currentUserRole: WorkspaceRole;
}

/**
 * 새 워크스페이스를 생성하고, 생성자를 ADMIN으로 등록합니다.
 * @param userId 워크스페이스를 생성하는 사용자 ID
 * @param name 워크스페이스 이름
 * @returns 생성된 Workspace 객체
 */
export async function createWorkspace(userId: string, name: string): Promise<Workspace> {
  if (!userId) {
    throw new ValidationError('사용자 ID가 필요합니다.');
  }
  if (!name || name.trim() === '') {
    throw new ValidationError('워크스페이스 이름은 필수입니다.');
  }

  try {
    const newWorkspace = await prisma.$transaction(async (tx) => {
      // 1. 워크스페이스 생성
      const workspace = await tx.workspace.create({
        data: {
          name,
          ownerId: userId, // ownerId 필드에 생성자 ID 저장
        },
      });

      // 2. 생성자를 해당 워크스페이스의 ADMIN으로 WorkspaceUser 테이블에 추가
      await tx.workspaceUser.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: 'ADMIN' as WorkspaceRole, // Prisma Enum 값 사용
        },
      });

      // 3. 기본 카테고리 생성
      const expenseCategories = [
        {
          name: '이사비용',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '가전가구',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '생활비',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '기타',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '정기결제',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '헌금',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '교통비',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '용돈',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '유흥비',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
        {
          name: '가족비',
          type: 'expense' as const,
          workspaceId: workspace.id,
        },
      ];

      const incomeCategories = [
        {
          name: '급여',
          type: 'income' as const,
          workspaceId: workspace.id,
        },
        {
          name: '부수입',
          type: 'income' as const,
          workspaceId: workspace.id,
        },
      ];

      await tx.category.createMany({
        data: [...expenseCategories, ...incomeCategories],
      });

      return workspace;
    });
    return newWorkspace;
  } catch (error) {
    console.error('[WorkspaceService] createWorkspace error:', error);
    // 고유 제약 조건 위반 등 Prisma 에러 처리 추가 가능
    throw new ApiError('워크스페이스 생성 중 오류가 발생했습니다.');
  }
}

/**
 * 특정 사용자가 속한 모든 워크스페이스 목록을 조회합니다. (최소화된 데이터)
 * @param userId 사용자 ID
 * @returns 사용자가 속한 Workspace의 DTO 배열
 */
export async function getUserWorkspaces(userId: string): Promise<MyWorkspaceDto[]> {
  if (!userId) {
    throw new ValidationError('사용자 ID가 필요합니다.');
  }

  try {
    const workspaceUsers = await prisma.workspaceUser.findMany({
      where: { userId },
      select: {
        // 필요한 데이터만 선택
        role: true, // currentUserRole을 위해 필요
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        workspace: {
          createdAt: 'asc', // 정렬 기준은 유지 (또는 name 순 등)
        },
      },
    });

    // 선택된 데이터를 MyWorkspaceDto 형태로 매핑
    return workspaceUsers.map((wu) => ({
      id: wu.workspace.id,
      name: wu.workspace.name,
      currentUserRole: wu.role,
    }));
  } catch (error) {
    console.error('[WorkspaceService] getUserWorkspaces error:', error);
    throw new ApiError('워크스페이스 목록 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 특정 워크스페이스 정보를 조회합니다. (사용자 권한 확인 포함)
 * @param userId 현재 사용자 ID
 * @param workspaceId 조회할 워크스페이스 ID
 * @returns Workspace 객체
 */
export async function getWorkspaceById(
  userId: string,
  workspaceId: string
): Promise<(Workspace & { currentUserRole: WorkspaceRole }) | null> {
  if (!userId || !workspaceId) {
    throw new ValidationError('사용자 ID와 워크스페이스 ID는 필수입니다.');
  }

  try {
    const workspaceUser = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          // @@unique([userId, workspaceId]) 필드명 사용
          userId,
          workspaceId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!workspaceUser) {
      // 사용자가 해당 워크스페이스의 멤버가 아님
      throw new ForbiddenError('해당 워크스페이스에 접근 권한이 없습니다.');
    }

    return {
      ...workspaceUser.workspace,
      currentUserRole: workspaceUser.role,
    };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof ValidationError) {
      throw error;
    }
    console.error('[WorkspaceService] getWorkspaceById error:', error);
    throw new ApiError('워크스페이스 정보 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 워크스페이스 이름을 변경합니다.
 * @param userId 현재 사용자 ID
 * @param workspaceId 변경할 워크스페이스 ID
 * @param newName 새로운 워크스페이스 이름
 * @returns 업데이트된 Workspace 객체
 */
export async function updateWorkspace(
  userId: string,
  workspaceId: string,
  newName: string
): Promise<Workspace> {
  if (!userId || !workspaceId) {
    throw new ValidationError('사용자 ID와 워크스페이스 ID는 필수입니다.');
  }
  if (!newName || newName.trim() === '') {
    throw new ValidationError('새 워크스페이스 이름은 필수입니다.');
  }

  try {
    const workspaceUser = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      include: {
        workspace: true, // ownerId를 확인하기 위해 workspace 정보 포함
      },
    });

    if (!workspaceUser) {
      throw new ForbiddenError('해당 워크스페이스에 접근 권한이 없습니다.');
    }

    // 워크스페이스 소유주 또는 ADMIN만 이름 변경 가능
    if (workspaceUser.role !== 'ADMIN' && workspaceUser.workspace.ownerId !== userId) {
      throw new ForbiddenError('워크스페이스 이름을 변경할 권한이 없습니다.');
    }

    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { name: newName },
    });

    return updatedWorkspace;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[WorkspaceService] updateWorkspace error:', error);
    throw new ApiError('워크스페이스 이름 변경 중 오류가 발생했습니다.');
  }
}

/**
 * 특정 워크스페이스의 모든 사용자 목록을 조회합니다.
 * @param workspaceId 조회할 워크스페이스 ID
 * @param currentUserId 현재 요청을 보낸 사용자 ID (권한 확인용)
 * @returns 사용자 목록 (User 객체와 WorkspaceUser의 role 포함)
 */
export async function getWorkspaceUsers(
  workspaceId: string,
  currentUserId: string
): Promise<(User & { role: WorkspaceRole })[]> {
  if (!workspaceId || !currentUserId) {
    throw new ValidationError('워크스페이스 ID와 사용자 ID는 필수입니다.');
  }

  try {
    // 현재 사용자가 해당 워크스페이스의 멤버인지 확인
    const requesterMembership = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: currentUserId,
          workspaceId: workspaceId,
        },
      },
    });

    if (!requesterMembership) {
      throw new ForbiddenError('해당 워크스페이스의 멤버 목록을 조회할 권한이 없습니다.');
    }

    // 멤버 목록 조회 (ADMIN 또는 멤버 본인이 요청 시)
    // 여기서는 모든 멤버가 다른 멤버 목록을 볼 수 있도록 허용 (정책에 따라 수정 가능)
    const workspaceUsers = await prisma.workspaceUser.findMany({
      where: { workspaceId: workspaceId },
      include: {
        user: true, // User 정보 (name, email 등) 포함
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    });

    return workspaceUsers.map((wu) => ({
      ...wu.user,
      role: wu.role,
    }));
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[WorkspaceService] getWorkspaceUsers error:', error);
    throw new ApiError('워크스페이스 사용자 목록 조회 중 오류가 발생했습니다.');
  }
}

/**
 * 워크스페이스에서 특정 사용자를 제거합니다.
 * @param workspaceId 워크스페이스 ID
 * @param userIdToRemove 제거할 사용자 ID
 * @param currentUserId 현재 요청을 보낸 사용자 ID (권한 확인용)
 */
export async function removeUserFromWorkspace(
  workspaceId: string,
  userIdToRemove: string,
  currentUserId: string
): Promise<void> {
  if (!workspaceId || !userIdToRemove || !currentUserId) {
    throw new ValidationError(
      '워크스페이스 ID, 제거할 사용자 ID, 현재 사용자 ID는 모두 필수입니다.'
    );
  }

  try {
    const requesterMembership = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: currentUserId,
          workspaceId: workspaceId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!requesterMembership || requesterMembership.role !== 'ADMIN') {
      throw new ForbiddenError('워크스페이스에서 사용자를 제거할 권한이 없습니다.');
    }

    if (userIdToRemove === requesterMembership.workspace.ownerId) {
      throw new ForbiddenError('워크스페이스 소유자는 제거할 수 없습니다.');
    }

    if (userIdToRemove === currentUserId && requesterMembership.role === 'ADMIN') {
      const otherAdmins = await prisma.workspaceUser.count({
        where: {
          workspaceId: workspaceId,
          role: 'ADMIN',
          userId: { not: currentUserId },
        },
      });
      if (otherAdmins === 0) {
        throw new ForbiddenError(
          '유일한 관리자는 자신을 워크스페이스에서 제거할 수 없습니다. 다른 관리자를 먼저 지정해주세요.'
        );
      }
    }

    const userToRemoveData = await prisma.user.findUnique({
      where: { id: userIdToRemove },
      select: { email: true }, // 제거할 사용자의 이메일만 가져옴
    });

    if (!userToRemoveData) {
      throw new ApiError('제거할 사용자를 찾을 수 없습니다.', 404);
    }

    const userToRemoveMembership = await prisma.workspaceUser.findUnique({
      where: {
        userId_workspaceId: {
          userId: userIdToRemove,
          workspaceId: workspaceId,
        },
      },
      // user 정보를 include 할 필요 없이 위에서 email을 가져왔음
    });

    if (!userToRemoveMembership) {
      throw new ApiError('제거할 사용자가 해당 워크스페이스의 멤버가 아닙니다.', 404);
    }

    await prisma.workspaceUser.delete({
      where: {
        userId_workspaceId: {
          userId: userIdToRemove,
          workspaceId: workspaceId,
        },
      },
    });

    // 관련된 초대 정보도 정리 (PENDING 상태의 초대)
    if (userToRemoveData && userToRemoveData.email) {
      await prisma.invitation.updateMany({
        where: {
          workspaceId: workspaceId,
          email: userToRemoveData.email as string,
          status: InvitationStatus.PENDING,
        },
        data: {
          status: InvitationStatus.CANCELED, // Prisma 스키마에 CANCELED가 추가되었으므로 enum 멤버 사용
        },
      });
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('[WorkspaceService] removeUserFromWorkspace error:', error);
    throw new ApiError('워크스페이스에서 사용자 제거 중 오류가 발생했습니다.');
  }
}

/**
 * 워크스페이스를 삭제합니다.
 * @param userId 현재 사용자 ID
 * @param workspaceId 삭제할 워크스페이스 ID
 * @returns Promise<void>
 */
export async function deleteWorkspace(userId: string, workspaceId: string): Promise<void> {
  if (!userId || !workspaceId) {
    throw new ValidationError('사용자 ID와 워크스페이스 ID는 필수입니다.');
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      // 워크스페이스가 존재하지 않는 경우, 이미 삭제되었거나 잘못된 ID일 수 있으므로
      // NotFoundError보다는 일반적인 메시지나 성공으로 처리할 수도 있습니다.
      // 여기서는 일단 찾을 수 없는 경우로 처리합니다.
      throw new ApiError('삭제할 워크스페이스를 찾을 수 없습니다.', 404);
    }

    // 워크스페이스 소유주만 삭제 가능
    if (workspace.ownerId !== userId) {
      throw new ForbiddenError('워크스페이스를 삭제할 권한이 없습니다.');
    }

    // Prisma 스키마에서 onDelete: Cascade 설정으로 관련 데이터 자동 삭제됨
    await prisma.workspace.delete({
      where: { id: workspaceId },
    });
  } catch (error) {
    if (
      error instanceof ForbiddenError ||
      error instanceof ValidationError ||
      error instanceof ApiError
    ) {
      throw error;
    }
    console.error('[WorkspaceService] deleteWorkspace error:', error);
    throw new ApiError('워크스페이스 삭제 중 오류가 발생했습니다.');
  }
}
```

```ts
/* ./src/stores/workspaceStore.ts */
// src/stores/workspaceStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware"; // persist 미들웨어 추가

interface WorkspaceState {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  workspaces: Workspace[]; // 사용자가 속한 워크스페이스 목록 (선택적)
  setWorkspaces: (workspaces: Workspace[]) => void; // 목록 설정 함수 (선택적)
}

// 워크스페이스 타입 (app/workspaces/page.tsx와 동일하게 정의 또는 import)
export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string; // 또는 Date
  updatedAt: string; // 또는 Date
  currentUserRole: string;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      setActiveWorkspaceId: (workspaceId) =>
        set({ activeWorkspaceId: workspaceId }),
      workspaces: [],
      setWorkspaces: (workspaces) => set({ workspaces }),
    }),
    {
      name: "workspace-storage", // localStorage에 저장될 때 사용될 키 이름
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);
```

```ts
/* ./src/types/calendarTypes.ts */
// src/types/calendarTypes.ts (또는 적절한 위치)
export interface CategoryBreakdownItem {
  categoryId: number; // 카테고리 ID도 함께 저장하면 유용
  categoryName: string;
  amount: number;
}

export interface DailyAggregatedCategoryData {
  date: string; // 'YYYY-MM-DD' 형식
  incomeItems: CategoryBreakdownItem[];
  expenseItems: CategoryBreakdownItem[];
  totalIncome: number;
  totalExpense: number;
}
```

```ts
/* ./src/types/categoryTypes.ts */
/* ./src/types/categoryTypes.ts */
// 카테고리 관련 타입을 정의합니다.

/**
 * 카테고리 데이터 구조 (DB 모델과 유사)
 * UI 표시 및 데이터 처리에 사용됩니다.
 */
export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense'; // 수입 또는 지출 카테고리
  // 필요시 아이콘, 색상 등의 UI 관련 속성 추가 가능
  // icon?: string;
  // color?: string;
}

/**
 * SelectField 등에서 사용될 카테고리 옵션 타입
 */
export interface CategoryOption {
  id: number;
  name: string;
  type: 'income' | 'expense';
}
```

```ts
/* ./src/types/chartTypes.ts */
/* ./src/types/chartTypes.ts */
// 차트 컴포넌트에서 공통적으로 사용될 수 있는 데이터 타입을 정의합니다.

/**
 * 카테고리 분포 차트(예: PieChart)에 사용될 데이터 항목 타입
 */
export interface ChartCategoryData {
  categoryId: number | string; // '기타' 등의 항목을 위해 string도 허용 가능
  categoryName: string;
  amount: number;
  percentage?: number; // 전체 대비 비율 (선택적)
  // color?: string; // 각 항목별 색상 (선택적)
}

/**
 * 트렌드 차트(예: LineChart, BarChart, AreaChart)에 사용될 데이터 항목 타입
 * 주로 시간 경과에 따른 변화를 나타냅니다.
 */
export interface TrendChartItemData {
  date: string; // X축에 표시될 날짜 또는 기간 문자열
  [key: string]: number | string; // Y축에 표시될 여러 시리즈의 값 (동적 키 허용)
  // 예시: income: number; expense: number; balance?: number;
}

/**
 * 분산형 차트(ScatterChart)에 사용될 데이터 포인트 타입
 */
export interface ScatterDataPoint {
  x: number; // X축 값 (예: 날짜, 금액)
  y: number; // Y축 값 (예: 금액, 빈도)
  z?: number; // 추가 차원 (버블 크기 등, 선택적)
  category?: string; // 데이터 포인트의 카테고리 (선택적)
  name?: string; // 데이터 포인트의 이름 또는 설명 (선택적)
}
```

```ts
/* ./src/types/commonTypes.ts */
/* ./src/types/commonTypes.ts */
// 여러 도메인에서 공통적으로 사용될 수 있는 기본 타입을 정의합니다.

/**
 * 카드 발급사 식별자 타입
 * 실제 프로젝트에서는 금융결제원 표준 코드 등을 사용하는 것을 고려할 수 있습니다.
 */
export type CardIssuer = "현대카드" | "기타";

/**
 * API 응답 등에서 사용될 수 있는 기본적인 페이징 정보 타입
 */
export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

/**
 * 정렬 옵션 타입
 */
export interface SortOption<T extends string> {
  sortBy: T;
  sortOrder: "asc" | "desc";
}

export type ValueType = "currency" | "number" | "percent";
```

```ts
/* ./src/types/insightTypes.ts */
// src/types/insightTypes.ts

export enum InsightType {
  // MVP
  CATEGORY_SPENDING_INCREASE = "CATEGORY_SPENDING_INCREASE",
  CATEGORY_SPENDING_DECREASE = "CATEGORY_SPENDING_DECREASE",
  BUDGET_NEARING_LIMIT = "BUDGET_NEARING_LIMIT",
  BUDGET_OVERRUN_WARNING = "BUDGET_OVERRUN_WARNING",
  RECENT_HIGH_SPENDING_ALERT = "RECENT_HIGH_SPENDING_ALERT",
  // Post-MVP
  INCOME_SPIKE_ALERT = "INCOME_SPIKE_ALERT",
  SAVING_GOAL_PROGRESS = "SAVING_GOAL_PROGRESS",
  SUBSCRIPTION_REMINDER = "SUBSCRIPTION_REMINDER",
}

export interface Insight {
  id: string;
  type: InsightType;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  detailsLink?: string;
  data?: Record<string, unknown>; // 인사이트 생성에 사용된 추가 데이터
  generatedAt: string; // ISO 문자열
}

// API 응답 전체 구조 (필요시)
export interface InsightsApiResponse {
  insights: Insight[];
}
```

```ts
/* ./src/types/kpiTypes.ts */
/* ./src/types/kpiTypes.ts */
// 핵심 성과 지표(KPI) 관련 타입을 정의합니다.

/**
 * KPI 카드에 표시될 트렌드 데이터의 개별 항목 타입
 * 날짜와 해당 날짜의 값으로 구성됩니다.
 */
export interface KpiTrendValue {
  date: string; // 예: "2023-10-01" (일별), "2023-10" (월별)
  value: number;
}

/**
 * 개별 KPI 항목 데이터 구조
 * 현재 값, 트렌드 데이터, 이전 기간 대비 변화량 및 변화율을 포함합니다.
 */
export interface KpiItemData {
  value: number;
  trend?: KpiTrendValue[]; // 선택적 필드로 변경 (모든 KPI에 트렌드가 없을 수 있음)
  change?: number;
  changePercent?: number;
  previous?: number; // 이전 기간 값 (필요시 추가)
}

/**
 * 대시보드 KPI 전체 데이터 구조
 * 수입, 지출, 잔액 등 주요 KPI 항목들을 포함합니다.
 */
export interface KpiData {
  period: 'month' | 'year' | string; // 통계 기준 기간 (예: "2023-10", "2023")
  date: string; // 통계 기준일 또는 월/연도 문자열
  kpi: {
    income: KpiItemData;
    expense: KpiItemData;
    balance: KpiItemData; // 당월 (수입 - 지출)
    totalBalance: KpiItemData; // 이월 잔액 + 당월 (수입 - 지출) -> 최종 잔액
    carryOverBalance?: KpiItemData; // 이월 잔액 (선택적)
    expenseToIncomeRatio?: KpiItemData; // 수입 대비 지출 비율 (선택적)
    avgDailyExpense?: KpiItemData; // 일평균 또는 월평균 지출 (선택적)
    // 필요에 따라 추가 KPI 항목 정의 가능
  };
  // topCategories는 CategoryStatsData 또는 별도 타입으로 분리 고려
}
```

```ts
/* ./src/types/statisticsTypes.ts */
/* ./src/types/statisticsTypes.ts */
// 통계 데이터 관련 복합 타입을 정의합니다.
import type { ChartCategoryData, TrendChartItemData } from './chartTypes';

/**
 * 일별 통계 데이터 구조
 */
export interface DailyStatsData {
  date: string; // "YYYY-MM-DD"
  current: {
    income: number;
    expense: number;
    balance: number;
  };
  previous?: {
    // 이전일 또는 이전 기간 비교 데이터
    income: number;
    expense: number;
    balance: number;
  } | null;
  comparison?: {
    incomeChange: number;
    incomeChangePercent: number;
    expenseChange: number;
    expenseChangePercent: number;
    balanceChange: number;
    balanceChangePercent: number;
  } | null;
}

/**
 * 월별 통계 데이터 구조
 * useDashboardData 훅의 MonthlyStatsData와 유사하게 정의
 */
export interface MonthlyStatsData {
  month: string; // "YYYY-MM"
  previousMonth?: string | null; // 비교 대상 이전 월
  income: number;
  expense: number;
  balance: number; // 당월 (수입 - 지출)
  carryOverBalance: number; // 이월 잔액
  totalBalance: number; // 최종 잔액 (이월 + 당월 잔액)
  averageDailyExpense: number;
  averageDailyIncome: number;
  expenseRatio: number; // 수입 대비 지출 비율 (%)
  dailyTrend: TrendChartItemData[]; // 해당 월의 일별 수입/지출 트렌드
  categoryData: {
    // 해당 월의 카테고리별 수입/지출
    expenseData: ChartCategoryData[];
    incomeData: ChartCategoryData[];
    totalExpense: number;
    totalIncome: number;
  };
  previous?: {
    // 이전 월 비교 데이터
    income: number;
    expense: number;
    balance: number;
    dailyTrend?: TrendChartItemData[];
    categoryData?: {
      expenseData: ChartCategoryData[];
      incomeData: ChartCategoryData[];
    };
  } | null;
  comparison?: {
    // 전월 대비 변화량/변화율
    incomeChange: number;
    incomeChangePercent: number;
    expenseChange: number;
    expenseChangePercent: number;
    balanceChange: number;
    balanceChangePercent: number;
  } | null;
}

/**
 * 연간 통계 데이터 구조
 */
export interface YearlyStatsData {
  year: string; // "YYYY"
  previousYear?: string | null;
  income: number;
  expense: number;
  balance: number;
  averageMonthlyExpense: number;
  averageMonthlyIncome: number;
  expenseRatio: number;
  monthlyTrend: TrendChartItemData[]; // 해당 연도의 월별 수입/지출 트렌드
  categoryData: {
    expenseData: ChartCategoryData[];
    incomeData: ChartCategoryData[];
  };
  previous?: {
    income: number;
    expense: number;
    balance: number;
    monthlyTrend?: TrendChartItemData[];
    categoryData?: {
      expenseData: ChartCategoryData[];
      incomeData: ChartCategoryData[];
    };
  } | null;
  comparison?: {
    incomeChange: number;
    incomeChangePercent: number;
    expenseChange: number;
    expenseChangePercent: number;
    balanceChange: number;
    balanceChangePercent: number;
  } | null;
}

/**
 * 카테고리별 통계 데이터 구조
 * useDashboardData 훅의 CategoryStatsData와 유사하게 정의
 */
export interface CategoryStatsData {
  period: 'month' | 'year' | string; // 통계 기준 (월별, 연별 등)
  date: string; // 기준 월 또는 연도 (예: "2023-10", "2023")
  expenseData: ChartCategoryData[];
  incomeData: ChartCategoryData[];
  // 필요시 카테고리별 변화량/변화율 데이터 추가
  expenseChangeData?: Array<
    ChartCategoryData & { previousAmount?: number; change?: number; changePercent?: number }
  >;
  incomeChangeData?: Array<
    ChartCategoryData & { previousAmount?: number; change?: number; changePercent?: number }
  >;
  topExpenseCategories?: ChartCategoryData[]; // 상위 지출 카테고리
  topIncomeCategories?: ChartCategoryData[]; // 상위 수입 카테고리
}

/**
 * 소비 패턴 분석 데이터 구조
 */
export interface SpendingPatternStats {
  totalExpense: number;
  averageDailyExpense: number;
  dayPattern: Array<{
    // 요일별 소비 패턴
    day: string; // 예: "0" (일요일) ~ "6" (토요일) 또는 "월", "화" 등
    amount: number;
    count: number; // 거래 건수
    avgAmount: number; // 평균 거래 금액
  }>;
  topCategories: Array<{
    // 상위 지출 카테고리
    categoryId: number;
    name: string;
    amount: number;
  }>;
  transactionCount: number; // 총 지출 거래 건수
  // 필요시 시간대별 소비 패턴 등 추가
  // timePattern?: Array<{ hour: string; amount: number; count: number }>;
}

/**
 * 수입원 분석 데이터 구조
 */
export interface IncomeSourceStats {
  totalIncome: number;
  incomeSources: Array<{
    // 수입원별 정보
    categoryId: number;
    name: string;
    value: number; // 해당 수입원의 금액
    percentage: number; // 전체 수입 대비 비율
  }>;
  trendData: Array<{
    // 최근 수입 트렌드 (예: 월별)
    month: string; // "YYYY-MM"
    income: number;
  }>;
  diversityScore: number; // 수입원 다양성 점수 (0-100점 등)
  incomeSourceCount: number; // 수입원 개수
  previous?: IncomeSourceStats | null; // 이전 기간 비교 데이터 (선택적)
}

/**
 * 예산 대비 지출 분석 데이터 구조
 */
export interface BudgetVsActualStats {
  totalBudget: number;
  totalActual: number;
  difference: number; // 예산 - 실제 지출
  totalPercentage: number | null | undefined; // 전체 예산 대비 실제 지출 비율 (%), null/undefined 가능
  budgetVsActualByCategory: Array<{
    budgetId: number | null; // 예산 ID (없을 수 있음)
    category: string; // 카테고리명
    categoryId: number;
    budget: number; // 설정된 예산액
    actual: number; // 실제 지출액
    difference: number; // 예산 - 실제
    percentage: number | null | undefined; // 해당 카테고리 예산 대비 실제 지출 비율 (%), null/undefined 가능
  }>;
  overBudgetCategories: Array<{
    // 예산 초과 카테고리 목록
    budgetId: number | null;
    category: string;
    categoryId: number;
    budget: number;
    actual: number;
    difference: number;
    percentage: number | null | undefined;
  }>;
  hasBudget: boolean; // 해당 월에 설정된 예산이 하나라도 있는지 여부
}

/**
 * 상세 통계 데이터 (특정 기간 내 거래 내역 및 요약)
 */
export interface DetailStatsData {
  startDate: string;
  endDate: string;
  transactions: import('./transactionTypes').TransactionData[]; // 상세 거래 내역
  dailySummary: TrendChartItemData[]; // 일별 요약 (수입, 지출)
  categoryData: {
    expense: ChartCategoryData[];
    income: ChartCategoryData[];
  };
  totals: {
    // 기간 내 총계
    income: number;
    expense: number;
    balance: number;
  };
}
```

```ts
/* ./src/types/transactionTypes.ts */
/* ./src/types/transactionTypes.ts */
// 거래(Transaction)와 관련된 타입을 정의합니다.
import type { Category } from './categoryTypes';
import type { CardIssuer } from './commonTypes';

/**
 * 개별 거래 내역 데이터 구조
 * DB 모델을 기반으로 하며, UI 표시 및 데이터 처리에 사용됩니다.
 */
export interface TransactionData {
  id: number;
  date: string; // ISO 8601 형식의 날짜 문자열 (예: "2023-10-26")
  amount: number;
  type: 'income' | 'expense';
  description: string; // 빈 문자열일 수 있음
  categoryId: number;
  category: Category; // 연결된 카테고리 정보

  // 할부 관련 필드
  isInstallment?: boolean | null; // 할부 거래 여부
  installmentMonths?: number | null; // 총 할부 개월 수 (원거래, 개별 할부금 공통)
  currentInstallmentNumber?: number | null; // 현재 할부 회차 (개별 할부금에만 해당)
  totalInstallmentAmount?: number | null; // 총 할부 금액 (원거래, 개별 할부금 공통)
  originalTransactionId?: number | null; // 할부 원거래의 ID (개별 할부금에만 해당)
  installmentCardIssuer?: CardIssuer | null; // 할부 카드사
  estimatedInstallmentFee?: number | null; // 원거래의 총 예상 할부 수수료
  monthlyInstallmentFee?: number | null; // 해당 월의 할부 수수료 (개별 할부금에 해당)
}

/**
 * 거래 생성 API 요청 시 사용될 페이로드 타입
 * Zod 스키마 (CreateTransactionSchema)와 동기화됩니다.
 */
export interface CreateTransactionPayload {
  date: string;
  amount: number; // 일반 거래 시 실제 금액, 할부 원거래 시 총 할부 금액
  type: 'income' | 'expense';
  description?: string;
  categoryId: number;
  isInstallment?: boolean;
  installmentMonths?: number; // 할부 원거래 시 필수 (2 이상)
  totalInstallmentAmount?: number; // 할부 원거래 시 필수
  installmentCardIssuer?: CardIssuer; // 할부 원거래 시 필수
  // currentInstallmentNumber, originalTransactionId는 서버에서 자동 생성되거나
  // 개별 할부금 생성 로직에서 사용되므로, 일반적인 '새 거래 추가' 시에는 포함되지 않음.
}

/**
 * 거래 수정 API 요청 시 사용될 페이로드 타입
 * Zod 스키마 (UpdateTransactionSchema)와 동기화됩니다.
 * 모든 필드는 선택적(partial)입니다.
 */
export type UpdateTransactionPayload = Partial<CreateTransactionPayload> & {
  // isInstallment가 false로 변경될 경우, 서버에서 나머지 할부 필드를 null로 처리해야 함.
  // 개별 할부금의 특정 정보(예: 회차, 원거래 ID)를 수정하는 경우는 별도 고려 필요.
  // 현재 스키마는 주로 원거래 정보 수정 또는 일반<->할부 상태 변경에 초점.
};

/**
 * 거래 목록 조회 API의 쿼리 파라미터 타입
 * Zod 스키마 (GetTransactionsQuerySchema)와 동기화됩니다.
 */
export interface GetTransactionsQuery {
  type?: 'income' | 'expense';
  startDate?: string;
  endDate?: string;
  categoryId?: number;
  keyword?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: 'date' | 'amount' | 'category.name' | 'isInstallment';
  sortOrder?: 'asc' | 'desc';
  isInstallment?: boolean; // true: 할부만, false: 일반만, undefined: 전체
  originalTransactionId?: number; // 특정 원거래에 연결된 개별 할부금만 조회
  // 페이징 관련 필드 추가 가능
  // page?: number;
  // limit?: number;
}

/**
 * 거래 목록 조회 API 응답 객체 타입
 * 페이징 정보와 함께 실제 거래 내역 배열을 포함합니다.
 */
export interface TransactionResponse {
  totalCount: number;
  transactions: TransactionData[];
}
```

## tsx 파일

```tsx
/* ./src/app/auth/signin/page.tsx */
"use client";

import { signIn } from "next-auth/react";
import Button from "@/components/ui/Button";
import { ArrowLeftStartOnRectangleIcon } from "@heroicons/react/24/outline"; // Google 아이콘 대신 기본 로그인 아이콘 사용
import Head from "next/head";
import Link from "next/link";

// 임시 로고 컴포넌트 (실제 로고 SVG 또는 Image 컴포넌트로 교체 필요)
const AppLogo = () => (
  <svg
    className="h-12 w-auto text-blue-600"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.105 0 2 .895 2 2s-.895 2-2 2-2-.895-2-2 .895-2 2-2zm0 12c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-16C6.477 4 2 8.477 2 14s4.477 10 10 10 10-4.477 10-10S17.523 4 12 4z"
    />
  </svg>
);

export default function SignInPage() {
  return (
    <>
      <Head>
        <title>로그인 - 가계부 앱</title>
        <meta name="description" content="가계부 앱에 로그인하여 시작하세요." />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Link href="/" className="inline-block mb-6">
              <AppLogo />
            </Link>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              가계부 앱 시작하기
            </h2>
            <p className="mt-3 text-base text-gray-600">
              로그인하고 재정 관리를 시작해보세요.
            </p>
          </div>

          <div className="bg-white shadow-xl ring-1 ring-gray-900/5 sm:rounded-xl p-8 md:p-10">
            <div className="space-y-6">
              <Button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                variant="primary" // "primary" variant가 Google 스타일과 유사하다고 가정
                className="w-full flex items-center justify-center gap-3"
                size="lg" // 큰 버튼
                icon={ArrowLeftStartOnRectangleIcon} // 아이콘 추가
              >
                {/* Google 로고 SVG를 직접 추가하거나, 텍스트로 대체 */}
                {/* <img src="/path/to/google-logo.svg" alt="Google" className="h-5 w-5" /> */}
                Google 계정으로 로그인
              </Button>

              {/* 다른 로그인 옵션 (예: 이메일/패스워드) 추가 가능 */}
              {/* <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white px-2 text-gray-500">또는</span>
                </div>
              </div>
              <form action="#" method="POST" className="space-y-6">
                // 이메일, 패스워드 입력 필드...
              </form> */}
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-gray-500">
            계정이 없으신가요?{" "}
            <a
              href="#" // 회원가입 페이지 경로로 변경
              className="font-semibold leading-6 text-blue-600 hover:text-blue-500"
              onClick={(e) => {
                e.preventDefault();
                signIn("google", { callbackUrl: "/dashboard" }); // 우선 Google 로그인으로 연결
              }}
            >
              Google 계정으로 시작하기
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
```

```tsx
/* ./src/app/dashboard/page.tsx */
/* ./src/app/dashboard/page.tsx */
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  PlusCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  Cog6ToothIcon, // 워크스페이스 관리 아이콘으로 사용
  CreditCardIcon,
  ChartBarIcon,
  Bars3Icon,
  XMarkIcon,
  InformationCircleIcon,
  BuildingOffice2Icon,
  RectangleStackIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

import { useDashboardManager } from '@/hooks/useDashboardManager';
import { useDashboardData } from '@/hooks/useDashboardData';
import TrendChart from '@/components/dashboard/TrendChart';
import CategoryDistributionChart from '@/components/dashboard/CategoryDistributionChart';
import TransactionTable from '@/components/dashboard/TransactionTable';
import TransactionForm from '@/components/forms/TransactionForm';
import TransactionEditModal from '@/components/forms/TransactionEditModal';

import SpendingPatternChart from '@/components/dashboard/SpendingPatternChart';
import IncomeSourceChart from '@/components/dashboard/IncomeSourceChart';
import BudgetVsActualChart from '@/components/dashboard/BudgetVsActualChart';
import { useToast } from '@/contexts/ToastContext';

import SpendingPatternSkeleton from '@/components/dashboard/SpendingPatternSkeleton';
import IncomeSourceSkeleton from '@/components/dashboard/IncomeSourceSkeleton';
import BudgetVsActualSkeleton from '@/components/dashboard/BudgetVsActualSkeleton';

import ErrorBoundary from '@/components/ErrorBoundary';
import { KpiData } from '@/types/kpiTypes';
import { TransactionData } from '@/types/transactionTypes';
import {
  MY_WORKSPACES_ENDPOINT,
  TRANSACTION_BY_ID_ENDPOINT,
  WORKSPACES_ENDPOINT,
} from '@/constants/apiEndpoints';
import { KPI_CARD_COLOR_CLASSES } from '@/constants/chartColors';
import { ValueType } from '@/types/commonTypes';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import KpiCardRedesign from '@/components/dashboard/KpiCard';
import FilterModal from '@/components/dashboard/FilterModal';
import { InsightsApiResponse } from '@/types/insightTypes';
import InsightsSection from '@/components/dashboard/InsightsSection';
import { addDismissedInsightId } from '@/lib/localStorageUtils';
import LoginLogoutButton from '@/components/auth/LoginLogoutButton';
import { useWorkspaceStore, Workspace } from '@/stores/workspaceStore';
import { useSession } from 'next-auth/react';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRouter } from 'next/navigation';
import TextField from '@/components/ui/TextField';
import Alert from '@/components/ui/Alert';
import Link from 'next/link'; // Next.js Link 컴포넌트 import
import DailyTransactionCalendar from '@/components/dashboard/DailyTransactionCalendar';
import { DailyAggregatedCategoryData } from '@/types/calendarTypes';

interface CreateWorkspacePayload {
  name: string;
}

// --- Dashboard Page ---
export default function DashboardRedesignPage() {
  const router = useRouter();

  const { status: sessionStatus } = useSession({
    required: true, // 세션이 없으면 자동으로 로그인 페이지로 리디렉션
    onUnauthenticated() {
      router.push('/api/auth/signin'); // 명시적 리디렉션 (미들웨어와 중복 가능성 있으나 안전 장치)
    },
  });

  const { showToast } = useToast();

  const {
    selectedMonth,
    editingTransaction,
    showTransactionForm,
    handleSetShowTransactionForm: setShowTransactionForm,
    handleSetEditingTransaction: setEditingTransaction,
    mutateAllRelevantStats,
    moveMonth,
    localFilters,
    appliedFilters,
    handleLocalFilterChange,
    applyFilters,
    resetFilters,
    isMobileMenuOpen,
    toggleMobileMenu,
    compareWithPrevious,
  } = useDashboardManager();

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const {
    kpiData,
    monthlyStats,
    categoryStats,
    transactions,
    categoryOptions,
    spendingPatternData,
    incomeSourceData,
    budgetVsActualData,
    insightsData, // useDashboardData에서 추가된 인사이트 데이터
    insightsIsLoading, // 인사이트 로딩 상태
    insightsError,
    isLoading: isDashboardDataLoading,
    error: dashboardDataError,
    kpiIsLoading,
    monthlyStatsIsLoading,
    categoryStatsIsLoading,
    transactionsIsLoading,
    spendingPatternIsLoading,
    incomeSourceIsLoading,
    budgetVsActualIsLoading,
    mutateFunctions,
  } = useDashboardData({
    selectedMonth,
    compareWithPrevious,
    appliedFilters,
    includeExtraStats: true,
  });

  const {
    activeWorkspaceId,
    setActiveWorkspaceId,
    workspaces: storedWorkspaces,
    setWorkspaces: setStoredWorkspaces,
  } = useWorkspaceStore();

  const [workspaceApiError, setWorkspaceApiError] = useState<string | null>(null);

  const [showCreateFormInPage, setShowCreateFormInPage] = useState(false);
  const [newWorkspaceNameInPage, setNewWorkspaceNameInPage] = useState('');
  const [isCreatingWorkspaceInPage, setIsCreatingWorkspaceInPage] = useState(false);

  const currentWorkspace = useMemo(() => {
    return storedWorkspaces.find((ws) => ws.id === activeWorkspaceId);
  }, [activeWorkspaceId, storedWorkspaces]);

  const [currentYear, currentMonthIndex] = useMemo(() => {
    const dateObj = parseISO(`${selectedMonth}-01`);
    return [dateObj.getFullYear(), dateObj.getMonth()]; // getMonth()는 0-11 반환
  }, [selectedMonth]);

  const handleCalendarDateClick = (
    date: Date,
    dataForDate: DailyAggregatedCategoryData | undefined
  ) => {
    console.log('Calendar date clicked:', format(date, 'yyyy-MM-dd'));
    if (dataForDate) {
      console.log('Data for this date:', dataForDate);
    }
  };

  // 워크스페이스 목록 가져오기
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      const fetchWorkspaces = async () => {
        setWorkspaceApiError(null);
        try {
          const response = await fetch(MY_WORKSPACES_ENDPOINT); // GET /api/me/workspaces
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '워크스페이스 목록을 불러오는데 실패했습니다.');
          }
          const data: Workspace[] = await response.json();
          setStoredWorkspaces(
            data.map((ws) => ({
              id: ws.id,
              name: ws.name,
              ownerId: ws.ownerId,
              currentUserRole: ws.currentUserRole,
              createdAt: ws.createdAt,
              updatedAt: ws.updatedAt,
            }))
          );

          if (data.length === 0 && !activeWorkspaceId) {
            // 워크스페이스가 없고, 아직 선택된 것도 없으면 생성 폼 바로 표시
            setShowCreateFormInPage(true);
          } else if (data.length > 0 && !activeWorkspaceId) {
            // 워크스페이스는 있지만 선택된 것이 없으면 선택 UI 표시 (자동 선택 로직이 없다면)
            // (만약 persist 미들웨어로 localStorage에서 activeWorkspaceId를 가져온다면 이 조건은 잘 발생 안할 수 있음)
          } else if (
            data.length > 0 &&
            activeWorkspaceId &&
            !data.find((ws) => ws.id === activeWorkspaceId)
          ) {
            // 저장된 activeWorkspaceId가 더 이상 유효하지 않은 경우 (예: 삭제됨)
            setActiveWorkspaceId(null); // 선택 해제
            // 필요시 첫번째 워크스페이스를 기본으로 선택할 수 있음
            // setActiveWorkspaceId(data[0].id);
          }
        } catch (err: unknown) {
          if (err instanceof Error) {
            setWorkspaceApiError(err.message);
            showToast(err.message, 'error');
          } else {
            setWorkspaceApiError('알 수 없는 오류로 워크스페이스 목록을 불러오는데 실패했습니다.');
            showToast('알 수 없는 오류로 워크스페이스 목록을 불러오는데 실패했습니다.', 'error');
          }
        }
      };
      fetchWorkspaces();
    }
  }, [sessionStatus, showToast, setStoredWorkspaces, activeWorkspaceId, setActiveWorkspaceId]);

  const handleSelectWorkspace = (workspaceId: string, workspaceName?: string) => {
    setActiveWorkspaceId(workspaceId);
    showToast(`${workspaceName || '워크스페이스'} 선택됨`, 'success');
    // 별도 페이지로 이동하지 않고, 현재 페이지에서 대시보드 UI가 렌더링될 것임
    // router.push('/dashboard'); // 이 줄은 필요 없어짐
    setShowCreateFormInPage(false); // 혹시 생성폼이 열려있었다면 닫기
  };

  const handleCreateWorkspaceInPage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newWorkspaceNameInPage.trim()) {
      showToast('워크스페이스 이름을 입력해주세요.', 'error');
      return;
    }
    setIsCreatingWorkspaceInPage(true);
    setWorkspaceApiError(null);
    try {
      const payload: CreateWorkspacePayload = {
        name: newWorkspaceNameInPage.trim(),
      };
      const response = await fetch(WORKSPACES_ENDPOINT, {
        // POST /api/workspaces
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '워크스페이스 생성에 실패했습니다.');
      }
      const createdApiWorkspace: Workspace = await response.json();
      const createdStoredWorkspace: Workspace = {
        // 스토어 타입으로 매핑
        id: createdApiWorkspace.id,
        name: createdApiWorkspace.name,
        ownerId: createdApiWorkspace.ownerId,
        currentUserRole: createdApiWorkspace.currentUserRole,
        createdAt: createdApiWorkspace.createdAt,
        updatedAt: createdApiWorkspace.updatedAt,
      };

      showToast(`워크스페이스 '${createdStoredWorkspace.name}'가 생성되었습니다.`, 'success');
      setStoredWorkspaces([...storedWorkspaces, createdStoredWorkspace]); // 스토어 목록에 추가
      handleSelectWorkspace(createdStoredWorkspace.id, createdStoredWorkspace.name); // 새로 만든 워크스페이스 선택
      setNewWorkspaceNameInPage('');
      setShowCreateFormInPage(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setWorkspaceApiError(err.message);
        showToast(err.message, 'error');
      } else {
        setWorkspaceApiError('알 수 없는 오류로 워크스페이스 생성에 실패했습니다.');
        showToast('알 수 없는 오류로 워크스페이스 생성에 실패했습니다.', 'error');
      }
    } finally {
      setIsCreatingWorkspaceInPage(false);
    }
  };

  const handleEditTransactionClick = useCallback(
    (transactionToEdit: TransactionData) => {
      if (!activeWorkspaceId) {
        showToast('작업할 워크스페이스를 먼저 선택해주세요.', 'error');
        router.push('/');
        return;
      }
      setEditingTransaction(transactionToEdit);
      setShowTransactionForm(true);
    },
    [setEditingTransaction, setShowTransactionForm, activeWorkspaceId, showToast, router]
  );

  const handleDeleteTransactionClick = useCallback(
    async (transactionIdToDelete: number) => {
      if (!activeWorkspaceId) {
        showToast('작업할 워크스페이스를 먼저 선택해주세요.', 'error');
        router.push('/');
        return;
      }

      if (!transactions) {
        showToast('거래 목록을 확인 중입니다. 잠시 후 다시 시도해주세요.', 'info');
        return;
      }

      const transactionToDelete = transactions.find((t) => t.id === transactionIdToDelete);
      let confirmMessage = `정말로 이 내역(ID: ${transactionIdToDelete})을 삭제하시겠습니까?`;

      if (transactionToDelete?.originalTransactionId) {
        confirmMessage = `이것은 할부 거래의 일부입니다. 이 회차만 삭제하시겠습니까, 아니면 연결된 전체 할부 시리즈(원거래 ID: ${transactionToDelete.originalTransactionId})를 삭제하시겠습니까? (현재는 이 회차만 삭제됩니다 - 기능 확장 필요)`;
      } else if (transactionToDelete?.isInstallment) {
        confirmMessage = `이 할부 원거래(ID: ${transactionIdToDelete})를 삭제하시겠습니까? 연결된 모든 할부 회차가 함께 삭제됩니다.`;
      }

      if (window.confirm(confirmMessage)) {
        try {
          const response = await fetch(
            TRANSACTION_BY_ID_ENDPOINT(activeWorkspaceId, transactionIdToDelete),
            { method: 'DELETE' }
          );
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || '내역 삭제에 실패했습니다.');
          }
          showToast('내역이 성공적으로 삭제되었습니다.', 'success');
          mutateAllRelevantStats();
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : '알 수 없는 오류로 내역 삭제에 실패했습니다.';
          console.error('내역 삭제 중 오류:', error);
          showToast(message, 'error');
        }
      }
    },
    [transactions, showToast, mutateAllRelevantStats, activeWorkspaceId, router]
  );

  const kpiItemsToDisplay = useMemo(
    () => [
      {
        key: 'carryOverBalance',
        title: '이월 잔액',
        config: { icon: CreditCardIcon, color: 'yellow' as const },
        nature: 'positiveIsGood' as const,
        valueType: 'currency',
      },
      {
        key: 'income',
        title: '당월 수입',
        config: { icon: ArrowTrendingUpIcon, color: 'green' as const },
        nature: 'positiveIsGood' as const,
        valueType: 'currency',
      },
      {
        key: 'expense',
        title: '당월 지출',
        config: { icon: ArrowTrendingDownIcon, color: 'red' as const },
        nature: 'negativeIsGood' as const,
        valueType: 'currency',
      },
      {
        key: 'totalBalance',
        title: '최종 잔액',
        config: { icon: ChartBarIcon, color: 'blue' as const },
        nature: 'positiveIsGood' as const,
        valueType: 'currency',
      },
    ],
    []
  );
  // --- Hook 정의 끝 ---

  if (sessionStatus === 'loading') {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-slate-100 to-sky-100'>
        <LoadingSpinner size='lg' />
        <p className='ml-4 text-xl text-gray-700 mt-4'>인증 정보를 확인 중입니다...</p>
      </div>
    );
  }

  // 인증은 되었으나, 활성 워크스페이스가 없는 경우 (워크스페이스 선택/생성 UI 표시)
  if (sessionStatus === 'authenticated' && !activeWorkspaceId) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 flex flex-col items-center justify-center p-4'>
        <Card
          title={storedWorkspaces.length > 0 ? '워크스페이스 선택' : '첫 워크스페이스 생성'}
          className='w-full max-w-md'
        >
          {workspaceApiError && (
            <Alert type='error' className='mb-4'>
              {workspaceApiError}
            </Alert>
          )}

          {storedWorkspaces.length > 0 && !showCreateFormInPage && (
            <div className='space-y-3 mb-6'>
              <p className='text-sm text-gray-600 mb-3'>
                참여중인 워크스페이스에서 선택하거나 새로 만드세요.
              </p>
              {storedWorkspaces.map((ws) => (
                <Button
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws.id, ws.name)}
                  variant='secondary'
                  className='w-full text-left justify-start'
                  icon={RectangleStackIcon}
                >
                  {ws.name}{' '}
                  <span className='text-xs text-gray-500 ml-auto'>({ws.currentUserRole})</span>
                </Button>
              ))}
            </div>
          )}

          {!showCreateFormInPage && storedWorkspaces.length > 0 && (
            <Button
              variant='primary'
              onClick={() => setShowCreateFormInPage(true)}
              className='w-full mb-4 border-gray-300 text-gray-700 hover:bg-gray-50'
              icon={PlusIcon}
            >
              새 워크스페이스 만들기
            </Button>
          )}

          {(showCreateFormInPage || storedWorkspaces.length === 0) && (
            <div>
              <h2 className='text-md font-medium text-gray-700 mb-3'>
                {storedWorkspaces.length > 0
                  ? '새 워크스페이스 정보 입력'
                  : '첫 워크스페이스를 만들어 시작하세요!'}
              </h2>
              <form onSubmit={handleCreateWorkspaceInPage} className='space-y-4'>
                <TextField
                  id='newWorkspaceNameInPage'
                  name='newWorkspaceNameInPage'
                  label='워크스페이스 이름'
                  value={newWorkspaceNameInPage}
                  onChange={(e) => setNewWorkspaceNameInPage(e.target.value)}
                  placeholder='예: 팀 프로젝트, 우리집 가계부'
                  required
                  disabled={isCreatingWorkspaceInPage}
                />
                <div className='flex gap-2 pt-2'>
                  {storedWorkspaces.length > 0 && ( // 취소 버튼은 기존 워크스페이스가 있을 때만 의미 있음
                    <Button
                      type='button'
                      variant='secondary'
                      onClick={() => setShowCreateFormInPage(false)}
                      disabled={isCreatingWorkspaceInPage}
                      className='flex-1'
                    >
                      취소
                    </Button>
                  )}
                  <Button
                    type='submit'
                    variant='primary'
                    disabled={isCreatingWorkspaceInPage}
                    className='flex-1'
                  >
                    {isCreatingWorkspaceInPage ? (
                      <LoadingSpinner size='sm' />
                    ) : (
                      '만들기 및 시작하기'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Card>
        <div className='mt-8'>
          <LoginLogoutButton /> {/* 로그아웃 버튼은 여기에도 둘 수 있음 */}
        </div>
      </div>
    );
  }

  // 활성 워크스페이스가 있고, 대시보드 데이터 로딩 중
  if (activeWorkspaceId && isDashboardDataLoading) {
    return (
      <div className='flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-slate-100 to-sky-100'>
        <LoadingSpinner size='lg' />
        <p className='text-xl text-gray-700 mt-4'>
          {currentWorkspace?.name || '선택된'} 워크스페이스 데이터를 불러오는 중입니다...
        </p>
      </div>
    );
  }

  // 대시보드 데이터 로딩 에러 처리
  if (dashboardDataError) {
    return (
      <div className='flex flex-col justify-center items-center h-screen bg-red-50 text-red-700 p-4'>
        <InformationCircleIcon className='h-12 w-12 text-red-500 mb-4' />
        <h2 className='text-xl font-semibold mb-2'>데이터 로딩 오류</h2>
        <p className='text-center mb-4'>워크스페이스 데이터를 불러오는 중 문제가 발생했습니다.</p>
        <pre className='text-xs bg-red-100 p-2 rounded overflow-auto max-w-md'>
          {dashboardDataError.error.message || '알 수 없는 오류'}
        </pre>
        <Button onClick={() => router.push('/')} className='mt-4'>
          워크스페이스 다시 선택
        </Button>
      </div>
    );
  }

  const handleAddTransactionClick = () => {
    if (!activeWorkspaceId) {
      showToast('작업할 워크스페이스를 먼저 선택해주세요.', 'error');
      router.push('/');
      return;
    }
    setEditingTransaction(null);
    setShowTransactionForm(true);
  };

  const handleFormSuccess = () => {
    mutateAllRelevantStats();
    setShowTransactionForm(false);
    setEditingTransaction(null);
  };

  // 인사이트 숨기기 핸들러 (MVP 이후 기능)
  const handleDismissInsight = (insightIdToDismiss: string) => {
    addDismissedInsightId(insightIdToDismiss); // localStorage에 ID 저장

    if (mutateFunctions.mutateInsights && insightsData) {
      const updatedInsights = insightsData.filter((insight) => insight.id !== insightIdToDismiss);

      mutateFunctions.mutateInsights(
        { insights: updatedInsights } as InsightsApiResponse, // API 응답 형식에 맞춤
        false
      );
      showToast(`인사이트가 숨김 처리되었습니다.`, 'info');
    } else {
      showToast(`인사이트가 숨김 처리되었습니다. (새로고침 시 적용)`, 'info');
    }
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 text-gray-800 pb-16'>
      <header className='bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-40'>
        <div className='container mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center'>
            <BuildingOffice2Icon className='h-6 w-6 text-blue-600 mr-2 hidden sm:inline-block' />
            <h1 className='text-xl sm:text-2xl font-bold text-blue-700 truncate max-w-[150px] sm:max-w-xs'>
              {currentWorkspace?.name || '대시보드'}
            </h1>
            <Button
              onClick={() => setActiveWorkspaceId(null)}
              variant='ghost'
              size='sm'
              className='ml-2 text-xs'
            >
              (워크스페이스 변경)
            </Button>
          </div>
          <div className='flex items-center space-x-2 sm:space-x-3'>
            <Button
              onClick={handleAddTransactionClick}
              variant='primary'
              icon={PlusCircleIcon}
              size='md'
              className='hidden sm:inline-flex'
            >
              새 내역
            </Button>
            <Button
              onClick={handleAddTransactionClick}
              variant='primary'
              icon={PlusCircleIcon}
              size='icon'
              ariaLabel='새 내역 추가'
              className='sm:hidden'
            />
            <Link href='/settings/budget'>
              <Button
                variant='secondary' // 예산 설정은 secondary로 변경하여 워크스페이스 관리와 구분
                icon={Cog6ToothIcon}
                size='md'
                className='hidden sm:inline-flex'
              >
                예산 설정
              </Button>
            </Link>
            {activeWorkspaceId && ( // activeWorkspaceId가 있을 때만 버튼 표시
              <Link href={`/workspaces/${activeWorkspaceId}`}>
                <Button
                  variant='primary' // 워크스페이스 관리는 primary로
                  icon={Cog6ToothIcon} // 아이콘은 동일하게 Cog6ToothIcon 사용
                  size='md'
                  className='hidden sm:inline-flex'
                >
                  워크스페이스 관리
                </Button>
              </Link>
            )}
            <LoginLogoutButton />
            <Button
              onClick={toggleMobileMenu}
              variant='ghost'
              icon={isMobileMenuOpen ? XMarkIcon : Bars3Icon}
              size='icon'
              ariaLabel='메뉴 토글'
              className='md:hidden'
            />
          </div>
        </div>
      </header>

      {/* 모바일 메뉴 (isMobileMenuOpen 상태에 따라 표시) */}
      {isMobileMenuOpen && (
        <div className='md:hidden fixed inset-x-0 top-16 bg-white shadow-lg z-30 p-4 space-y-3'>
          <Link href='/settings/budget' className='block'>
            <Button variant='ghost' icon={Cog6ToothIcon} className='w-full justify-start'>
              예산 설정
            </Button>
          </Link>
          {activeWorkspaceId && (
            <Link href={`/workspaces/${activeWorkspaceId}`} className='block'>
              <Button variant='ghost' icon={Cog6ToothIcon} className='w-full justify-start'>
                워크스페이스 관리
              </Button>
            </Link>
          )}
          {/* 추가적인 모바일 메뉴 항목들... */}
        </div>
      )}

      <main className='container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8'>
        <section className='mb-6 sm:mb-8 p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-md'>
          <div className='flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4'>
            <div className='flex items-center space-x-2'>
              <Button
                onClick={() => moveMonth('prev')}
                variant='secondary'
                icon={ChevronLeftIcon}
                size='icon'
                ariaLabel='이전 달'
              />
              <h2 className='text-lg sm:text-xl font-semibold text-gray-700 whitespace-nowrap tabular-nums'>
                {format(parseISO(`${selectedMonth}-01`), 'yyyy년 M월', {
                  locale: ko,
                })}
              </h2>
              <Button
                onClick={() => moveMonth('next')}
                variant='secondary'
                icon={ChevronRightIcon}
                size='icon'
                ariaLabel='다음 달'
              />
            </div>
            <Button
              variant='secondary'
              icon={FunnelIcon}
              onClick={() => setIsFilterModalOpen(true)}
            >
              필터
            </Button>
          </div>
        </section>

        {/* 금융 인사이트 섹션 추가 */}
        <section className='my-6 sm:my-8'>
          <h2 className='text-xl font-semibold text-gray-700 mb-4 px-1'>✨ 오늘의 금융 인사이트</h2>
          <InsightsSection
            insights={insightsData}
            isLoading={insightsIsLoading}
            error={insightsError}
            currentMonth={format(parseISO(`${selectedMonth}-01`), 'yyyy년 M월', { locale: ko })}
            onDismissInsight={handleDismissInsight}
          />
        </section>

        <section className='mb-6 sm:mb-8'>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6'>
            {kpiItemsToDisplay.map(({ key, title, config, nature, valueType }) => {
              let value: number | undefined;
              let change: number | undefined;
              let changePercent: number | undefined;
              let trend: { date: string; value: number }[] | undefined;
              let isLoadingSpecific = kpiIsLoading;

              if (key === 'carryOverBalance') {
                value = monthlyStats?.carryOverBalance;
                isLoadingSpecific = monthlyStatsIsLoading;
              } else if (kpiData?.kpi) {
                const kpiItem = kpiData.kpi[key as keyof KpiData['kpi']];
                if (kpiItem) {
                  value = kpiItem.value;
                  change = kpiItem.change;
                  changePercent = kpiItem.changePercent;
                  trend = kpiItem.trend;
                }
              }

              if (!isLoadingSpecific && value === undefined) {
                return (
                  <Card
                    key={key}
                    className={`border-l-4 ${
                      config.color
                        ? KPI_CARD_COLOR_CLASSES[config.color]?.border
                        : 'border-gray-500'
                    } ${
                      config.color ? KPI_CARD_COLOR_CLASSES[config.color]?.bg : 'bg-gray-50'
                    } flex flex-col justify-between h-full`}
                  >
                    <div className='flex items-center justify-between'>
                      <p className={`text-sm font-medium text-gray-500 truncate`}>{title}</p>
                      {config.icon && (
                        <config.icon
                          className={`h-7 w-7 sm:h-8 sm:w-8 ${
                            config.color
                              ? KPI_CARD_COLOR_CLASSES[config.color]?.text
                              : 'text-gray-500'
                          } opacity-60`}
                        />
                      )}
                    </div>
                    <p className='text-lg text-gray-400 mt-2'>데이터 없음</p>
                  </Card>
                );
              }

              return (
                <KpiCardRedesign
                  key={key}
                  title={title}
                  value={value ?? 0}
                  change={change}
                  changePercent={changePercent}
                  icon={config.icon}
                  color={config.color}
                  trendData={trend}
                  valueType={(valueType || 'currency') as ValueType}
                  valueNature={nature}
                  isLoading={isLoadingSpecific}
                />
              );
            })}
          </div>
        </section>

        <section className='my-6 sm:my-8'>
          <h2 className='text-xl font-semibold text-gray-700 mb-4 px-1'>
            일별 거래 달력 (카테고리별)
          </h2>
          {transactionsIsLoading ? ( // <<-- transactions 로딩 상태 사용
            <Card className='h-[500px]'>
              <div className='flex items-center justify-center h-full'>
                <LoadingSpinner size='lg' />
                <p className='ml-2'>달력 및 거래내역 로딩 중...</p>
              </div>
            </Card>
          ) : dashboardDataError ? ( // dashboardDataError는 transactionsError 등을 포함할 수 있음
            <Card>
              <Alert type='error'>
                거래 내역을 불러오는데 실패했습니다:{' '}
                {dashboardDataError.message || '알 수 없는 오류'}
              </Alert>
            </Card>
          ) : transactions && transactions.length > 0 ? ( // transactions 데이터 직접 사용
            <DailyTransactionCalendar
              year={currentYear}
              month={currentMonthIndex}
              transactions={transactions} // <<-- 전체 거래 내역 전달
              onDateClick={handleCalendarDateClick}
            />
          ) : (
            <Card>
              <div className='text-center py-8'>
                <InformationCircleIcon className='h-12 w-12 mx-auto text-gray-400 mb-2' />
                <p className='text-gray-500'>해당 월의 거래 내역이 없습니다.</p>
                <Button onClick={handleAddTransactionClick} variant='primary' className='mt-4'>
                  첫 내역 추가하기
                </Button>
              </div>
            </Card>
          )}
        </section>

        <section className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 sm:mb-8'>
          <ErrorBoundary
            fallback={
              <Card title='월간 수입/지출 트렌드'>
                <p className='text-red-500'>차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            <Card title='월간 수입/지출 트렌드 (일별)' className='h-full'>
              {monthlyStatsIsLoading ? (
                <div className='h-[300px] sm:h-[350px] flex items-center justify-center'>
                  <div className='animate-pulse bg-gray-200 rounded-md w-full h-full'></div>
                </div>
              ) : monthlyStats?.dailyTrend && monthlyStats.dailyTrend.length > 0 ? (
                <TrendChart
                  data={monthlyStats.dailyTrend}
                  type='bar'
                  xDataKey='date'
                  series={[
                    { dataKey: 'income', name: '수입', color: '#4CAF50' },
                    { dataKey: 'expense', name: '지출', color: '#F44336' },
                  ]}
                  height='300px'
                  stack={false}
                />
              ) : (
                <div className='h-[300px] sm:h-[350px] flex flex-col items-center justify-center bg-gray-50 rounded-md'>
                  <InformationCircleIcon className='h-10 w-10 text-gray-400 mb-2' />
                  <p className='text-gray-500'>이번 달 거래 내역이 없습니다.</p>
                </div>
              )}
            </Card>
          </ErrorBoundary>

          <ErrorBoundary
            fallback={
              <Card title='카테고리별 지출 분포'>
                <p className='text-red-500'>차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            <Card title='카테고리별 지출 분포' className='h-full'>
              {categoryStatsIsLoading ? (
                <div className='h-[300px] sm:h-[350px] flex items-center justify-center'>
                  <div className='animate-pulse bg-gray-200 rounded-md w-full h-full'></div>
                </div>
              ) : categoryStats?.expenseData && categoryStats.expenseData.length > 0 ? (
                <CategoryDistributionChart
                  data={categoryStats.expenseData.filter(
                    (item) => item.categoryId !== null && item.amount > 0
                  )}
                  type='expense'
                  height='300px'
                  title=''
                />
              ) : (
                <div className='h-[300px] sm:h-[350px] flex flex-col items-center justify-center bg-gray-50 rounded-md'>
                  <InformationCircleIcon className='h-10 w-10 text-gray-400 mb-2' />
                  <p className='text-gray-500'>이번 달 지출 내역이 없습니다.</p>
                </div>
              )}
            </Card>
          </ErrorBoundary>
        </section>

        <section className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 sm:mb-8'>
          <ErrorBoundary
            fallback={
              <Card title='소비 패턴 분석'>
                <p className='text-red-500'>차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            {spendingPatternIsLoading ? (
              <SpendingPatternSkeleton />
            ) : spendingPatternData && spendingPatternData.dayPattern.length > 0 ? (
              <SpendingPatternChart data={spendingPatternData} title='소비 패턴 분석' />
            ) : (
              <Card title='소비 패턴 분석' className='h-full'>
                <div className='h-64 flex flex-col items-center justify-center bg-gray-50 rounded-md'>
                  <InformationCircleIcon className='h-10 w-10 text-gray-400 mb-2' />
                  <p className='text-gray-500'>소비 패턴 데이터가 없습니다.</p>
                </div>
              </Card>
            )}
          </ErrorBoundary>
          <ErrorBoundary
            fallback={
              <Card title='수입원 분석'>
                <p className='text-red-500'>차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            {incomeSourceIsLoading ? (
              <IncomeSourceSkeleton />
            ) : incomeSourceData && incomeSourceData.incomeSources.length > 0 ? (
              <IncomeSourceChart data={incomeSourceData} title='수입원 분석' />
            ) : (
              <Card title='수입원 분석' className='h-full'>
                <div className='h-64 flex flex-col items-center justify-center bg-gray-50 rounded-md'>
                  <InformationCircleIcon className='h-10 w-10 text-gray-400 mb-2' />
                  <p className='text-gray-500'>수입원 분석 데이터가 없습니다.</p>
                </div>
              </Card>
            )}
          </ErrorBoundary>
          <ErrorBoundary
            fallback={
              <Card title='예산 대비 지출'>
                <p className='text-red-500'>차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            {budgetVsActualIsLoading ? (
              <BudgetVsActualSkeleton />
            ) : budgetVsActualData ? (
              <BudgetVsActualChart data={budgetVsActualData} title='예산 대비 지출' />
            ) : (
              <Card title='예산 대비 지출' className='h-full'>
                <div className='h-64 flex flex-col items-center justify-center bg-gray-50 rounded-md'>
                  <InformationCircleIcon className='h-10 w-10 text-gray-400 mb-2' />
                  <p className='text-gray-500'>예산 데이터가 없거나, 설정된 예산이 없습니다.</p>
                  <Link href='/settings/budget'>
                    <Button variant='secondary' className='mt-2 text-sm'>
                      예산 설정 바로가기
                    </Button>
                  </Link>
                </div>
              </Card>
            )}
          </ErrorBoundary>
        </section>

        {/* <section>
          <ErrorBoundary
            fallback={
              <Card title='최근 거래 내역'>
                <p className='text-red-500'>거래 내역 로드 중 오류 발생</p>
              </Card>
            }
          >
            <Card title='최근 거래 내역' noPadding>
              {transactionsIsLoading ? (
                <div className='p-6'>
                  <div className='h-[300px] bg-gray-200 animate-pulse rounded-md'></div>
                </div>
              ) : transactions && transactions.length > 0 ? (
                <TransactionTable
                  transactions={transactions}
                  onEdit={handleEditTransactionClick}
                  onDelete={handleDeleteTransactionClick}
                  title=''
                  maxHeight='400px'
                />
              ) : (
                <div className='h-64 flex flex-col items-center justify-center bg-gray-50 rounded-b-md p-6'>
                  <InformationCircleIcon className='h-10 w-10 text-gray-400 mb-2' />
                  <p className='text-gray-500'>표시할 거래 내역이 없습니다.</p>
                  <Button onClick={handleAddTransactionClick} variant='primary' className='mt-4'>
                    첫 내역 추가하기
                  </Button>
                </div>
              )}
            </Card>
          </ErrorBoundary>
        </section> */}

        {showTransactionForm && (
          <div className='fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out'>
            <div className='bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col transform transition-all duration-300 ease-in-out scale-100 opacity-100'>
              <div className='px-6 py-4 border-b flex justify-between items-center'>
                <h3 className='text-lg font-semibold'>
                  {editingTransaction ? '내역 수정' : '새 내역 추가'}
                </h3>
                <Button
                  icon={XMarkIcon}
                  variant='ghost'
                  size='icon'
                  onClick={() => {
                    setShowTransactionForm(false);
                    setEditingTransaction(null);
                  }}
                  ariaLabel='닫기'
                />
              </div>
              <div className='p-6 overflow-y-auto'>
                {editingTransaction ? (
                  <TransactionEditModal
                    transaction={editingTransaction}
                    onClose={() => {
                      setShowTransactionForm(false);
                      setEditingTransaction(null);
                    }}
                    onSave={handleFormSuccess}
                    workspaceId={activeWorkspaceId as string} // workspaceId 전달
                  />
                ) : (
                  <TransactionForm
                    onTransactionAdded={handleFormSuccess}
                    onCancel={() => setShowTransactionForm(false)}
                    workspaceId={activeWorkspaceId as string} // workspaceId 전달
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <FilterModal
          isOpen={isFilterModalOpen}
          onClose={() => setIsFilterModalOpen(false)}
          filters={localFilters}
          onFilterChange={handleLocalFilterChange}
          onApplyFilters={() => {
            applyFilters();
            setIsFilterModalOpen(false);
          }}
          onResetFilters={() => {
            resetFilters();
            setIsFilterModalOpen(false);
          }}
          categoryOptions={categoryOptions} // 이 categoryOptions는 useDashboardData에서 이미 activeWorkspaceId 기준으로 가져옴
        />
      </main>

      <footer className='text-center py-8 text-sm text-gray-500 border-t border-gray-200 bg-slate-50'>
        <p>&copy; {new Date().getFullYear()} 가계부 애플리케이션. 모든 권리 보유.</p>
      </footer>
    </div>
  );
}
```

```tsx
/* ./src/app/invitations/accept/page.tsx */
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { postFetcher } from '@/lib/fetchers';

type Status = 'loading' | 'success' | 'error';

interface AcceptInvitationApiResponse {
  workspaceId?: string;
  message: string;
}

export default function AcceptInvitationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('유효하지 않은 토큰입니다.');
      return;
    }

    const accept = async () => {
      setStatus('loading');
      try {
        const apiResponse = await postFetcher<AcceptInvitationApiResponse, { token: string }>(
          '/api/invitations/accept',
          { arg: { token } }
        );

        setStatus('success');
        setMessage(apiResponse.message);
        setWorkspaceId(apiResponse.workspaceId);
      } catch (error: any) {
        setStatus('error');
        const errorMessage =
          error?.info?.message || error?.message || '초대 수락 중 오류가 발생했습니다.';
        setMessage(errorMessage);
        console.error('Failed to accept invitation:', error);
      }
    };

    accept();
  }, [token]);

  const handleGoToWorkspace = () => {
    if (workspaceId) {
      router.push(`/workspaces/${workspaceId}`);
    } else {
      router.push('/workspaces');
    }
  };

  const handleGoToLogin = () => {
    router.push('/auth/signin');
  };

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4'>
      <div className='bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center'>
        {status === 'loading' && (
          <>
            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto'></div>
            <p className='mt-4 text-lg font-semibold'>초대 수락 중...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <h1 className='text-2xl font-bold text-green-600 mb-4'>초대 수락 완료!</h1>
            <p className='text-gray-700 mb-6'>{message}</p>
            <Button onClick={handleGoToWorkspace} className='w-full'>
              워크스페이스로 이동
            </Button>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className='text-2xl font-bold text-red-600 mb-4'>오류 발생</h1>
            <p className='text-gray-700 mb-6'>{message}</p>
            <Button onClick={handleGoToLogin} className='w-full'>
              로그인 페이지로 이동
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
```

```tsx
/* ./src/app/layout.tsx */
// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/contexts/ToastContext";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AuthSessionProvider from "@/providers/AuthSessionProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "가계부 앱",
  description: "Next.js와 SQLite로 만든 간단한 가계부 애플리케이션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <body
        className={`${inter.className} bg-gray-50  text-gray-900  min-h-screen transition-colors duration-300`}
      >
        <AuthSessionProvider>
          <ToastProvider>
            <main className="container mx-auto p-4">{children}</main>
            <Analytics />
            <SpeedInsights />
          </ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
```

```tsx
/* ./src/app/page.tsx */
// src/app/page.tsx
import IntegratedDashboardPage from '@/app/dashboard/page';

export default function Home() {
  return <IntegratedDashboardPage />;
}
```

```tsx
/* ./src/app/settings/budget/page.tsx */
// src/app/settings/budget/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import BudgetManager from "@/components/budget/BudgetManager";
import { useToast } from "@/contexts/ToastContext";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function BudgetSettingsPage() {
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), "yyyy-MM")
  );
  const { activeWorkspaceId } = useWorkspaceStore();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    if (!activeWorkspaceId) {
      router.push("/");
    }
  }, [activeWorkspaceId, router]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  const handleBudgetsChanged = () => {
    // 통계 갱신을 위한 로직 (필요시)
    // 예: 캐시 무효화 또는 리디렉션
    showToast("예산이 업데이트되었습니다.", "success");
  };

  if (!activeWorkspaceId) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
        <p className="ml-2">워크스페이스 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">예산 설정</h1>

      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          기준 월 선택
        </label>
        <input
          type="month"
          value={selectedMonth}
          onChange={handleMonthChange}
          className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <BudgetManager
        selectedMonth={selectedMonth}
        onBudgetsChanged={handleBudgetsChanged}
        workspaceId={activeWorkspaceId}
      />
    </div>
  );
}
```

```tsx
/* ./src/app/workspaces/[workspaceId]/page.tsx */
'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WorkspaceRole } from '@prisma/client';

// API 응답 타입 (예시)
interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: any; // 상세 오류 정보
}

// User 인터페이스 (API 응답과 일치하도록)
interface User {
  id: string;
  name: string | null; // name은 null일 수 있음
  email: string | null; // email은 null일 수 있음
  role: WorkspaceRole; // 역할
  // image?: string | null; // 필요하다면 사용자 이미지
}

interface Workspace {
  id: string;
  name: string;
  currentUserRole?: WorkspaceRole; // 현재 사용자의 역할
}

interface InvitedBy {
  id: string;
  name: string | null;
  email: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: string; // 'PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED', 'EXPIRED' 등
  createdAt: string; // 또는 Date
  expiresAt: string; // 또는 Date
  invitedBy?: InvitedBy; // 초대한 사용자 정보 (선택적)
}

// Generic API fetch 함수
async function fetchApi<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, options);
    const responseData = await response.json().catch(() => ({})); // JSON 파싱 실패 대비

    if (!response.ok) {
      return {
        error:
          responseData.message || responseData.error || `HTTP error! status: ${response.status}`,
        details: responseData.details,
      };
    }
    // Prisma 등에서 data 필드 없이 직접 객체를 반환하는 경우 data 키가 없을 수 있음
    // success true/false로 구분하는 경우도 있음
    return { data: responseData.data !== undefined ? responseData.data : responseData };
  } catch (error) {
    console.error('API call failed:', error);
    return {
      error: error instanceof Error ? error.message : '알 수 없는 네트워크 오류가 발생했습니다.',
    };
  }
}

export default function WorkspaceManagePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params?.workspaceId as string;

  const [workspaceName, setWorkspaceName] = useState('');
  const [originalWorkspaceName, setOriginalWorkspaceName] = useState('');
  const [members, setMembers] = useState<User[]>([]);
  const [emailToInvite, setEmailToInvite] = useState('');
  const [roleToInvite, setRoleToInvite] = useState<WorkspaceRole>(WorkspaceRole.MEMBER);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);

  useEffect(() => {
    if (!workspaceId) {
      setIsLoading(false);
      console.error('워크스페이스 ID가 URL에 없습니다.');
      alert('유효하지 않은 접근입니다. 워크스페이스 ID가 필요합니다.');
      router.push('/dashboard');
      return;
    }

    const fetchWorkspaceData = async () => {
      setIsLoading(true);

      const workspaceRes = await fetchApi<Workspace>(`/api/workspaces/${workspaceId}`);
      if (workspaceRes.error || !workspaceRes.data) {
        alert(`워크스페이스 정보 로딩 실패: ${workspaceRes.error || '데이터 없음'}`);
        setCurrentWorkspace(null);
        setIsLoading(false);
        return;
      }
      const workspaceData = workspaceRes.data;
      setCurrentWorkspace(workspaceData);
      setWorkspaceName(workspaceData.name);
      setOriginalWorkspaceName(workspaceData.name);

      const membersRes = await fetchApi<User[]>(`/api/workspaces/${workspaceId}/users`);
      if (membersRes.error || !membersRes.data) {
        alert(`멤버 목록 로딩 실패: ${membersRes.error || '데이터 없음'}`);
        setMembers([]);
      } else {
        setMembers(membersRes.data);
      }

      if (workspaceData.currentUserRole === WorkspaceRole.ADMIN) {
        const invitationsRes = await fetchApi<Invitation[]>(
          `/api/workspaces/${workspaceId}/invitations`
        );
        if (invitationsRes.error || !invitationsRes.data) {
          alert(`초대 목록 로딩 실패: ${invitationsRes.error || '데이터 없음'}`);
          setPendingInvitations([]);
        } else {
          setPendingInvitations(invitationsRes.data);
        }
      }

      setIsLoading(false);
    };

    fetchWorkspaceData();
  }, [workspaceId, router]);

  const handleUpdateWorkspaceName = async () => {
    if (
      !currentWorkspace ||
      !workspaceName.trim() ||
      workspaceName.trim() === originalWorkspaceName
    ) {
      alert('새 워크스페이스 이름을 입력해주세요 또는 변경된 내용이 없습니다.');
      return;
    }
    setIsSubmitting(true);
    const result = await fetchApi<Workspace>(`/api/workspaces/${currentWorkspace.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: workspaceName.trim() }),
    });
    setIsSubmitting(false);

    if (result.error || !result.data) {
      alert(`워크스페이스 이름 수정 실패: ${result.error || '응답 없음'}`);
    } else {
      alert('워크스페이스 이름이 수정되었습니다.');
      setCurrentWorkspace(result.data);
      setOriginalWorkspaceName(result.data.name);
      setWorkspaceName(result.data.name);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace || deleteConfirmName !== originalWorkspaceName) {
      alert('워크스페이스 이름이 일치하지 않습니다.');
      return;
    }

    const confirmed = confirm(
      `정말로 '${originalWorkspaceName}' 워크스페이스를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`
    );
    if (!confirmed) {
      setDeleteConfirmName('');
      return;
    }

    setIsSubmitting(true);
    const result = await fetchApi<void>(`/api/workspaces/${currentWorkspace.id}`, {
      method: 'DELETE',
    });
    setIsSubmitting(false);

    if (result.error) {
      alert(`워크스페이스 삭제 실패: ${result.error}`);
    } else {
      alert('워크스페이스가 삭제되었습니다.');
      router.push('/dashboard');
    }
  };

  const handleInviteUser = async () => {
    if (!currentWorkspace || !emailToInvite.trim()) {
      alert('초대할 사용자의 이메일을 입력해주세요.');
      return;
    }

    const trimmedEmail = emailToInvite.trim();
    console.log('Trimmed email for validation:', `'${trimmedEmail}'`); // 실제 값 확인을 위해 ``으로 감쌈

    const emailRegex = new RegExp(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // RegExp 객체 사용

    if (!emailRegex.test(trimmedEmail)) {
      alert('유효한 이메일 주소를 입력해주세요. 입력값: ' + trimmedEmail);
      return;
    }

    setIsSubmitting(true);
    const result = await fetchApi<Invitation>(
      `/api/workspaces/${currentWorkspace.id}/invitations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, role: roleToInvite }),
      }
    );
    setIsSubmitting(false);

    if (result.error || !result.data) {
      alert(
        `사용자 초대 실패: ${result.error || '응답 없음'}\n${
          result.details ? JSON.stringify(result.details) : ''
        }`
      );
    } else {
      alert(`'${trimmedEmail}'님에게 초대를 보냈습니다. 역할: ${roleToInvite}`);
      setEmailToInvite('');
      setPendingInvitations((prev) => [result.data!, ...prev]);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!currentWorkspace || currentWorkspace.currentUserRole !== WorkspaceRole.ADMIN) {
      alert('초대를 취소할 권한이 없습니다.');
      return;
    }
    const invitationToRevoke = pendingInvitations.find((inv) => inv.id === invitationId);
    if (!invitationToRevoke) return;

    const confirmed = confirm(
      `정말로 '${invitationToRevoke.email}'님에게 보낸 초대를 취소하시겠습니까?`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    const result = await fetchApi<void>(`/api/invitations/${invitationId}`, { method: 'DELETE' });
    setIsSubmitting(false);

    if (result.error) {
      alert(`초대 취소 실패: ${result.error}`);
    } else {
      alert('초대가 성공적으로 취소되었습니다.');
      setPendingInvitations(pendingInvitations.filter((inv) => inv.id !== invitationId));
    }
  };

  const handleRemoveUser = async (userIdToRemove: string) => {
    if (!currentWorkspace) return;

    const userToRemove = members.find((u) => u.id === userIdToRemove);
    if (!userToRemove) return;

    if (userToRemove.id === currentWorkspace.currentUserRole) {
    }

    const confirmed = confirm(
      `정말로 '${
        userToRemove.name || userToRemove.email
      }' 사용자를 워크스페이스에서 제외하시겠습니까?`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    const result = await fetchApi<void>(
      `/api/workspaces/${currentWorkspace.id}/users/${userIdToRemove}`,
      { method: 'DELETE' }
    );
    setIsSubmitting(false);

    if (result.error) {
      alert(`사용자 제외 실패: ${result.error}`);
    } else {
      setMembers(members.filter((user) => user.id !== userIdToRemove));
      alert('사용자가 워크스페이스에서 제외되었습니다.');
    }
  };

  if (isLoading) {
    return <div className='container mx-auto p-8 text-center'>로딩 중...</div>;
  }

  if (!currentWorkspace) {
    return (
      <div className='container mx-auto p-8 text-center'>
        <p className='text-red-500'>워크스페이스 정보를 불러오지 못했습니다.</p>
        <Button onClick={() => router.push('/dashboard')} className='mt-4'>
          대시보드로 돌아가기
        </Button>
      </div>
    );
  }

  const isAdmin = currentWorkspace.currentUserRole === WorkspaceRole.ADMIN;

  return (
    <div className='container mx-auto p-4 md:p-8'>
      <h1 className='text-3xl font-bold mb-8'>워크스페이스 관리: {originalWorkspaceName}</h1>

      <section className='mb-12'>
        <h2 className='text-2xl font-semibold mb-4'>워크스페이스 설정</h2>
        <div className='space-y-4 max-w-md'>
          <div>
            <Label htmlFor='workspaceName'>워크스페이스 이름</Label>
            <Input
              id='workspaceName'
              type='text'
              value={workspaceName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setWorkspaceName(e.target.value)}
              className='mt-1'
              disabled={!isAdmin || isSubmitting}
            />
          </div>
          <Button
            onClick={handleUpdateWorkspaceName}
            disabled={
              !isAdmin ||
              isSubmitting ||
              workspaceName.trim() === originalWorkspaceName ||
              !workspaceName.trim()
            }
          >
            {isSubmitting ? '저장 중...' : '이름 변경 저장'}
          </Button>
        </div>
      </section>

      <Separator className='my-8' />

      {isAdmin && (
        <section className='mb-12'>
          <h2 className='text-2xl font-semibold mb-4'>멤버 초대</h2>
          <div className='space-y-4 max-w-md'>
            <div>
              <Label htmlFor='emailToInvite'>이메일 주소</Label>
              <Input
                id='emailToInvite'
                type='email'
                placeholder='초대할 사용자의 이메일'
                value={emailToInvite}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setEmailToInvite(e.target.value)}
                disabled={isSubmitting}
                className='mt-1'
              />
            </div>
            <div>
              <Label htmlFor='roleToInvite'>역할</Label>
              <select
                id='roleToInvite'
                value={roleToInvite}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setRoleToInvite(e.target.value as WorkspaceRole)
                }
                disabled={isSubmitting}
                className='mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white'
              >
                <option value={WorkspaceRole.ADMIN}>Admin</option>
                <option value={WorkspaceRole.MEMBER}>Member</option>
              </select>
            </div>
            <Button onClick={handleInviteUser} disabled={isSubmitting || !emailToInvite.trim()}>
              {isSubmitting ? '초대 중...' : '초대 보내기'}
            </Button>
          </div>
        </section>
      )}
      {isAdmin && <Separator className='my-8' />}

      {isAdmin && pendingInvitations.length > 0 && (
        <section className='mb-12'>
          <h2 className='text-2xl font-semibold mb-4'>
            처리 대기중인 초대 ({pendingInvitations.length}건)
          </h2>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이메일</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>초대일</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead>초대한 사람</TableHead>
                  <TableHead className='text-right'>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>{invitation.role}</TableCell>
                    <TableCell>{invitation.status}</TableCell>
                    <TableCell>{new Date(invitation.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(invitation.expiresAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {invitation.invitedBy?.name || invitation.invitedBy?.email || '-'}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handleRevokeInvitation(invitation.id)}
                        disabled={isSubmitting}
                      >
                        초대 취소
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
      {isAdmin && pendingInvitations.length > 0 && <Separator className='my-8' />}

      <section className='mb-12'>
        <h2 className='text-2xl font-semibold mb-4'>멤버 관리 ({members.length}명)</h2>
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>이메일</TableHead>
                <TableHead>역할</TableHead>
                {isAdmin && <TableHead className='text-right'>작업</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length > 0 ? (
                members.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name || '-'}</TableCell>
                    <TableCell>{user.email || '-'}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    {isAdmin && (
                      <TableCell className='text-right'>
                        <Button
                          variant='destructive'
                          size='sm'
                          onClick={() => handleRemoveUser(user.id)}
                          disabled={isSubmitting || !isAdmin}
                        >
                          {isSubmitting ? '처리 중...' : '내보내기'}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 4 : 3} className='text-center'>
                    워크스페이스에 멤버가 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Separator className='my-8' />

      {isAdmin && (
        <section>
          <h2 className='text-2xl font-semibold mb-4'>워크스페이스 삭제</h2>
          <div className='p-4 border border-destructive/50 rounded-lg bg-destructive/5'>
            <p className='text-sm text-destructive mb-4'>
              이 작업은 되돌릴 수 없습니다. 워크스페이스를 삭제하면 모든 관련 데이터가 영구적으로
              제거됩니다.
            </p>
            <Dialog onOpenChange={(open) => !open && setDeleteConfirmName('')}>
              <DialogTrigger asChild>
                <Button variant='destructive' disabled={isSubmitting}>
                  워크스페이스 삭제
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>정말로 워크스페이스를 삭제하시겠습니까?</DialogTitle>
                  <DialogDescription>
                    이 작업은 되돌릴 수 없습니다. 워크스페이스와 관련된 모든 데이터가 영구적으로
                    삭제됩니다. 진행하려면 아래에 워크스페이스 이름{' '}
                    <span className='font-semibold text-foreground'>{originalWorkspaceName}</span>
                    을(를) 정확히 입력해주세요.
                  </DialogDescription>
                </DialogHeader>
                <Input
                  type='text'
                  value={deleteConfirmName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setDeleteConfirmName(e.target.value)
                  }
                  placeholder={originalWorkspaceName}
                  className='my-4'
                  disabled={isSubmitting}
                />
                <DialogFooter>
                  <Button
                    variant='outline'
                    onClick={() => {
                      const closeButton = document.querySelector(
                        '[data-radix-dialog-default-open="true"] button[aria-label="Close"]'
                      ) as HTMLElement;
                      if (closeButton) closeButton.click();
                    }}
                    disabled={isSubmitting}
                  >
                    취소
                  </Button>
                  <Button
                    variant='destructive'
                    onClick={handleDeleteWorkspace}
                    disabled={isSubmitting || deleteConfirmName !== originalWorkspaceName}
                  >
                    {isSubmitting ? '삭제 중...' : '삭제 확인'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </section>
      )}
    </div>
  );
}
```

```tsx
/* ./src/components/auth/LoginLogoutButton.tsx */
// src/components/auth/LoginLogoutButton.tsx (새 파일 또는 기존 UI 컴포넌트에 통합)
"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Button from "@/components/ui/Button"; // 기존 Button 컴포넌트 활용
import Image from "next/image"; // Next.js Image 컴포넌트 사용 권장
import {
  UserCircleIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowLeftStartOnRectangleIcon,
} from "@heroicons/react/24/outline";

export default function LoginLogoutButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Button variant="ghost" disabled className="animate-pulse">
        <div className="h-5 w-20 bg-gray-300 rounded"></div>
      </Button>
    );
  }

  if (session && session.user) {
    return (
      <div className="flex items-center space-x-2">
        {session.user.image ? (
          <Image
            src={session.user.image}
            alt={session.user.name || "User avatar"}
            width={32}
            height={32}
            className="rounded-full"
          />
        ) : (
          <UserCircleIcon className="h-8 w-8 text-gray-600" />
        )}
        <span className="text-sm text-gray-700 hidden sm:inline">
          {session.user.name || session.user.email}
        </span>
        <Button
          onClick={() => signOut()}
          variant="secondary"
          size="sm"
          icon={ArrowRightStartOnRectangleIcon}
        >
          로그아웃
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => signIn("google")}
      variant="primary"
      icon={ArrowLeftStartOnRectangleIcon}
    >
      Google 로그인
    </Button>
  );
}
```

```tsx
/* ./src/components/budget/BudgetManager.tsx */
// src/components/budget/BudgetManager.tsx

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import Button from "@/components/ui/Button";
import { useToast } from "@/contexts/ToastContext";
import {
  BUDGET_BY_ID_ENDPOINT,
  BUDGETS_ENDPOINT,
  CATEGORIES_ENDPOINT,
} from "@/constants/apiEndpoints";

type Budget = {
  id: number;
  month: string;
  categoryId: number;
  amount: number;
  category: {
    id: number;
    name: string;
    type: string;
  };
};

type Category = {
  id: number;
  name: string;
  type: string;
};

type FormValues = {
  categoryId: string;
  amount: string;
};

type BudgetManagerProps = {
  selectedMonth: string;
  onBudgetsChanged?: () => void;
  workspaceId: string;
};

export default function BudgetManager({
  selectedMonth,
  onBudgetsChanged,
  workspaceId,
}: BudgetManagerProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();
  const { showToast } = useToast();

  // 예산 및 카테고리 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 카테고리 로드
        const categoriesResponse = await fetch(
          CATEGORIES_ENDPOINT(workspaceId)
        );
        if (!categoriesResponse.ok) throw new Error("카테고리 로드 실패");
        const categoriesData = await categoriesResponse.json();
        setCategories(
          categoriesData.filter((cat: Category) => cat.type === "expense")
        );

        // 예산 로드
        const budgetsResponse = await fetch(
          `${BUDGETS_ENDPOINT(workspaceId)}?month=${selectedMonth}`
        );
        if (!budgetsResponse.ok) throw new Error("예산 로드 실패");
        const budgetsData = await budgetsResponse.json();
        setBudgets(budgetsData);
      } catch (error) {
        console.error("데이터 로드 중 오류:", error);
        showToast("데이터를 불러오는데 실패했습니다.", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedMonth, showToast, workspaceId]);

  // 예산 추가/수정 핸들러
  const onSubmit = async (data: FormValues) => {
    try {
      // 값 검증
      const categoryId = parseInt(data.categoryId);
      const amount = parseFloat(data.amount);

      if (isNaN(categoryId) || categoryId <= 0) {
        showToast("유효한 카테고리를 선택해주세요.", "error");
        return;
      }

      if (isNaN(amount) || amount <= 0) {
        showToast("유효한 금액을 입력해주세요.", "error");
        return;
      }

      // API 요청
      const response = await fetch(BUDGETS_ENDPOINT(workspaceId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: selectedMonth,
          categoryId,
          amount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "예산 저장 실패");
      }

      // 성공 메시지 및 상태 업데이트
      showToast("예산이 저장되었습니다.", "success");
      reset(); // 폼 초기화

      // 예산 데이터 다시 로드
      const updatedResponse = await fetch(
        `${BUDGETS_ENDPOINT(workspaceId)}?month=${selectedMonth}`
      );
      const updatedData = await updatedResponse.json();
      setBudgets(updatedData);

      // 부모 컴포넌트에 변경 알림
      if (onBudgetsChanged) {
        onBudgetsChanged();
      }
    } catch (error) {
      console.error("예산 저장 중 오류:", error);
      if (error instanceof Error) {
        showToast(error.message || "예산 저장에 실패했습니다.", "error");
      } else {
        showToast("알 수 없는 오류로 예산 저장에 실패했습니다.", "error");
      }
    }
  };

  // 예산 삭제 핸들러
  const handleDelete = async (budgetId: number) => {
    if (!confirm("이 예산을 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(
        BUDGET_BY_ID_ENDPOINT(workspaceId, budgetId),
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "예산 삭제 실패");
      }

      // 성공 메시지 및 상태 업데이트
      showToast("예산이 삭제되었습니다.", "success");
      setBudgets((prev) => prev.filter((b) => b.id !== budgetId));

      // 부모 컴포넌트에 변경 알림
      if (onBudgetsChanged) {
        onBudgetsChanged();
      }
    } catch (error) {
      console.error("예산 삭제 중 오류:", error);
      if (error instanceof Error) {
        showToast(error.message || "예산 삭제에 실패했습니다.", "error");
      } else {
        showToast("알 수 없는 오류로 예산 삭제에 실패했습니다.", "error");
      }
    }
  };

  // 이미 예산이 설정된 카테고리 필터링
  const availableCategories = categories.filter(
    (cat) => !budgets.some((budget) => budget.categoryId === cat.id)
  );

  // 금액 포맷팅
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">예산 관리</h2>

      {/* 예산 추가 폼 */}
      <form onSubmit={handleSubmit(onSubmit)} className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              카테고리
            </label>
            <select
              {...register("categoryId", {
                required: "카테고리는 필수 항목입니다",
              })}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading || availableCategories.length === 0}
            >
              <option value="">카테고리 선택</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id.toString()}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-500">
                {errors.categoryId.message}
              </p>
            )}
            {availableCategories.length === 0 && !isLoading && (
              <p className="mt-1 text-xs text-yellow-500">
                모든 카테고리에 예산이 설정되었습니다.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              예산 금액
            </label>
            <input
              type="number"
              {...register("amount", {
                required: "금액은 필수 항목입니다",
                min: { value: 1, message: "금액은 0보다 커야 합니다" },
              })}
              placeholder="0"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
            {errors.amount && (
              <p className="mt-1 text-xs text-red-500">
                {errors.amount.message}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || availableCategories.length === 0}
          >
            {isLoading ? "처리 중..." : "예산 설정"}
          </Button>
        </div>
      </form>

      {/* 현재 예산 목록 */}
      <h3 className="font-medium text-sm mb-2">현재 설정된 예산</h3>
      {isLoading ? (
        <div className="flex justify-center items-center h-20">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : budgets.length === 0 ? (
        <p className="text-gray-500 text-sm">설정된 예산이 없습니다.</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {budgets.map((budget) => (
            <div
              key={budget.id}
              className="flex justify-between items-center p-2 bg-gray-50 rounded gap-2"
            >
              <span className="font-medium">{budget.category.name}</span>
              <div className="flex items-center">
                <span className="mr-4">{formatAmount(budget.amount)}</span>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(budget.id)}
                >
                  삭제
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/BudgetVsActualChart.tsx */
/* ./src/components/dashboard/BudgetVsActualChart.tsx */

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import Button from "../ui/Button";
import Link from "next/link";

// 타입 정의에서 percentage와 totalPercentage가 null 또는 undefined일 수 있도록 허용
type BudgetVsActualItem = {
  budgetId: number | null;
  category: string;
  categoryId: number;
  budget: number;
  actual: number;
  difference: number;
  percentage: number | null | undefined; // null 또는 undefined 허용
};

type BudgetVsActualChartProps = {
  data: {
    totalBudget: number;
    totalActual: number;
    difference: number;
    totalPercentage: number | null | undefined; // null 또는 undefined 허용
    budgetVsActualByCategory: BudgetVsActualItem[];
    overBudgetCategories: BudgetVsActualItem[];
    hasBudget: boolean;
  };
  title?: string;
};

export default function BudgetVsActualChart({
  data,
  title = "예산 대비 지출",
}: BudgetVsActualChartProps) {
  const formatAmount = (amount: number) => {
    // 금액이 null이나 undefined가 아니라고 가정 (일반적으로 숫자형)
    if (typeof amount !== "number" || isNaN(amount)) return "0원";
    return new Intl.NumberFormat("ko-KR").format(amount) + "원";
  };

  // formatPercent 함수: null, undefined, NaN 값 방어 코드 추가
  const formatPercent = (percent?: number | null) => {
    if (percent === null || percent === undefined || isNaN(percent)) {
      return "N/A"; // 또는 "0.0%" 등 기본값으로 처리
    }
    if (percent === Infinity) return "∞%";
    return `${percent.toFixed(1)}%`;
  };

  // getStatusClass 함수: null, undefined, NaN 값 방어 코드 추가
  const getStatusClass = (percentage?: number | null) => {
    if (percentage === null || percentage === undefined || isNaN(percentage)) {
      return "text-gray-500"; // 기본 색상
    }
    if (percentage === Infinity || percentage > 100) return "text-red-500";
    if (percentage > 80) return "text-yellow-500";
    return "text-green-500";
  };

  // data.totalPercentage가 유효한 숫자인지 확인하고, 아니면 0으로 대체
  const validTotalPercentage =
    data?.totalPercentage !== null &&
    data?.totalPercentage !== undefined &&
    !isNaN(data.totalPercentage)
      ? data.totalPercentage
      : 0;

  // 데이터 로딩 중 또는 데이터가 없을 때의 초기 UI
  if (!data || !data.budgetVsActualByCategory) {
    return (
      <div className="bg-white p-4 rounded-lg shadow h-full">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-64 flex flex-col items-center justify-center gap-2 bg-gray-50 rounded-md">
          <p className="text-gray-400">
            예산 데이터를 불러오고 있거나 표시할 데이터가 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white p-4 rounded-lg shadow h-full flex flex-col"
      style={{ justifyContent: "space-between" }}
    >
      <h3 className="text-lg font-semibold mb-2">{title}</h3>

      {/* 전체 예산 요약 (예산이 설정된 경우에만 표시) */}
      {data.hasBudget && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">전체 예산</span>
            <span className="text-sm">{formatAmount(data.totalBudget)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">전체 지출</span>
            <span className={`text-sm ${getStatusClass(data.totalPercentage)}`}>
              {formatAmount(data.totalActual)} (
              {formatPercent(data.totalPercentage)})
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
            <div
              className={`h-2.5 rounded-full ${
                validTotalPercentage === Infinity || validTotalPercentage > 100
                  ? "bg-red-500"
                  : validTotalPercentage > 80
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{
                width: `${Math.min(
                  validTotalPercentage === Infinity
                    ? 100
                    : validTotalPercentage,
                  100
                )}%`,
              }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* 카테고리별 예산 대비 지출 차트 및 목록 */}
      {data.budgetVsActualByCategory.length > 0 ? (
        <>
          <div className="h-[160px] mb-2">
            {/* 차트 높이 유지 또는 조절 */}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                // slice(0,5) 제거하여 모든 항목 표시 시도, 또는 스크롤 가능한 컨테이너로 감싸기
                data={data.budgetVsActualByCategory}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }} // left 마진 조절
                barCategoryGap="20%" // 바 사이 간격
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(value) =>
                    value >= 1000 ? `${value / 1000}K` : value.toString()
                  }
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fontSize: 10, width: 70 }} // tick 너비 제한, fontSize 조절
                  width={80} // YAxis 전체 너비
                  interval={0} // 모든 tick 표시
                  style={{ overflow: "visible" }} // 긴 텍스트가 잘리지 않도록
                />
                <Tooltip formatter={(value) => formatAmount(value as number)} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar
                  name="예산"
                  dataKey="budget"
                  fill="#94A3B8"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  name="실제 지출"
                  dataKey="actual"
                  fill="#EF4444"
                  radius={[0, 4, 4, 0]}
                />
                {/* 예산이 설정된 경우에만 기준선 표시 */}
                {data.hasBudget && <ReferenceLine x={0} stroke="#CCC" />}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 예산 초과 카테고리 목록 */}
          {data.overBudgetCategories.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
              <h4 className="text-sm font-medium text-red-700 mb-2">
                예산 초과 카테고리
              </h4>
              <div className="max-h-[100px] overflow-y-auto text-xs">
                {/* 높이 및 폰트 크기 조절 */}
                <table className="w-full">
                  <thead className="text-gray-600">
                    <tr>
                      <th className="text-left py-1 font-normal">카테고리</th>
                      <th className="text-right py-1 font-normal">사용율</th>
                      <th className="text-right py-1 font-normal">초과액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overBudgetCategories.map((item) => (
                      <tr
                        key={item.categoryId}
                        className="border-t border-red-100"
                      >
                        <td className="py-1 pr-1 truncate max-w-[100px]">
                          {item.category}
                        </td>
                        <td
                          className={`py-1 text-right font-medium ${getStatusClass(
                            item.percentage
                          )}`}
                        >
                          {formatPercent(item.percentage)}
                        </td>
                        <td className="py-1 text-right font-medium">
                          {item.difference < 0
                            ? formatAmount(Math.abs(item.difference))
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        // 예산 항목은 있으나 실제 지출/예산 내역이 없는 경우, 또는 예산 자체가 없는 경우
        <div className="h-64 flex flex-col items-center justify-center gap-2 bg-gray-50 rounded-md">
          <p className="text-gray-400">
            표시할 예산 대비 지출 내역이 없습니다.
          </p>
          {!data.hasBudget && ( // 예산이 아예 설정되지 않은 경우에만 예산 설정 버튼 표시
            <Link href="/settings/budget">
              <Button variant="primary">예산 설정하기</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/BudgetVsActualSkeleton.tsx */
// src/components/dashboard/BudgetVsActualSkeleton.tsx

import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function BudgetVsActualSkeleton() {
  return (
    <div className="bg-white p-4 rounded-lg shadow h-full">
      {/* 제목 영역 */}
      <Skeleton className="h-6 w-32 mb-3" />

      {/* 예산 요약 영역 */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex justify-between items-center mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>

        {/* 진행 상태 바 */}
        <Skeleton className="h-2.5 w-full mb-1" />

        {/* 퍼센티지 표시 */}
        <div className="flex justify-between">
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-6" />
          <Skeleton className="h-3 w-6" />
        </div>
      </div>

      {/* 바 차트 영역 */}
      <Skeleton className="h-[160px] w-full mb-4" />

      {/* 카테고리 목록 영역 */}
      <div className="mt-4">
        <Skeleton className="h-4 w-40 mb-2" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/CategoryDistributionChart.tsx */
// src/components/dashboard/CategoryDistributionChart.tsx
import { ChartCategoryData } from '@/types/chartTypes';
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// renderCustomizedLabel 프롭 타입 정의
interface CustomizedLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  // innerRadius: number; // 사용되지 않으므로 제거
  outerRadius: number;
  // percent: number; // 사용되지 않으므로 제거
  index: number;
}

type CategoryDistributionChartProps = {
  data: ChartCategoryData[];
  title: string;
  type?: 'income' | 'expense';
  height?: number | string;
  showLabels?: boolean;
  showLegend?: boolean;
};

export default function CategoryDistributionChart({
  data,
  title,
  type = 'expense',
  height = 300,
  showLabels = true,
  showLegend = true,
}: CategoryDistributionChartProps) {
  // 색상 팔레트 정의
  const COLORS = {
    income: [
      '#4CAF50',
      '#81C784',
      '#A5D6A7',
      '#C8E6C9',
      '#E8F5E9',
      '#2E7D32',
      '#388E3C',
      '#43A047',
      '#66BB6A',
      '#D4E157',
    ],
    expense: [
      'rgb(191, 225, 246)',
      'rgb(255, 207, 201)',
      'rgb(255, 229, 160)',
      'rgb(232, 234, 237)',
      'rgb(71, 56, 34)',
      'rgb(17, 115, 75)',
      'rgb(177, 2, 2)',
      'rgb(255, 200, 170)',
      'rgb(10, 83, 168)',
      'rgb(230, 207, 242)',
      'rgb(90, 50, 134)',
    ],
  };

  // 금액 포맷팅 함수
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  // 퍼센트 포맷팅 함수
  const formatPercent = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };

  // 데이터가 없는 경우 표시할 내용
  if (!data || data.length === 0) {
    return (
      <div className='bg-white p-4 rounded-lg shadow h-64 flex items-center justify-center h-full'>
        <p className='text-gray-500'>데이터가 없습니다.</p>
      </div>
    );
  }

  // 상위 5개 카테고리만 표시, 나머지는 '기타'로 묶기
  const TOP_CATEGORIES_COUNT = 5;
  let chartData = [...data];

  if (data.length > TOP_CATEGORIES_COUNT) {
    const topCategories = data.slice(0, TOP_CATEGORIES_COUNT);
    const otherCategories = data.slice(TOP_CATEGORIES_COUNT);

    const otherAmount = otherCategories.reduce((sum, item) => sum + item.amount, 0);
    const otherPercentage = otherCategories.reduce((sum, item) => sum + (item.percentage || 0), 0);

    chartData = [
      ...topCategories,
      {
        categoryId: -1,
        categoryName: '기타',
        amount: otherAmount,
        percentage: otherPercentage,
      },
    ];
  }

  // 커스텀 라벨 컴포넌트
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    // innerRadius, // 제거
    outerRadius,
    // percent, // 제거
    index,
  }: CustomizedLabelProps) => {
    // 타입 적용
    if (!showLabels) return null;

    const RADIAN = Math.PI / 180;
    const radius = outerRadius * 1.1;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill='#333'
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline='central'
        fontSize='12'
      >
        {`${chartData[index].categoryName} ${formatPercent(chartData[index].percentage || 0)}`}
      </text>
    );
  };

  return (
    <div className='bg-white p-4 rounded-lg shadow h-full'>
      <h3 className='text-lg font-semibold mb-4'>{title}</h3>
      <div style={{ height }}>
        <ResponsiveContainer width='100%' height='100%'>
          <PieChart>
            <Pie
              data={chartData}
              cx='50%'
              cy='50%'
              labelLine={showLabels}
              outerRadius={80}
              fill='#8884d8'
              dataKey='amount'
              nameKey='categoryName'
              label={showLabels ? renderCustomizedLabel : undefined}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[type][index % COLORS[type].length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatAmount(value as number), '금액']}
              itemSorter={(item) => -(item.value as number)}
            />
            {showLegend && (
              <Legend
                formatter={(value) => (
                  <span style={{ color: '#333', fontSize: '0.8rem' }}>{value}</span>
                )}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 카테고리 상세 목록 */}
      <div className='mt-4'>
        <div className='grid grid-cols-1 gap-2'>
          {chartData.map((item, index) => (
            <div key={index} className='flex justify-between items-center text-sm'>
              <div className='flex items-center'>
                <div
                  className='w-3 h-3 rounded-full mr-2'
                  style={{
                    backgroundColor: COLORS[type][index % COLORS[type].length],
                  }}
                ></div>
                <span className='truncate max-w-[150px]'>{item.categoryName}</span>
              </div>
              <div className='flex items-center'>
                <span className='font-medium'>{formatAmount(item.amount)}</span>
                <span className='ml-2 text-gray-500 w-16 text-right'>
                  {formatPercent(item.percentage || 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/DailyTransactionCalendar.tsx */
// src/components/dashboard/DailyTransactionCalendar.tsx
import React, { useMemo } from 'react';
import { format, getDaysInMonth, startOfMonth, isSameMonth, parseISO, isToday } from 'date-fns';
import type { TransactionData } from '@/types/transactionTypes';
import type { DailyAggregatedCategoryData, CategoryBreakdownItem } from '@/types/calendarTypes';
import { cn } from '@/lib/utils';
import { ArrowUpCircleIcon, ArrowDownCircleIcon } from '@heroicons/react/24/outline'; // 아이콘 추가

interface DailyTransactionCalendarProps {
  year: number;
  month: number; // 0 (January) to 11 (December)
  transactions: TransactionData[];
  onDateClick?: (date: Date, dataForDate: DailyAggregatedCategoryData | undefined) => void;
  // 활성 워크스페이스 ID는 부모에서 관리하므로, 이 컴포넌트는 데이터만 받습니다.
}

// 클라이언트 측에서 데이터를 집계하는 함수 (이전과 동일하게 유지 또는 필요시 최적화)
const aggregateTransactionsForCalendar = (
  transactions: TransactionData[],
  year: number,
  monthIndex: number
): DailyAggregatedCategoryData[] => {
  const dailyAggregates: { [dateStr: string]: DailyAggregatedCategoryData } = {};
  const monthStartDate = new Date(year, monthIndex, 1);
  const daysInCurrentMonth = getDaysInMonth(monthStartDate);

  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const currentDate = new Date(year, monthIndex, day);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    dailyAggregates[dateStr] = {
      date: dateStr,
      incomeItems: [],
      expenseItems: [],
      totalIncome: 0,
      totalExpense: 0,
    };
  }

  transactions.forEach((tx) => {
    const transactionDate = parseISO(tx.date);
    if (transactionDate.getFullYear() === year && transactionDate.getMonth() === monthIndex) {
      const dateStr = format(transactionDate, 'yyyy-MM-dd');
      const dayAggregate = dailyAggregates[dateStr];

      if (dayAggregate) {
        const item: CategoryBreakdownItem = {
          categoryId: tx.category.id,
          categoryName: tx.category.name,
          amount: tx.amount,
        };

        if (tx.type === 'income') {
          const existingIncomeItem = dayAggregate.incomeItems.find(
            (i) => i.categoryId === tx.category.id
          );
          if (existingIncomeItem) {
            existingIncomeItem.amount += tx.amount;
          } else {
            dayAggregate.incomeItems.push(item);
          }
          dayAggregate.totalIncome += tx.amount;
        } else if (tx.type === 'expense') {
          const existingExpenseItem = dayAggregate.expenseItems.find(
            (i) => i.categoryId === tx.category.id
          );
          if (existingExpenseItem) {
            existingExpenseItem.amount += tx.amount;
          } else {
            dayAggregate.expenseItems.push(item);
          }
          dayAggregate.totalExpense += tx.amount;
        }
      }
    }
  });
  return Object.values(dailyAggregates);
};

const CalendarDayCell: React.FC<{
  day: number;
  date: Date;
  dataForThisDay?: DailyAggregatedCategoryData;
  isCurrentMonth: boolean;
  isTodayDate: boolean;
  onClick?: () => void;
}> = ({ day, date, dataForThisDay, isCurrentMonth, isTodayDate, onClick }) => {
  const MAX_ITEMS_TO_SHOW = 2; // 각 타입별 최대 표시 항목 수

  const renderCategoryItems = (items: CategoryBreakdownItem[], type: 'income' | 'expense') => {
    if (!items || items.length === 0) return null;
    const colorClass = type === 'income' ? 'text-green-600' : 'text-red-600';
    const Icon = type === 'income' ? ArrowUpCircleIcon : ArrowDownCircleIcon;

    return (
      <div className='mb-1 last:mb-0'>
        {items.slice(0, MAX_ITEMS_TO_SHOW).map((item, idx) => (
          <div
            key={`${type}-${idx}`}
            className={`flex items-center justify-between text-xs ${colorClass}`}
          >
            <div className='flex items-center truncate mr-1'>
              <Icon className='h-3 w-3 mr-1 flex-shrink-0 opacity-70' />
              <span className='truncate' title={item.categoryName}>
                {item.categoryName}
              </span>
            </div>
            <span className='font-medium whitespace-nowrap'>{item.amount.toLocaleString()}</span>
          </div>
        ))}
        {items.length > MAX_ITEMS_TO_SHOW && (
          <div className={`text-xs text-center ${colorClass} opacity-80`}>
            + {items.length - MAX_ITEMS_TO_SHOW}건 더보기
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'bg-white p-2.5 flex flex-col min-h-[120px] sm:min-h-[140px] relative group transition-shadow duration-200 ease-in-out',
        isCurrentMonth ? 'hover:shadow-lg' : 'bg-slate-50 text-slate-400',
        onClick && isCurrentMonth && 'cursor-pointer',
        isTodayDate && 'ring-2 ring-blue-500 ring-inset z-10'
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'font-medium text-xs sm:text-sm',
          isTodayDate && 'text-blue-600 font-bold',
          !isCurrentMonth && 'text-slate-400'
        )}
      >
        {day}
      </div>
      {isCurrentMonth &&
      dataForThisDay &&
      (dataForThisDay.incomeItems.length > 0 || dataForThisDay.expenseItems.length > 0) ? (
        <div className='mt-1.5 text-xs flex-grow space-y-1 overflow-y-auto custom-scrollbar pr-1'>
          {renderCategoryItems(dataForThisDay.incomeItems, 'income')}
          {renderCategoryItems(dataForThisDay.expenseItems, 'expense')}
        </div>
      ) : isCurrentMonth ? (
        <div className='flex-grow flex items-center justify-center text-xs text-slate-400'>
          내역 없음
        </div>
      ) : null}
      {isCurrentMonth &&
        dataForThisDay &&
        (dataForThisDay.totalIncome > 0 || dataForThisDay.totalExpense > 0) && (
          <div className='mt-auto pt-1.5 border-t border-slate-200 text-xs font-semibold'>
            {dataForThisDay.totalIncome > 0 && (
              <p className='text-green-500 truncate'>
                총 수입: {dataForThisDay.totalIncome.toLocaleString()}
              </p>
            )}
            {dataForThisDay.totalExpense > 0 && (
              <p className='text-red-500 truncate'>
                총 지출: {dataForThisDay.totalExpense.toLocaleString()}
              </p>
            )}
          </div>
        )}
    </div>
  );
};

const DailyTransactionCalendar: React.FC<DailyTransactionCalendarProps> = ({
  year,
  month,
  transactions,
  onDateClick,
}) => {
  const monthStartDate = startOfMonth(new Date(year, month));
  const daysInMonthCount = getDaysInMonth(monthStartDate);
  const firstDayOfMonthIndex = monthStartDate.getDay();

  const dailyAggregatedData = useMemo(() => {
    return aggregateTransactionsForCalendar(transactions || [], year, month);
  }, [transactions, year, month]);

  const calendarDays: React.ReactElement[] = [];
  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

  // 이전 달의 날짜 채우기 (시작 부분)
  const prevMonthEndDate = new Date(year, month, 0); // 이전 달의 마지막 날
  const daysInPrevMonth = prevMonthEndDate.getDate();
  for (let i = 0; i < firstDayOfMonthIndex; i++) {
    const day = daysInPrevMonth - firstDayOfMonthIndex + 1 + i;
    calendarDays.push(
      <CalendarDayCell
        key={`empty-start-${i}`}
        day={day}
        date={new Date(prevMonthEndDate.getFullYear(), prevMonthEndDate.getMonth(), day)}
        isCurrentMonth={false}
        isTodayDate={false}
      />
    );
  }

  // 현재 달의 날짜 채우기
  for (let day = 1; day <= daysInMonthCount; day++) {
    const currentDate = new Date(year, month, day);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dataForThisDay = dailyAggregatedData.find((d) => d.date === dateStr);

    calendarDays.push(
      <CalendarDayCell
        key={dateStr}
        day={day}
        date={currentDate}
        dataForThisDay={dataForThisDay}
        isCurrentMonth={true}
        isTodayDate={isToday(currentDate)}
        onClick={() => onDateClick && onDateClick(currentDate, dataForThisDay)}
      />
    );
  }

  // 다음 달의 날짜 채우기 (끝 부분)
  const totalCellsRendered = firstDayOfMonthIndex + daysInMonthCount;
  const nextMonthDaysNeeded = (7 - (totalCellsRendered % 7)) % 7;
  const nextMonthStartDate = new Date(year, month + 1, 1);

  for (let i = 0; i < nextMonthDaysNeeded; i++) {
    const day = i + 1;
    calendarDays.push(
      <CalendarDayCell
        key={`empty-end-${i}`}
        day={day}
        date={new Date(nextMonthStartDate.getFullYear(), nextMonthStartDate.getMonth(), day)}
        isCurrentMonth={false}
        isTodayDate={false}
      />
    );
  }

  return (
    <div className='bg-white p-3 sm:p-4 rounded-xl shadow-xl border border-slate-200'>
      <div className='grid grid-cols-7 gap-px text-center text-xs sm:text-sm font-semibold text-slate-600 mb-2'>
        {daysOfWeek.map((dayName) => (
          <div key={dayName} className='py-2'>
            {dayName}
          </div>
        ))}
      </div>
      <div className='grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden'>
        {calendarDays}
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1; /* slate-300 */
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8; /* slate-400 */
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9; /* thumb track for firefox */
        }
      `}</style>
    </div>
  );
};

export default DailyTransactionCalendar;
```

```tsx
/* ./src/components/dashboard/FilterModal.tsx */
import { BUTTON_TEXTS } from '@/constants/uiTexts';
import { CategoryOption } from '@/types/categoryTypes';
import Button from '../ui/Button';
import Card from '../ui/Card';

// --- Filter Modal ---
const FilterModal = ({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  onApplyFilters,
  onResetFilters,
  categoryOptions,
}: {
  isOpen: boolean;
  onClose: () => void;
  filters: { startDate: string; endDate: string; type: string; categoryId: string };
  onFilterChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  categoryOptions: CategoryOption[] | undefined;
}) => {
  if (!isOpen) return null;

  const availableCategories =
    categoryOptions?.filter((cat) => !filters.type || cat.type === filters.type) || [];

  return (
    <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
      <Card title='거래내역 필터' className='w-full max-w-md bg-white rounded-xl shadow-2xl'>
        <div className='space-y-4'>
          <div>
            <label htmlFor='filter-startDate' className='block text-sm font-medium text-gray-700'>
              시작일
            </label>
            <input
              type='date'
              name='startDate'
              id='filter-startDate'
              value={filters.startDate}
              onChange={onFilterChange}
              className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2'
            />
          </div>
          <div>
            <label htmlFor='filter-endDate' className='block text-sm font-medium text-gray-700'>
              종료일
            </label>
            <input
              type='date'
              name='endDate'
              id='filter-endDate'
              value={filters.endDate}
              onChange={onFilterChange}
              className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2'
            />
          </div>
          <div>
            <label htmlFor='filter-type' className='block text-sm font-medium text-gray-700'>
              거래 유형
            </label>
            <select
              name='type'
              id='filter-type'
              value={filters.type}
              onChange={onFilterChange}
              className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2'
            >
              <option value=''>전체</option>
              <option value='income'>수입</option>
              <option value='expense'>지출</option>
            </select>
          </div>
          <div>
            <label htmlFor='filter-categoryId' className='block text-sm font-medium text-gray-700'>
              카테고리
            </label>
            <select
              name='categoryId'
              id='filter-categoryId'
              value={filters.categoryId}
              onChange={onFilterChange}
              className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2'
              disabled={availableCategories.length === 0}
            >
              <option value=''>전체</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className='mt-6 flex justify-end gap-3'>
          <Button variant='ghost' onClick={onClose}>
            {BUTTON_TEXTS.cancel}
          </Button>
          <Button
            variant='secondary'
            onClick={() => {
              onResetFilters();
              onClose();
            }}
          >
            {BUTTON_TEXTS.resetFilter}
          </Button>
          <Button
            variant='primary'
            onClick={() => {
              onApplyFilters();
              onClose();
            }}
          >
            {BUTTON_TEXTS.apply}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default FilterModal;
```

```tsx
/* ./src/components/dashboard/IncomeSourceChart.tsx */
// src/components/dashboard/IncomeSourceChart.tsx

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

type IncomeSourceItem = {
  categoryId: number;
  name: string;
  value: number;
  percentage: number;
};

type IncomeTrendItem = {
  month: string;
  income: number;
};

type IncomeSourceChartProps = {
  data: {
    totalIncome: number;
    incomeSources: IncomeSourceItem[];
    trendData: IncomeTrendItem[];
    diversityScore: number;
    incomeSourceCount: number;
  };
  title?: string;
};

export default function IncomeSourceChart({ data, title = '수입원 분석' }: IncomeSourceChartProps) {
  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0EA5E9'];

  // 금액 포맷팅
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  // 월 포맷팅 (YYYY-MM -> MM월)
  const formatMonth = (month: string) => {
    const parts = month.split('-');
    return `${parseInt(parts[1])}월`;
  };

  // 데이터가 없는 경우 표시할 내용
  if (!data || !data.incomeSources || data.incomeSources.length === 0) {
    return (
      <div className='bg-white p-4 rounded-lg shadow h-full'>
        <h3 className='text-lg font-semibold mb-4'>{title}</h3>
        <div className='h-64 flex items-center justify-center bg-gray-50 rounded-md'>
          <p className='text-gray-400'>수입 데이터가 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white p-4 rounded-lg shadow h-full'>
      <h3 className='text-lg font-semibold mb-2'>{title}</h3>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4'>
        <div className='p-2 bg-gray-50 rounded'>
          <h4 className='text-xs font-medium text-gray-500'>총 수입</h4>
          <p className='text-lg font-semibold text-green-600'>{formatAmount(data.totalIncome)}</p>
        </div>
        <div className='p-2 bg-gray-50 rounded'>
          <h4 className='text-xs font-medium text-gray-500'>수입원 수</h4>
          <p className='text-lg font-semibold text-blue-600'>{data.incomeSourceCount}개</p>
        </div>
      </div>

      {/* 파이 차트 */}
      <div className='h-[180px] mb-4'>
        <ResponsiveContainer width='100%' height='100%'>
          <PieChart>
            <Pie
              data={data.incomeSources}
              cx='50%'
              cy='50%'
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey='value'
              nameKey='name'
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.incomeSources.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 수입 트렌드 차트 (있는 경우) */}
      {data.trendData && data.trendData.length > 0 && (
        <div className='mt-2'>
          <h4 className='text-sm font-medium text-gray-700 mb-2'>최근 수입 트렌드</h4>
          <div className='h-[100px]'>
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart data={data.trendData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray='3 3' vertical={false} />
                <XAxis dataKey='month' tickFormatter={formatMonth} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  formatter={(value) => formatAmount(value as number)}
                  labelFormatter={(label) => `${formatMonth(label)}의 수입`}
                />
                <Bar dataKey='income' name='수입' fill='#10B981' />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 수입원 다양화 점수 */}
      <div className='mt-4'>
        <h4 className='text-sm font-medium text-gray-700 mb-1'>수입원 다양화 점수</h4>
        <div className='w-full bg-gray-200 rounded-full h-2.5'>
          <div
            className={`h-2.5 rounded-full ${
              data.diversityScore < 30
                ? 'bg-red-500'
                : data.diversityScore < 60
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${data.diversityScore}%` }}
          ></div>
        </div>
        <p className='text-xs text-gray-500 mt-1'>
          {data.diversityScore < 30
            ? '단일 수입원에 의존하고 있습니다. 수입원 다양화를 고려해보세요.'
            : data.diversityScore < 60
            ? '몇 개의 수입원이 있지만, 더 다양화하면 좋을 것 같습니다.'
            : `${data.incomeSourceCount}개의 수입원이 있습니다. 좋은 다각화 상태입니다.`}
        </p>
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/IncomeSourceSkeleton.tsx */
// src/components/dashboard/IncomeSourceSkeleton.tsx

import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function IncomeSourceSkeleton() {
  return (
    <div className="bg-white p-4 rounded-lg shadow h-full">
      {/* 제목 영역 */}
      <Skeleton className="h-6 w-32 mb-4" />

      {/* KPI 요약 카드 영역 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>

      {/* 파이 차트 영역 */}
      <Skeleton className="h-[180px] w-full mb-4" />

      {/* 트렌드 차트 영역 */}
      <div className="mt-2">
        <Skeleton className="h-4 w-36 mb-2" />
        <Skeleton className="h-[100px] w-full mb-4" />
      </div>

      {/* 다양화 점수 영역 */}
      <div className="mt-4">
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-2.5 w-full mb-1" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/InsightCard.tsx */
// src/components/dashboard/InsightCard.tsx
import React from "react";
import { Insight, InsightType } from "@/types/insightTypes";
import {
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";
import Card from "@/components/ui/Card"; // 기존 Card 컴포넌트 활용
import { KPI_CARD_COLOR_CLASSES } from "@/constants/chartColors"; // 색상 상수 활용

interface InsightCardProps {
  insight: Insight;
  onDismiss?: (insightId: string) => void; // 나중에 숨기기 기능 추가 시 사용
}

const InsightCard: React.FC<InsightCardProps> = ({ insight, onDismiss }) => {
  const { id, type, severity, title, message } = insight;

  const getSeverityStyles = () => {
    switch (severity) {
      case "critical":
        return {
          icon: ShieldExclamationIcon,
          borderColor: KPI_CARD_COLOR_CLASSES.red.border,
          bgColor: KPI_CARD_COLOR_CLASSES.red.bg,
          textColor: KPI_CARD_COLOR_CLASSES.red.text,
          iconColor: KPI_CARD_COLOR_CLASSES.red.text,
        };
      case "warning":
        return {
          icon: ExclamationTriangleIcon,
          borderColor: KPI_CARD_COLOR_CLASSES.yellow.border,
          bgColor: KPI_CARD_COLOR_CLASSES.yellow.bg,
          textColor: KPI_CARD_COLOR_CLASSES.yellow.text,
          iconColor: KPI_CARD_COLOR_CLASSES.yellow.text,
        };
      case "info":
      default:
        return {
          icon: InformationCircleIcon,
          borderColor: KPI_CARD_COLOR_CLASSES.blue.border,
          bgColor: KPI_CARD_COLOR_CLASSES.blue.bg,
          textColor: KPI_CARD_COLOR_CLASSES.blue.text,
          iconColor: KPI_CARD_COLOR_CLASSES.blue.text,
        };
    }
  };

  // 인사이트 유형별 아이콘 매핑 (선택적)
  const getTypeSpecificIcon = () => {
    switch (type) {
      case InsightType.CATEGORY_SPENDING_INCREASE:
        return ArrowTrendingUpIcon;
      case InsightType.CATEGORY_SPENDING_DECREASE:
        return ArrowTrendingDownIcon;
      case InsightType.BUDGET_OVERRUN_WARNING:
      case InsightType.BUDGET_NEARING_LIMIT:
        return BanknotesIcon; // 예시 아이콘
      // 다른 타입에 대한 아이콘 추가
      default:
        return getSeverityStyles().icon;
    }
  };

  const styles = getSeverityStyles();
  const TypeIcon = getTypeSpecificIcon();

  const content = (
    <Card
      className={`border-l-4 ${styles.borderColor} ${styles.bgColor} hover:shadow-md transition-shadow duration-200`}
    >
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 pt-0.5`}>
          <TypeIcon
            className={`h-6 w-6 ${styles.iconColor}`}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${styles.textColor}`}>{title}</p>
          <p className="text-sm text-gray-600 mt-1">{message}</p>
          {/* TODO: 인사이트 상세 페이지 링크 추가 시 사용 */}
          {/* {detailsLink && (
            <p className="mt-2 text-xs">
              <span className="text-blue-600 hover:text-blue-800 hover:underline">
                자세히 보기 &rarr;
              </span>
            </p>
          )} */}
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(id)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="인사이트 숨기기"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </Card>
  );

  // detailsLink가 있을 경우 Link로 감싸고, 없으면 div로 감쌉니다.
  // return detailsLink ? (
  //   <Link href={detailsLink} passHref style={{ display: "block" }}>
  //     <div className="block cursor-pointer no-underline">{content}</div>
  //   </Link>
  // ) : (
  //   <div>{content}</div>
  // );
  return <div>{content}</div>;
};

export default InsightCard;
```

```tsx
/* ./src/components/dashboard/InsightSkeleton.tsx */
// src/components/dashboard/skeletons/InsightSkeleton.tsx
import React from "react";
import Skeleton from "@/components/ui/Skeleton"; // 기존 Skeleton 컴포넌트 활용
import Card from "@/components/ui/Card";

interface InsightSkeletonProps {
  count?: number; // 한 번에 보여줄 스켈레톤 카드 개수
}

const InsightSkeletonCard: React.FC = () => {
  return (
    <Card className="border-l-4 border-gray-200 bg-gray-50">
      <div className="flex items-start space-x-3">
        <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/4 mt-1" />
        </div>
      </div>
    </Card>
  );
};

const InsightSkeleton: React.FC<InsightSkeletonProps> = ({ count = 1 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <InsightSkeletonCard key={index} />
      ))}
    </div>
  );
};

export default InsightSkeleton;
```

```tsx
/* ./src/components/dashboard/InsightsSection.tsx */
// src/components/dashboard/InsightsSection.tsx
import React from "react";
import { Insight } from "@/types/insightTypes";
import InsightCard from "./InsightCard";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card"; // 기본 Card 컴포넌트 사용
import InsightSkeleton from "./InsightSkeleton";

interface InsightsSectionProps {
  insights: Insight[] | undefined;
  isLoading: boolean;
  error: Error | null; // SWR 에러 타입 또는 Error 객체
  currentMonth: string; // 인사이트가 없을 때 안내 메시지에 활용
  onDismissInsight?: (insightId: string) => void; // 인사이트 숨기기 기능 (선택적)
}

const InsightsSection: React.FC<InsightsSectionProps> = ({
  insights,
  isLoading,
  error,
  currentMonth,
  onDismissInsight,
}) => {
  if (isLoading) {
    return <InsightSkeleton count={2} />; // 로딩 시 2개의 스켈레톤 카드 표시 (조절 가능)
  }

  if (error) {
    return (
      <Alert type="error" className="mb-6">
        금융 인사이트를 불러오는 중 오류가 발생했습니다:{" "}
        {error.message || "알 수 없는 오류"}
      </Alert>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <Card className="mb-6">
        <div className="text-center py-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-12 h-12 mx-auto text-gray-400 mb-3"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 0-11.25a6.01 6.01 0 0 0 0 11.25Zm0 0H12M12 12.75a2.25 2.25 0 0 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z"
            />
          </svg>
          <p className="text-gray-600 font-medium">
            {currentMonth}에 대한 새로운 금융 인사이트가 없습니다.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            데이터가 충분히 쌓이면 유용한 정보를 알려드릴게요!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {insights.map((insight) => (
        <InsightCard
          key={insight.id}
          insight={insight}
          onDismiss={onDismissInsight}
        />
      ))}
    </div>
  );
};

export default InsightsSection;
```

```tsx
/* ./src/components/dashboard/KpiCard.tsx */
import React from 'react';
import { formatCurrencyKrwInTenThousand, formatPercent, formatNumber } from '@/lib/formatters';
import { ValueType } from '@/types/commonTypes';
import { KPI_CARD_COLOR_CLASSES } from '@/constants/chartColors';
import Card from '../ui/Card';

const KpiCardRedesign = ({
  title,
  value,
  change,
  changePercent,
  trendData,
  icon: Icon,
  color = 'blue',
  valueType = 'currency',
  valueNature = 'positiveIsGood',
  isLoading = false,
}: {
  title: string;
  value: number;
  change?: number;
  changePercent?: number;
  trendData?: { date: string; value: number }[];
  icon?: React.ElementType;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
  valueType?: ValueType;
  valueNature?: 'positiveIsGood' | 'negativeIsGood';
  isLoading?: boolean;
}) => {
  if (isLoading) {
    return <KpiCardSkeleton />;
  }

  const currentColors = KPI_CARD_COLOR_CLASSES[color] || KPI_CARD_COLOR_CLASSES.blue;

  const formattedValue =
    valueType === 'currency'
      ? formatCurrencyKrwInTenThousand(value)
      : valueType === 'percent'
      ? formatPercent(value)
      : formatNumber(value);

  const formattedChangeValuePart = (val?: number) => {
    if (val === undefined) return '';
    return valueType === 'currency'
      ? formatCurrencyKrwInTenThousand(Math.abs(val))
      : formatNumber(Math.abs(val));
  };

  let changeSign = '';
  if (change !== undefined && change !== 0) {
    changeSign = change > 0 ? '+' : '-';
  }
  const formattedChange =
    change !== undefined && change !== 0
      ? `${changeSign}${formattedChangeValuePart(change)}`
      : change === 0 && valueType === 'currency'
      ? formatCurrencyKrwInTenThousand(0)
      : change === 0
      ? '0'
      : '';

  const getChangeTextColor = () => {
    if (change === undefined || change === null || change === 0) return 'text-gray-500';
    if (valueNature === 'positiveIsGood') {
      return change > 0 ? 'text-green-600' : 'text-red-600';
    } else {
      return change > 0 ? 'text-red-600' : 'text-green-600';
    }
  };

  const normalizeTrendData = (data?: { date: string; value: number }[]) => {
    if (!data || data.length === 0) return [];
    const values = data.map((p) => p.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;

    if (range === 0 && data.length > 0) {
      return data.map((_, i) => ({
        x: data.length === 1 ? 50 : (i / (data.length - 1)) * 100,
        y: 10,
      }));
    }
    if (range === 0 && data.length === 0) return [];

    return data.map((d, i) => ({
      x: data.length === 1 ? 50 : (i / (data.length - 1)) * 100,
      y: 20 - ((d.value - minValue) / range) * 15,
    }));
  };

  const normalizedTrendPoints = normalizeTrendData(trendData);

  return (
    <Card
      className={`border-l-4 ${currentColors.border} ${currentColors.bg} flex flex-col justify-between h-full`}
    >
      <div>
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <p className={`text-sm font-medium text-gray-500 truncate`}>{title}</p>
            <p className={`text-2xl sm:text-3xl font-bold ${currentColors.text} mt-1`}>
              {formattedValue}
            </p>
            {(formattedChange || (changePercent !== undefined && changePercent !== null)) && (
              <p className={`text-xs mt-1 ${getChangeTextColor()}`}>
                {formattedChange}
                {changePercent !== undefined &&
                  changePercent !== null &&
                  ` (${changePercent > 0 ? '+' : ''}${formatPercent(changePercent)})`}
              </p>
            )}
          </div>
          {Icon && <Icon className={`h-7 w-7 sm:h-8 sm:w-8 ${currentColors.text} opacity-60`} />}
        </div>
      </div>
      {normalizedTrendPoints.length > 1 && (
        <div className='mt-3 h-10 w-full'>
          <svg width='100%' height='100%' viewBox='0 0 100 25' preserveAspectRatio='none'>
            <polyline
              fill='none'
              stroke={currentColors.text}
              strokeOpacity='0.7'
              strokeWidth='1.5'
              points={normalizedTrendPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          </svg>
        </div>
      )}
    </Card>
  );
};

const KpiCardSkeleton = () => (
  <Card className='border-l-4 border-gray-200 bg-gray-50 flex flex-col justify-between h-full animate-pulse'>
    <div>
      <div className='flex items-center justify-between'>
        <div className='flex-1'>
          <div className='h-4 bg-gray-300 rounded w-3/4 mb-2'></div>
          <div className='h-8 bg-gray-300 rounded w-1/2 mb-1'></div>
          <div className='h-3 bg-gray-300 rounded w-1/4'></div>
        </div>
        <div className='h-8 w-8 bg-gray-300 rounded-full'></div>
      </div>
    </div>
    <div className='mt-3 h-10 w-full bg-gray-200 rounded'></div>
  </Card>
);

export default KpiCardRedesign;
```

```tsx
/* ./src/components/dashboard/SpendingPatternChart.tsx */
/* ./src/components/dashboard/SpendingPatternChart.tsx */

import React from 'react';
import {
  ComposedChart, // BarChart에서 ComposedChart로 변경
  Bar,
  Line, // Line 추가
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type DayPatternItem = {
  day: string;
  amount: number;
  count: number;
  avgAmount: number;
};

type TopCategoryItem = {
  categoryId: number;
  name: string;
  amount: number;
};

type SpendingPatternChartProps = {
  data: {
    totalExpense: number;
    averageDailyExpense: number;
    dayPattern: DayPatternItem[];
    topCategories: TopCategoryItem[];
    transactionCount: number;
  };
  title?: string;
};

const SpendingPatternChart = ({ data, title = '소비 패턴 분석' }: SpendingPatternChartProps) => {
  // 요일 이름 변환
  const formatDay = (day: string) => {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayIndex = parseInt(day, 10);
    return dayNames[dayIndex];
  };

  // 금액 포맷팅
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  // 횟수 포맷팅 (Tooltip용)
  const formatCount = (count: number) => {
    return `${count}회`;
  };

  // 데이터가 없는 경우 표시할 내용
  if (!data || !data.dayPattern || data.dayPattern.length === 0) {
    return (
      <div className='bg-white p-4 rounded-lg shadow'>
        <h3 className='text-lg font-semibold mb-4'>{title}</h3>
        <div className='h-64 flex items-center justify-center bg-gray-50 rounded-md'>
          <p className='text-gray-400'>데이터가 없습니다</p>
        </div>
      </div>
    );
  }

  // 가장 지출이 많은 요일 찾기
  const maxSpendingDay = [...data.dayPattern].sort((a, b) => b.amount - a.amount)[0];
  const mostFrequentDay = [...data.dayPattern].sort((a, b) => b.count - a.count)[0];

  return (
    <div className='bg-white p-4 rounded-lg shadow h-full'>
      <h3 className='text-lg font-semibold mb-4'>{title}</h3>

      {/* 차트 영역 */}
      <div className='h-[200px] mb-4'>
        <ResponsiveContainer width='100%' height='100%'>
          <ComposedChart // BarChart에서 ComposedChart로 변경
            data={data.dayPattern}
            margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='day' tickFormatter={formatDay} />
            <YAxis
              yAxisId='left'
              orientation='left'
              stroke='#EF4444'
              tickFormatter={(value) => `${value / 1000}K`}
            />{' '}
            {/* 금액 축 */}
            <YAxis yAxisId='right' orientation='right' stroke='#3B82F6' /> {/* 횟수 축 */}
            <Tooltip
              formatter={(value, name) => {
                if (name === '지출 금액') return formatAmount(value as number);
                if (name === '지출 횟수') return formatCount(value as number); // 횟수 포맷팅 적용
                return value;
              }}
              labelFormatter={formatDay}
            />
            <Legend />
            <Bar
              yAxisId='left'
              name='지출 금액'
              dataKey='amount'
              fill='#EF4444' // 지출 금액은 빨간색 계열 바
              radius={[4, 4, 0, 0]} // 바 상단 모서리 둥글게 (선택 사항)
            />
            <Line // 지출 횟수를 Line으로 변경
              yAxisId='right'
              type='monotone' // 라인 타입 (예: monotone, linear)
              name='지출 횟수'
              dataKey='count'
              stroke='#3B82F6' // 지출 횟수는 파란색 계열 라인
              strokeWidth={2} // 라인 두께
              dot={{ r: 3 }} // 데이터 포인트 점 표시
              activeDot={{ r: 5 }} // 활성 데이터 포인트 점 표시
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 분석 결과 영역 */}
      <div className='space-y-2'>
        <div className='grid grid-cols-2 gap-2'>
          <div className='p-2 bg-gray-50 rounded'>
            <h4 className='text-sm font-medium text-gray-700'>총 지출 금액</h4>
            <p className='text-base font-semibold text-red-600'>
              {formatAmount(data.totalExpense)}
            </p>
          </div>
          <div className='p-2 bg-gray-50 rounded'>
            <h4 className='text-sm font-medium text-gray-700'>일평균 지출</h4>
            <p className='text-base font-semibold text-blue-600'>
              {formatAmount(data.averageDailyExpense)}
            </p>
          </div>
        </div>

        <div className='mt-3'>
          <h4 className='text-sm font-medium text-gray-700 mb-1'>패턴 분석</h4>
          <ul className='text-sm text-gray-600 space-y-1'>
            <li>
              최다 지출 요일:{' '}
              <span className='font-medium text-red-600'>{formatDay(maxSpendingDay.day)}요일</span>{' '}
              ({formatAmount(maxSpendingDay.amount)})
            </li>
            <li>
              최다 지출 빈도:{' '}
              <span className='font-medium text-blue-600'>
                {formatDay(mostFrequentDay.day)}요일
              </span>{' '}
              ({mostFrequentDay.count}회)
            </li>
          </ul>
        </div>

        {/* 상위 카테고리 영역 */}
        {data.topCategories && data.topCategories.length > 0 && (
          <div className='mt-3'>
            <h4 className='text-sm font-medium text-gray-700 mb-1'>주요 지출 카테고리</h4>
            <div className='space-y-1 max-h-[80px] overflow-y-auto'>
              {data.topCategories.map((category) => (
                <div
                  key={category.categoryId}
                  className='flex justify-between items-center text-xs'
                >
                  <span className='text-gray-700'>{category.name}</span>
                  <span className='font-medium'>{formatAmount(category.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(SpendingPatternChart);
```

```tsx
/* ./src/components/dashboard/SpendingPatternSkeleton.tsx */
// src/components/dashboard/SpendingPatternSkeleton.tsx

import React from "react";
import Skeleton from "@/components/ui/Skeleton";

export default function SpendingPatternSkeleton() {
  return (
    <div className="bg-white p-4 rounded-lg shadow h-full">
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* 차트 영역 */}
      <Skeleton className="h-[200px] w-full mb-4" />

      {/* 요약 카드 영역 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>

      {/* 패턴 분석 영역 */}
      <Skeleton className="h-4 w-40 mb-2" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/TransactionTable.tsx */
// src/components/dashboard/TransactionTable.tsx
import React, { useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { TransactionData } from "@/types/transactionTypes";
import Button from "../ui/Button";

type TransactionTableProps = {
  transactions: TransactionData[];
  title?: string;
  showActions?: boolean;
  onEdit?: (transaction: TransactionData) => void;
  onDelete?: (id: number) => void;
  compact?: boolean;
  maxHeight?: string;
};

export default function TransactionTable({
  transactions,
  title = "거래 내역",
  showActions = true,
  onEdit,
  onDelete,
  compact = false,
  maxHeight,
}: TransactionTableProps) {
  const [sortBy, setSortBy] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 정렬 함수
  const sortedTransactions = [...transactions].sort((a, b) => {
    let valA: number | string | boolean;
    let valB: number | string | boolean;

    switch (sortBy) {
      case "date":
        valA = new Date(a.date).getTime();
        valB = new Date(b.date).getTime();
        break;
      case "amount":
        valA = a.amount;
        valB = b.amount;
        break;
      case "category":
        valA = a.category.name;
        valB = b.category.name;
        break;
      case "isInstallment":
        valA = a.isInstallment ? 1 : 0;
        valB = b.isInstallment ? 1 : 0;
        break;
      case "cardIssuer": // <<-- 카드사 정렬
        valA = a.installmentCardIssuer || "";
        valB = b.installmentCardIssuer || "";
        break;
      case "estimatedFee": // <<-- 예상 수수료 정렬
        valA = a.estimatedInstallmentFee || 0;
        valB = b.estimatedInstallmentFee || 0;
        break;
      default:
        return 0;
    }

    // 문자열 비교는 localeCompare 사용
    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder === "asc"
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    // 숫자 비교
    if (typeof valA === "number" && typeof valB === "number") {
      return sortOrder === "asc" ? valA - valB : valB - valA;
    }
    return 0;
  });

  // 정렬 핸들러
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  // 헤더 렌더링 함수
  const renderHeader = (text: string, column: string) => {
    return (
      <th
        onClick={() => handleSort(column)}
        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
      >
        <div className="flex items-center">
          {text}
          {sortBy === column && (
            <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>
          )}
        </div>
      </th>
    );
  };

  // 금액 포맷팅 함수
  const formatAmount = (amount: number, type: string) => {
    const formattedAmount = new Intl.NumberFormat("ko-KR").format(amount);
    return `${type === "income" ? "+" : "-"} ${formattedAmount}원`;
  };

  // 날짜 포맷팅 함수
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return compact
      ? format(date, "MM.dd", { locale: ko })
      : format(date, "yyyy년 MM월 dd일", { locale: ko });
  };

  const getInstallmentDisplayInfo = (transaction: TransactionData): string => {
    if (transaction.isInstallment) {
      const cardInfo = transaction.installmentCardIssuer
        ? `(${transaction.installmentCardIssuer})`
        : "";
      if (
        transaction.originalTransactionId &&
        transaction.currentInstallmentNumber &&
        transaction.installmentMonths
      ) {
        return ` (${transaction.currentInstallmentNumber}/${transaction.installmentMonths}회)${cardInfo}`;
      } else if (
        transaction.installmentMonths &&
        transaction.installmentMonths > 1 &&
        !transaction.originalTransactionId
      ) {
        return ` (${transaction.installmentMonths}개월 할부)${cardInfo}`;
      }
    }
    return "";
  };

  const formatEstimatedFee = (fee?: number | null) => {
    if (fee === null || fee === undefined || fee === 0) return "-";
    return `${new Intl.NumberFormat("ko-KR").format(fee)}원`;
  };

  // 테이블 스타일
  const tableStyle = {
    maxHeight: maxHeight ? maxHeight : "auto",
    overflowY: maxHeight ? "auto" : "visible",
  } as React.CSSProperties;

  // 데이터가 없는 경우
  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="p-4">
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600">등록된 내역이 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="text-sm text-gray-500">총 {transactions.length}건</div>
      </div>

      <div style={tableStyle} className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {renderHeader("날짜", "date")}
              {renderHeader("카테고리", "category")}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                내용
              </th>
              {renderHeader("금액", "amount")}
              {renderHeader("카드사", "cardIssuer")}
              {renderHeader("수수료(예상/월)", "estimatedFee")}
              {showActions && (
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  관리
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTransactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-gray-50">
                {/* 날짜, 카테고리 */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(transaction.date)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {transaction.category.name}
                </td>
                {/* 내용 + 할부정보 */}
                <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-[150px]">
                  {transaction.description || "-"}
                  <span className="text-xs text-gray-500 ml-1">
                    {getInstallmentDisplayInfo(transaction)}
                  </span>
                </td>
                {/* 금액 */}
                <td
                  className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${
                    transaction.type === "income"
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatAmount(transaction.amount, transaction.type)}
                  {/* 할부 원거래 총액 표시 (선택적) */}
                  {transaction.isInstallment &&
                    !transaction.originalTransactionId &&
                    transaction.totalInstallmentAmount &&
                    transaction.totalInstallmentAmount !==
                      transaction.amount && (
                      <span className="block text-xs text-gray-400">
                        (총액:{" "}
                        {new Intl.NumberFormat("ko-KR").format(
                          transaction.totalInstallmentAmount
                        )}
                        원)
                      </span>
                    )}
                </td>
                {/* 카드사 표시 */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {transaction.isInstallment
                    ? transaction.installmentCardIssuer || "-"
                    : "-"}
                </td>
                {/* 수수료 표시 로직 수정 */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {transaction.isInstallment
                    ? transaction.originalTransactionId
                      ? formatEstimatedFee(transaction.monthlyInstallmentFee) // 개별 할부금: 월별 수수료
                      : formatEstimatedFee(transaction.estimatedInstallmentFee) // 원거래: 총 예상 수수료
                    : "-"}
                </td>
                {/* 관리 버튼 */}
                {showActions && (
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      {onEdit && (
                        <Button
                          onClick={() => onEdit(transaction)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          수정
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          onClick={() => onDelete(transaction.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          삭제
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/TrendChart.tsx */
import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart, // 혼합 차트를 위한 ComposedChart 임포트
  ReferenceLine,
} from 'recharts';
import { NameType, Payload, ValueType } from 'recharts/types/component/DefaultTooltipContent';

type TrendChartProps = {
  data: Array<unknown>; // 다양한 형태의 데이터를 받을 수 있도록 unknown으로 설정 (구체적인 타입 정의 권장)
  type: 'line' | 'bar' | 'area' | 'composed'; // 차트 유형
  xDataKey: string; // X축에 해당하는 데이터 키
  series: Array<{
    dataKey: string; // Y축에 해당하는 데이터 키
    name: string; // 범례에 표시될 시리즈 이름
    color: string; // 시리즈 색상
    type?: 'line' | 'bar' | 'area'; // 혼합 차트 사용 시 각 시리즈의 타입 지정
  }>;
  title?: string; // 차트 제목
  height?: number | string; // 차트 높이
  showLegend?: boolean; // 범례 표시 여부
  referenceLine?: number; // 기준선 y 값
  showPercent?: boolean; // Y축 값을 퍼센트로 표시할지 여부 (현재는 금액 포맷팅만 구현됨)
  stack?: boolean; // 막대 또는 영역 차트에서 누적 여부
};

export default function TrendChart({
  data,
  type = 'line', // 기본 차트 유형
  xDataKey,
  series,
  title,
  height = 300, // 기본 높이
  showLegend = true,
  referenceLine,
  showPercent = false, // 기본적으로 금액으로 표시
  stack = false,
}: TrendChartProps) {
  // X축 레이블 포맷팅 함수 (날짜 형식에 따라 MM/DD 또는 YYYY.MM으로 변경)
  const formatXAxis = (value: string) => {
    if (!value) return '';

    if (value.length === 10 && value.includes('-')) {
      // YYYY-MM-DD 형식
      const parts = value.split('-');
      return `${parts[1]}/${parts[2]}`; // MM/DD
    } else if (value.length === 7 && value.includes('-')) {
      // YYYY-MM 형식
      const parts = value.split('-');
      return `${parts[0]}.${parts[1]}`; // YYYY.MM
    }
    // 기타 형식은 그대로 반환 (예: '1일', '2일' 등)
    return value;
  };

  // Y축 및 툴팁 값 포맷팅 함수 (통화 또는 퍼센트)
  const formatValue = (value: number) => {
    if (showPercent) {
      return `${value.toFixed(1)}%`;
    }
    // 금액을 K (천), M (백만) 단위로 축약 또는 전체 통화로 표시
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    // 기본 전체 통화 형식 (원화)
    return new Intl.NumberFormat('ko-KR', {
      // style: "currency", // '원' 기호가 중복될 수 있어 제거 또는 조건부 사용
      // currency: "KRW",
    }).format(value);
  };

  const tooltipFormatter = (
    value: ValueType,
    name: NameType,
    props: Payload<ValueType, NameType>
  ) => {
    const originalValue = props.payload[props.dataKey as string]; // 원본 값 접근
    const formattedVal = new Intl.NumberFormat('ko-KR').format(originalValue) + '원';
    return [formattedVal, name];
  };

  // 차트 렌더링 로직
  const renderChart = () => {
    const chartProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }, // 여백 조정
    };

    const commonElements = (
      <>
        <CartesianGrid strokeDasharray='3 3' stroke='#e0e0e0' />
        <XAxis
          dataKey={xDataKey}
          tickFormatter={formatXAxis}
          tick={{ fontSize: 12, fill: '#666' }}
          axisLine={{ stroke: '#ccc' }}
          tickLine={{ stroke: '#ccc' }}
        />
        <YAxis
          tickFormatter={formatValue} // 축약된 금액 포맷 사용
          tick={{ fontSize: 12, fill: '#666' }}
          axisLine={{ stroke: '#ccc' }}
          tickLine={{ stroke: '#ccc' }}
          // domain={['auto', 'auto']} // 데이터 범위에 따라 자동으로 도메인 설정
        />
        <Tooltip
          formatter={(value, name, props) => tooltipFormatter(value, name, props)} // 상세 금액 포맷 사용
          labelFormatter={(label) => formatXAxis(label)}
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '4px',
            borderColor: '#ccc',
          }}
          itemStyle={{ fontSize: '12px' }}
          cursor={{ fill: 'rgba(204, 204, 204, 0.2)' }}
        />
        {showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />}
        {referenceLine !== undefined && (
          <ReferenceLine
            y={referenceLine}
            stroke='#999' // 기준선 색상 변경
            strokeDasharray='4 4' // 기준선 스타일 변경
            label={{
              value: ` 기준: ${formatValue(referenceLine)}`,
              position: 'insideTopRight',
              fill: '#999',
              fontSize: 10,
            }}
          />
        )}
      </>
    );

    if (type === 'line') {
      return (
        <LineChart {...chartProps}>
          {commonElements}
          {series.map((s, index) => (
            <Line
              key={index}
              type='monotone'
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              activeDot={{ r: 6, strokeWidth: 2, fill: s.color }}
              dot={{ r: 3, strokeWidth: 1 }}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      );
    } else if (type === 'bar') {
      return (
        <BarChart {...chartProps} barGap={stack ? 0 : 4} barCategoryGap={stack ? '20%' : '10%'}>
          {commonElements}
          {series.map((s, index) => (
            <Bar
              key={index}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color}
              radius={[4, 4, 0, 0]} // 막대 상단 모서리 둥글게
              stackId={stack ? 'a' : undefined}
            />
          ))}
        </BarChart>
      );
    } else if (type === 'area') {
      return (
        <AreaChart {...chartProps}>
          {commonElements}
          {series.map((s, index) => (
            <Area
              key={index}
              type='monotone'
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color}
              stroke={s.color}
              fillOpacity={0.4} // 투명도 조절
              strokeWidth={2}
              activeDot={{ r: 6, strokeWidth: 2, fill: s.color }}
              stackId={stack ? 'a' : undefined}
            />
          ))}
        </AreaChart>
      );
    } else if (type === 'composed') {
      return (
        <ComposedChart {...chartProps}>
          {commonElements}
          {series.map((s, index) => {
            if (s.type === 'bar') {
              return (
                <Bar
                  key={`${s.dataKey}-${index}-bar`}
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={s.color}
                  radius={[4, 4, 0, 0]}
                  stackId={stack ? 'a' : undefined}
                  // barSize={20} // 필요한 경우 막대 너비 고정
                />
              );
            } else if (s.type === 'area') {
              return (
                <Area
                  key={`${s.dataKey}-${index}-area`}
                  type='monotone'
                  dataKey={s.dataKey}
                  name={s.name}
                  fill={s.color}
                  stroke={s.color}
                  fillOpacity={0.4}
                  strokeWidth={2}
                  activeDot={{ r: 6, strokeWidth: 2, fill: s.color }}
                  stackId={stack ? 'a' : undefined}
                />
              );
            } else {
              // 기본값은 line (s.type === "line" 또는 undefined)
              return (
                <Line
                  key={`${s.dataKey}-${index}-line`}
                  type='monotone'
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={s.color}
                  activeDot={{ r: 6, strokeWidth: 2, fill: s.color }}
                  dot={{ r: 3, strokeWidth: 1 }}
                  strokeWidth={2}
                />
              );
            }
          })}
        </ComposedChart>
      );
    }

    // 지원하지 않는 차트 타입에 대한 처리
    return (
      <div className='flex items-center justify-center h-full text-red-500'>
        지원하지 않는 차트 유형입니다: {type}
      </div>
    );
  };

  return (
    <div className='bg-white p-4 rounded-lg shadow h-full'>
      {title && <h3 className='text-lg font-semibold mb-4 text-gray-700'>{title}</h3>}
      <div style={{ height: height }}>
        <ResponsiveContainer width='100%' height='100%'>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/ErrorBoundary.tsx */
// src/components/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';
import Button from './ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className='p-4 bg-red-50 border border-red-200 rounded-lg'>
          <h2 className='text-lg font-medium text-red-600 mb-2'>오류가 발생했습니다</h2>
          <p className='text-red-500 text-sm'>
            {this.state.error?.message ||
              '알 수 없는 오류가 발생했습니다. 페이지를 새로고침해 주세요.'}
          </p>
          <Button
            onClick={() => this.setState({ hasError: false })}
            className='mt-3 px-4 py-2 bg-red-100 text-red-600 text-sm rounded hover:bg-red-200'
          >
            다시 시도
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

```tsx
/* ./src/components/forms/TransactionEditModal.tsx */
// src/components/forms/TransactionEditModal.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import SelectField from "@/components/ui/SelectField";
import { useToast } from "@/contexts/ToastContext";
import Alert from "@/components/ui/Alert";
import { UpdateTransactionPayload } from "@/lib/schemas/transactionsApiSchemas";

import { CardIssuer } from "@/types/commonTypes";
import { TransactionData } from "@/types/transactionTypes";
import {
  CATEGORIES_ENDPOINT,
  TRANSACTION_BY_ID_ENDPOINT,
} from "@/constants/apiEndpoints";
import { SUPPORTED_CARD_ISSUERS } from "@/constants/cardIssuers";

type Category = {
  id: number;
  name: string;
  type: string;
};

type TransactionEditModalProps = {
  transaction: TransactionData | null;
  onClose: () => void;
  onSave: () => void;
  workspaceId: string;
};

export default function TransactionEditModal({
  transaction,
  onClose,
  onSave,
  workspaceId,
}: TransactionEditModalProps) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<{
    date: string;
    amount: string;
    type: "expense" | "income" | undefined;
    description: string;
    categoryId: string;
    isInstallment: boolean;
    installmentMonths: string;
    totalInstallmentAmount: string;
    installmentCardIssuer: CardIssuer | null;
  }>({
    date: "",
    amount: "",
    type: "expense",
    description: "",
    categoryId: "",
    isInstallment: false,
    installmentMonths: "",
    totalInstallmentAmount: "",
    installmentCardIssuer: "현대카드",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(""); // API 에러 메시지
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); // 폼 필드별 유효성 검사 에러

  // 수정 대상 거래가 할부 '원거래'인지 판별
  const isOriginalInstallment = useMemo(() => {
    return transaction?.isInstallment && !transaction?.originalTransactionId;
  }, [transaction]);

  // 할부 원거래가 아닌 경우 (일반 거래 또는 개별 할부금) 내용 외 필드 비활성화 여부
  const disableNonDescriptionFields = !isOriginalInstallment;

  useEffect(() => {
    if (transaction) {
      setFormData({
        date: new Date(transaction.date).toISOString().split("T")[0],
        amount: transaction.amount.toString(), // 항상 레코드의 amount를 표시
        type: transaction.type,
        description: transaction.description || "",
        categoryId: transaction.categoryId.toString(),
        isInstallment: transaction.isInstallment || false,
        installmentMonths: transaction.installmentMonths?.toString() || "",
        totalInstallmentAmount:
          transaction.totalInstallmentAmount?.toString() || "",
        installmentCardIssuer: transaction.installmentCardIssuer || null,
      });
      // 에러 상태 초기화
      setErrors({});
      setApiError("");
    }
  }, [transaction]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(CATEGORIES_ENDPOINT(workspaceId));
        if (!response.ok) {
          throw new Error("카테고리를 불러오는데 실패했습니다.");
        }
        const data = await response.json();
        setCategories(data);
      } catch (error: unknown) {
        console.error("카테고리 조회 중 오류:", error);
        showToast(
          "카테고리 목록을 불러오는데 실패했습니다. 다시 시도해주세요.",
          "error"
        );
      }
    };
    fetchCategories();
  }, [showToast, workspaceId]);

  const filteredCategories = categories.filter(
    (cat) => cat.type === formData.type
  );

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;

    // 할부 원거래가 아니면 내용 외 필드 변경 불가
    if (disableNonDescriptionFields && name !== "description") {
      return;
    }

    const newValue =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    setFormData((prev) => {
      const newState = { ...prev, [name]: newValue };

      // 아래 로직은 할부 원거래 수정 시에만 유효함
      if (isOriginalInstallment) {
        if (name === "type") {
          newState.categoryId = "";
          if (newValue === "income") {
            newState.isInstallment = false;
            newState.installmentMonths = "";
            newState.totalInstallmentAmount = "";
            newState.installmentCardIssuer = null;
          }
        }
        if (name === "isInstallment" && !newValue) {
          newState.installmentMonths = "";
          newState.totalInstallmentAmount = "";
          newState.installmentCardIssuer = null;
        }
        if (name === "totalInstallmentAmount" && newState.isInstallment) {
          newState.amount = newValue as string;
        }
        if (name === "isInstallment" && newValue === true) {
          newState.amount = newState.totalInstallmentAmount;
        }
      }
      return newState;
    });

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    // 할부 원거래일 경우에만 모든 필드 검사
    if (isOriginalInstallment) {
      if (!formData.date) newErrors.date = "날짜를 선택해주세요.";
      // amount는 totalInstallmentAmount와 동기화되므로 total만 검증
      if (!formData.type) newErrors.type = "유형을 선택해주세요.";
      if (!formData.categoryId)
        newErrors.categoryId = "카테고리를 선택해주세요.";

      if (formData.isInstallment) {
        if (formData.type === "income") {
          newErrors.isInstallment = "수입 거래는 할부를 설정할 수 없습니다.";
        }
        const installmentMonthsValue = parseInt(formData.installmentMonths, 10);
        if (!formData.installmentMonths)
          newErrors.installmentMonths = "할부 개월수를 입력해주세요.";
        else if (isNaN(installmentMonthsValue) || installmentMonthsValue < 2)
          newErrors.installmentMonths =
            "할부 개월수는 2개월 이상이어야 합니다.";

        const totalInstallmentAmountValue = parseFloat(
          formData.totalInstallmentAmount
        );
        if (!formData.totalInstallmentAmount)
          newErrors.totalInstallmentAmount = "총 할부 금액을 입력해주세요.";
        else if (
          isNaN(totalInstallmentAmountValue) ||
          totalInstallmentAmountValue <= 0
        )
          newErrors.totalInstallmentAmount =
            "총 할부 금액은 0보다 커야 합니다.";

        if (!formData.installmentCardIssuer)
          newErrors.installmentCardIssuer = "할부 카드사를 선택해주세요.";
      } else {
        // 할부가 아닌 경우 (일반 거래로 수정 시)
        const amountValue = parseFloat(formData.amount);
        if (!formData.amount) newErrors.amount = "금액을 입력해주세요.";
        else if (isNaN(amountValue) || amountValue <= 0)
          newErrors.amount = "금액은 0보다 커야 합니다.";
      }
    }
    // 할부 원거래가 아닌 경우 (일반 거래, 개별 할부금)는 description 외에는 수정 안되므로 유효성 검사 불필요
    // (필요하다면 description의 길이 제한 등을 추가할 수 있음)

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !transaction) {
      // 유효성 검사는 원거래일 때만 의미가 크지만, transaction 존재 여부는 항상 체크
      showToast("입력 내용을 확인해주세요.", "error");
      return;
    }

    setIsLoading(true);
    setApiError("");

    const dataToSend: Partial<UpdateTransactionPayload> = {};

    // 할부 원거래가 아닌 경우: description만 비교하고 전송
    if (disableNonDescriptionFields) {
      if (formData.description !== (transaction.description || "")) {
        dataToSend.description = formData.description;
      }
    } else {
      // 할부 원거래인 경우: 모든 변경 가능한 필드 비교 후 전송
      if (
        formData.date !== new Date(transaction.date).toISOString().split("T")[0]
      ) {
        dataToSend.date = formData.date;
      }
      if (formData.type !== transaction.type) {
        dataToSend.type = formData.type;
      }
      if (formData.description !== (transaction.description || "")) {
        dataToSend.description = formData.description;
      }
      if (parseInt(formData.categoryId, 10) !== transaction.categoryId) {
        dataToSend.categoryId = parseInt(formData.categoryId, 10);
      }
      if (formData.isInstallment !== (transaction.isInstallment || false)) {
        dataToSend.isInstallment = formData.isInstallment;
      }

      if (formData.isInstallment) {
        // 할부로 설정/수정 시
        const totalAmountNum = parseFloat(formData.totalInstallmentAmount);
        // transaction.totalInstallmentAmount가 없을 경우 (예: 일반->할부 변경 시) transaction.amount를 기준으로 비교할 수도 있음
        const originalTotalAmount =
          transaction.totalInstallmentAmount ??
          (transaction.isInstallment ? transaction.amount : undefined);
        if (totalAmountNum !== originalTotalAmount) {
          dataToSend.totalInstallmentAmount = totalAmountNum;
          dataToSend.amount = totalAmountNum; // amount 동기화
        }
        const monthsNum = parseInt(formData.installmentMonths, 10);
        if (monthsNum !== (transaction.installmentMonths ?? undefined)) {
          dataToSend.installmentMonths = monthsNum;
        }
        if (
          formData.installmentCardIssuer !==
          (transaction.installmentCardIssuer || null)
        ) {
          dataToSend.installmentCardIssuer =
            formData.installmentCardIssuer as CardIssuer;
        }
      } else {
        // 일반 거래로 설정/수정 시
        const amountNum = parseFloat(formData.amount);
        if (
          amountNum !== transaction.amount ||
          dataToSend.isInstallment === false
        ) {
          dataToSend.amount = amountNum;
        }
      }
    }

    // 변경된 내용이 없으면 API 호출 안 함
    if (Object.keys(dataToSend).length === 0) {
      showToast("변경된 내용이 없습니다.", "info");
      setIsLoading(false);
      onClose();
      return;
    }

    try {
      const response = await fetch(
        TRANSACTION_BY_ID_ENDPOINT(workspaceId, transaction.id),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataToSend),
        }
      );

      const responseData = await response.json();

      if (!response.ok) {
        let errorMessage = responseData.error || "내역 수정에 실패했습니다.";
        if (responseData.details) {
          const fieldErrors = Object.entries(responseData.details)
            .map(
              ([key, value]): string =>
                `${key}: ${(value as string[]).join(", ")}`
            )
            .join("; ");
          errorMessage += ` (상세: ${fieldErrors})`;
        }
        throw new Error(errorMessage);
      }

      showToast("내역이 성공적으로 수정되었습니다.", "success");
      onSave(); // 부모 컴포넌트에 저장 완료 알림
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("내역 수정 중 오류:", error);
        setApiError(
          error.message || "내역 수정 중 알 수 없는 오류가 발생했습니다."
        );
        showToast(error.message || "내역 수정 중 오류 발생", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!transaction) return null;

  // 예상 수수료 표시 (있는 경우)
  const displayEstimatedFee = transaction.estimatedInstallmentFee
    ? ` (예상 수수료: ${new Intl.NumberFormat("ko-KR").format(
        transaction.estimatedInstallmentFee
      )}원)`
    : "";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="border-b px-6 py-4 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-xl font-semibold">내역 수정</h3>
          <Button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none text-2xl leading-none"
            aria-label="닫기"
          >
            &times;
          </Button>
        </div>

        {apiError && ( // API 에러 메시지 표시
          <Alert type="error" onClose={() => setApiError("")} className="m-4">
            {apiError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* 날짜 필드 */}
          <TextField
            id="edit-date"
            name="date"
            label="날짜"
            type="date"
            value={formData.date}
            onChange={handleChange}
            required
            disabled={disableNonDescriptionFields} // 비활성화 조건 적용
            error={errors.date}
          />

          {/* 유형 필드 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              유형
            </label>
            <div className="flex">
              <label className="inline-flex items-center mr-6">
                <input
                  type="radio"
                  name="type"
                  value="expense"
                  checked={formData.type === "expense"}
                  onChange={handleChange}
                  disabled={disableNonDescriptionFields} // 비활성화 조건 적용
                  className="form-radio h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700">지출</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="type"
                  value="income"
                  checked={formData.type === "income"}
                  onChange={handleChange}
                  disabled={disableNonDescriptionFields} // 비활성화 조건 적용
                  className="form-radio h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700">수입</span>
              </label>
            </div>
            {errors.type && (
              <p className="mt-1 text-xs text-red-500">{errors.type}</p>
            )}
          </div>

          {/* 금액 필드 */}
          <TextField
            id="edit-amount"
            name="amount"
            label={
              isOriginalInstallment ? "금액 (총 할부 금액과 동일)" : "금액"
            }
            type="number"
            value={formData.amount}
            onChange={handleChange}
            placeholder="0"
            required={!formData.isInstallment} // 일반 거래 시 필수
            disabled={disableNonDescriptionFields || isOriginalInstallment} // 원거래 또는 내용 외 필드 수정 불가 시 비활성화
            error={errors.amount}
          />

          {/* 카테고리 필드 */}
          <SelectField
            id="edit-categoryId"
            name="categoryId"
            label="카테고리"
            value={formData.categoryId}
            onChange={handleChange}
            options={[
              { value: "", label: "카테고리 선택" },
              ...filteredCategories.map((cat) => ({
                value: cat.id.toString(),
                label: cat.name,
              })),
            ]}
            required
            disabled={disableNonDescriptionFields} // 비활성화 조건 적용
            error={errors.categoryId}
          />

          {/* --- 할부 입력 필드 (원거래 수정 시에만 활성화) --- */}
          {formData.type === "expense" && ( // 수입 유형일 때는 할부 섹션 숨김
            <div
              className={`space-y-4 rounded-md border p-3 ${
                disableNonDescriptionFields
                  ? "bg-gray-50 border-gray-200"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center">
                <input
                  id="edit-isInstallment"
                  name="isInstallment"
                  type="checkbox"
                  checked={formData.isInstallment}
                  onChange={handleChange}
                  disabled={disableNonDescriptionFields} // 비활성화 조건 적용
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="edit-isInstallment"
                  className="ml-2 block text-sm text-gray-900"
                >
                  할부 결제 {displayEstimatedFee}
                </label>
              </div>
              {errors.isInstallment && !disableNonDescriptionFields && (
                <p className="text-xs text-red-500">{errors.isInstallment}</p>
              )}

              {formData.isInstallment && (
                <>
                  <TextField
                    id="edit-totalInstallmentAmount"
                    name="totalInstallmentAmount"
                    label="총 할부 금액"
                    type="number"
                    value={formData.totalInstallmentAmount}
                    onChange={handleChange}
                    placeholder="예: 300000"
                    required={!!isOriginalInstallment}
                    disabled={disableNonDescriptionFields} // 비활성화 조건 적용
                    error={errors.totalInstallmentAmount}
                    min="0"
                  />
                  <TextField
                    id="edit-installmentMonths"
                    name="installmentMonths"
                    label="할부 개월 수 (2개월 이상)"
                    type="number"
                    value={formData.installmentMonths}
                    onChange={handleChange}
                    placeholder="예: 3"
                    required={!!isOriginalInstallment}
                    disabled={disableNonDescriptionFields} // 비활성화 조건 적용
                    error={errors.installmentMonths}
                    min="2"
                  />
                  <SelectField
                    id="edit-installmentCardIssuer"
                    name="installmentCardIssuer"
                    label="할부 카드사"
                    value={formData.installmentCardIssuer || ""}
                    onChange={handleChange}
                    options={[
                      { value: "", label: "카드사 선택" },
                      ...SUPPORTED_CARD_ISSUERS.map((issuer) => ({
                        value: issuer,
                        label: issuer,
                      })),
                    ]}
                    required={!!isOriginalInstallment} // 원거래 수정 시 필수
                    disabled={disableNonDescriptionFields} // 비활성화 조건 적용
                    error={errors.installmentCardIssuer}
                  />
                </>
              )}
            </div>
          )}

          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="edit-description"
            >
              내용 (선택)
            </label>
            <textarea
              id="edit-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="내역에 대한 설명을 입력하세요"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              취소
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? "저장 중..." : "저장"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/forms/TransactionForm.tsx */
// src/components/forms/TransactionForm.tsx
"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import TextField from "@/components/ui/TextField";
import SelectField from "@/components/ui/SelectField";
import Alert from "@/components/ui/Alert";
import { useToast } from "@/contexts/ToastContext";
import { CardIssuer } from "@/types/commonTypes";
import { CreateTransactionPayload } from "@/lib/schemas/transactionsApiSchemas";
import {
  CATEGORIES_ENDPOINT,
  TRANSACTIONS_ENDPOINT,
} from "@/constants/apiEndpoints";
import { SUPPORTED_CARD_ISSUERS } from "@/constants/cardIssuers";

type Category = {
  id: number;
  name: string;
  type: string;
};

type TransactionFormProps = {
  onTransactionAdded: () => void;
  onCancel?: () => void;
  workspaceId: string;
};

export default function TransactionForm({
  onTransactionAdded,
  onCancel,
  workspaceId,
}: TransactionFormProps) {
  const [formData, setFormData] = useState<{
    date: string;
    amount: string;
    type: "expense" | "income" | undefined;
    description: string;
    categoryId: string;
    isInstallment: boolean;
    installmentMonths: string;
    totalInstallmentAmount: string;
    installmentCardIssuer: CardIssuer | null;
  }>({
    date: "",
    amount: "",
    type: "expense",
    description: "",
    categoryId: "",
    isInstallment: false,
    installmentMonths: "",
    totalInstallmentAmount: "",
    installmentCardIssuer: "현대카드",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(""); // API 에러 메시지
  const { showToast } = useToast();
  const [errors, setErrors] = useState<{ [key: string]: string }>({}); // 폼 필드별 유효성 검사 에러

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(CATEGORIES_ENDPOINT(workspaceId));
        if (!response.ok) {
          throw new Error("카테고리를 불러오는데 실패했습니다.");
        }
        const data = await response.json();
        setCategories(data);
      } catch (fetchError: unknown) {
        if (fetchError instanceof Error) {
          console.error("카테고리 조회 중 오류:", fetchError);
          // 사용자에게 보여지는 에러는 setError 또는 showToast 사용
          showToast(
            "카테고리 목록을 불러오는데 실패했습니다. 다시 시도해주세요.",
            "error"
          );
          setError("카테고리를 불러오는데 실패했습니다."); // 내부 에러 상태도 유지
        }
      }
    };
    fetchCategories();
  }, [showToast, workspaceId]);

  const filteredCategories = categories.filter(
    (cat) => cat.type === formData.type
  );

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type: elementType } = e.target;
    const newValue =
      elementType === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : value;

    setFormData((prev) => {
      const newState = { ...prev, [name]: newValue };

      // 타입 변경 시 카테고리 및 할부 관련 필드 초기화
      if (name === "type") {
        newState.categoryId = "";
        if (newValue === "income") {
          newState.isInstallment = false;
          newState.installmentMonths = "";
          newState.totalInstallmentAmount = "";
          newState.installmentCardIssuer = null; // 카드사 초기화
        }
      }

      // 할부 체크 해제 시 관련 필드 초기화
      if (name === "isInstallment" && !newValue) {
        newState.installmentMonths = "";
        newState.totalInstallmentAmount = "";
        newState.installmentCardIssuer = null; // 카드사 초기화
        // 할부 해제 시 amount는 사용자가 직접 입력해야 하므로 그대로 두거나 초기화
        // newState.amount = ''; // 필요시 주석 해제
      }

      // 할부 선택 & 총 할부 금액 입력 시 amount 동기화 (선택적 UI 개선)
      if (name === "totalInstallmentAmount" && newState.isInstallment) {
        newState.amount = newValue as string; // 예: amount 필드를 총액으로 자동 설정
      }
      // 할부 선택 시 amount 필드 비활성화 및 초기화 가능
      if (name === "isInstallment" && newValue === true) {
        newState.amount = newState.totalInstallmentAmount; // amount를 total로 설정
      }

      return newState;
    });

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.date) newErrors.date = "날짜를 선택해주세요.";

    // "금액" 필드 유효성 검사는 할부가 아닐 때만 수행
    if (!formData.isInstallment) {
      const amountValue = parseFloat(formData.amount);
      if (!formData.amount) newErrors.amount = "금액을 입력해주세요.";
      else if (isNaN(amountValue) || amountValue <= 0)
        newErrors.amount = "금액은 0보다 큰 숫자여야 합니다.";
    }

    if (!formData.type) newErrors.type = "유형을 선택해주세요.";
    if (!formData.categoryId) newErrors.categoryId = "카테고리를 선택해주세요.";

    if (formData.isInstallment) {
      if (formData.type === "income") {
        newErrors.isInstallment = "수입 거래는 할부를 설정할 수 없습니다.";
      }
      const installmentMonthsValue = parseInt(formData.installmentMonths, 10);
      if (!formData.installmentMonths)
        newErrors.installmentMonths = "할부 개월수를 입력해주세요.";
      else if (isNaN(installmentMonthsValue) || installmentMonthsValue < 2)
        newErrors.installmentMonths = "할부 개월수는 2개월 이상이어야 합니다.";

      const totalInstallmentAmountValue = parseFloat(
        formData.totalInstallmentAmount
      );
      if (!formData.totalInstallmentAmount)
        newErrors.totalInstallmentAmount = "총 할부 금액을 입력해주세요.";
      else if (
        isNaN(totalInstallmentAmountValue) ||
        totalInstallmentAmountValue <= 0
      )
        newErrors.totalInstallmentAmount = "총 할부 금액은 0보다 커야 합니다.";

      // 카드사 선택 유효성 검사
      if (!formData.installmentCardIssuer)
        newErrors.installmentCardIssuer = "할부 카드사를 선택해주세요.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast("입력 내용을 확인해주세요.", "error");
      return;
    }

    setIsLoading(true);
    setError("");

    const categoryIdAsNumber = parseInt(formData.categoryId, 10);

    // API 페이로드 구성
    const dataToSend: CreateTransactionPayload = {
      date: formData.date,
      type: formData.type as "expense" | "income",
      description: formData.description,
      categoryId: categoryIdAsNumber,
      isInstallment: formData.isInstallment,
      amount: 0,
    };

    if (formData.isInstallment) {
      // 할부 시: amount는 totalInstallmentAmount로 설정, 다른 할부 필드 포함
      dataToSend.amount = parseFloat(formData.totalInstallmentAmount);
      dataToSend.installmentMonths = parseInt(formData.installmentMonths, 10);
      dataToSend.totalInstallmentAmount = parseFloat(
        formData.totalInstallmentAmount
      );
      dataToSend.installmentCardIssuer =
        formData.installmentCardIssuer as CardIssuer; // <<-- 카드사 정보 포함
    } else {
      // 일반 거래 시: amount는 사용자가 입력한 값
      dataToSend.amount = parseFloat(formData.amount);
    }

    try {
      const response = await fetch(TRANSACTIONS_ENDPOINT(workspaceId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      const responseData = await response.json();

      if (!response.ok) {
        let errorMessage = responseData.error || "내역 등록에 실패했습니다.";
        if (responseData.details) {
          const fieldErrors = Object.entries(responseData.details)
            .map(
              ([key, value]): string =>
                `${key}: ${(value as string[]).join(", ")}`
            )
            .join("; ");
          errorMessage += ` (상세: ${fieldErrors})`;
        }
        throw new Error(errorMessage);
      }

      // 성공 시 폼 초기화
      setFormData({
        date: new Date().toISOString().split("T")[0],
        amount: "",
        type: "expense",
        description: "",
        categoryId: "",
        isInstallment: false,
        installmentMonths: "",
        totalInstallmentAmount: "",
        installmentCardIssuer: null, // 카드사 초기화
      });
      setErrors({}); // 에러 메시지 초기화
      showToast("내역이 성공적으로 등록되었습니다.", "success");
      onTransactionAdded();
    } catch (submitError: unknown) {
      if (submitError instanceof Error) {
        console.error("내역 등록 중 오류:", submitError);
        setError(
          submitError.message || "내역 등록 중 알 수 없는 오류가 발생했습니다."
        ); // API 에러 메시지 설정
        showToast(submitError.message || "내역 등록 중 오류 발생", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {error && ( // API 에러 메시지 표시
        <Alert type="error" onClose={() => setError("")} className="mb-4">
          {error}
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          id="date"
          name="date"
          label="날짜"
          type="date"
          value={formData.date}
          onChange={handleChange}
          required
          error={errors.date}
        />

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            유형
          </label>
          <div className="flex">
            <label className="inline-flex items-center mr-6">
              <input
                type="radio"
                name="type"
                value="expense"
                checked={formData.type === "expense"}
                onChange={handleChange}
                className="form-radio h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">지출</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="type"
                value="income"
                checked={formData.type === "income"}
                onChange={handleChange}
                className="form-radio h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">수입</span>
            </label>
          </div>
          {errors.type && (
            <p className="mt-1 text-xs text-red-500">{errors.type}</p>
          )}
        </div>

        {/* 금액 입력 필드: 할부 시 비활성화/다른 의미 부여 가능 */}
        <TextField
          id="amount"
          name="amount"
          label={formData.isInstallment ? "금액 (총 할부 금액과 동일)" : "금액"}
          type="number"
          value={formData.amount}
          onChange={handleChange}
          placeholder="0"
          required={!formData.isInstallment}
          disabled={formData.isInstallment} // 할부 시 비활성화
          error={errors.amount}
        />

        <SelectField
          id="categoryId"
          name="categoryId"
          label="카테고리"
          value={formData.categoryId}
          onChange={handleChange}
          options={[
            { value: "", label: "카테고리 선택" },
            ...filteredCategories.map((cat) => ({
              value: cat.id.toString(),
              label: cat.name,
            })),
          ]}
          required
          error={errors.categoryId}
        />

        {/* --- 할부 입력 필드 --- */}
        {/* --- 할부 입력 필드 --- */}
        {formData.type === "expense" && (
          <div className="space-y-4 rounded-md border border-gray-200 p-3">
            <div className="flex items-center">
              <input
                id="isInstallment"
                name="isInstallment"
                type="checkbox"
                checked={formData.isInstallment}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="isInstallment"
                className="ml-2 block text-sm text-gray-900"
              >
                할부 결제
              </label>
            </div>
            {errors.isInstallment && (
              <p className="text-xs text-red-500">{errors.isInstallment}</p>
            )}

            {formData.isInstallment && (
              <>
                {/* 총 할부 금액 입력 필드 */}
                <TextField
                  id="totalInstallmentAmount"
                  name="totalInstallmentAmount"
                  label="총 할부 금액"
                  type="number"
                  value={formData.totalInstallmentAmount}
                  onChange={handleChange}
                  placeholder="예: 300000"
                  required={formData.isInstallment}
                  error={errors.totalInstallmentAmount}
                  min="0"
                />
                {/* 할부 개월 수 입력 필드 */}
                <TextField
                  id="installmentMonths"
                  name="installmentMonths"
                  label="할부 개월 수 (2개월 이상)"
                  type="number"
                  value={formData.installmentMonths}
                  onChange={handleChange}
                  placeholder="예: 3"
                  required={formData.isInstallment}
                  error={errors.installmentMonths}
                  min="2"
                />
                {/* 할부 카드사 선택 필드 */}
                <SelectField
                  id="installmentCardIssuer"
                  name="installmentCardIssuer"
                  label="할부 카드사"
                  value={formData.installmentCardIssuer ?? ""}
                  onChange={handleChange}
                  options={[
                    { value: "", label: "카드사 선택" },
                    ...SUPPORTED_CARD_ISSUERS.map((issuer) => ({
                      value: issuer,
                      label: issuer,
                    })),
                  ]}
                  required={formData.isInstallment} // 할부 시 필수
                  error={errors.installmentCardIssuer}
                />
              </>
            )}
          </div>
        )}
        {/* --- 할부 입력 필드 끝 --- */}

        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="description"
          >
            내용 (선택)
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="내역에 대한 설명을 입력하세요"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          {onCancel && (
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isLoading}
            >
              취소
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading}
            className={!onCancel ? "w-full" : ""}
          >
            {isLoading ? "등록 중..." : "내역 등록"}
          </Button>
        </div>
      </form>
    </>
  );
}
```

```tsx
/* ./src/components/ui/Alert.tsx */
// src/components/ui/Alert.tsx
import React from 'react';
import Button from './Button';

type AlertProps = {
  children: React.ReactNode;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose?: () => void;
  className?: string;
};

export default function Alert({ children, type, onClose, className = '' }: AlertProps) {
  // 타입에 따른 스타일
  const typeStyles = {
    success: 'bg-green-100 border-green-400 text-green-700',
    error: 'bg-red-100 border-red-400 text-red-700',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700',
    info: 'bg-blue-100 border-blue-400 text-blue-700',
  };

  return (
    <div className={`border px-4 py-3 rounded mb-4 ${typeStyles[type]} ${className}`}>
      <div className='flex justify-between items-center'>
        <div>{children}</div>
        {onClose && (
          <Button
            onClick={onClose}
            className='ml-4 text-sm opacity-70 hover:opacity-100'
            aria-label='닫기'
          >
            ×
          </Button>
        )}
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/ui/Button.tsx */
// src/components/ui/Button.tsx
import React from 'react';

const Button = ({
  children,
  type = 'button',
  onClick,
  variant = 'ghost',
  className = '',
  disabled = false,
  icon: Icon,
  size = 'md',
  ariaLabel,
}: {
  type?: 'button' | 'submit' | 'reset';
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive' | 'outline' | 'link';
  className?: string;
  disabled?: boolean;
  icon?: React.ElementType;
  size?: 'sm' | 'md' | 'lg' | 'icon';
  ariaLabel?: string;
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150';
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2',
  };
  const variantStyles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-400 shadow-none',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    destructive: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    outline:
      'border border-gray-300 hover:bg-gray-100 text-gray-700 focus:ring-gray-400 bg-transparent shadow-none',
    link: 'text-blue-600 hover:underline focus:ring-blue-500 shadow-none bg-transparent',
  };
  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : '';

  const currentBaseStyles =
    variant === 'link'
      ? 'inline-flex items-center justify-center font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150'
      : baseStyles;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${currentBaseStyles} ${sizeStyles[size]} ${
        variantStyles[variant || 'ghost']
      } ${disabledStyles} ${className}`}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
    >
      {Icon && <Icon className={`h-5 w-5 ${children ? 'mr-2' : ''}`} />}
      {children}
    </button>
  );
};

export default Button;
```

```tsx
/* ./src/components/ui/Card.tsx */
// src/components/ui/Card.tsx
import React from 'react';

const Card = ({
  children,
  title,
  className = '',
  actions,
  noPadding = false,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
  actions?: React.ReactNode;
  noPadding?: boolean;
}) => (
  <div className={`bg-white rounded-xl shadow-lg ${className}`}>
    {(title || actions) && (
      <div className='px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex justify-between items-center'>
        {title && <h3 className='text-base sm:text-lg font-semibold text-gray-800'>{title}</h3>}
        {actions && <div className='flex items-center gap-2'>{actions}</div>}
      </div>
    )}
    <div className={noPadding ? '' : 'p-4 sm:p-6'}>{children}</div>
  </div>
);

export default Card;
```

```tsx
/* ./src/components/ui/dialog.tsx */
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
          <XIcon />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
```

```tsx
/* ./src/components/ui/EmptyState.tsx */
// src/components/ui/EmptyState.tsx
import React from 'react';
import Button from './Button';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
};

export default function EmptyState({
  title,
  description,
  icon,
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div className='text-center py-12 bg-gray-50 rounded-lg'>
      {icon && <div className='mb-4 text-gray-400'>{icon}</div>}
      <h3 className='text-lg font-medium text-gray-900'>{title}</h3>
      {description && <p className='mt-2 text-sm text-gray-500'>{description}</p>}
      {actionText && onAction && (
        <div className='mt-4'>
          <Button onClick={onAction} variant='primary'>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
}
```

```tsx
/* ./src/components/ui/input.tsx */
import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
```

```tsx
/* ./src/components/ui/label.tsx */
"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
```

```tsx
/* ./src/components/ui/LoadingSpinner.tsx */
// src/components/ui/LoadingSpinner.tsx
export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className='flex justify-center items-center py-4'>
      <svg
        className={`animate-spin ${sizeClass[size]} text-blue-500`}
        xmlns='http://www.w3.org/2000/svg'
        fill='none'
        viewBox='0 0 24 24'
      >
        <circle
          className='opacity-25'
          cx='12'
          cy='12'
          r='10'
          stroke='currentColor'
          strokeWidth='4'
        ></circle>
        <path
          className='opacity-75'
          fill='currentColor'
          d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
        ></path>
      </svg>
    </div>
  );
}
```

```tsx
/* ./src/components/ui/SelectField.tsx */
// src/components/ui/SelectField.tsx
import React from 'react';

type Option = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  id: string;
  name: string;
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Option[];
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
};

export default function SelectField({
  id,
  name,
  label,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  error,
  className = '',
}: SelectFieldProps) {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label htmlFor={id} className='block text-gray-700 mb-2'>
          {label}
          {required && <span className='text-red-500 ml-1'>*</span>}
        </label>
      )}
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
          ${
            error
              ? 'border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
        `}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className='mt-1 text-sm text-red-500'>{error}</p>}
    </div>
  );
}
```

```tsx
/* ./src/components/ui/separator.tsx */
"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator-root"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
```

```tsx
/* ./src/components/ui/Skeleton.tsx */
// src/components/ui/Skeleton.tsx

import React from "react";

type SkeletonProps = {
  className?: string;
  height?: string | number;
  width?: string | number;
};

export default function Skeleton({
  className = "",
  height,
  width,
}: SkeletonProps) {
  const style: React.CSSProperties = {
    height: height
      ? typeof height === "number"
        ? `${height}px`
        : height
      : undefined,
    width: width
      ? typeof width === "number"
        ? `${width}px`
        : width
      : undefined,
  };

  return (
    <div
      className={`animate-pulse bg-gray-200 rounded-md ${className}`}
      style={style}
    />
  );
}
```

```tsx
/* ./src/components/ui/table.tsx */
"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
```

```tsx
/* ./src/components/ui/TextField.tsx */
// src/components/ui/TextField.tsx
import React from 'react';

type TextFieldProps = {
  id: string;
  name: string;
  label?: string;
  type?: 'text' | 'number' | 'email' | 'password' | 'date';
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  min?: string | number;
  className?: string;
};

export default function TextField({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  placeholder = '',
  required = false,
  disabled = false,
  error,
  min,
  className = '',
}: TextFieldProps) {
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label htmlFor={id} className='block text-gray-700 mb-2'>
          {label}
          {required && <span className='text-red-500 ml-1'>*</span>}
        </label>
      )}
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        min={min}
        className={`
          w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2
          ${
            error
              ? 'border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:ring-blue-200 focus:border-blue-500'
          }
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
        `}
      />
      {error && <p className='mt-1 text-sm text-red-500'>{error}</p>}
    </div>
  );
}
```

```tsx
/* ./src/components/ui/Toast.tsx */
// src/components/ui/Toast.tsx
import React, { useEffect } from 'react';
import Button from './Button';

type ToastProps = {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
};

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  // 타입에 따른 스타일
  const typeStyles = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  // 지정된 시간 후 토스트 닫기
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className='fixed bottom-4 right-4 z-50 animate-fade-in-up'>
      <div
        className={`${typeStyles[type]} text-white py-2 px-4 rounded-md shadow-lg flex items-center`}
      >
        <span>{message}</span>
        <Button
          onClick={onClose}
          className='ml-3 text-white text-xl font-bold opacity-70 hover:opacity-100'
          aria-label='닫기'
        >
          ×
        </Button>
      </div>
    </div>
  );
}
```

```tsx
/* ./src/contexts/ToastContext.tsx */
// src/contexts/ToastContext.tsx
'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';
import Toast from '@/components/ui/Toast';

type ToastType = 'success' | 'error' | 'info';

type ToastContextType = {
  showToast: (message: string, type: ToastType) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
```

```tsx
/* ./src/providers/AuthSessionProvider.tsx */
// src/components/providers/AuthSessionProvider.tsx
"use client"; // 이 컴포넌트가 클라이언트 컴포넌트임을 명시

import { SessionProvider } from "next-auth/react";
import React from "react";

interface AuthSessionProviderProps {
  children: React.ReactNode;
  // NextAuth.js v5 이후에는 session prop을 직접 전달할 필요가 없을 수 있습니다.
  // session?: any; // 필요에 따라 session prop 타입 정의
}

export default function AuthSessionProvider({
  children,
}: AuthSessionProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

# prisma 폴더

```ts
/* ./prisma/reset.ts */
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 기존 데이터 삭제 (개발 환경에서만 사용)
  // 참조하는 쪽 테이블부터 삭제해야 합니다.
  await prisma.transaction.deleteMany({}); // 모든 Transaction 레코드 삭제
  await prisma.budget.deleteMany({}); // 모든 Budget 레코드 삭제 (추가된 부분)

  console.log('기존 Transaction, Budget 데이터가 삭제되었습니다.');
}

main()
  .catch((e) => {
    console.error('Seed 작업 중 오류 발생:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

```ts
/* ./prisma/schema.prisma */
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// --- 인증 관련 모델 ---
model Account {
  id                String  @id @default(cuid()) // ID 타입을 문자열로 변경 (cuid 또는 uuid 권장)
  userId            String  // User 모델의 ID 타입과 일치
  type              String
  provider          String  // 예: "google"
  providerAccountId String  // Google에서 제공하는 사용자 ID
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId]) // 각 제공자별 계정 ID는 고유해야 함
  @@index([userId]) // userId로 검색 최적화
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String   // User 모델의 ID 타입과 일치
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId]) // userId로 검색 최적화
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]

  // 워크스페이스 관련 관계 추가
  createdWorkspaces Workspace[]     @relation("CreatedWorkspaces") // 이 사용자가 생성한 워크스페이스 목록
  workspaceUsers    WorkspaceUser[] // 이 사용자가 참여하고 있는 워크스페이스 멤버십 정보
  sentInvitations   Invitation[]    @relation("SentInvitations") // 이 사용자가 보낸 초대 목록 (선택적)

  // --- 해결: Transaction과의 양방향 관계 설정 ---
  createdTransactions Transaction[] @relation("UserTransactions") // 사용자가 생성한 거래내역 목록
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token]) // 복합 고유 키
}

// --- 기존 모델들 (Transaction, Category, Budget) ---
// Transaction, Category, Budget 모델은 Phase 2에서 Workspace와 연결되도록 수정될 예정입니다.
// 지금은 그대로 두거나, User 모델과 직접 연결하지 않습니다.

model Transaction {
  id            Int      @id @default(autoincrement())
  date          DateTime
  amount        Float
  type          String   // "income" 또는 "expense"
  description   String?
  categoryId    Int
  category      Category @relation(fields: [categoryId], references: [id])
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  isInstallment            Boolean? @default(false)
  installmentMonths        Int?
  currentInstallmentNumber Int?
  totalInstallmentAmount   Float?
  originalTransactionId    Int?
  estimatedInstallmentFee  Float?
  installmentCardIssuer    String?

  // --- 워크스페이스 연결 추가 ---
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade) // 워크스페이스 삭제 시 관련 거래내역도 삭제

  // --- 거래 내역 작성자 연결 (선택적, 필요시 User 모델도 수정하여 양방향 관계 설정) ---
  createdById String? // User 모델의 id와 연결
  // --- 해결: 관계 이름 명시 ---
  createdBy   User?   @relation("UserTransactions", fields: [createdById], references: [id], onUpdate: NoAction, onDelete: SetNull) // 작성자 삭제 시 거래내역은 유지, createdById는 null로


  @@index([date])
  @@index([type])
  @@index([categoryId])
  @@index([workspaceId]) // 워크스페이스별 조회 최적화
  @@index([createdById]) // 작성자별 조회 최적화 (선택적)
  @@index([isInstallment, originalTransactionId])
}

model Category {
  id           Int           @id @default(autoincrement())
  name         String
  type         String        // "income" 또는 "expense"
  transactions Transaction[]
  budgets      Budget[]

  // --- 워크스페이스 연결 추가 ---
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade) // 워크스페이스 삭제 시 관련 카테고리도 삭제

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([workspaceId, name, type]) // 워크스페이스 내에서 카테고리 이름과 타입은 고유
  @@index([type])
  @@index([workspaceId])
}

model Budget {
  id         Int      @id @default(autoincrement())
  month      String   //<y_bin_46>-MM 형식
  categoryId Int
  amount     Float
  category   Category @relation(fields: [categoryId], references: [id]) // onDelete는 Category 모델의 기본 설정 따름 (보통 Restrict 또는 NoAction)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // --- 워크스페이스 연결 추가 ---
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade) // 워크스페이스 삭제 시 관련 예산도 삭제

  @@unique([workspaceId, month, categoryId]) // 워크스페이스별, 월별, 카테고리별 예산은 고유
  @@index([month])
  @@index([workspaceId])
}

enum WorkspaceRole {
  ADMIN
  MEMBER
  // VIEWER // 필요시 추가
}

model Workspace {
  id        String   @id @default(cuid())
  name      String
  ownerId   String   // 워크스페이스를 생성한 사용자의 ID (User 모델의 id와 연결)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  owner        User            @relation("CreatedWorkspaces", fields: [ownerId], references: [id])
  users        WorkspaceUser[] // 이 워크스페이스에 속한 사용자들 (WorkspaceUser 모델과 연결)

  // 워크스페이스에 귀속되는 데이터들
  transactions Transaction[]
  budgets      Budget[]
  categories   Category[]
  invitations  Invitation[]    // 이 워크스페이스로 보내진 초대들 (선택적 기능)

  @@index([ownerId])
}

model WorkspaceUser {
  id          String        @id @default(cuid())
  userId      String        // User 모델의 id와 연결
  workspaceId String        // Workspace 모델의 id와 연결
  role        WorkspaceRole // 위에서 정의한 WorkspaceRole Enum 사용
  joinedAt    DateTime      @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade) // 사용자가 삭제되면 멤버십도 삭제
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade) // 워크스페이스가 삭제되면 멤버십도 삭제

  @@unique([userId, workspaceId]) // 사용자는 하나의 워크스페이스에 중복 참여 불가
  @@index([userId])
  @@index([workspaceId])
}

enum InvitationStatus {
  PENDING  // 초대 발송, 수락 대기 중
  ACCEPTED // 초대 수락됨
  DECLINED // 초대 거절됨
  EXPIRED  // 초대 만료됨
  CANCELED // 초대 취소됨 (관리자 또는 사용자에 의해)
}

model Invitation {
  id          String           @id @default(cuid())
  email       String           // 초대받는 사람의 이메일
  workspaceId String           // 어느 워크스페이스로의 초대인지
  role        WorkspaceRole    // 초대 시 부여할 역할
  status      InvitationStatus @default(PENDING) // 초대 상태
  token       String           @unique @default(uuid()) // 초대 수락을 위한 고유 토큰
  expiresAt   DateTime         // 초대 만료 시간
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  invitedById String    // 초대한 사용자의 ID (User 모델의 id와 연결)
  invitedBy   User      @relation("SentInvitations", fields: [invitedById], references: [id])

  @@index([email])
  @@index([workspaceId])
  @@index([token])
}```

## tsx 파일

