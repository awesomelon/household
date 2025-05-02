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
/* ./src/app/api/me/workspaces/route.ts */
// app/api/me/workspaces/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getUserWorkspaces } from "@/services/workspaceService";
import { ApiError } from "@/services/apiError";
import { User as NextAuthUser } from "next-auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;

    const workspaces = await getUserWorkspaces(userId);
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error("[API GET /api/me/workspaces] error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "워크스페이스 목록 조회 중 내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/budgets/[budgetId]/route.ts */
// API 라우트 핸들러: /api/budgets/[id]
import { NextResponse } from "next/server";
import { deleteBudget } from "@/services/budgetService"; // getBudgetById 서비스 함수는 필요시 추가
import { ApiError, ValidationError } from "@/services/apiError";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { User as NextAuthUser } from "next-auth";
import {
  BudgetIdParamSchema,
  WorkspaceIdParamSchema,
} from "@/lib/schemas/commonApiSchemas";

interface ContextParams {
  workspaceId: string;
  budgetId: string; // Next.js 라우트 파라미터는 문자열로 전달됨
}

/**
 * 특정 예산 삭제 (DELETE /api/budgets/:id)
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<ContextParams> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;

    const { workspaceId, budgetId: budgetIdStr } = await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }
    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const budgetIdValidation = BudgetIdParamSchema.safeParse({
      id: budgetIdStr,
    }); // BudgetIdParamSchema는 id를 숫자로 변환
    if (!budgetIdValidation.success) {
      throw new ValidationError(
        "잘못된 예산 ID 형식입니다.",
        budgetIdValidation.error.flatten().fieldErrors
      );
    }
    const validBudgetId = budgetIdValidation.data.id;

    // 서비스 함수 호출 시 userId, workspaceId, budgetId 전달
    await deleteBudget(userId, validWorkspaceId, validBudgetId);
    return NextResponse.json({
      success: true,
      message: "예산이 성공적으로 삭제되었습니다.",
    });
  } catch (error) {
    const { workspaceId, budgetId: budgetIdStr } = await context.params;
    console.error(
      `[API DELETE /api/workspaces/${workspaceId}/budgets/${budgetIdStr}] error:`,
      error
    );
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "예산 삭제 중 내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/budgets/route.ts */
// src/app/api/workspaces/[workspaceId]/budgets/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions"; // 경로 확인
import { BudgetSchema } from "@/lib/schemas/budgetApiSchemas";
import { WorkspaceIdParamSchema } from "@/lib/schemas/commonApiSchemas";
import { getBudgetsByMonth, upsertBudget } from "@/services/budgetService";
import { ApiError, ValidationError } from "@/services/apiError";
import { User as NextAuthUser } from "next-auth";

interface ContextParams {
  workspaceId: string;
}

export async function GET(
  request: Request,
  context: { params: Promise<ContextParams> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;
    const { workspaceId } = await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }
    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    if (!month) {
      throw new ValidationError("month 파라미터가 필요합니다.");
    }
    // month 형식 유효성 검사는 서비스 계층에서 수행하거나, 여기서 Zod 스키마로도 가능

    // 서비스 함수 호출 시 userId, workspaceId, month 전달
    const budgets = await getBudgetsByMonth(userId, validWorkspaceId, month);
    return NextResponse.json(budgets);
  } catch (error) {
    const { workspaceId } = await context.params;
    console.error(
      `[API GET /api/workspaces/${workspaceId}/budgets] error:`,
      error
    );
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "예산 조회 중 내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<ContextParams> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;
    const { workspaceId } = await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }
    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const body = await request.json();
    const validationResult = BudgetSchema.safeParse(body); // BudgetSchema는 month, categoryId, amount만 검증
    if (!validationResult.success) {
      throw new ValidationError(
        "요청 본문이 유효하지 않습니다.",
        validationResult.error.flatten().fieldErrors
      );
    }

    // 서비스 함수 호출 시 userId, workspaceId, payload 전달
    const budget = await upsertBudget(
      userId,
      validWorkspaceId,
      validationResult.data
    );
    return NextResponse.json(budget, { status: 201 }); // 생성 또는 수정 성공 시 200 또는 201
  } catch (error) {
    const { workspaceId } = await context.params;
    console.error(
      `[API POST /api/workspaces/${workspaceId}/budgets] error:`,
      error
    );
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "예산 저장 중 내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/categories/route.ts */
// src/app/api/workspaces/[workspaceId]/categories/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { WorkspaceIdParamSchema } from "@/lib/schemas/commonApiSchemas";
import { getAllCategories, createCategory } from "@/services/categoryService"; // createCategory 추가 가정
import { ApiError, ValidationError } from "@/services/apiError";
import { User as NextAuthUser } from "next-auth";
import { z } from "zod"; // 카테고리 생성용 스키마

interface ContextParams {
  workspaceId: string;
}

// 카테고리 생성 요청 본문 스키마 (예시)
const CreateCategorySchema = z.object({
  name: z
    .string()
    .min(1, "카테고리 이름은 필수입니다.")
    .max(50, "카테고리 이름은 50자를 넘을 수 없습니다."),
  type: z.enum(["income", "expense"], {
    message: "카테고리 유형은 'income' 또는 'expense'여야 합니다.",
  }),
});

export async function GET(
  request: Request,
  context: { params: Promise<ContextParams> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;
    const { workspaceId } = await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }
    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const categories = await getAllCategories(userId, validWorkspaceId);
    return NextResponse.json(categories);
  } catch (error) {
    const { workspaceId } = await context.params;

    console.error(
      `[API GET /api/workspaces/${workspaceId}/categories] error:`,
      error
    );
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "카테고리 조회 중 내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<ContextParams> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;
    const { workspaceId } = await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }
    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const body = await request.json();
    const validationResult = CreateCategorySchema.safeParse(body);
    if (!validationResult.success) {
      throw new ValidationError(
        "요청 본문이 유효하지 않습니다.",
        validationResult.error.flatten().fieldErrors
      );
    }

    // createCategory 서비스 함수가 (userId, workspaceId, payload)를 받는다고 가정
    const newCategory = await createCategory(
      userId,
      validWorkspaceId,
      validationResult.data
    );
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error) {
    const { workspaceId } = await context.params;
    console.error(
      `[API POST /api/workspaces/${workspaceId}/categories] error:`,
      error
    );
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "카테고리 생성 중 내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/insights/route.ts */
// src/app/api/workspaces/[workspaceId]/insights/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { GetInsightsQuerySchema } from "@/lib/schemas/insightApiSchemas";
import { WorkspaceIdParamSchema } from "@/lib/schemas/commonApiSchemas";
import { ApiError, ValidationError } from "@/services/apiError";
import insightGenerationService from "@/services/insightGenerationService";
import { User as NextAuthUser } from "next-auth";

interface ContextParams {
  workspaceId: string;
}

export async function GET(
  request: Request,
  context: { params: Promise<ContextParams> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;
    const { workspaceId } = await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }
    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validationResult = GetInsightsQuerySchema.safeParse(queryParams); // month 파라미터 검증

    if (!validationResult.success) {
      throw new ValidationError(
        "요청 파라미터가 유효하지 않습니다.",
        validationResult.error.flatten().fieldErrors
      );
    }
    const { month } = validationResult.data;

    // 서비스 함수 호출 시 userId, workspaceId, month 전달
    const insights = await insightGenerationService.generateInsights(
      userId,
      validWorkspaceId,
      month
    );
    return NextResponse.json({ insights });
  } catch (error) {
    const { workspaceId } = await context.params;
    console.error(
      `[API GET /api/workspaces/${workspaceId}/insights] error:`,
      error
    );
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "인사이트 조회 중 내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/stats/route.ts */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { StatsApiQuerySchema } from "@/lib/schemas/statsApiSchemas";
import { ApiError, ValidationError } from "@/services/apiError";
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
import { User as NextAuthUser } from "next-auth";
import { WorkspaceIdParamSchema } from "@/lib/schemas/commonApiSchemas";

interface ContextParams {
  workspaceId: string;
}

export async function GET(
  request: Request,
  context: { params: Promise<ContextParams> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;
    const { workspaceId } = await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }
    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const { searchParams } = new URL(request.url);
    const validationResult = StatsApiQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );
    if (!validationResult.success) {
      throw new ValidationError(
        "요청 파라미터가 유효하지 않습니다.",
        validationResult.error.flatten().fieldErrors
      );
    }
    const query = validationResult.data;

    let result;

    switch (query.type) {
      case "daily":
        result = await getDailyStatsService(
          userId,
          validWorkspaceId,
          query.date,
          query.compare
        );
        break;
      case "monthly":
        result = await getMonthlyStatsService(
          userId,
          validWorkspaceId,
          query.month,
          query.compare
        );
        break;
      case "yearly":
        result = await getYearlyStatsService(
          userId,
          validWorkspaceId,
          query.year,
          query.compare
        );
        break;
      case "category":
        // query.month 또는 query.year 중 period에 맞는 값을 전달
        const categoryReference =
          query.period === "year" ? query.year : query.month;
        result = await getCategoryStatsService(
          userId,
          validWorkspaceId,
          categoryReference,
          query.period as "month" | "year"
        );
        break;
      case "trend":
        result = await getTrendStatsService(
          userId,
          validWorkspaceId,
          query.period as "day" | "month" | "year",
          query.month,
          query.year
        );
        break;
      case "kpi":
        result = await getKpiStatsService(
          userId,
          validWorkspaceId,
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
          validWorkspaceId,
          startDate,
          endDate
        );
        break;
      case "spendingPattern":
        result = await getSpendingPatternStatsService(
          userId,
          validWorkspaceId,
          query.month
        );
        break;
      case "incomeSource":
        result = await getIncomeSourceStatsService(
          userId,
          validWorkspaceId,
          query.month,
          query.compare
        );
        break;
      case "budgetVsActual":
        result = await getBudgetVsActualStatsService(
          userId,
          validWorkspaceId,
          query.month
        );
        break;
      default:
        throw new ValidationError("지원하지 않는 통계 유형입니다.");
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API GET /api/stats] error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "통계 데이터 조회 중 내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/transactions/[transactionId]/route.ts */
// API 라우트 핸들러: /api/transactions/[id]
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import {
  UpdateTransactionSchema,
  TransactionIdParamSchema, // transactionId만 검증
} from "@/lib/schemas/transactionsApiSchemas";
import { WorkspaceIdParamSchema } from "@/lib/schemas/commonApiSchemas";
import {
  updateTransaction,
  deleteTransaction,
  getTransactionById,
} from "@/services/transactionService";
import { ApiError, ValidationError } from "@/services/apiError";
import { User as NextAuthUser } from "next-auth";

interface ContextParams {
  workspaceId: string;
  transactionId: string; // Next.js는 경로 파라미터를 문자열로 전달
}

export async function GET(
  request: Request,
  context: { params: Promise<ContextParams> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;
    const { workspaceId, transactionId: transactionIdStr } =
      await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }
    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const transactionIdValidation = TransactionIdParamSchema.safeParse({
      id: transactionIdStr,
    });
    if (!transactionIdValidation.success) {
      throw new ValidationError(
        "잘못된 거래 ID 형식입니다.",
        transactionIdValidation.error.flatten().fieldErrors
      );
    }
    const validTransactionId = transactionIdValidation.data.id;

    const transaction = await getTransactionById(
      userId,
      validWorkspaceId,
      validTransactionId
    );
    return NextResponse.json(transaction);
  } catch (error) {
    const { workspaceId, transactionId: transactionIdStr } =
      await context.params;

    console.error(
      `[API GET /api/workspaces/${workspaceId}/transactions/${transactionIdStr}] error:`,
      error
    );
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * 특정 거래 내역 수정 (PUT /api/transactions/:id)
 * @param request - NextRequest 객체
 * @param context - 라우트 파라미터를 포함하는 객체. context.params.id 로 접근.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<ContextParams> } // 타입 수정: context.params가 Promise를 반환하도록 명시
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;
    const { workspaceId, transactionId: transactionIdStr } =
      await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }
    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const transactionIdValidation = TransactionIdParamSchema.safeParse({
      id: transactionIdStr,
    });
    if (!transactionIdValidation.success) {
      throw new ValidationError(
        "잘못된 내역 ID 형식입니다.",
        transactionIdValidation.error.flatten().fieldErrors
      );
    }
    const validTransactionId = transactionIdValidation.data.id;

    const body = await request.json();
    const validationResult = UpdateTransactionSchema.safeParse(body);
    if (!validationResult.success) {
      throw new ValidationError(
        "요청 본문이 유효하지 않습니다.",
        validationResult.error.flatten().fieldErrors
      );
    }

    const updatedData = await updateTransaction(
      userId,
      validWorkspaceId,
      validTransactionId,
      validationResult.data
    );

    return NextResponse.json(updatedData);
  } catch (error) {
    const { workspaceId, transactionId: transactionIdStr } =
      await context.params;

    console.error(
      `[API PUT /api/workspaces/${workspaceId}/transactions/${transactionIdStr}] error:`,
      error
    );

    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * 특정 거래 내역 삭제 (DELETE /api/transactions/:id)
 * @param request - NextRequest 객체 (사용되지 않음)
 * @param context - 라우트 파라미터를 포함하는 객체. context.params.id 로 접근.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<ContextParams> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;
    const { workspaceId, transactionId: transactionIdStr } =
      await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }

    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const transactionIdValidation = TransactionIdParamSchema.safeParse({
      id: transactionIdStr,
    });

    if (!transactionIdValidation.success) {
      throw new ValidationError(
        "잘못된 내역 ID 형식입니다.",
        transactionIdValidation.error.flatten().fieldErrors
      );
    }
    const validTransactionId = transactionIdValidation.data.id;

    await deleteTransaction(userId, validWorkspaceId, validTransactionId);
    return NextResponse.json({
      success: true,
      message: "내역이 성공적으로 삭제되었습니다.",
    });
  } catch (error) {
    const { workspaceId, transactionId: transactionIdStr } =
      await context.params;

    console.error(
      `[API DELETE /api/workspaces/${workspaceId}/transactions/${transactionIdStr}] error:`,
      error
    );
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
```

```ts
/* ./src/app/api/workspaces/[workspaceId]/transactions/route.ts */
// API 라우트 핸들러: /api/transactions
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { User as NextAuthUser } from "next-auth";
import {
  CreateTransactionSchema,
  GetTransactionsQuerySchema,
} from "@/lib/schemas/transactionsApiSchemas";
import {
  createTransaction,
  getTransactions,
} from "@/services/transactionService";
import { ApiError, ValidationError } from "@/services/apiError";
import { WorkspaceIdParamSchema } from "@/lib/schemas/commonApiSchemas";

interface ContextParams {
  workspaceId: string;
}

/**
 * 거래 목록 조회 (GET /api/transactions)
 */
export async function GET(
  request: Request,
  context: { params: Promise<ContextParams> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }

    const userId = (session.user as NextAuthUser & { id: string }).id;
    const { workspaceId } = await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }

    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = GetTransactionsQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      throw new ValidationError(
        "요청 파라미터가 유효하지 않습니다.",
        validationResult.error.flatten().fieldErrors
      );
    }

    const transactions = await getTransactions(
      userId,
      validWorkspaceId,
      validationResult.data
    );
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("[API GET /api/transactions] error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * 새 거래 내역 생성 (POST /api/transactions)
 */
export async function POST(
  request: Request,
  context: { params: Promise<ContextParams> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }

    const userId = (session.user as NextAuthUser & { id: string }).id;
    const { workspaceId } = await context.params;

    const workspaceIdValidation = WorkspaceIdParamSchema.safeParse({
      workspaceId,
    });
    if (!workspaceIdValidation.success) {
      throw new ValidationError(
        "잘못된 워크스페이스 ID 형식입니다.",
        workspaceIdValidation.error.flatten().fieldErrors
      );
    }

    const validWorkspaceId = workspaceIdValidation.data.workspaceId;

    const body = await request.json();
    const validationResult = CreateTransactionSchema.safeParse(body);

    if (!validationResult.success) {
      throw new ValidationError(
        "요청 본문이 유효하지 않습니다.",
        validationResult.error.flatten().fieldErrors
      );
    }

    const createdTransaction = await createTransaction(
      userId,
      validWorkspaceId,
      validationResult.data
    );
    return NextResponse.json(createdTransaction, { status: 201 });
  } catch (error) {
    console.error("[API POST /api/transactions] error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
```

```ts
/* ./src/app/api/workspaces/route.ts */
// app/api/workspaces/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { createWorkspace } from "@/services/workspaceService";
import { CreateWorkspaceSchema } from "@/lib/schemas/workspaceApiSchemas"; // Zod 스키마 경로
import { ApiError, ValidationError } from "@/services/apiError";
import { User as NextAuthUser } from "next-auth"; // NextAuth User 타입

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !session.user ||
      !(session.user as NextAuthUser & { id: string }).id
    ) {
      return NextResponse.json(
        { error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }
    const userId = (session.user as NextAuthUser & { id: string }).id;

    const body = await request.json();
    const validationResult = CreateWorkspaceSchema.safeParse(body);

    if (!validationResult.success) {
      throw new ValidationError(
        "요청 본문이 유효하지 않습니다.",
        validationResult.error.flatten().fieldErrors
      );
    }

    const { name } = validationResult.data;
    const newWorkspace = await createWorkspace(userId, name);

    return NextResponse.json(newWorkspace, { status: 201 });
  } catch (error) {
    console.error("[API POST /api/workspaces] error:", error);
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { error: "워크스페이스 생성 중 내부 서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
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
import type { CardIssuer } from '@/types/commonTypes'; // CardIssuer 타입 경로 수정 필요시 확인

/**
 * 지원되는 카드 발급사 목록
 * TransactionForm, TransactionEditModal, financeUtils 등에서 공통으로 사용됩니다.
 */
export const SUPPORTED_CARD_ISSUERS: CardIssuer[] = [
  'Shinhan Card',
  'Hyundai Card',
  'Samsung Card',
  'Lotte Card',
  'Woori Card',
  'Hana Card',
  'KB Kookmin Card',
  'BC Card',
  'NH Nonghyup Card',
  'Kwangju Bank',
  'Other',
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
  'Shinhan Card': { minApr: 9.5, maxApr: 19.9, referenceDate: '2024-06-01' },
  'Hyundai Card': { minApr: 7.9, maxApr: 19.9, referenceDate: '2024-11-01' },
  'Samsung Card': { minApr: 10.0, maxApr: 19.9, referenceDate: '2021-07-07' },
  'Lotte Card': { minApr: 8.1, maxApr: 19.9, referenceDate: '2023-09-01' },
  'Woori Card': { minApr: 8.6, maxApr: 19.9, referenceDate: '2024-07-01' },
  'Hana Card': { minApr: 9.2, maxApr: 19.95, referenceDate: '2021-07-01' },
  'KB Kookmin Card': { minApr: 8.6, maxApr: 19.9, referenceDate: '2023-09-16' },
  'BC Card': { minApr: 10.9, maxApr: 19.9, referenceDate: '2024-10-01' },
  'NH Nonghyup Card': { minApr: 11.1, maxApr: 19.9, referenceDate: '2024-07-01' },
  'Kwangju Bank': { minApr: 9.9, maxApr: 19.0, referenceDate: '2025-01-01' },
  Other: { minApr: 10.0, maxApr: 19.9, referenceDate: 'N/A' }, // 기본값
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
import useSWR from "swr";
import { fetcher } from "@/lib/fetchers"; // 에러 처리가 포함된 fetcher 사용
import type { KpiData } from "@/types/kpiTypes";
import type {
  MonthlyStatsData,
  CategoryStatsData,
  SpendingPatternStats, // 타입 경로 수정 가능성 있음
  IncomeSourceStats, // 타입 경로 수정 가능성 있음
  BudgetVsActualStats, // 타입 경로 수정 가능성 있음
} from "@/types/statisticsTypes"; // 구체적인 통계 타입 사용
import type { TransactionData } from "@/types/transactionTypes";
import type { CategoryOption } from "@/types/categoryTypes";
import type { TrendChartItemData } from "@/types/chartTypes"; // TrendChartItemData 타입 사용
import {
  STATS_ENDPOINT,
  TRANSACTIONS_ENDPOINT,
  CATEGORIES_ENDPOINT,
  INSIGHTS_ENDPOINT,
} from "@/constants/apiEndpoints"; // API 엔드포인트 상수 사용
import { InsightsApiResponse } from "@/types/insightTypes";
import { useWorkspaceStore } from "@/stores/workspaceStore";

// Trend API 응답 타입 (예시, 실제 API 응답 구조에 맞게 정의 필요)
// statisticsService.getTrendStats의 반환 타입과 일치해야 함
export interface TrendApiResponse {
  period: "day" | "month" | "year";
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
  period: "month" | "year" = "month"
) =>
  workspaceId
    ? `${STATS_ENDPOINT(workspaceId)}?type=category&${
        period === "month"
          ? `month=${selectedMonth}`
          : `year=${selectedMonth.substring(0, 4)}`
      }&period=${period}`
    : null;

export const getTransactionsSWRKey = (
  workspaceId: string,
  filters: UseDashboardDataProps["appliedFilters"]
) => {
  if (!workspaceId) return null;
  const params = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate,
    sortBy: "date",
    sortOrder: "desc",
  });
  if (filters.type) params.append("type", filters.type);
  if (filters.categoryId) params.append("categoryId", filters.categoryId);
  return `${TRANSACTIONS_ENDPOINT(workspaceId)}?${params.toString()}`;
};

export const getCategoryOptionsSWRKey = (workspaceId: string) =>
  workspaceId ? CATEGORIES_ENDPOINT(workspaceId) : null;

export const getTrendDataSWRKey = (
  workspaceId: string,
  selectedMonth: string
) =>
  workspaceId
    ? `${STATS_ENDPOINT(
        workspaceId
      )}?type=trend&period=day&month=${selectedMonth}`
    : null;

export const getSpendingPatternSWRKey = (
  workspaceId: string,
  selectedMonth: string
) =>
  workspaceId
    ? `${STATS_ENDPOINT(
        workspaceId
      )}?type=spendingPattern&month=${selectedMonth}`
    : null;

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

export const getBudgetVsActualSWRKey = (
  workspaceId: string,
  selectedMonth: string
) =>
  workspaceId
    ? `${STATS_ENDPOINT(
        workspaceId
      )}?type=budgetVsActual&month=${selectedMonth}`
    : null;

export const getInsightsSWRKey = (workspaceId: string, selectedMonth: string) =>
  workspaceId
    ? `${INSIGHTS_ENDPOINT(workspaceId)}?month=${selectedMonth}`
    : null;

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
    activeWorkspaceId
      ? getKpiSWRKey(activeWorkspaceId, selectedMonth, compareWithPrevious)
      : null,
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
      ? getMonthlyStatsSWRKey(
          activeWorkspaceId,
          selectedMonth,
          compareWithPrevious
        )
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
    activeWorkspaceId
      ? getCategoryStatsSWRKey(activeWorkspaceId, selectedMonth, "month")
      : null,
    fetcher
  );

  // 트렌드 데이터 페칭
  const {
    data: trendStatsData,
    error: trendDataError,
    isLoading: trendStatsIsLoading,
    mutate: mutateTrendStatsData,
  } = useSWR<TrendApiResponse>(
    activeWorkspaceId
      ? getTrendDataSWRKey(activeWorkspaceId, selectedMonth)
      : null,
    fetcher
  );

  // 거래 내역 데이터 페칭
  const {
    data: transactions,
    error: transactionsError,
    isLoading: transactionsIsLoading,
    mutate: mutateTransactions,
  } = useSWR<TransactionData[]>(
    activeWorkspaceId
      ? getTransactionsSWRKey(activeWorkspaceId, appliedFilters)
      : null,
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
      ? getIncomeSourceSWRKey(
          activeWorkspaceId,
          selectedMonth,
          compareWithPrevious
        )
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
    activeWorkspaceId
      ? getInsightsSWRKey(activeWorkspaceId, selectedMonth)
      : null,
    fetcher
  );

  // 실제 인사이트 배열은 insightsResponse.insights 에서 추출
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
    ? spendingPatternIsLoading ||
      incomeSourceIsLoading ||
      budgetVsActualIsLoading
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

  return {
    // 기본 데이터
    kpiData,
    monthlyStats,
    categoryStats,
    trendStatsData, // dailyTrend와 중복 가능성 인지
    transactions,
    categoryOptions,

    // 추가 분석 데이터 (조건부)
    spendingPatternData, // includeExtraStats가 false면 undefined
    incomeSourceData, // includeExtraStats가 false면 undefined
    budgetVsActualData, // includeExtraStats가 false면 undefined

    insightsData, // 실제 인사이트 배열
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
    // 또는 필요한 mutate 함수만 직접 반환: mutateTransactions, mutateKpiData 등
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
  // pages: {
  //   signIn: '/auth/signin',
  //   signOut: '/auth/signout',
  //   error: '/auth/error',
  //   verifyRequest: '/auth/verify-request',
  //   newUser: '/auth/new-user'
  // },

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
import {
  startOfMonth,
  endOfMonth,
  format,
  eachMonthOfInterval,
} from "date-fns";

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
  const months = eachMonthOfInterval({ start, end });
  const monthlyDataPromises = months.map(async (month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthStr = format(month, "yyyy-MM");
    const stats = await getStatsByDateRangeDb(
      workspaceId,
      monthStart,
      monthEnd
    );
    return {
      date: monthStr, // 'month' 대신 'date' 속성으로 통일 (TrendChart 호환성)
      expense: stats.expense,
      income: stats.income,
    };
  });

  const resolvedMonthlyData = await Promise.all(monthlyDataPromises);
  return resolvedMonthlyData.sort((a, b) => a.date.localeCompare(b.date));
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
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const yearlyDataPromises = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearStart = new Date(year, 0, 1); // 1월 1일
    const yearEnd = new Date(year, 11, 31); // 12월 31일

    if (yearEnd < start || yearStart > end) continue;

    const effectiveStart = yearStart < start ? start : yearStart;
    const effectiveEnd = yearEnd > end ? end : yearEnd;

    yearlyDataPromises.push(
      (async () => {
        const stats = await getStatsByDateRangeDb(
          workspaceId,
          effectiveStart,
          effectiveEnd
        );
        return {
          year: year.toString(),
          expense: stats.expense,
          income: stats.income,
        };
      })()
    );
  }
  const resolvedYearlyData = await Promise.all(yearlyDataPromises);
  return resolvedYearlyData.sort((a, b) => a.year.localeCompare(b.year));
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
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  CreateTransactionPayload,
  UpdateTransactionPayload,
  GetTransactionsQuery,
} from "@/lib/schemas/transactionsApiSchemas";
import { calculateEstimatedInstallmentFee } from "@/lib/financeUtils";
// 새로 추가된 유틸리티 함수 임포트 (경로는 실제 프로젝트 구조에 맞게 조정)
import {
  calculateInstallmentAmounts,
  calculateNthInstallmentPaymentDate,
} from "@/lib/financeUtils"; // 기존 financeUtils.ts에 추가 가정
import { startOfDay } from "date-fns";

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
      workspaceId, // 추가
      createdById, // 추가
    } = data;

    const purchaseDate = new Date(purchaseDateString);

    // 할부 원거래의 경우, 'amount' 필드에 'totalInstallmentAmount'를 사용.
    // 'totalInstallmentAmount'가 없으면 API 요청의 'amount'를 총액으로 간주.
    const actualTotalInstallmentAmount = isInstallment
      ? totalInstallmentAmount || amount
      : amount;

    let estimatedFee: number | null = null;
    if (
      isInstallment &&
      type === "expense" &&
      actualTotalInstallmentAmount &&
      installmentMonths &&
      installmentMonths >= 2
    ) {
      estimatedFee = calculateEstimatedInstallmentFee(
        actualTotalInstallmentAmount,
        installmentMonths,
        installmentCardIssuer,
        "max"
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
        totalInstallmentAmount: isInstallment
          ? actualTotalInstallmentAmount
          : null,
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
      type === "expense" &&
      installmentMonths &&
      installmentMonths > 0 &&
      actualTotalInstallmentAmount &&
      actualTotalInstallmentAmount > 0
    ) {
      const installmentAmounts = calculateInstallmentAmounts(
        actualTotalInstallmentAmount,
        installmentMonths
      );

      for (let i = 0; i < installmentMonths; i++) {
        const paymentDate = calculateNthInstallmentPaymentDate(
          purchaseDate,
          i + 1
        ); // 1회차부터 시작
        const singleInstallmentAmount = installmentAmounts[i];

        await tx.transaction.create({
          data: {
            date: paymentDate,
            amount: singleInstallmentAmount,
            type,
            description: `${description || "할부"} (${
              i + 1
            }/${installmentMonths}회)`,
            category: { connect: { id: categoryId } },
            isInstallment: true,
            installmentMonths,
            currentInstallmentNumber: i + 1,
            totalInstallmentAmount: actualTotalInstallmentAmount,
            originalTransactionId: originalTransaction.id,
            installmentCardIssuer,
            estimatedInstallmentFee: null,
            workspace: { connect: { id: workspaceId } }, // 워크스페이스 연결
            createdBy: { connect: { id: createdById } }, // 작성자 연결 (개별 할부금도 동일인으로 설정)
          },
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
export async function updateTransactionDb(
  id: number,
  data: UpdateTransactionDbPayload
) {
  const { workspaceId, ...updatePayload } = data;

  return prisma.$transaction(async (tx) => {
    // 1. 기존 거래 정보 조회
    const existingTransaction = await tx.transaction.findUnique({
      where: { id, workspaceId }, // workspaceId 조건 추가
    });

    if (!existingTransaction) {
      console.error(
        `[updateTransactionDb] Transaction not found for ID: ${id}`
      );
      throw new Error(`수정할 거래(ID: ${id})를 찾을 수 없습니다.`);
    }
    console.log(
      `[updateTransactionDb] Found existing transaction:`,
      existingTransaction
    );

    // 2. 이 거래가 '할부 원거래'였는지 확인
    const wasOriginalInstallment =
      existingTransaction.isInstallment &&
      !existingTransaction.originalTransactionId;
    console.log(
      `[updateTransactionDb] Was original installment? ${wasOriginalInstallment}`
    ); // <<-- 로그 추가 (3)

    // 3. '할부 원거래'였다면, 연결된 기존 개별 할부금 레코드들을 먼저 삭제
    if (wasOriginalInstallment) {
      console.log(
        `[updateTransactionDb] Attempting to delete child installments for original ID: ${id}`
      );
      const deleteResult = await tx.transaction.deleteMany({
        // deleteResult 변수 추가
        where: { originalTransactionId: id, workspaceId },
      });
      console.log(
        `[updateTransactionDb] Deleted ${deleteResult.count} child installments.`
      ); // <<-- 로그 추가 (4) - 삭제된 개수 확인
    }

    // 4. 업데이트 데이터 준비 (기존 로직과 동일)
    const updateDataForTarget: Prisma.TransactionUpdateInput = {};

    if (updatePayload.date)
      updateDataForTarget.date = new Date(updatePayload.date);
    if (updatePayload.type) updateDataForTarget.type = updatePayload.type;
    if (updatePayload.description !== undefined)
      updateDataForTarget.description = data.description;

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
          updatePayload.amount !== undefined
            ? updatePayload.amount
            : existingTransaction.amount; // 기존 회차 금액 유지
        updateDataForTarget.currentInstallmentNumber =
          updatePayload.currentInstallmentNumber !== undefined
            ? updatePayload.currentInstallmentNumber
            : existingTransaction.currentInstallmentNumber; // 기존 회차 정보 유지
        updateDataForTarget.originalTransactionId =
          existingTransaction.originalTransactionId; // 기존 원거래 ID 유지

        // 개별 할부금 수정 시에는 estimatedInstallmentFee를 원거래 기준으로 재계산하지 않거나, null로 설정합니다.
        updateDataForTarget.estimatedInstallmentFee =
          existingTransaction.estimatedInstallmentFee; // 또는 null
      } else {
        // --- 할부 원거래를 생성 또는 수정하는 경우 ---
        if ((updatePayload.type || existingTransaction.type) === "income") {
          throw new Error("수입 거래는 할부로 설정할 수 없습니다.");
        }
        // installmentMonths, totalInstallmentAmount, installmentCardIssuer 유효성 검사는 스키마 및 API 핸들러에서 처리됨을 가정합니다.
        if (!newInstallmentMonths || newInstallmentMonths < 2) {
          throw new Error("할부 개월수는 2개월 이상이어야 합니다.");
        }
        if (!newTotalInstallmentAmount || newTotalInstallmentAmount <= 0) {
          throw new Error("총 할부 금액은 0보다 커야 합니다.");
        }
        // 카드사 정보는 newInstallmentCardIssuer를 사용 (payload에 없으면 existingTransaction 값)

        updateDataForTarget.isInstallment = true;
        updateDataForTarget.installmentMonths = newInstallmentMonths;
        updateDataForTarget.totalInstallmentAmount = newTotalInstallmentAmount;
        updateDataForTarget.installmentCardIssuer = newInstallmentCardIssuer;
        updateDataForTarget.amount = newTotalInstallmentAmount; // 원거래 amount는 총액
        updateDataForTarget.currentInstallmentNumber = null; // 원거래는 회차 정보 없음
        updateDataForTarget.originalTransactionId = null; // 원거래는 스스로가 원거래
        updateDataForTarget.estimatedInstallmentFee =
          calculateEstimatedInstallmentFee(
            newTotalInstallmentAmount,
            newInstallmentMonths,
            newInstallmentCardIssuer,
            "max"
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
          existingTransaction.totalInstallmentAmount ||
          existingTransaction.amount;
      }
    }

    console.log(
      `[updateTransactionDb] Prepared update data for ID ${id}:`,
      updateDataForTarget
    ); // <<-- 로그 추가 (5)

    // 5. 전달된 ID의 레코드 업데이트 실행
    const updatedTransaction = await tx.transaction.update({
      where: { id },
      data: updateDataForTarget,
    });
    console.log("Updated transaction (ID:%s):", id, updatedTransaction);

    // 6. 새로운 조건으로 개별 할부금 레코드 재생성 (조건 수정됨)
    const shouldRegenerateChildren =
      updatedTransaction.isInstallment &&
      updatedTransaction.type === "expense" &&
      updatedTransaction.installmentMonths &&
      updatedTransaction.installmentMonths > 0 &&
      updatedTransaction.totalInstallmentAmount &&
      updatedTransaction.totalInstallmentAmount > 0 &&
      !updatedTransaction.originalTransactionId; // <<-- 핵심 조건!

    if (shouldRegenerateChildren) {
      console.log(
        "Regenerating child installments for original ID:",
        updatedTransaction.id
      );
      const installmentAmounts = calculateInstallmentAmounts(
        updatedTransaction.totalInstallmentAmount as number,
        updatedTransaction.installmentMonths as number
      );
      const basePurchaseDate = updatedTransaction.date; // 재생성 기준일은 원거래의 날짜

      for (
        let i = 0;
        i < (updatedTransaction.installmentMonths as number);
        i++
      ) {
        const paymentDate = calculateNthInstallmentPaymentDate(
          basePurchaseDate,
          i + 1
        );
        const singleInstallmentAmount = installmentAmounts[i];

        await tx.transaction.create({
          data: {
            date: paymentDate,
            amount: singleInstallmentAmount,
            type: updatedTransaction.type,
            description: `${updatedTransaction.description || "할부"} (${
              i + 1
            }/${updatedTransaction.installmentMonths}회)`,
            category: { connect: { id: updatedTransaction.categoryId } },
            isInstallment: true,
            installmentMonths: updatedTransaction.installmentMonths,
            currentInstallmentNumber: i + 1,
            totalInstallmentAmount: updatedTransaction.totalInstallmentAmount,
            originalTransactionId: updatedTransaction.id, // 올바른 원거래 ID 연결
            installmentCardIssuer: updatedTransaction.installmentCardIssuer,
            estimatedInstallmentFee: null,
            workspace: { connect: { id: workspaceId } },
            createdBy: { connect: { id: existingTransaction.createdById! } },
          },
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

    if (
      !transactionToDelete ||
      transactionToDelete.workspaceId !== workspaceId
    ) {
      throw new Error(
        `삭제할 거래(ID: ${id})를 찾을 수 없거나 권한이 없습니다.`
      );
    }

    if (
      transactionToDelete.isInstallment &&
      !transactionToDelete.originalTransactionId
    ) {
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
    workspaceId, // 추가
    type,
    startDate,
    endDate,
    categoryId,
    keyword,
    minAmount,
    maxAmount,
    sortBy = "date",
    sortOrder = "desc",
    isInstallment,
    originalTransactionId,
  } = query;

  const filter: Prisma.TransactionWhereInput = {
    workspaceId, // 항상 workspaceId로 필터링
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
    filter.description = { contains: keyword, mode: "insensitive" };
  }
  if (minAmount !== undefined || maxAmount !== undefined) {
    filter.amount = {};
    if (minAmount !== undefined) filter.amount.gte = minAmount;
    if (maxAmount !== undefined) filter.amount.lte = maxAmount;
  }

  if (isInstallment !== undefined) {
    filter.isInstallment = isInstallment;
    if (isInstallment === false) {
      // 일반 거래만 조회 (isInstallment가 명시적으로 false이거나, 아예 null인 경우)
      filter.OR = [{ isInstallment: false }, { isInstallment: null }];
    }
    // isInstallment: true의 경우, originalTransactionId 유무에 따라 원거래/개별할부금 구분 가능
  }
  if (originalTransactionId !== undefined) {
    filter.originalTransactionId = originalTransactionId;
    filter.isInstallment = true; // 특정 원거래에 연결된 할부금은 항상 isInstallment: true
  }

  const orderBy: Prisma.TransactionOrderByWithRelationInput = {};
  if (sortBy === "category.name") {
    orderBy.category = { name: sortOrder };
  } else if (
    sortBy === "date" ||
    sortBy === "amount" ||
    sortBy === "isInstallment"
  ) {
    orderBy[sortBy] = sortOrder;
  } else {
    orderBy["date"] = sortOrder;
  }

  return prisma.transaction.findMany({
    where: filter,
    include: { category: true },
    orderBy,
  });
}

export async function findCategoryByIdDb(categoryId: number) {
  return prisma.category.findUnique({ where: { id: categoryId } });
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

import { CARD_INSTALLMENT_RATES_INFO } from '@/constants/cardIssuers';
import { addMonths, setDate, startOfDay } from 'date-fns';

/**
 * 선택된 카드사와 할부 정보에 기반하여 예상 수수료를 계산합니다.
 * @param principal 할부 원금 (totalInstallmentAmount)
 * @param months 할부 개월 수
 * @param cardIssuer 선택된 카드사 이름
 * @param estimationMethod 사용할 수수료율 ( 'max', 'average', 'min' 등)
 * @returns 계산된 예상 할부 수수료 (소수점 반올림)
 */
export function calculateEstimatedInstallmentFee(
  principal: number,
  months: number,
  cardIssuer?: string | null,
  estimationMethod: 'max' | 'average' | 'min' = 'max' // 기본값: 최댓값 사용 (보수적 추정)
): number {
  if (principal <= 0 || months < 2 || !cardIssuer) {
    return 0;
  }

  const rateInfo = CARD_INSTALLMENT_RATES_INFO[cardIssuer] || CARD_INSTALLMENT_RATES_INFO['Other'];
  let annualRate: number;

  // 사용할 수수료율 선택
  switch (estimationMethod) {
    case 'min':
      annualRate = rateInfo.minApr;
      break;
    case 'average':
      annualRate = (rateInfo.minApr + rateInfo.maxApr) / 2;
      break;
    case 'max':
    default:
      annualRate = rateInfo.maxApr;
  }

  if (annualRate <= 0) {
    return 0; // 유효하지 않은 수수료율
  }

  // [원금 * 연이율 * (개월수 + 1) / 2] / 12 공식 사용
  const rateDecimal = annualRate / 100;
  const estimatedFee = (principal * rateDecimal * (months + 1)) / 2 / 12;

  console.log(
    `[Fee Calculation] Principal: ${principal}, Months: ${months}, Card: ${cardIssuer}, Rate Used: ${annualRate}% (${estimationMethod}), Estimated Fee: ${estimatedFee}`
  );

  return Math.round(estimatedFee); // 정수로 반올림하여 반환
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
  const baseDate = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate;
  // 첫 번째 할부금은 구매일이 속한 달의 다음 달 10일입니다.
  // 따라서, (회차)만큼 월을 더한 후 10일로 설정합니다.
  const paymentMonthDate = addMonths(baseDate, installmentNumber);
  return startOfDay(setDate(paymentMonthDate, 10));
}

/**
 * 총 할부 금액을 개월 수로 나누어 각 회차별 금액 배열을 반환합니다.
 * 잔액은 마지막 회차에 포함됩니다.
 * @param totalAmount 총 할부 금액
 * @param months 할부 개월 수
 * @returns 각 회차별 납부 금액 배열
 */
export function calculateInstallmentAmounts(totalAmount: number, months: number): number[] {
  if (months <= 0) {
    // console.warn("할부 개월 수는 0보다 커야 합니다.");
    return []; // 또는 에러 throw
  }
  if (totalAmount < 0) {
    // console.warn("총 할부 금액은 0 이상이어야 합니다.");
    return Array(months).fill(0); // 또는 에러 throw
  }

  const amounts = new Array(months).fill(0);
  const baseInstallment = Math.floor(totalAmount / months);
  const remainder = totalAmount % months;

  for (let i = 0; i < months; i++) {
    amounts[i] = baseInstallment;
  }

  // 남은 금액(1원 단위)을 첫 회차부터 분배
  for (let i = 0; i < remainder; i++) {
    amounts[i] += 1;
  }

  // 만약 총액이 개월수보다 작아서 baseInstallment가 0이고 remainder만 있는 경우 처리
  // (예: 2원 / 3개월 -> [1, 1, 0] 또는 [0,1,1] 또는 [1,0,1])
  // 위의 로직은 [1,1,0] 을 만듭니다.
  // 일반적인 방식은 마지막 회차에 몰아주는 것입니다. 아래는 그 방식입니다.
  if (months > 0 && totalAmount >= 0) {
    const preciseBaseAmount = parseFloat((totalAmount / months).toPrecision(15)); // 부동소수점 정밀도 고려
    for (let i = 0; i < months - 1; i++) {
      amounts[i] = parseFloat(preciseBaseAmount.toFixed(0)); // 가장 가까운 정수로 반올림 또는 버림 (정책에 따라)
      // 여기서는 소수점 버림 후 정수로 변환하는 효과에 가까움 (floor와 유사)
      // 은행 방식은 보통 원단위 절사 후 마지막회차 정산이므로 toFixed(0) 후 parseFloat.
      // 더 정확하려면 금융 라이브러리(decimal.js 등) 사용 고려
    }
    const sumOfInitialInstallments = amounts
      .slice(0, months - 1)
      .reduce((acc, val) => acc + val, 0);
    amounts[months - 1] = totalAmount - sumOfInitialInstallments;
    return amounts;
  }

  return amounts;
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
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query'],
  }).$extends(withAccelerate());

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
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
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "ID는 유효한 양의 숫자여야 합니다.",
    }),
});

export type BudgetParam = z.infer<typeof BudgetParamSchema>;
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
/* ./src/middleware.ts */
// middleware.ts (또는 src/middleware.ts)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // NextAuth.js 내부 API 경로는 제외
  if (pathname.startsWith("/api/auth/")) {
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
import { prisma } from "@/lib/prisma";
import {
  getMonthlyStatsService,
  getBudgetVsActualStatsService,
} from "@/services/statisticsService";
import { getTransactions } from "@/services/transactionService";
import type {
  MonthlyStatsData,
  BudgetVsActualStats,
} from "@/types/statisticsTypes";
import type { TransactionData } from "@/types/transactionTypes";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  addDays,
  parseISO,
  differenceInDays,
  getDate,
} from "date-fns";
import { v4 as uuidv4 } from "uuid"; // 고유 ID 생성을 위해 uuid 추가
import { ForbiddenError } from "./apiError";

// 인사이트 타입 정의 (초기)
export interface Insight {
  id: string; // 고유 식별자 (예: uuid)
  type: InsightType; // 인사이트 종류 (예: 'BUDGET_OVERRUN_WARNING')
  severity: "info" | "warning" | "critical"; // 심각도
  title: string; // 인사이트 제목
  message: string; // 사용자에게 보여질 메시지
  detailsLink?: string; // 관련 상세 정보 페이지 링크 (선택)
  data?: Record<string, unknown>; // 인사이트 생성에 사용된 추가 데이터 (선택)
  generatedAt: string; // 생성 시각 (ISO 문자열)
}

export enum InsightType {
  // MVP
  CATEGORY_SPENDING_INCREASE = "CATEGORY_SPENDING_INCREASE",
  CATEGORY_SPENDING_DECREASE = "CATEGORY_SPENDING_DECREASE",
  BUDGET_NEARING_LIMIT = "BUDGET_NEARING_LIMIT",
  BUDGET_OVERRUN_WARNING = "BUDGET_OVERRUN_WARNING",
  RECENT_HIGH_SPENDING_ALERT = "RECENT_HIGH_SPENDING_ALERT",
  // Post-MVP (구현 대상)
  INCOME_SPIKE_ALERT = "INCOME_SPIKE_ALERT", // 수입 급증 알림
  POSITIVE_MONTHLY_BALANCE = "POSITIVE_MONTHLY_BALANCE", // 월간 긍정적 잔액 (SAVING_GOAL_PROGRESS 단순화)
  POTENTIAL_SUBSCRIPTION_REMINDER = "POTENTIAL_SUBSCRIPTION_REMINDER", // 구독 결제일 알림 (추정 기반)
}

// 주요 지출 카테고리 (예시, 추후 설정 또는 동적 분석으로 변경 가능)
const MAJOR_EXPENSE_CATEGORIES = ["식비", "교통비", "생활용품"]; // 카테고리 이름 또는 ID
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

    const membership = await prisma.workspaceUser.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) {
      throw new ForbiddenError(
        "이 워크스페이스의 인사이트를 생성할 권한이 없습니다."
      );
    }

    try {
      // 1. 필요한 데이터 페칭
      // 월별 통계 (compareWithPrevious=true로 이전 달 데이터 포함)
      const monthlyStats = await getMonthlyStatsService(
        userId,
        workspaceId,
        month,
        true
      );
      const budgetVsActualData = await getBudgetVsActualStatsService(
        userId,
        workspaceId,
        month
      );

      // 최근 N일간 지출 내역
      const recentTransactions = await getTransactions(userId, workspaceId, {
        startDate: format(
          subDays(today, HIGH_SPENDING_CHECK_DAYS - 1),
          "yyyy-MM-dd"
        ),
        endDate: format(today, "yyyy-MM-dd"),
        type: "expense",
        sortBy: "date",
        sortOrder: "desc",
      });

      // 이번 달 전체 거래 내역 (구독 알림용)
      const currentMonthTransactions = await getTransactions(
        userId,
        workspaceId,
        {
          startDate: format(startOfMonth(currentMonthDate), "yyyy-MM-dd"),
          endDate: format(endOfMonth(currentMonthDate), "yyyy-MM-dd"),
          type: "expense", // 지출만 대상
        }
      );

      // 이전 달 전체 거래 내역 (구독 알림 비교용)
      const previousMonthStartDate = startOfMonth(
        subDays(startOfMonth(currentMonthDate), 1)
      );
      const previousMonthEndDate = endOfMonth(previousMonthStartDate);
      const previousMonthTransactions = await getTransactions(
        userId,
        workspaceId,
        {
          startDate: format(previousMonthStartDate, "yyyy-MM-dd"),
          endDate: format(previousMonthEndDate, "yyyy-MM-dd"),
          type: "expense",
        }
      );

      // 2. 각 인사이트 생성 로직 호출
      insights.push(
        ...this._generateBudgetOverrunInsights(
          budgetVsActualData,
          currentIsoString,
          month
        )
      );
      insights.push(
        ...this._generateCategorySpendingChangeInsights(
          monthlyStats,
          currentIsoString
        )
      );
      insights.push(
        ...this._generateRecentHighSpendingInsights(
          recentTransactions,
          currentIsoString
        )
      );

      // --- TODO 완료: 다른 인사이트 생성 로직 추가 ---
      insights.push(
        ...this._generateIncomeSpikeAlerts(monthlyStats, currentIsoString)
      );
      insights.push(
        ...this._generatePositiveMonthlyBalanceAlerts(
          monthlyStats,
          currentIsoString,
          month
        )
      );
      insights.push(
        ...this._generatePotentialSubscriptionReminders(
          currentMonthTransactions,
          previousMonthTransactions,
          currentIsoString,
          month
        )
      );
      // --- TODO 완료 끝 ---

      return insights
        .filter((insight) => insight != null) // null인 인사이트 제거
        .sort(
          (a, b) =>
            new Date(b.generatedAt).getTime() -
            new Date(a.generatedAt).getTime()
        );
    } catch (error) {
      console.error(
        `[InsightService] Error generating insights for ${month}:`,
        error
      );
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
            severity: "critical",
            title: `${item.category} 예산 초과!`,
            message: `${item.category} 예산을 ${Math.abs(
              item.difference
            ).toLocaleString()}원 초과했습니다. (사용률: ${(
              usageRatio * 100
            ).toFixed(0)}%)`,
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
            severity: "warning",
            title: `${item.category} 예산 소진 임박`,
            message: `${item.category} 예산의 ${(usageRatio * 100).toFixed(
              0
            )}%를 사용했습니다. 남은 예산: ${(
              item.budget - item.actual
            ).toLocaleString()}원`,
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
      const currentCategory = currentExpenses.find(
        (c) => c.categoryName === categoryName
      );
      const previousCategory = previousExpenses.find(
        (c) => c.categoryName === categoryName
      );

      if (currentCategory && previousCategory && previousCategory.amount > 0) {
        const change = currentCategory.amount - previousCategory.amount;
        const percentageChange = (change / previousCategory.amount) * 100;

        if (Math.abs(percentageChange) >= 20 && Math.abs(change) >= 30000) {
          const type =
            change > 0
              ? InsightType.CATEGORY_SPENDING_INCREASE
              : InsightType.CATEGORY_SPENDING_DECREASE;
          const title = `${categoryName} 지출 ${change > 0 ? "증가" : "감소"}`;
          const message = `지난 달 대비 ${categoryName} 지출이 ${percentageChange.toFixed(
            0
          )}% (${change.toLocaleString()}원) ${
            change > 0 ? "증가했습니다" : "감소했습니다"
          }. 현재 ${currentCategory.amount.toLocaleString()}원 / 이전 ${previousCategory.amount.toLocaleString()}원`;

          insights.push({
            id: uuidv4(),
            type,
            severity: "info",
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
    const highSpends = transactions.filter(
      (tx) => tx.amount >= HIGH_SPENDING_THRESHOLD_AMOUNT
    );

    if (highSpends.length > 0) {
      const totalHighSpendingAmount = highSpends.reduce(
        (sum, tx) => sum + tx.amount,
        0
      );
      insights.push({
        id: uuidv4(),
        type: InsightType.RECENT_HIGH_SPENDING_ALERT,
        severity: "warning",
        title: `최근 ${HIGH_SPENDING_CHECK_DAYS}일간 고액 지출 발생`,
        message: `최근 ${HIGH_SPENDING_CHECK_DAYS}일 동안 ${HIGH_SPENDING_THRESHOLD_AMOUNT.toLocaleString()}원 이상 지출이 ${
          highSpends.length
        }건 (총 ${totalHighSpendingAmount.toLocaleString()}원) 발생했습니다.`,
        detailsLink: `/dashboard/transactions?startDate=${format(
          subDays(new Date(), HIGH_SPENDING_CHECK_DAYS - 1),
          "yyyy-MM-dd"
        )}&endDate=${format(
          new Date(),
          "yyyy-MM-dd"
        )}&minAmount=${HIGH_SPENDING_THRESHOLD_AMOUNT}`,
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
        severity: "info",
        title: "🎉 월 수입 증가!",
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
        severity: "info",
        title: "👍 훌륭한 저축 진행!",
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
    const reminderEndDate = addDays(
      today,
      SUBSCRIPTION_REMINDER_LOOKAHEAD_DAYS
    );

    // 이미 이번 달에 처리된 "유사한" 거래는 알림에서 제외하기 위한 목록
    const processedThisMonthDescriptions: Set<string> = new Set();
    currentMonthTransactions.forEach((tx) => {
      if (tx.description) processedThisMonthDescriptions.add(tx.description);
    });

    for (const prevTx of previousMonthTransactions) {
      // 지출이고, 설명이 있고, 할부 원거래가 아닌 경우 (개별 할부금은 제외)
      if (
        prevTx.type === "expense" &&
        prevTx.description &&
        !(!prevTx.isInstallment || prevTx.originalTransactionId)
      ) {
        // 지난 달 거래 날짜에서 "일"만 가져옴
        const prevTxDayOfMonth = getDate(parseISO(prevTx.date));

        // 예상 결제일 (이번 달의 해당 일)
        // currentReportMonth는 'YYYY-MM' 형식이므로, 해당 월의 날짜로 Date 객체 생성
        const expectedPaymentDateThisMonth = parseISO(
          `${currentReportMonth}-${String(prevTxDayOfMonth).padStart(2, "0")}`
        );

        // 예상 결제일이 알림 기간 내에 있고, 오늘보다 이후이며, 아직 이번 달에 유사한 거래가 없다면 알림
        if (
          differenceInDays(expectedPaymentDateThisMonth, reminderStartDate) >=
            0 &&
          differenceInDays(expectedPaymentDateThisMonth, reminderEndDate) <=
            0 &&
          !processedThisMonthDescriptions.has(prevTx.description) // 설명 기반으로 단순 중복 방지
        ) {
          // 추가 검증: 지난 달 거래와 "유사한" 거래가 이번 달에 이미 발생했는지 다시 한번 확인 (금액 유사성)
          const alreadyPaidThisMonth = currentMonthTransactions.find(
            (currTx) =>
              currTx.description === prevTx.description &&
              (Math.abs(currTx.amount - prevTx.amount) / prevTx.amount) * 100 <=
                SUBSCRIPTION_AMOUNT_DEVIATION_PERCENT
          );

          if (!alreadyPaidThisMonth) {
            insights.push({
              id: uuidv4(),
              type: InsightType.POTENTIAL_SUBSCRIPTION_REMINDER,
              severity: "info",
              title: "🔔 정기 결제 예정 알림 (추정)",
              message: `[${prevTx.description}] 항목이 ${format(
                expectedPaymentDateThisMonth,
                "M월 d일"
              )}경 결제될 것으로 예상됩니다. (지난 달 ${prevTx.amount.toLocaleString()}원 기준)`,
              detailsLink: `/dashboard/transactions?keyword=${encodeURIComponent(
                prevTx.description
              )}`, // 관련 거래 검색 링크
              data: {
                description: prevTx.description,
                lastAmount: prevTx.amount,
                expectedDate: format(
                  expectedPaymentDateThisMonth,
                  "yyyy-MM-dd"
                ),
                prevTxDate: prevTx.date,
              },
              generatedAt,
            });
            // 동일 설명에 대한 알림은 하나만 생성
            processedThisMonthDescriptions.add(prevTx.description);
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
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const incomeByCategory = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { workspaceId, date: { gte: start, lte: end }, type: "income" },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    });

    const totalIncome = incomeByCategory.reduce(
      (sum, item) => sum + (item._sum.amount || 0),
      0
    );
    const categoryIds = incomeByCategory
      .map((c) => c.categoryId)
      .filter((id) => id !== null) as number[];
    const categories =
      categoryIds.length > 0
        ? await prisma.category.findMany({ where: { id: { in: categoryIds } } })
        : [];

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
      const previousMonth = format(subMonths(date, 1), "yyyy-MM");
      const prevMonthStats = await getIncomeSourceStatsService(
        userId,
        workspaceId,
        previousMonth,
        false
      );
      previousData = prevMonthStats;
    }

    const trendData = [];
    for (let i = 5; i >= 0; i--) {
      const targetMonth = format(subMonths(date, i), "yyyy-MM");
      const targetStart = startOfMonth(subMonths(date, i));
      const targetEnd = endOfMonth(subMonths(date, i));
      const monthIncome = await prisma.transaction.aggregate({
        where: {
          workspaceId,
          date: { gte: targetStart, lte: targetEnd },
          type: "income",
        },
        _sum: { amount: true },
      });
      trendData.push({
        month: targetMonth,
        income: monthIncome._sum.amount || 0,
      });
    }

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

    const budgets = await prisma.budget.findMany({
      where: { workspaceId, month: monthStr },
      include: { category: true },
    });

    const expensesByCategory = await prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        workspaceId,
        date: { gte: start, lte: end },
        type: "expense",
        NOT: { isInstallment: true, originalTransactionId: null },
      },
      _sum: { amount: true },
    });

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
    const nonBudgetedExpensesPromises = expensesByCategory
      .filter(
        (e) =>
          e.categoryId !== null &&
          !budgetedCategoryIds.includes(e.categoryId as number)
      ) // Type assertion
      .map(async (e) => {
        const category = await prisma.category.findUnique({
          where: { id: e.categoryId as number },
        }); // Type assertion
        const actualAmount = e._sum.amount || 0;
        return {
          budgetId: null,
          category: category?.name || "알 수 없음",
          categoryId: e.categoryId as number, // Type assertion
          budget: 0,
          actual: actualAmount,
          difference: -actualAmount,
          percentage: Infinity,
        };
      });
    const nonBudgetedResults = await Promise.all(nonBudgetedExpensesPromises);
    const combinedData = [...budgetVsActualByCategory, ...nonBudgetedResults];

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
import type { TransactionData } from "@/types/transactionTypes";
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
): Promise<TransactionData[]> {
  const membership = await prisma.workspaceUser.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) {
    throw new ForbiddenError(
      "이 워크스페이스의 거래 내역을 조회할 권한이 없습니다."
    );
  }

  try {
    // DB 함수 호출 시 workspaceId를 query 객체에 포함하여 전달
    const transactions = await getTransactionsDb({ ...query, workspaceId });
    return transactions as unknown as TransactionData[];
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
import { prisma } from "@/lib/prisma"; // Prisma 클라이언트 경로 확인
import type { Workspace, WorkspaceRole } from "@prisma/client"; // Prisma 생성 타입
import { ApiError, ForbiddenError, ValidationError } from "./apiError"; // 기존 에러 클래스 활용

/**
 * 새 워크스페이스를 생성하고, 생성자를 ADMIN으로 등록합니다.
 * @param userId 워크스페이스를 생성하는 사용자 ID
 * @param name 워크스페이스 이름
 * @returns 생성된 Workspace 객체
 */
export async function createWorkspace(
  userId: string,
  name: string
): Promise<Workspace> {
  if (!userId) {
    throw new ValidationError("사용자 ID가 필요합니다.");
  }
  if (!name || name.trim() === "") {
    throw new ValidationError("워크스페이스 이름은 필수입니다.");
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
          role: "ADMIN" as WorkspaceRole, // Prisma Enum 값 사용
        },
      });

      return workspace;
    });
    return newWorkspace;
  } catch (error) {
    console.error("[WorkspaceService] createWorkspace error:", error);
    // 고유 제약 조건 위반 등 Prisma 에러 처리 추가 가능
    throw new ApiError("워크스페이스 생성 중 오류가 발생했습니다.");
  }
}

/**
 * 특정 사용자가 속한 모든 워크스페이스 목록을 조회합니다.
 * @param userId 사용자 ID
 * @returns 사용자가 속한 Workspace 객체 배열 (멤버십 정보 포함 가능)
 */
export async function getUserWorkspaces(
  userId: string
): Promise<(Workspace & { currentUserRole: WorkspaceRole })[]> {
  if (!userId) {
    throw new ValidationError("사용자 ID가 필요합니다.");
  }

  try {
    const workspaceUsers = await prisma.workspaceUser.findMany({
      where: { userId },
      include: {
        workspace: true, // Workspace 정보 함께 로드
      },
      orderBy: {
        workspace: {
          createdAt: "asc", // 또는 name 순 등
        },
      },
    });

    // Workspace 정보와 현재 사용자의 해당 워크스페이스 내 역할을 함께 반환
    return workspaceUsers.map((wu) => ({
      ...wu.workspace,
      currentUserRole: wu.role,
    }));
  } catch (error) {
    console.error("[WorkspaceService] getUserWorkspaces error:", error);
    throw new ApiError("워크스페이스 목록 조회 중 오류가 발생했습니다.");
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
    throw new ValidationError("사용자 ID와 워크스페이스 ID는 필수입니다.");
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
      throw new ForbiddenError("해당 워크스페이스에 접근 권한이 없습니다.");
    }

    return {
      ...workspaceUser.workspace,
      currentUserRole: workspaceUser.role,
    };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof ValidationError) {
      throw error;
    }
    console.error("[WorkspaceService] getWorkspaceById error:", error);
    throw new ApiError("워크스페이스 정보 조회 중 오류가 발생했습니다.");
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
export type CardIssuer =
  | 'Shinhan Card'
  | 'Hyundai Card'
  | 'Samsung Card'
  | 'Lotte Card'
  | 'Woori Card'
  | 'Hana Card'
  | 'KB Kookmin Card'
  | 'BC Card'
  | 'NH Nonghyup Card'
  | 'Kwangju Bank'
  | 'Other'; // 기타 또는 미선택 옵션

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
  sortOrder: 'asc' | 'desc';
}

export type ValueType = 'currency' | 'number' | 'percent';
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
  estimatedInstallmentFee?: number | null; // 예상 할부 수수료 (원거래에만 해당될 수 있음)
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
```

## tsx 파일

```tsx
/* ./src/app/dashboard/page.tsx */
/* ./src/app/dashboard/page.tsx */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import {
  PlusCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  ChartBarIcon,
  Bars3Icon,
  XMarkIcon,
  InformationCircleIcon,
  BuildingOffice2Icon,
  RectangleStackIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

import { useDashboardManager } from "@/hooks/useDashboardManager";
import { useDashboardData } from "@/hooks/useDashboardData";
import TrendChart from "@/components/dashboard/TrendChart";
import CategoryDistributionChart from "@/components/dashboard/CategoryDistributionChart";
import TransactionTable from "@/components/dashboard/TransactionTable";
import TransactionForm from "@/components/forms/TransactionForm";
import TransactionEditModal from "@/components/forms/TransactionEditModal";

import SpendingPatternChart from "@/components/dashboard/SpendingPatternChart";
import IncomeSourceChart from "@/components/dashboard/IncomeSourceChart";
import BudgetVsActualChart from "@/components/dashboard/BudgetVsActualChart";
import { useToast } from "@/contexts/ToastContext";

import SpendingPatternSkeleton from "@/components/dashboard/SpendingPatternSkeleton";
import IncomeSourceSkeleton from "@/components/dashboard/IncomeSourceSkeleton";
import BudgetVsActualSkeleton from "@/components/dashboard/BudgetVsActualSkeleton";

import ErrorBoundary from "@/components/ErrorBoundary";
import { KpiData } from "@/types/kpiTypes";
import { TransactionData } from "@/types/transactionTypes";
import {
  MY_WORKSPACES_ENDPOINT,
  TRANSACTION_BY_ID_ENDPOINT,
  WORKSPACES_ENDPOINT,
} from "@/constants/apiEndpoints";
import { KPI_CARD_COLOR_CLASSES } from "@/constants/chartColors";
import { ValueType } from "@/types/commonTypes";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import KpiCardRedesign from "@/components/dashboard/KpiCard";
import FilterModal from "@/components/dashboard/FilterModal";
import { InsightsApiResponse } from "@/types/insightTypes";
import InsightsSection from "@/components/dashboard/InsightsSection";
import { addDismissedInsightId } from "@/lib/localStorageUtils";
import LoginLogoutButton from "@/components/auth/LoginLogoutButton";
import { useWorkspaceStore, Workspace } from "@/stores/workspaceStore";
import { useSession } from "next-auth/react";

import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useRouter } from "next/navigation";
import TextField from "@/components/ui/TextField";
import Alert from "@/components/ui/Alert";
import Link from "next/link";

interface CreateWorkspacePayload {
  name: string;
}

// --- Dashboard Page ---
export default function DashboardRedesignPage() {
  const router = useRouter();

  const { status: sessionStatus } = useSession({
    required: true, // 세션이 없으면 자동으로 로그인 페이지로 리디렉션
    onUnauthenticated() {
      router.push("/api/auth/signin"); // 명시적 리디렉션 (미들웨어와 중복 가능성 있으나 안전 장치)
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

  const [workspaceApiError, setWorkspaceApiError] = useState<string | null>(
    null
  );

  const [showCreateFormInPage, setShowCreateFormInPage] = useState(false);
  const [newWorkspaceNameInPage, setNewWorkspaceNameInPage] = useState("");
  const [isCreatingWorkspaceInPage, setIsCreatingWorkspaceInPage] =
    useState(false);

  const currentWorkspace = useMemo(() => {
    return storedWorkspaces.find((ws) => ws.id === activeWorkspaceId);
  }, [activeWorkspaceId, storedWorkspaces]);

  // 워크스페이스 목록 가져오기
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      const fetchWorkspaces = async () => {
        setWorkspaceApiError(null);
        try {
          const response = await fetch(MY_WORKSPACES_ENDPOINT); // GET /api/me/workspaces
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.error || "워크스페이스 목록을 불러오는데 실패했습니다."
            );
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
            showToast(err.message, "error");
          } else {
            setWorkspaceApiError(
              "알 수 없는 오류로 워크스페이스 목록을 불러오는데 실패했습니다."
            );
            showToast(
              "알 수 없는 오류로 워크스페이스 목록을 불러오는데 실패했습니다.",
              "error"
            );
          }
        }
      };
      fetchWorkspaces();
    }
  }, [
    sessionStatus,
    showToast,
    setStoredWorkspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
  ]);

  const handleSelectWorkspace = (
    workspaceId: string,
    workspaceName?: string
  ) => {
    setActiveWorkspaceId(workspaceId);
    showToast(`${workspaceName || "워크스페이스"} 선택됨`, "success");
    // 별도 페이지로 이동하지 않고, 현재 페이지에서 대시보드 UI가 렌더링될 것임
    // router.push('/dashboard'); // 이 줄은 필요 없어짐
    setShowCreateFormInPage(false); // 혹시 생성폼이 열려있었다면 닫기
  };

  const handleCreateWorkspaceInPage = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (!newWorkspaceNameInPage.trim()) {
      showToast("워크스페이스 이름을 입력해주세요.", "error");
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "워크스페이스 생성에 실패했습니다.");
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

      showToast(
        `워크스페이스 '${createdStoredWorkspace.name}'가 생성되었습니다.`,
        "success"
      );
      setStoredWorkspaces([...storedWorkspaces, createdStoredWorkspace]); // 스토어 목록에 추가
      handleSelectWorkspace(
        createdStoredWorkspace.id,
        createdStoredWorkspace.name
      ); // 새로 만든 워크스페이스 선택
      setNewWorkspaceNameInPage("");
      setShowCreateFormInPage(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setWorkspaceApiError(err.message);
        showToast(err.message, "error");
      } else {
        setWorkspaceApiError(
          "알 수 없는 오류로 워크스페이스 생성에 실패했습니다."
        );
        showToast(
          "알 수 없는 오류로 워크스페이스 생성에 실패했습니다.",
          "error"
        );
      }
    } finally {
      setIsCreatingWorkspaceInPage(false);
    }
  };

  const handleEditTransactionClick = useCallback(
    (transactionToEdit: TransactionData) => {
      if (!activeWorkspaceId) {
        showToast("작업할 워크스페이스를 먼저 선택해주세요.", "error");
        router.push("/");
        return;
      }
      setEditingTransaction(transactionToEdit);
      setShowTransactionForm(true);
    },
    [
      setEditingTransaction,
      setShowTransactionForm,
      activeWorkspaceId,
      showToast,
      router,
    ]
  );

  const handleDeleteTransactionClick = useCallback(
    async (transactionIdToDelete: number) => {
      if (!activeWorkspaceId) {
        showToast("작업할 워크스페이스를 먼저 선택해주세요.", "error");
        router.push("/");
        return;
      }

      if (!transactions) {
        showToast(
          "거래 목록을 확인 중입니다. 잠시 후 다시 시도해주세요.",
          "info"
        );
        return;
      }

      const transactionToDelete = transactions.find(
        (t) => t.id === transactionIdToDelete
      );
      let confirmMessage = `정말로 이 내역(ID: ${transactionIdToDelete})을 삭제하시겠습니까?`;

      if (transactionToDelete?.originalTransactionId) {
        confirmMessage = `이것은 할부 거래의 일부입니다. 이 회차만 삭제하시겠습니까, 아니면 연결된 전체 할부 시리즈(원거래 ID: ${transactionToDelete.originalTransactionId})를 삭제하시겠습니까? (현재는 이 회차만 삭제됩니다 - 기능 확장 필요)`;
      } else if (transactionToDelete?.isInstallment) {
        confirmMessage = `이 할부 원거래(ID: ${transactionIdToDelete})를 삭제하시겠습니까? 연결된 모든 할부 회차가 함께 삭제됩니다.`;
      }

      if (window.confirm(confirmMessage)) {
        try {
          const response = await fetch(
            TRANSACTION_BY_ID_ENDPOINT(
              activeWorkspaceId,
              transactionIdToDelete
            ),
            { method: "DELETE" }
          );
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "내역 삭제에 실패했습니다.");
          }
          showToast("내역이 성공적으로 삭제되었습니다.", "success");
          mutateAllRelevantStats();
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : "알 수 없는 오류로 내역 삭제에 실패했습니다.";
          console.error("내역 삭제 중 오류:", error);
          showToast(message, "error");
        }
      }
    },
    [transactions, showToast, mutateAllRelevantStats, activeWorkspaceId, router]
  );

  const kpiItemsToDisplay = useMemo(
    () => [
      {
        key: "carryOverBalance",
        title: "이월 잔액",
        config: { icon: CreditCardIcon, color: "yellow" as const },
        nature: "positiveIsGood" as const,
        valueType: "currency",
      },
      {
        key: "income",
        title: "당월 수입",
        config: { icon: ArrowTrendingUpIcon, color: "green" as const },
        nature: "positiveIsGood" as const,
        valueType: "currency",
      },
      {
        key: "expense",
        title: "당월 지출",
        config: { icon: ArrowTrendingDownIcon, color: "red" as const },
        nature: "negativeIsGood" as const,
        valueType: "currency",
      },
      {
        key: "totalBalance",
        title: "최종 잔액",
        config: { icon: ChartBarIcon, color: "blue" as const },
        nature: "positiveIsGood" as const,
        valueType: "currency",
      },
    ],
    []
  );
  // --- Hook 정의 끝 ---

  if (sessionStatus === "loading") {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-slate-100 to-sky-100">
        <LoadingSpinner size="lg" />
        <p className="ml-4 text-xl text-gray-700 mt-4">
          인증 정보를 확인 중입니다...
        </p>
      </div>
    );
  }

  // 인증은 되었으나, 활성 워크스페이스가 없는 경우 (워크스페이스 선택/생성 UI 표시)
  if (sessionStatus === "authenticated" && !activeWorkspaceId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 flex flex-col items-center justify-center p-4">
        <Card
          title={
            storedWorkspaces.length > 0
              ? "워크스페이스 선택"
              : "첫 워크스페이스 생성"
          }
          className="w-full max-w-md"
        >
          {workspaceApiError && (
            <Alert type="error" className="mb-4">
              {workspaceApiError}
            </Alert>
          )}

          {storedWorkspaces.length > 0 && !showCreateFormInPage && (
            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-600 mb-3">
                참여중인 워크스페이스에서 선택하거나 새로 만드세요.
              </p>
              {storedWorkspaces.map((ws) => (
                <Button
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws.id, ws.name)}
                  variant="secondary"
                  className="w-full text-left justify-start"
                  icon={RectangleStackIcon}
                >
                  {ws.name}{" "}
                  <span className="text-xs text-gray-500 ml-auto">
                    ({ws.currentUserRole})
                  </span>
                </Button>
              ))}
            </div>
          )}

          {!showCreateFormInPage && storedWorkspaces.length > 0 && (
            <Button
              variant="primary"
              onClick={() => setShowCreateFormInPage(true)}
              className="w-full mb-4 border-gray-300 text-gray-700 hover:bg-gray-50"
              icon={PlusIcon}
            >
              새 워크스페이스 만들기
            </Button>
          )}

          {(showCreateFormInPage || storedWorkspaces.length === 0) && (
            <div>
              <h2 className="text-md font-medium text-gray-700 mb-3">
                {storedWorkspaces.length > 0
                  ? "새 워크스페이스 정보 입력"
                  : "첫 워크스페이스를 만들어 시작하세요!"}
              </h2>
              <form
                onSubmit={handleCreateWorkspaceInPage}
                className="space-y-4"
              >
                <TextField
                  id="newWorkspaceNameInPage"
                  name="newWorkspaceNameInPage"
                  label="워크스페이스 이름"
                  value={newWorkspaceNameInPage}
                  onChange={(e) => setNewWorkspaceNameInPage(e.target.value)}
                  placeholder="예: 팀 프로젝트, 우리집 가계부"
                  required
                  disabled={isCreatingWorkspaceInPage}
                />
                <div className="flex gap-2 pt-2">
                  {storedWorkspaces.length > 0 && ( // 취소 버튼은 기존 워크스페이스가 있을 때만 의미 있음
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowCreateFormInPage(false)}
                      disabled={isCreatingWorkspaceInPage}
                      className="flex-1"
                    >
                      취소
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isCreatingWorkspaceInPage}
                    className="flex-1"
                  >
                    {isCreatingWorkspaceInPage ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      "만들기 및 시작하기"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </Card>
        <div className="mt-8">
          <LoginLogoutButton /> {/* 로그아웃 버튼은 여기에도 둘 수 있음 */}
        </div>
      </div>
    );
  }

  // 활성 워크스페이스가 있고, 대시보드 데이터 로딩 중
  if (activeWorkspaceId && isDashboardDataLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-slate-100 to-sky-100">
        <LoadingSpinner size="lg" />
        <p className="text-xl text-gray-700 mt-4">
          {currentWorkspace?.name || "선택된"} 워크스페이스 데이터를 불러오는
          중입니다...
        </p>
      </div>
    );
  }

  // 대시보드 데이터 로딩 에러 처리
  if (dashboardDataError) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-red-50 text-red-700 p-4">
        <InformationCircleIcon className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">데이터 로딩 오류</h2>
        <p className="text-center mb-4">
          워크스페이스 데이터를 불러오는 중 문제가 발생했습니다.
        </p>
        <pre className="text-xs bg-red-100 p-2 rounded overflow-auto max-w-md">
          {dashboardDataError.error.message || "알 수 없는 오류"}
        </pre>
        <Button onClick={() => router.push("/")} className="mt-4">
          워크스페이스 다시 선택
        </Button>
      </div>
    );
  }

  const handleAddTransactionClick = () => {
    if (!activeWorkspaceId) {
      showToast("작업할 워크스페이스를 먼저 선택해주세요.", "error");
      router.push("/");
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
      const updatedInsights = insightsData.filter(
        (insight) => insight.id !== insightIdToDismiss
      );

      mutateFunctions.mutateInsights(
        { insights: updatedInsights } as InsightsApiResponse, // API 응답 형식에 맞춤
        false
      );
      showToast(`인사이트가 숨김 처리되었습니다.`, "info");
    } else {
      showToast(`인사이트가 숨김 처리되었습니다. (새로고침 시 적용)`, "info");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 text-gray-800 pb-16">
      <header className="bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <BuildingOffice2Icon className="h-6 w-6 text-blue-600 mr-2 hidden sm:inline-block" />
            <h1 className="text-xl sm:text-2xl font-bold text-blue-700 truncate max-w-[150px] sm:max-w-xs">
              {currentWorkspace?.name || "대시보드"}
            </h1>
            <Button
              onClick={() => setActiveWorkspaceId(null)}
              variant="ghost"
              size="sm"
              className="ml-2 text-xs"
            >
              (워크스페이스 변경)
            </Button>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            <Button
              onClick={handleAddTransactionClick}
              variant="primary"
              icon={PlusCircleIcon}
              size="md"
              className="hidden sm:inline-flex"
            >
              새 내역
            </Button>
            <Button
              onClick={handleAddTransactionClick}
              variant="primary"
              icon={PlusCircleIcon}
              size="icon"
              ariaLabel="새 내역 추가"
              className="sm:hidden"
            />
            <Link href="/settings/budget">
              <Button
                variant="primary"
                icon={Cog6ToothIcon}
                size="md"
                className="hidden sm:inline-flex"
              >
                예산 설정
              </Button>
            </Link>
            <LoginLogoutButton /> {/* 여기에 추가 */}
            <Button
              onClick={toggleMobileMenu}
              variant="ghost"
              icon={isMobileMenuOpen ? XMarkIcon : Bars3Icon}
              size="icon"
              ariaLabel="메뉴 토글"
              className="md:hidden"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <section className="mb-6 sm:mb-8 p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-md">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => moveMonth("prev")}
                variant="secondary"
                icon={ChevronLeftIcon}
                size="icon"
                ariaLabel="이전 달"
              />
              <h2 className="text-lg sm:text-xl font-semibold text-gray-700 whitespace-nowrap tabular-nums">
                {format(parseISO(`${selectedMonth}-01`), "yyyy년 M월", {
                  locale: ko,
                })}
              </h2>
              <Button
                onClick={() => moveMonth("next")}
                variant="secondary"
                icon={ChevronRightIcon}
                size="icon"
                ariaLabel="다음 달"
              />
            </div>
            <Button
              variant="secondary"
              icon={FunnelIcon}
              onClick={() => setIsFilterModalOpen(true)}
            >
              필터
            </Button>
          </div>
        </section>

        {/* 금융 인사이트 섹션 추가 */}
        <section className="my-6 sm:my-8">
          <h2 className="text-xl font-semibold text-gray-700 mb-4 px-1">
            ✨ 오늘의 금융 인사이트
          </h2>
          <InsightsSection
            insights={insightsData}
            isLoading={insightsIsLoading}
            error={insightsError}
            currentMonth={format(
              parseISO(`${selectedMonth}-01`),
              "yyyy년 M월",
              { locale: ko }
            )}
            onDismissInsight={handleDismissInsight}
          />
        </section>

        <section className="mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {kpiItemsToDisplay.map(
              ({ key, title, config, nature, valueType }) => {
                let value: number | undefined;
                let change: number | undefined;
                let changePercent: number | undefined;
                let trend: { date: string; value: number }[] | undefined;
                let isLoadingSpecific = kpiIsLoading;

                if (key === "carryOverBalance") {
                  value = monthlyStats?.carryOverBalance;
                  isLoadingSpecific = monthlyStatsIsLoading;
                } else if (kpiData?.kpi) {
                  const kpiItem = kpiData.kpi[key as keyof KpiData["kpi"]];
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
                          : "border-gray-500"
                      } ${
                        config.color
                          ? KPI_CARD_COLOR_CLASSES[config.color]?.bg
                          : "bg-gray-50"
                      } flex flex-col justify-between h-full`}
                    >
                      <div className="flex items-center justify-between">
                        <p
                          className={`text-sm font-medium text-gray-500 truncate`}
                        >
                          {title}
                        </p>
                        {config.icon && (
                          <config.icon
                            className={`h-7 w-7 sm:h-8 sm:w-8 ${
                              config.color
                                ? KPI_CARD_COLOR_CLASSES[config.color]?.text
                                : "text-gray-500"
                            } opacity-60`}
                          />
                        )}
                      </div>
                      <p className="text-lg text-gray-400 mt-2">데이터 없음</p>
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
                    valueType={(valueType || "currency") as ValueType}
                    valueNature={nature}
                    isLoading={isLoadingSpecific}
                  />
                );
              }
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 sm:mb-8">
          <ErrorBoundary
            fallback={
              <Card title="월간 수입/지출 트렌드">
                <p className="text-red-500">차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            <Card title="월간 수입/지출 트렌드 (일별)" className="h-full">
              {monthlyStatsIsLoading ? (
                <div className="h-[300px] sm:h-[350px] flex items-center justify-center">
                  <div className="animate-pulse bg-gray-200 rounded-md w-full h-full"></div>
                </div>
              ) : monthlyStats?.dailyTrend &&
                monthlyStats.dailyTrend.length > 0 ? (
                <TrendChart
                  data={monthlyStats.dailyTrend}
                  type="bar"
                  xDataKey="date"
                  series={[
                    { dataKey: "income", name: "수입", color: "#4CAF50" },
                    { dataKey: "expense", name: "지출", color: "#F44336" },
                  ]}
                  height="300px"
                  stack={false}
                />
              ) : (
                <div className="h-[300px] sm:h-[350px] flex flex-col items-center justify-center bg-gray-50 rounded-md">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">이번 달 거래 내역이 없습니다.</p>
                </div>
              )}
            </Card>
          </ErrorBoundary>

          <ErrorBoundary
            fallback={
              <Card title="카테고리별 지출 분포">
                <p className="text-red-500">차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            <Card title="카테고리별 지출 분포" className="h-full">
              {categoryStatsIsLoading ? (
                <div className="h-[300px] sm:h-[350px] flex items-center justify-center">
                  <div className="animate-pulse bg-gray-200 rounded-md w-full h-full"></div>
                </div>
              ) : categoryStats?.expenseData &&
                categoryStats.expenseData.length > 0 ? (
                <CategoryDistributionChart
                  data={categoryStats.expenseData.filter(
                    (item) => item.categoryId !== null && item.amount > 0
                  )}
                  type="expense"
                  height="300px"
                  title=""
                />
              ) : (
                <div className="h-[300px] sm:h-[350px] flex flex-col items-center justify-center bg-gray-50 rounded-md">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">이번 달 지출 내역이 없습니다.</p>
                </div>
              )}
            </Card>
          </ErrorBoundary>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 sm:mb-8">
          <ErrorBoundary
            fallback={
              <Card title="소비 패턴 분석">
                <p className="text-red-500">차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            {spendingPatternIsLoading ? (
              <SpendingPatternSkeleton />
            ) : spendingPatternData &&
              spendingPatternData.dayPattern.length > 0 ? (
              <SpendingPatternChart
                data={spendingPatternData}
                title="소비 패턴 분석"
              />
            ) : (
              <Card title="소비 패턴 분석" className="h-full">
                <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-md">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">소비 패턴 데이터가 없습니다.</p>
                </div>
              </Card>
            )}
          </ErrorBoundary>
          <ErrorBoundary
            fallback={
              <Card title="수입원 분석">
                <p className="text-red-500">차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            {incomeSourceIsLoading ? (
              <IncomeSourceSkeleton />
            ) : incomeSourceData &&
              incomeSourceData.incomeSources.length > 0 ? (
              <IncomeSourceChart data={incomeSourceData} title="수입원 분석" />
            ) : (
              <Card title="수입원 분석" className="h-full">
                <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-md">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">
                    수입원 분석 데이터가 없습니다.
                  </p>
                </div>
              </Card>
            )}
          </ErrorBoundary>
          <ErrorBoundary
            fallback={
              <Card title="예산 대비 지출">
                <p className="text-red-500">차트 로드 중 오류 발생</p>
              </Card>
            }
          >
            {budgetVsActualIsLoading ? (
              <BudgetVsActualSkeleton />
            ) : budgetVsActualData ? (
              <BudgetVsActualChart
                data={budgetVsActualData}
                title="예산 대비 지출"
              />
            ) : (
              <Card title="예산 대비 지출" className="h-full">
                <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-md">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">
                    예산 데이터가 없거나, 설정된 예산이 없습니다.
                  </p>
                  <Link href="/settings/budget">
                    <Button variant="secondary" className="mt-2 text-sm">
                      예산 설정 바로가기
                    </Button>
                  </Link>
                </div>
              </Card>
            )}
          </ErrorBoundary>
        </section>

        <section>
          <ErrorBoundary
            fallback={
              <Card title="최근 거래 내역">
                <p className="text-red-500">거래 내역 로드 중 오류 발생</p>
              </Card>
            }
          >
            <Card title="최근 거래 내역" noPadding>
              {transactionsIsLoading ? (
                <div className="p-6">
                  <div className="h-[300px] bg-gray-200 animate-pulse rounded-md"></div>
                </div>
              ) : transactions && transactions.length > 0 ? (
                <TransactionTable
                  transactions={transactions}
                  onEdit={handleEditTransactionClick}
                  onDelete={handleDeleteTransactionClick}
                  title=""
                  maxHeight="400px"
                />
              ) : (
                <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-b-md p-6">
                  <InformationCircleIcon className="h-10 w-10 text-gray-400 mb-2" />
                  <p className="text-gray-500">표시할 거래 내역이 없습니다.</p>
                  <Button
                    onClick={handleAddTransactionClick}
                    variant="primary"
                    className="mt-4"
                  >
                    첫 내역 추가하기
                  </Button>
                </div>
              )}
            </Card>
          </ErrorBoundary>
        </section>

        {showTransactionForm && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 transition-opacity duration-300 ease-in-out">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col transform transition-all duration-300 ease-in-out scale-100 opacity-100">
              <div className="px-6 py-4 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  {editingTransaction ? "내역 수정" : "새 내역 추가"}
                </h3>
                <Button
                  icon={XMarkIcon}
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowTransactionForm(false);
                    setEditingTransaction(null);
                  }}
                  ariaLabel="닫기"
                />
              </div>
              <div className="p-6 overflow-y-auto">
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

      <footer className="text-center py-8 text-sm text-gray-500 border-t border-gray-200 bg-slate-50">
        <p>
          &copy; {new Date().getFullYear()} 가계부 애플리케이션. 모든 권리 보유.
        </p>
      </footer>
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
/* ./src/components/dashboard/BalanceHistoryChart.tsx */
// src/components/dashboard/BalanceHistoryChart.tsx
import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';

type BalanceDataPoint = {
  date: string;
  income: number;
  expense: number;
  balance: number;
  cumulativeBalance: number;
};

type BalanceHistoryChartProps = {
  data: BalanceDataPoint[];
  title?: string;
  height?: number | string;
  showCumulative?: boolean;
};

export default function BalanceHistoryChart({
  data,
  title = '수입/지출 및 잔액 추이',
  height = 300,
  showCumulative = true,
}: BalanceHistoryChartProps) {
  // 차트 데이터 준비
  const chartData = data.map((item) => {
    return {
      ...item,
      balance: item.income - item.expense,
    };
  });

  // 날짜 포맷 변환
  const formatXAxis = (dateStr: string) => {
    if (dateStr.length === 10) {
      // YYYY-MM-DD
      return dateStr.substring(5); // MM-DD만 표시
    }
    return dateStr;
  };

  // 금액 포맷팅 함수
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
  };

  // 투명도 설정
  const areaOpacity = 0.2;

  return (
    <div className='bg-white p-4 rounded-lg shadow'>
      {title && <h3 className='text-lg font-semibold mb-4'>{title}</h3>}
      <div style={{ height }}>
        <ResponsiveContainer width='100%' height='100%'>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='date' tickFormatter={formatXAxis} tick={{ fontSize: 12 }} />
            <YAxis
              tickFormatter={(value) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                return value;
              }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: number) => [formatAmount(value)]}
              labelFormatter={(label) => label}
            />
            <Legend />
            <ReferenceLine y={0} stroke='#666' strokeDasharray='3 3' />

            {/* 수입 Area */}
            <Area
              type='monotone'
              dataKey='income'
              name='수입'
              stroke='#4CAF50'
              fill='#4CAF50'
              fillOpacity={areaOpacity}
              activeDot={{ r: 6 }}
            />

            {/* 지출 Area */}
            <Area
              type='monotone'
              dataKey='expense'
              name='지출'
              stroke='#F44336'
              fill='#F44336'
              fillOpacity={areaOpacity}
              activeDot={{ r: 6 }}
            />

            {/* 일별 잔액 Line */}
            <Area
              type='monotone'
              dataKey='balance'
              name='잔액'
              stroke='#2196F3'
              fill='#2196F3'
              fillOpacity={areaOpacity}
              activeDot={{ r: 6 }}
            />

            {/* 누적 잔액 Line (옵션) */}
            {showCumulative && (
              <Area
                type='monotone'
                dataKey='cumulativeBalance'
                name='누적 잔액'
                stroke='#9C27B0'
                fill='#9C27B0'
                fillOpacity={areaOpacity}
                activeDot={{ r: 6 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
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
/* ./src/components/dashboard/CategoryPieChart.tsx */
'use client';

import { EXPENSE_COLORS, INCOME_COLORS } from '@/constants/chartColors';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

type CategoryData = {
  categoryId: number;
  categoryName: string;
  amount: number;
};

type CategoryPieChartProps = {
  data: CategoryData[];
  title: string;
  type?: 'income' | 'expense';
};

export default function CategoryPieChart({ data, title, type = 'income' }: CategoryPieChartProps) {
  // 타입에 따라 사용할 색상 배열 선택
  const currentColors = type === 'income' ? INCOME_COLORS : EXPENSE_COLORS;

  // 금액이 0이 아닌 데이터만 필터링
  const filteredData = data.filter((item) => item.amount > 0);

  // 금액 포맷팅 함수
  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString()}원`;
  };

  // 데이터가 없는 경우 표시할 내용
  if (filteredData.length === 0) {
    return (
      <div className='bg-white p-4 rounded-lg shadow h-64 flex items-center justify-center'>
        <p className='text-gray-500'>데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className='bg-white p-4 rounded-lg shadow'>
      <h3 className='text-lg font-semibold mb-4'>{title}</h3>
      <div className='h-64'>
        <ResponsiveContainer width='100%' height='100%'>
          <PieChart>
            <Pie
              data={filteredData}
              cx='50%'
              cy='50%'
              labelLine={false}
              outerRadius={80}
              fill='#8884d8'
              dataKey='amount'
              nameKey='categoryName'
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {filteredData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={currentColors[index % currentColors.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatAmount(value)} />
            <Legend
              formatter={(value) => (
                <span style={{ color: '#333', fontSize: '0.8rem' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/ExpenseRatioGauge.tsx */
import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid';

type ExpenseRatioGaugeProps = {
  income: number;
  expense: number;
  previousIncome?: number;
  previousExpense?: number;
  title?: string;
};

export default function ExpenseRatioGauge({
  income,
  expense,
  previousIncome,
  previousExpense,
  title = '지출/수입 비율',
}: ExpenseRatioGaugeProps) {
  // 최대 표시 비율 설정
  const MAX_DISPLAY_RATIO = 1000;

  // 비율 계산 로직
  const calculateRatio = (inc: number, exp: number) => {
    if (inc <= 0) {
      // 수입이 0 또는 음수이고 지출이 있는 경우
      if (exp > 0) {
        return {
          value: 0.0,
          displayValue: MAX_DISPLAY_RATIO,
          isInfinite: true,
          hasExpense: true,
          isExtreme: true,
        };
      }
      // 수입이 0이고 지출도 0인 경우
      return {
        value: 0.0,
        displayValue: 0.0,
        isInfinite: false,
        hasExpense: false,
        isExtreme: false,
      };
    }

    // 정상적인 비율 계산
    const calculatedRatio = (exp / inc) * 100;
    const isExtreme = calculatedRatio > MAX_DISPLAY_RATIO;

    return {
      value: calculatedRatio,
      displayValue: isExtreme ? MAX_DISPLAY_RATIO : calculatedRatio,
      isInfinite: false,
      hasExpense: exp > 0,
      isExtreme: isExtreme,
    };
  };

  const {
    value: actualRatio,
    displayValue: ratio,
    isInfinite,
    hasExpense,
    isExtreme,
  } = calculateRatio(income, expense);

  // 이전 비율 계산 (있는 경우)
  let previousRatioData;

  if (previousIncome !== undefined && previousExpense !== undefined) {
    previousRatioData = calculateRatio(previousIncome, previousExpense);
  }

  // 변화량 계산 (둘 다 유한한 값일 때만)
  const change =
    previousRatioData && !isInfinite && !previousRatioData.isInfinite
      ? actualRatio - previousRatioData.value
      : null;

  // 색상 결정
  const getColor = () => {
    if (isInfinite || isExtreme) return 'red';
    if (actualRatio > 100) return 'red';
    if (actualRatio > 70) return 'yellow';
    return 'green';
  };

  const color = getColor();
  const colorClass = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
  }[color];

  // 게이지 바 너비 계산
  const getGaugeWidth = () => {
    if (isInfinite || isExtreme) return '100%';
    return `${Math.min(actualRatio, 200)}%`;
  };

  // 상태 메시지 결정
  const getStatusText = () => {
    if (isInfinite) return '수입 없이 지출만 있습니다. 재정 상태를 점검하세요.';
    if (isExtreme) return '지출이 수입을 크게 초과합니다. 재정 상태를 점검하세요.';
    if (actualRatio > 100) return '지출이 수입을 초과합니다. 재정 상태를 점검하세요.';
    if (actualRatio > 70) return '지출이 수입의 상당 부분을 차지합니다.';
    return '재정 상태가 양호합니다.';
  };

  // 하단 메시지 결정
  const getBottomMessage = () => {
    if (isInfinite && hasExpense) {
      return (
        <p>
          수입 없이{' '}
          <span className='font-medium text-red-600'>
            {new Intl.NumberFormat('ko-KR').format(expense)}원
          </span>
          을 지출했습니다.
        </p>
      );
    }

    if (isExtreme) {
      return (
        <p>
          지출이 수입을 <span className='font-medium text-red-600'>1000%+</span> 초과했습니다.
        </p>
      );
    }

    if (actualRatio > 100) {
      return (
        <p>
          지출이 수입을{' '}
          <span className='font-medium text-red-600'>{(actualRatio - 100).toFixed(1)}%</span>{' '}
          초과했습니다.
        </p>
      );
    }

    return (
      <p>
        수입의{' '}
        <span className={`font-medium ${actualRatio > 70 ? 'text-yellow-600' : 'text-green-600'}`}>
          {actualRatio.toFixed(1)}%
        </span>
        를 지출했습니다.
      </p>
    );
  };

  return (
    <div className='bg-white p-4 rounded-lg shadow-md'>
      <h3 className='text-lg font-semibold mb-2'>{title}</h3>
      <div className='flex items-center justify-between mb-2'>
        <div className='flex items-center'>
          {isExtreme ? (
            <span className='text-3xl font-bold'>1000%+</span>
          ) : (
            <span className='text-3xl font-bold'>{ratio.toFixed(1)}%</span>
          )}

          {isInfinite && hasExpense && (
            <span className='ml-2 text-red-600 font-medium'>Infinity%</span>
          )}
        </div>

        {change !== null && (
          <div className={`flex items-center ${change > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {change > 0 ? (
              <ArrowUpIcon className='h-4 w-4 mr-1' />
            ) : (
              <ArrowDownIcon className='h-4 w-4 mr-1' />
            )}
            <span className='text-sm'>{Math.abs(change).toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* 게이지 바 */}
      <div className='w-full bg-gray-200 rounded-full h-2.5 mb-1'>
        <div
          className={`h-2.5 rounded-full ${colorClass}`}
          style={{ width: getGaugeWidth() }}
        ></div>
      </div>

      <div className='flex justify-between text-xs mt-1 mb-3'>
        <span>0%</span>
        <span>50%</span>
        <span className='relative'>
          <span>100%</span>
          <span className='absolute -top-2 left-1/2 transform -translate-x-1/2 w-px h-2 bg-gray-400'></span>
        </span>
        <span>150%+</span>
      </div>

      <div className='text-sm text-gray-500 mt-2'>{getStatusText()}</div>

      <div className='mt-3 text-sm'>{getBottomMessage()}</div>
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/ExpenseRatioKPI.tsx */
import React from "react";

type ExpenseRatioKPIProps = {
  currentMonth: string;
  income: number;
  expense: number;
  previousIncome?: number;
  previousExpense?: number;
  avgRatio?: number;
};

export default function ExpenseRatioKPI({
  currentMonth,
  income,
  expense,
  previousIncome,
  previousExpense,
  avgRatio,
}: ExpenseRatioKPIProps) {
  // 비율 계산 로직 - 최대 표시 값 제한 추가
  const MAX_DISPLAY_RATIO = 1000; // 표시할 최대 비율 (1000%)

  const calculateRatio = (inc: number, exp: number) => {
    // 수입이 너무 작거나 0인 경우 (매우 작은 값 체크 추가)
    if (inc < 0.0001) {
      return {
        value: 0,
        isInfinite: exp > 0,
        displayValue: MAX_DISPLAY_RATIO,
        isExtreme: exp > 0,
      };
    }

    const calculatedRatio = (exp / inc) * 100;

    return {
      value: calculatedRatio,
      isInfinite: false,
      // 표시용 값은 최대치로 제한
      displayValue:
        calculatedRatio > MAX_DISPLAY_RATIO
          ? MAX_DISPLAY_RATIO
          : calculatedRatio,
      isExtreme: calculatedRatio > MAX_DISPLAY_RATIO,
    };
  };

  const {
    value: actualRatio,
    isInfinite,
    displayValue: ratio,
    isExtreme,
  } = calculateRatio(income, expense);

  // 이전 비율 계산 (있는 경우)
  let previousRatioData = undefined;

  if (previousIncome !== undefined && previousExpense !== undefined) {
    previousRatioData = calculateRatio(previousIncome, previousExpense);
  }

  // 상태 결정
  const status =
    isInfinite || ratio > 100 ? "danger" : ratio > 80 ? "warning" : "success";

  const statusStyles = {
    success: "bg-green-100 border-green-200 text-green-800",
    warning: "bg-yellow-100 border-yellow-200 text-yellow-800",
    danger: "bg-red-100 border-red-200 text-red-800",
  };

  // 비교 로직 수정 - 극단적인 상황 고려
  const getComparisonMessage = () => {
    if (!previousRatioData) return "";

    // 둘 다 극단적인 경우 (둘 다 매우 나쁨)
    if (
      (isInfinite || isExtreme) &&
      (previousRatioData.isInfinite || previousRatioData.isExtreme)
    ) {
      return "상태가 여전히 매우 좋지 않습니다.";
    }

    // 이전에는 괜찮았는데 지금은 극단적인 경우
    if (
      (isInfinite || isExtreme) &&
      !(previousRatioData.isInfinite || previousRatioData.isExtreme)
    ) {
      return "상태가 크게 악화되었습니다.";
    }

    // 이전에는 극단적이었는데 지금은 괜찮은 경우
    if (
      !(isInfinite || isExtreme) &&
      (previousRatioData.isInfinite || previousRatioData.isExtreme)
    ) {
      return "상태가 크게 개선되었습니다.";
    }

    // 일반적인 비교 (둘 다 정상 범위)
    const diff = actualRatio - previousRatioData.value;

    if (Math.abs(diff) < 5) {
      return "상태가 전월과 비슷합니다.";
    }

    return diff < 0 ? "상태가 개선되었습니다." : "상태가 악화되었습니다.";
  };

  // 초과 퍼센트 표시용 - 최대 1000%까지만 표시
  const excessPercentDisplay = () => {
    if (ratio <= 100) return "";

    const excess = Math.min(ratio - 100, MAX_DISPLAY_RATIO - 100);
    return `${excess.toFixed(1)}%`;
  };

  // 실제 표시할 텍스트
  const getDetailMessage = () => {
    if (isInfinite) {
      return "수입이 없거나 매우 적어 비율을 정확히 계산할 수 없습니다.";
    }

    if (isExtreme) {
      return `지출이 수입을 크게 초과했습니다(1000%+).`;
    }

    if (ratio > 100) {
      return `지출이 수입을 ${excessPercentDisplay()} 초과했습니다.`;
    }

    return `수입의 ${ratio.toFixed(1)}%를 지출했습니다.`;
  };

  return (
    <div className={`p-5 rounded-lg border ${statusStyles[status]}`}>
      <p className="text-sm opacity-80">{currentMonth} 지출/수입 비율</p>
      <div className="flex items-end mt-1">
        {/* 무한대 또는 극단적인 경우 특별 표시 */}
        {isInfinite ? (
          <h3 className="text-3xl font-bold">∞%</h3>
        ) : isExtreme ? (
          <h3 className="text-3xl font-bold">1000%+</h3>
        ) : (
          <h3 className="text-3xl font-bold">{ratio.toFixed(1)}%</h3>
        )}
      </div>

      {avgRatio && (
        <div className="mt-2 text-xs opacity-70">
          평균: {avgRatio.toFixed(1)}%
        </div>
      )}

      <div className="mt-3 text-sm">
        <p className="font-medium">{getDetailMessage()}</p>

        {previousRatioData && <p className="mt-1">{getComparisonMessage()}</p>}
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/ExpenseRatioTable.tsx */
import React from 'react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';

type DailyData = {
  date: string;
  income: number;
  expense: number;
};

type WeeklyData = {
  period: string;
  income: number;
  expense: number;
  ratio: number;
  isInfinite: boolean;
  isExtreme: boolean;
};

type ExpenseRatioTableProps = {
  dailyData: DailyData[];
  title?: string;
};

export default function ExpenseRatioTable({
  dailyData,
  title = '주간 지출/수입 요약',
}: ExpenseRatioTableProps) {
  // 최대 표시 비율 설정
  const MAX_DISPLAY_RATIO = 1000;

  // 비율 계산 로직
  const calculateRatio = (income: number, expense: number) => {
    if (income <= 0) {
      return {
        value: 0.0,
        displayValue: 0.0,
        isInfinite: expense > 0,
        isExtreme: false,
      };
    }

    const calculatedRatio = (expense / income) * 100;
    const isExtreme = calculatedRatio > MAX_DISPLAY_RATIO;

    return {
      value: calculatedRatio,
      displayValue: isExtreme ? MAX_DISPLAY_RATIO : calculatedRatio,
      isInfinite: false,
      isExtreme: isExtreme,
    };
  };

  // 주간 데이터 그룹화
  const groupDataByWeek = (data: DailyData[]): WeeklyData[] => {
    const weekMap: Record<
      string,
      {
        income: number;
        expense: number;
        startDate: Date;
        endDate: Date;
      }
    > = {};

    // 각 일별 데이터를 주차별로 그룹화
    data.forEach((day) => {
      const date = parseISO(day.date);
      const weekStart = startOfWeek(date, { locale: ko });
      const weekEnd = endOfWeek(date, { locale: ko });
      const weekKey = format(weekStart, 'yyyy-MM-dd');

      if (!weekMap[weekKey]) {
        weekMap[weekKey] = {
          income: 0,
          expense: 0,
          startDate: weekStart,
          endDate: weekEnd,
        };
      }

      weekMap[weekKey].income += day.income;
      weekMap[weekKey].expense += day.expense;
    });

    // 주차별 데이터를 배열로 변환하고 비율 계산
    return Object.keys(weekMap)
      .map((weekKey) => {
        const weekData = weekMap[weekKey];
        const {
          value: ratio,
          isInfinite,
          isExtreme,
        } = calculateRatio(weekData.income, weekData.expense);

        return {
          period: `${format(weekData.startDate, 'MM/dd', { locale: ko })} - ${format(
            weekData.endDate,
            'MM/dd',
            { locale: ko }
          )}`,
          income: weekData.income,
          expense: weekData.expense,
          ratio: ratio,
          isInfinite: isInfinite,
          isExtreme: isExtreme,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  };

  // 월간 합계 계산
  const calculateMonthlyData = (weeklyData: WeeklyData[]) => {
    const totalIncome = weeklyData.reduce((sum, week) => sum + week.income, 0);
    const totalExpense = weeklyData.reduce((sum, week) => sum + week.expense, 0);

    const { value: ratio, isInfinite, isExtreme } = calculateRatio(totalIncome, totalExpense);

    return {
      income: totalIncome,
      expense: totalExpense,
      ratio: ratio,
      isInfinite: isInfinite,
      isExtreme: isExtreme,
    };
  };

  // 주간 데이터 생성
  const weeklyData = groupDataByWeek(dailyData);

  // 월간 합계 데이터
  const monthlyData = calculateMonthlyData(weeklyData);

  // 금액 포맷팅 함수
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  // 비율 표시 함수
  const formatRatio = (ratio: number, isInfinite: boolean, isExtreme: boolean) => {
    if (isInfinite) return '0.0% (∞)';
    if (isExtreme) return '1000%+';
    return `${ratio.toFixed(1)}%`;
  };

  // 색상 클래스 결정 함수
  const getRatioColorClass = (ratio: number, isInfinite: boolean, isExtreme: boolean) => {
    if (isInfinite || isExtreme || ratio > 100) return 'text-red-600';
    if (ratio > 80) return 'text-yellow-600';
    return 'text-green-600';
  };

  // 상태 표시 색상 클래스 결정 함수
  const getStatusColorClass = (ratio: number, isInfinite: boolean, isExtreme: boolean) => {
    if (isInfinite || isExtreme || ratio > 100) return 'bg-red-500';
    if (ratio > 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className='bg-white rounded-lg shadow-md overflow-hidden'>
      <h3 className='text-lg font-semibold p-4 border-b'>{title}</h3>
      <div className='overflow-x-auto'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50'>
            <tr>
              <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>
                기간
              </th>
              <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase'>
                수입
              </th>
              <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase'>
                지출
              </th>
              <th className='px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase'>
                비율
              </th>
              <th className='px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase'>
                상태
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200'>
            {weeklyData.map((week) => (
              <tr key={week.period} className='hover:bg-gray-50'>
                <td className='px-4 py-3 text-sm text-gray-900'>{week.period}</td>
                <td className='px-4 py-3 text-sm text-gray-900 text-right'>
                  {formatAmount(week.income)}
                </td>
                <td className='px-4 py-3 text-sm text-gray-900 text-right'>
                  {formatAmount(week.expense)}
                </td>
                <td
                  className={`px-4 py-3 text-sm font-medium text-right ${getRatioColorClass(
                    week.ratio,
                    week.isInfinite,
                    week.isExtreme
                  )}`}
                >
                  {formatRatio(week.ratio, week.isInfinite, week.isExtreme)}
                </td>
                <td className='px-4 py-3 text-sm text-center'>
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${getStatusColorClass(
                      week.ratio,
                      week.isInfinite,
                      week.isExtreme
                    )}`}
                  ></span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className='bg-gray-50'>
            <tr>
              <td className='px-4 py-3 text-sm font-medium'>월 합계</td>
              <td className='px-4 py-3 text-sm font-medium text-right'>
                {formatAmount(monthlyData.income)}
              </td>
              <td className='px-4 py-3 text-sm font-medium text-right'>
                {formatAmount(monthlyData.expense)}
              </td>
              <td
                className={`px-4 py-3 text-sm font-medium text-right ${getRatioColorClass(
                  monthlyData.ratio,
                  monthlyData.isInfinite,
                  monthlyData.isExtreme
                )}`}
              >
                {formatRatio(monthlyData.ratio, monthlyData.isInfinite, monthlyData.isExtreme)}
              </td>
              <td className='px-4 py-3'></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
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
/* ./src/components/dashboard/MonthlyTrendChart.tsx */
'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

type DailyData = {
  date: string;
  income: number;
  expense: number;
};

type MonthlyTrendChartProps = {
  data: DailyData[];
};

export default function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  // 날짜 포맷 변환
  const chartData = data.map((item) => ({
    ...item,
    formattedDate: format(parseISO(item.date), 'd일', { locale: ko }),
  }));

  return (
    <div className='bg-white p-4 rounded-lg shadow'>
      <h3 className='text-lg font-semibold mb-4'>일별 수입/지출 트렌드</h3>
      <div className='h-64'>
        <ResponsiveContainer width='100%' height='100%'>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='formattedDate' />
            <YAxis />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString()}원`]}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />
            <Bar
              dataKey='income'
              name='수입'
              fill='#10b981' // 새로운 색상: emerald-500
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey='expense'
              name='지출'
              fill='#f97316' // 새로운 색상: orange-500
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

```tsx
/* ./src/components/dashboard/PeriodSelector.tsx */
// src/components/dashboard/PeriodSelector.tsx
'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import Button from '../ui/Button';

type PeriodSelectorProps = {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
};

export default function PeriodSelector({ selectedMonth, onMonthChange }: PeriodSelectorProps) {
  // 현재 연도와 월 계산
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // selectedMonth에서 연도와 월 추출 (형식: 'YYYY-MM')
  const [year, month] = selectedMonth.split('-').map(Number);

  // 이전 월, 다음 월 계산
  const getPreviousMonth = () => {
    if (month === 1) {
      return `${year - 1}-12`;
    } else {
      return `${year}-${String(month - 1).padStart(2, '0')}`;
    }
  };

  const getNextMonth = () => {
    // 현재 월보다 미래의 달은 선택 불가능
    if (year === currentYear && month === currentMonth) {
      return null;
    }

    if (month === 12) {
      return `${year + 1}-01`;
    } else {
      return `${year}-${String(month + 1).padStart(2, '0')}`;
    }
  };

  // 월 변경 핸들러
  const handlePreviousMonth = () => {
    onMonthChange(getPreviousMonth());
  };

  const handleNextMonth = () => {
    const nextMonth = getNextMonth();
    if (nextMonth) {
      onMonthChange(nextMonth);
    }
  };

  // 선택된 월을 한글로 포맷팅
  const formattedMonth = format(new Date(year, month - 1), 'yyyy년 M월', {
    locale: ko,
  });

  return (
    <div className='flex items-center justify-between mb-6 gap-4'>
      <Button
        onClick={handlePreviousMonth}
        className='bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-full'
      >
        &lt; 이전 달
      </Button>

      <h2 className='text-xl font-bold'>{formattedMonth}</h2>

      <Button
        onClick={handleNextMonth}
        disabled={!getNextMonth()}
        className={`font-bold py-2 px-4 rounded-full ${
          getNextMonth()
            ? 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        다음 달 &gt;
      </Button>
    </div>
  );
}
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
/* ./src/components/dashboard/SummaryCard.tsx */
// src/components/dashboard/SummaryCard.tsx
import React from 'react';

type SummaryCardProps = {
  title: string;
  amount: number;
  type?: 'neutral' | 'positive' | 'negative';
  icon?: React.ReactNode;
};

export default function SummaryCard({ title, amount, type = 'neutral', icon }: SummaryCardProps) {
  // 금액 포맷팅
  const formattedAmount = new Intl.NumberFormat('ko-KR').format(amount);

  // 타입에 따른 색상 설정
  const colorClass = {
    neutral: 'bg-blue-50 text-blue-700 border-blue-200',
    positive: 'bg-green-50 text-green-700 border-green-200',
    negative: 'bg-red-50 text-red-700 border-red-200',
  }[type];

  return (
    <div className={`p-4 rounded-lg border ${colorClass}`}>
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-sm font-medium opacity-80'>{title}</h3>
          <p className='text-2xl font-bold mt-1'>{formattedAmount}원</p>
        </div>
        {icon && <div className='text-lg opacity-80'>{icon}</div>}
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
              {/* 할부 컬럼 대신 카드사, 예상수수료 컬럼 추가 */}
              {renderHeader("카드사", "cardIssuer")}
              {renderHeader("예상수수료", "estimatedFee")}
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
                {/* 예상 수수료 표시 */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {transaction.isInstallment &&
                  !transaction.originalTransactionId
                    ? formatEstimatedFee(transaction.estimatedInstallmentFee)
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
    installmentCardIssuer: "Other", // <<-- 카드사 상태 추가
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
    installmentCardIssuer: "Other", // <<-- 카드사 상태 추가
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
/* ./src/components/layout/Navbar.tsx */
'use client';

import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className='bg-white shadow text-gray-800 p-4'>
      <div className='container mx-auto'>
        <Link href='/' className='text-xl font-bold'>
          가계부 앱
        </Link>
      </div>
    </nav>
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
import React from "react";

const Button = ({
  children,
  type = "button",
  onClick,
  variant = "ghost",
  className = "",
  disabled = false,
  icon: Icon,
  size = "md",
  ariaLabel,
}: {
  type?: "button" | "submit" | "reset";
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  disabled?: boolean;
  icon?: React.ElementType;
  size?: "sm" | "md" | "lg" | "icon";
  ariaLabel?: string;
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150";
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
    icon: "p-2",
  };
  const variantStyles = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
    secondary:
      "bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-400",
    ghost:
      "bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-400 shadow-none",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
  };
  const disabledStyles = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${disabledStyles} ${className}`}
      aria-label={
        ariaLabel || (typeof children === "string" ? children : undefined)
      }
    >
      {Icon && <Icon className={`h-5 w-5 ${children ? "mr-2" : ""}`} />}
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
/* ./prisma/node_modules/.prisma/client/client.d.ts */
export * from "./index"```

```ts
/* ./prisma/node_modules/.prisma/client/default.d.ts */
export * from "./index"```

```ts
/* ./prisma/node_modules/.prisma/client/edge.d.ts */
export * from "./default"```

```ts
/* ./prisma/node_modules/.prisma/client/index.d.ts */

/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Transaction
 * 
 */
export type Transaction = $Result.DefaultSelection<Prisma.$TransactionPayload>
/**
 * Model Category
 * 
 */
export type Category = $Result.DefaultSelection<Prisma.$CategoryPayload>
/**
 * Model Budget
 * 
 */
export type Budget = $Result.DefaultSelection<Prisma.$BudgetPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Transactions
 * const transactions = await prisma.transaction.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Transactions
   * const transactions = await prisma.transaction.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.transaction`: Exposes CRUD operations for the **Transaction** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Transactions
    * const transactions = await prisma.transaction.findMany()
    * ```
    */
  get transaction(): Prisma.TransactionDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.category`: Exposes CRUD operations for the **Category** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Categories
    * const categories = await prisma.category.findMany()
    * ```
    */
  get category(): Prisma.CategoryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.budget`: Exposes CRUD operations for the **Budget** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Budgets
    * const budgets = await prisma.budget.findMany()
    * ```
    */
  get budget(): Prisma.BudgetDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.7.0
   * Query Engine version: 3cff47a7f5d65c3ea74883f1d736e41d68ce91ed
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Transaction: 'Transaction',
    Category: 'Category',
    Budget: 'Budget'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "transaction" | "category" | "budget"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Transaction: {
        payload: Prisma.$TransactionPayload<ExtArgs>
        fields: Prisma.TransactionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TransactionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TransactionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          findFirst: {
            args: Prisma.TransactionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TransactionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          findMany: {
            args: Prisma.TransactionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>[]
          }
          create: {
            args: Prisma.TransactionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          createMany: {
            args: Prisma.TransactionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TransactionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>[]
          }
          delete: {
            args: Prisma.TransactionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          update: {
            args: Prisma.TransactionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          deleteMany: {
            args: Prisma.TransactionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TransactionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TransactionUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>[]
          }
          upsert: {
            args: Prisma.TransactionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TransactionPayload>
          }
          aggregate: {
            args: Prisma.TransactionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTransaction>
          }
          groupBy: {
            args: Prisma.TransactionGroupByArgs<ExtArgs>
            result: $Utils.Optional<TransactionGroupByOutputType>[]
          }
          count: {
            args: Prisma.TransactionCountArgs<ExtArgs>
            result: $Utils.Optional<TransactionCountAggregateOutputType> | number
          }
        }
      }
      Category: {
        payload: Prisma.$CategoryPayload<ExtArgs>
        fields: Prisma.CategoryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CategoryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CategoryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          findFirst: {
            args: Prisma.CategoryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CategoryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          findMany: {
            args: Prisma.CategoryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>[]
          }
          create: {
            args: Prisma.CategoryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          createMany: {
            args: Prisma.CategoryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CategoryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>[]
          }
          delete: {
            args: Prisma.CategoryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          update: {
            args: Prisma.CategoryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          deleteMany: {
            args: Prisma.CategoryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CategoryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.CategoryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>[]
          }
          upsert: {
            args: Prisma.CategoryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CategoryPayload>
          }
          aggregate: {
            args: Prisma.CategoryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCategory>
          }
          groupBy: {
            args: Prisma.CategoryGroupByArgs<ExtArgs>
            result: $Utils.Optional<CategoryGroupByOutputType>[]
          }
          count: {
            args: Prisma.CategoryCountArgs<ExtArgs>
            result: $Utils.Optional<CategoryCountAggregateOutputType> | number
          }
        }
      }
      Budget: {
        payload: Prisma.$BudgetPayload<ExtArgs>
        fields: Prisma.BudgetFieldRefs
        operations: {
          findUnique: {
            args: Prisma.BudgetFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BudgetPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.BudgetFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BudgetPayload>
          }
          findFirst: {
            args: Prisma.BudgetFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BudgetPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.BudgetFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BudgetPayload>
          }
          findMany: {
            args: Prisma.BudgetFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BudgetPayload>[]
          }
          create: {
            args: Prisma.BudgetCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BudgetPayload>
          }
          createMany: {
            args: Prisma.BudgetCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.BudgetCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BudgetPayload>[]
          }
          delete: {
            args: Prisma.BudgetDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BudgetPayload>
          }
          update: {
            args: Prisma.BudgetUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BudgetPayload>
          }
          deleteMany: {
            args: Prisma.BudgetDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.BudgetUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.BudgetUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BudgetPayload>[]
          }
          upsert: {
            args: Prisma.BudgetUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BudgetPayload>
          }
          aggregate: {
            args: Prisma.BudgetAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateBudget>
          }
          groupBy: {
            args: Prisma.BudgetGroupByArgs<ExtArgs>
            result: $Utils.Optional<BudgetGroupByOutputType>[]
          }
          count: {
            args: Prisma.BudgetCountArgs<ExtArgs>
            result: $Utils.Optional<BudgetCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    transaction?: TransactionOmit
    category?: CategoryOmit
    budget?: BudgetOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type CategoryCountOutputType
   */

  export type CategoryCountOutputType = {
    budgets: number
    transactions: number
  }

  export type CategoryCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    budgets?: boolean | CategoryCountOutputTypeCountBudgetsArgs
    transactions?: boolean | CategoryCountOutputTypeCountTransactionsArgs
  }

  // Custom InputTypes
  /**
   * CategoryCountOutputType without action
   */
  export type CategoryCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CategoryCountOutputType
     */
    select?: CategoryCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * CategoryCountOutputType without action
   */
  export type CategoryCountOutputTypeCountBudgetsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: BudgetWhereInput
  }

  /**
   * CategoryCountOutputType without action
   */
  export type CategoryCountOutputTypeCountTransactionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TransactionWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Transaction
   */

  export type AggregateTransaction = {
    _count: TransactionCountAggregateOutputType | null
    _avg: TransactionAvgAggregateOutputType | null
    _sum: TransactionSumAggregateOutputType | null
    _min: TransactionMinAggregateOutputType | null
    _max: TransactionMaxAggregateOutputType | null
  }

  export type TransactionAvgAggregateOutputType = {
    id: number | null
    amount: number | null
    categoryId: number | null
  }

  export type TransactionSumAggregateOutputType = {
    id: number | null
    amount: number | null
    categoryId: number | null
  }

  export type TransactionMinAggregateOutputType = {
    id: number | null
    date: Date | null
    amount: number | null
    type: string | null
    description: string | null
    categoryId: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TransactionMaxAggregateOutputType = {
    id: number | null
    date: Date | null
    amount: number | null
    type: string | null
    description: string | null
    categoryId: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TransactionCountAggregateOutputType = {
    id: number
    date: number
    amount: number
    type: number
    description: number
    categoryId: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TransactionAvgAggregateInputType = {
    id?: true
    amount?: true
    categoryId?: true
  }

  export type TransactionSumAggregateInputType = {
    id?: true
    amount?: true
    categoryId?: true
  }

  export type TransactionMinAggregateInputType = {
    id?: true
    date?: true
    amount?: true
    type?: true
    description?: true
    categoryId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TransactionMaxAggregateInputType = {
    id?: true
    date?: true
    amount?: true
    type?: true
    description?: true
    categoryId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TransactionCountAggregateInputType = {
    id?: true
    date?: true
    amount?: true
    type?: true
    description?: true
    categoryId?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TransactionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Transaction to aggregate.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Transactions
    **/
    _count?: true | TransactionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TransactionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TransactionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TransactionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TransactionMaxAggregateInputType
  }

  export type GetTransactionAggregateType<T extends TransactionAggregateArgs> = {
        [P in keyof T & keyof AggregateTransaction]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTransaction[P]>
      : GetScalarType<T[P], AggregateTransaction[P]>
  }




  export type TransactionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TransactionWhereInput
    orderBy?: TransactionOrderByWithAggregationInput | TransactionOrderByWithAggregationInput[]
    by: TransactionScalarFieldEnum[] | TransactionScalarFieldEnum
    having?: TransactionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TransactionCountAggregateInputType | true
    _avg?: TransactionAvgAggregateInputType
    _sum?: TransactionSumAggregateInputType
    _min?: TransactionMinAggregateInputType
    _max?: TransactionMaxAggregateInputType
  }

  export type TransactionGroupByOutputType = {
    id: number
    date: Date
    amount: number
    type: string
    description: string | null
    categoryId: number
    createdAt: Date
    updatedAt: Date
    _count: TransactionCountAggregateOutputType | null
    _avg: TransactionAvgAggregateOutputType | null
    _sum: TransactionSumAggregateOutputType | null
    _min: TransactionMinAggregateOutputType | null
    _max: TransactionMaxAggregateOutputType | null
  }

  type GetTransactionGroupByPayload<T extends TransactionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TransactionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TransactionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TransactionGroupByOutputType[P]>
            : GetScalarType<T[P], TransactionGroupByOutputType[P]>
        }
      >
    >


  export type TransactionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    date?: boolean
    amount?: boolean
    type?: boolean
    description?: boolean
    categoryId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["transaction"]>

  export type TransactionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    date?: boolean
    amount?: boolean
    type?: boolean
    description?: boolean
    categoryId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["transaction"]>

  export type TransactionSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    date?: boolean
    amount?: boolean
    type?: boolean
    description?: boolean
    categoryId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["transaction"]>

  export type TransactionSelectScalar = {
    id?: boolean
    date?: boolean
    amount?: boolean
    type?: boolean
    description?: boolean
    categoryId?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TransactionOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "date" | "amount" | "type" | "description" | "categoryId" | "createdAt" | "updatedAt", ExtArgs["result"]["transaction"]>
  export type TransactionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }
  export type TransactionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }
  export type TransactionIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }

  export type $TransactionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Transaction"
    objects: {
      category: Prisma.$CategoryPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      date: Date
      amount: number
      type: string
      description: string | null
      categoryId: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["transaction"]>
    composites: {}
  }

  type TransactionGetPayload<S extends boolean | null | undefined | TransactionDefaultArgs> = $Result.GetResult<Prisma.$TransactionPayload, S>

  type TransactionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TransactionFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TransactionCountAggregateInputType | true
    }

  export interface TransactionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Transaction'], meta: { name: 'Transaction' } }
    /**
     * Find zero or one Transaction that matches the filter.
     * @param {TransactionFindUniqueArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TransactionFindUniqueArgs>(args: SelectSubset<T, TransactionFindUniqueArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Transaction that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TransactionFindUniqueOrThrowArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TransactionFindUniqueOrThrowArgs>(args: SelectSubset<T, TransactionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Transaction that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionFindFirstArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TransactionFindFirstArgs>(args?: SelectSubset<T, TransactionFindFirstArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Transaction that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionFindFirstOrThrowArgs} args - Arguments to find a Transaction
     * @example
     * // Get one Transaction
     * const transaction = await prisma.transaction.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TransactionFindFirstOrThrowArgs>(args?: SelectSubset<T, TransactionFindFirstOrThrowArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Transactions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Transactions
     * const transactions = await prisma.transaction.findMany()
     * 
     * // Get first 10 Transactions
     * const transactions = await prisma.transaction.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const transactionWithIdOnly = await prisma.transaction.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TransactionFindManyArgs>(args?: SelectSubset<T, TransactionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Transaction.
     * @param {TransactionCreateArgs} args - Arguments to create a Transaction.
     * @example
     * // Create one Transaction
     * const Transaction = await prisma.transaction.create({
     *   data: {
     *     // ... data to create a Transaction
     *   }
     * })
     * 
     */
    create<T extends TransactionCreateArgs>(args: SelectSubset<T, TransactionCreateArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Transactions.
     * @param {TransactionCreateManyArgs} args - Arguments to create many Transactions.
     * @example
     * // Create many Transactions
     * const transaction = await prisma.transaction.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TransactionCreateManyArgs>(args?: SelectSubset<T, TransactionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Transactions and returns the data saved in the database.
     * @param {TransactionCreateManyAndReturnArgs} args - Arguments to create many Transactions.
     * @example
     * // Create many Transactions
     * const transaction = await prisma.transaction.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Transactions and only return the `id`
     * const transactionWithIdOnly = await prisma.transaction.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TransactionCreateManyAndReturnArgs>(args?: SelectSubset<T, TransactionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Transaction.
     * @param {TransactionDeleteArgs} args - Arguments to delete one Transaction.
     * @example
     * // Delete one Transaction
     * const Transaction = await prisma.transaction.delete({
     *   where: {
     *     // ... filter to delete one Transaction
     *   }
     * })
     * 
     */
    delete<T extends TransactionDeleteArgs>(args: SelectSubset<T, TransactionDeleteArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Transaction.
     * @param {TransactionUpdateArgs} args - Arguments to update one Transaction.
     * @example
     * // Update one Transaction
     * const transaction = await prisma.transaction.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TransactionUpdateArgs>(args: SelectSubset<T, TransactionUpdateArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Transactions.
     * @param {TransactionDeleteManyArgs} args - Arguments to filter Transactions to delete.
     * @example
     * // Delete a few Transactions
     * const { count } = await prisma.transaction.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TransactionDeleteManyArgs>(args?: SelectSubset<T, TransactionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Transactions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Transactions
     * const transaction = await prisma.transaction.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TransactionUpdateManyArgs>(args: SelectSubset<T, TransactionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Transactions and returns the data updated in the database.
     * @param {TransactionUpdateManyAndReturnArgs} args - Arguments to update many Transactions.
     * @example
     * // Update many Transactions
     * const transaction = await prisma.transaction.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Transactions and only return the `id`
     * const transactionWithIdOnly = await prisma.transaction.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TransactionUpdateManyAndReturnArgs>(args: SelectSubset<T, TransactionUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Transaction.
     * @param {TransactionUpsertArgs} args - Arguments to update or create a Transaction.
     * @example
     * // Update or create a Transaction
     * const transaction = await prisma.transaction.upsert({
     *   create: {
     *     // ... data to create a Transaction
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Transaction we want to update
     *   }
     * })
     */
    upsert<T extends TransactionUpsertArgs>(args: SelectSubset<T, TransactionUpsertArgs<ExtArgs>>): Prisma__TransactionClient<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Transactions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionCountArgs} args - Arguments to filter Transactions to count.
     * @example
     * // Count the number of Transactions
     * const count = await prisma.transaction.count({
     *   where: {
     *     // ... the filter for the Transactions we want to count
     *   }
     * })
    **/
    count<T extends TransactionCountArgs>(
      args?: Subset<T, TransactionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TransactionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Transaction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TransactionAggregateArgs>(args: Subset<T, TransactionAggregateArgs>): Prisma.PrismaPromise<GetTransactionAggregateType<T>>

    /**
     * Group by Transaction.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TransactionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TransactionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TransactionGroupByArgs['orderBy'] }
        : { orderBy?: TransactionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TransactionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTransactionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Transaction model
   */
  readonly fields: TransactionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Transaction.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TransactionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    category<T extends CategoryDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CategoryDefaultArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Transaction model
   */
  interface TransactionFieldRefs {
    readonly id: FieldRef<"Transaction", 'Int'>
    readonly date: FieldRef<"Transaction", 'DateTime'>
    readonly amount: FieldRef<"Transaction", 'Float'>
    readonly type: FieldRef<"Transaction", 'String'>
    readonly description: FieldRef<"Transaction", 'String'>
    readonly categoryId: FieldRef<"Transaction", 'Int'>
    readonly createdAt: FieldRef<"Transaction", 'DateTime'>
    readonly updatedAt: FieldRef<"Transaction", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Transaction findUnique
   */
  export type TransactionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction findUniqueOrThrow
   */
  export type TransactionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction findFirst
   */
  export type TransactionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Transactions.
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Transactions.
     */
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * Transaction findFirstOrThrow
   */
  export type TransactionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transaction to fetch.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Transactions.
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Transactions.
     */
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * Transaction findMany
   */
  export type TransactionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter, which Transactions to fetch.
     */
    where?: TransactionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Transactions to fetch.
     */
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Transactions.
     */
    cursor?: TransactionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Transactions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Transactions.
     */
    skip?: number
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * Transaction create
   */
  export type TransactionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * The data needed to create a Transaction.
     */
    data: XOR<TransactionCreateInput, TransactionUncheckedCreateInput>
  }

  /**
   * Transaction createMany
   */
  export type TransactionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Transactions.
     */
    data: TransactionCreateManyInput | TransactionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Transaction createManyAndReturn
   */
  export type TransactionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * The data used to create many Transactions.
     */
    data: TransactionCreateManyInput | TransactionCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Transaction update
   */
  export type TransactionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * The data needed to update a Transaction.
     */
    data: XOR<TransactionUpdateInput, TransactionUncheckedUpdateInput>
    /**
     * Choose, which Transaction to update.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction updateMany
   */
  export type TransactionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Transactions.
     */
    data: XOR<TransactionUpdateManyMutationInput, TransactionUncheckedUpdateManyInput>
    /**
     * Filter which Transactions to update
     */
    where?: TransactionWhereInput
    /**
     * Limit how many Transactions to update.
     */
    limit?: number
  }

  /**
   * Transaction updateManyAndReturn
   */
  export type TransactionUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * The data used to update Transactions.
     */
    data: XOR<TransactionUpdateManyMutationInput, TransactionUncheckedUpdateManyInput>
    /**
     * Filter which Transactions to update
     */
    where?: TransactionWhereInput
    /**
     * Limit how many Transactions to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Transaction upsert
   */
  export type TransactionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * The filter to search for the Transaction to update in case it exists.
     */
    where: TransactionWhereUniqueInput
    /**
     * In case the Transaction found by the `where` argument doesn't exist, create a new Transaction with this data.
     */
    create: XOR<TransactionCreateInput, TransactionUncheckedCreateInput>
    /**
     * In case the Transaction was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TransactionUpdateInput, TransactionUncheckedUpdateInput>
  }

  /**
   * Transaction delete
   */
  export type TransactionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    /**
     * Filter which Transaction to delete.
     */
    where: TransactionWhereUniqueInput
  }

  /**
   * Transaction deleteMany
   */
  export type TransactionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Transactions to delete
     */
    where?: TransactionWhereInput
    /**
     * Limit how many Transactions to delete.
     */
    limit?: number
  }

  /**
   * Transaction without action
   */
  export type TransactionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
  }


  /**
   * Model Category
   */

  export type AggregateCategory = {
    _count: CategoryCountAggregateOutputType | null
    _avg: CategoryAvgAggregateOutputType | null
    _sum: CategorySumAggregateOutputType | null
    _min: CategoryMinAggregateOutputType | null
    _max: CategoryMaxAggregateOutputType | null
  }

  export type CategoryAvgAggregateOutputType = {
    id: number | null
  }

  export type CategorySumAggregateOutputType = {
    id: number | null
  }

  export type CategoryMinAggregateOutputType = {
    id: number | null
    name: string | null
    type: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CategoryMaxAggregateOutputType = {
    id: number | null
    name: string | null
    type: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type CategoryCountAggregateOutputType = {
    id: number
    name: number
    type: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type CategoryAvgAggregateInputType = {
    id?: true
  }

  export type CategorySumAggregateInputType = {
    id?: true
  }

  export type CategoryMinAggregateInputType = {
    id?: true
    name?: true
    type?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CategoryMaxAggregateInputType = {
    id?: true
    name?: true
    type?: true
    createdAt?: true
    updatedAt?: true
  }

  export type CategoryCountAggregateInputType = {
    id?: true
    name?: true
    type?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type CategoryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Category to aggregate.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Categories
    **/
    _count?: true | CategoryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CategoryAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CategorySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CategoryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CategoryMaxAggregateInputType
  }

  export type GetCategoryAggregateType<T extends CategoryAggregateArgs> = {
        [P in keyof T & keyof AggregateCategory]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCategory[P]>
      : GetScalarType<T[P], AggregateCategory[P]>
  }




  export type CategoryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CategoryWhereInput
    orderBy?: CategoryOrderByWithAggregationInput | CategoryOrderByWithAggregationInput[]
    by: CategoryScalarFieldEnum[] | CategoryScalarFieldEnum
    having?: CategoryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CategoryCountAggregateInputType | true
    _avg?: CategoryAvgAggregateInputType
    _sum?: CategorySumAggregateInputType
    _min?: CategoryMinAggregateInputType
    _max?: CategoryMaxAggregateInputType
  }

  export type CategoryGroupByOutputType = {
    id: number
    name: string
    type: string
    createdAt: Date
    updatedAt: Date
    _count: CategoryCountAggregateOutputType | null
    _avg: CategoryAvgAggregateOutputType | null
    _sum: CategorySumAggregateOutputType | null
    _min: CategoryMinAggregateOutputType | null
    _max: CategoryMaxAggregateOutputType | null
  }

  type GetCategoryGroupByPayload<T extends CategoryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CategoryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CategoryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CategoryGroupByOutputType[P]>
            : GetScalarType<T[P], CategoryGroupByOutputType[P]>
        }
      >
    >


  export type CategorySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    type?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    budgets?: boolean | Category$budgetsArgs<ExtArgs>
    transactions?: boolean | Category$transactionsArgs<ExtArgs>
    _count?: boolean | CategoryCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["category"]>

  export type CategorySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    type?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["category"]>

  export type CategorySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    type?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["category"]>

  export type CategorySelectScalar = {
    id?: boolean
    name?: boolean
    type?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type CategoryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "name" | "type" | "createdAt" | "updatedAt", ExtArgs["result"]["category"]>
  export type CategoryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    budgets?: boolean | Category$budgetsArgs<ExtArgs>
    transactions?: boolean | Category$transactionsArgs<ExtArgs>
    _count?: boolean | CategoryCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type CategoryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type CategoryIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $CategoryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Category"
    objects: {
      budgets: Prisma.$BudgetPayload<ExtArgs>[]
      transactions: Prisma.$TransactionPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      name: string
      type: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["category"]>
    composites: {}
  }

  type CategoryGetPayload<S extends boolean | null | undefined | CategoryDefaultArgs> = $Result.GetResult<Prisma.$CategoryPayload, S>

  type CategoryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<CategoryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: CategoryCountAggregateInputType | true
    }

  export interface CategoryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Category'], meta: { name: 'Category' } }
    /**
     * Find zero or one Category that matches the filter.
     * @param {CategoryFindUniqueArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CategoryFindUniqueArgs>(args: SelectSubset<T, CategoryFindUniqueArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Category that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {CategoryFindUniqueOrThrowArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CategoryFindUniqueOrThrowArgs>(args: SelectSubset<T, CategoryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Category that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindFirstArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CategoryFindFirstArgs>(args?: SelectSubset<T, CategoryFindFirstArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Category that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindFirstOrThrowArgs} args - Arguments to find a Category
     * @example
     * // Get one Category
     * const category = await prisma.category.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CategoryFindFirstOrThrowArgs>(args?: SelectSubset<T, CategoryFindFirstOrThrowArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Categories that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Categories
     * const categories = await prisma.category.findMany()
     * 
     * // Get first 10 Categories
     * const categories = await prisma.category.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const categoryWithIdOnly = await prisma.category.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CategoryFindManyArgs>(args?: SelectSubset<T, CategoryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Category.
     * @param {CategoryCreateArgs} args - Arguments to create a Category.
     * @example
     * // Create one Category
     * const Category = await prisma.category.create({
     *   data: {
     *     // ... data to create a Category
     *   }
     * })
     * 
     */
    create<T extends CategoryCreateArgs>(args: SelectSubset<T, CategoryCreateArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Categories.
     * @param {CategoryCreateManyArgs} args - Arguments to create many Categories.
     * @example
     * // Create many Categories
     * const category = await prisma.category.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CategoryCreateManyArgs>(args?: SelectSubset<T, CategoryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Categories and returns the data saved in the database.
     * @param {CategoryCreateManyAndReturnArgs} args - Arguments to create many Categories.
     * @example
     * // Create many Categories
     * const category = await prisma.category.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Categories and only return the `id`
     * const categoryWithIdOnly = await prisma.category.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CategoryCreateManyAndReturnArgs>(args?: SelectSubset<T, CategoryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Category.
     * @param {CategoryDeleteArgs} args - Arguments to delete one Category.
     * @example
     * // Delete one Category
     * const Category = await prisma.category.delete({
     *   where: {
     *     // ... filter to delete one Category
     *   }
     * })
     * 
     */
    delete<T extends CategoryDeleteArgs>(args: SelectSubset<T, CategoryDeleteArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Category.
     * @param {CategoryUpdateArgs} args - Arguments to update one Category.
     * @example
     * // Update one Category
     * const category = await prisma.category.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CategoryUpdateArgs>(args: SelectSubset<T, CategoryUpdateArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Categories.
     * @param {CategoryDeleteManyArgs} args - Arguments to filter Categories to delete.
     * @example
     * // Delete a few Categories
     * const { count } = await prisma.category.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CategoryDeleteManyArgs>(args?: SelectSubset<T, CategoryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Categories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Categories
     * const category = await prisma.category.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CategoryUpdateManyArgs>(args: SelectSubset<T, CategoryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Categories and returns the data updated in the database.
     * @param {CategoryUpdateManyAndReturnArgs} args - Arguments to update many Categories.
     * @example
     * // Update many Categories
     * const category = await prisma.category.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Categories and only return the `id`
     * const categoryWithIdOnly = await prisma.category.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends CategoryUpdateManyAndReturnArgs>(args: SelectSubset<T, CategoryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Category.
     * @param {CategoryUpsertArgs} args - Arguments to update or create a Category.
     * @example
     * // Update or create a Category
     * const category = await prisma.category.upsert({
     *   create: {
     *     // ... data to create a Category
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Category we want to update
     *   }
     * })
     */
    upsert<T extends CategoryUpsertArgs>(args: SelectSubset<T, CategoryUpsertArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Categories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryCountArgs} args - Arguments to filter Categories to count.
     * @example
     * // Count the number of Categories
     * const count = await prisma.category.count({
     *   where: {
     *     // ... the filter for the Categories we want to count
     *   }
     * })
    **/
    count<T extends CategoryCountArgs>(
      args?: Subset<T, CategoryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CategoryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Category.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CategoryAggregateArgs>(args: Subset<T, CategoryAggregateArgs>): Prisma.PrismaPromise<GetCategoryAggregateType<T>>

    /**
     * Group by Category.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CategoryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CategoryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CategoryGroupByArgs['orderBy'] }
        : { orderBy?: CategoryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CategoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCategoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Category model
   */
  readonly fields: CategoryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Category.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CategoryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    budgets<T extends Category$budgetsArgs<ExtArgs> = {}>(args?: Subset<T, Category$budgetsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    transactions<T extends Category$transactionsArgs<ExtArgs> = {}>(args?: Subset<T, Category$transactionsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TransactionPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Category model
   */
  interface CategoryFieldRefs {
    readonly id: FieldRef<"Category", 'Int'>
    readonly name: FieldRef<"Category", 'String'>
    readonly type: FieldRef<"Category", 'String'>
    readonly createdAt: FieldRef<"Category", 'DateTime'>
    readonly updatedAt: FieldRef<"Category", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Category findUnique
   */
  export type CategoryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category findUniqueOrThrow
   */
  export type CategoryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category findFirst
   */
  export type CategoryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Categories.
     */
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }

  /**
   * Category findFirstOrThrow
   */
  export type CategoryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Category to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Categories.
     */
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }

  /**
   * Category findMany
   */
  export type CategoryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter, which Categories to fetch.
     */
    where?: CategoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Categories to fetch.
     */
    orderBy?: CategoryOrderByWithRelationInput | CategoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Categories.
     */
    cursor?: CategoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Categories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Categories.
     */
    skip?: number
    distinct?: CategoryScalarFieldEnum | CategoryScalarFieldEnum[]
  }

  /**
   * Category create
   */
  export type CategoryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The data needed to create a Category.
     */
    data: XOR<CategoryCreateInput, CategoryUncheckedCreateInput>
  }

  /**
   * Category createMany
   */
  export type CategoryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Categories.
     */
    data: CategoryCreateManyInput | CategoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Category createManyAndReturn
   */
  export type CategoryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * The data used to create many Categories.
     */
    data: CategoryCreateManyInput | CategoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Category update
   */
  export type CategoryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The data needed to update a Category.
     */
    data: XOR<CategoryUpdateInput, CategoryUncheckedUpdateInput>
    /**
     * Choose, which Category to update.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category updateMany
   */
  export type CategoryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Categories.
     */
    data: XOR<CategoryUpdateManyMutationInput, CategoryUncheckedUpdateManyInput>
    /**
     * Filter which Categories to update
     */
    where?: CategoryWhereInput
    /**
     * Limit how many Categories to update.
     */
    limit?: number
  }

  /**
   * Category updateManyAndReturn
   */
  export type CategoryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * The data used to update Categories.
     */
    data: XOR<CategoryUpdateManyMutationInput, CategoryUncheckedUpdateManyInput>
    /**
     * Filter which Categories to update
     */
    where?: CategoryWhereInput
    /**
     * Limit how many Categories to update.
     */
    limit?: number
  }

  /**
   * Category upsert
   */
  export type CategoryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * The filter to search for the Category to update in case it exists.
     */
    where: CategoryWhereUniqueInput
    /**
     * In case the Category found by the `where` argument doesn't exist, create a new Category with this data.
     */
    create: XOR<CategoryCreateInput, CategoryUncheckedCreateInput>
    /**
     * In case the Category was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CategoryUpdateInput, CategoryUncheckedUpdateInput>
  }

  /**
   * Category delete
   */
  export type CategoryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
    /**
     * Filter which Category to delete.
     */
    where: CategoryWhereUniqueInput
  }

  /**
   * Category deleteMany
   */
  export type CategoryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Categories to delete
     */
    where?: CategoryWhereInput
    /**
     * Limit how many Categories to delete.
     */
    limit?: number
  }

  /**
   * Category.budgets
   */
  export type Category$budgetsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetInclude<ExtArgs> | null
    where?: BudgetWhereInput
    orderBy?: BudgetOrderByWithRelationInput | BudgetOrderByWithRelationInput[]
    cursor?: BudgetWhereUniqueInput
    take?: number
    skip?: number
    distinct?: BudgetScalarFieldEnum | BudgetScalarFieldEnum[]
  }

  /**
   * Category.transactions
   */
  export type Category$transactionsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Transaction
     */
    select?: TransactionSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Transaction
     */
    omit?: TransactionOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TransactionInclude<ExtArgs> | null
    where?: TransactionWhereInput
    orderBy?: TransactionOrderByWithRelationInput | TransactionOrderByWithRelationInput[]
    cursor?: TransactionWhereUniqueInput
    take?: number
    skip?: number
    distinct?: TransactionScalarFieldEnum | TransactionScalarFieldEnum[]
  }

  /**
   * Category without action
   */
  export type CategoryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Category
     */
    select?: CategorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the Category
     */
    omit?: CategoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CategoryInclude<ExtArgs> | null
  }


  /**
   * Model Budget
   */

  export type AggregateBudget = {
    _count: BudgetCountAggregateOutputType | null
    _avg: BudgetAvgAggregateOutputType | null
    _sum: BudgetSumAggregateOutputType | null
    _min: BudgetMinAggregateOutputType | null
    _max: BudgetMaxAggregateOutputType | null
  }

  export type BudgetAvgAggregateOutputType = {
    id: number | null
    categoryId: number | null
    amount: number | null
  }

  export type BudgetSumAggregateOutputType = {
    id: number | null
    categoryId: number | null
    amount: number | null
  }

  export type BudgetMinAggregateOutputType = {
    id: number | null
    month: string | null
    categoryId: number | null
    amount: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BudgetMaxAggregateOutputType = {
    id: number | null
    month: string | null
    categoryId: number | null
    amount: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type BudgetCountAggregateOutputType = {
    id: number
    month: number
    categoryId: number
    amount: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type BudgetAvgAggregateInputType = {
    id?: true
    categoryId?: true
    amount?: true
  }

  export type BudgetSumAggregateInputType = {
    id?: true
    categoryId?: true
    amount?: true
  }

  export type BudgetMinAggregateInputType = {
    id?: true
    month?: true
    categoryId?: true
    amount?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BudgetMaxAggregateInputType = {
    id?: true
    month?: true
    categoryId?: true
    amount?: true
    createdAt?: true
    updatedAt?: true
  }

  export type BudgetCountAggregateInputType = {
    id?: true
    month?: true
    categoryId?: true
    amount?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type BudgetAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Budget to aggregate.
     */
    where?: BudgetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Budgets to fetch.
     */
    orderBy?: BudgetOrderByWithRelationInput | BudgetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: BudgetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Budgets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Budgets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Budgets
    **/
    _count?: true | BudgetCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: BudgetAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: BudgetSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: BudgetMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: BudgetMaxAggregateInputType
  }

  export type GetBudgetAggregateType<T extends BudgetAggregateArgs> = {
        [P in keyof T & keyof AggregateBudget]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateBudget[P]>
      : GetScalarType<T[P], AggregateBudget[P]>
  }




  export type BudgetGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: BudgetWhereInput
    orderBy?: BudgetOrderByWithAggregationInput | BudgetOrderByWithAggregationInput[]
    by: BudgetScalarFieldEnum[] | BudgetScalarFieldEnum
    having?: BudgetScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: BudgetCountAggregateInputType | true
    _avg?: BudgetAvgAggregateInputType
    _sum?: BudgetSumAggregateInputType
    _min?: BudgetMinAggregateInputType
    _max?: BudgetMaxAggregateInputType
  }

  export type BudgetGroupByOutputType = {
    id: number
    month: string
    categoryId: number
    amount: number
    createdAt: Date
    updatedAt: Date
    _count: BudgetCountAggregateOutputType | null
    _avg: BudgetAvgAggregateOutputType | null
    _sum: BudgetSumAggregateOutputType | null
    _min: BudgetMinAggregateOutputType | null
    _max: BudgetMaxAggregateOutputType | null
  }

  type GetBudgetGroupByPayload<T extends BudgetGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<BudgetGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof BudgetGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], BudgetGroupByOutputType[P]>
            : GetScalarType<T[P], BudgetGroupByOutputType[P]>
        }
      >
    >


  export type BudgetSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    month?: boolean
    categoryId?: boolean
    amount?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["budget"]>

  export type BudgetSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    month?: boolean
    categoryId?: boolean
    amount?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["budget"]>

  export type BudgetSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    month?: boolean
    categoryId?: boolean
    amount?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["budget"]>

  export type BudgetSelectScalar = {
    id?: boolean
    month?: boolean
    categoryId?: boolean
    amount?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type BudgetOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "month" | "categoryId" | "amount" | "createdAt" | "updatedAt", ExtArgs["result"]["budget"]>
  export type BudgetInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }
  export type BudgetIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }
  export type BudgetIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    category?: boolean | CategoryDefaultArgs<ExtArgs>
  }

  export type $BudgetPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Budget"
    objects: {
      category: Prisma.$CategoryPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      month: string
      categoryId: number
      amount: number
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["budget"]>
    composites: {}
  }

  type BudgetGetPayload<S extends boolean | null | undefined | BudgetDefaultArgs> = $Result.GetResult<Prisma.$BudgetPayload, S>

  type BudgetCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<BudgetFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: BudgetCountAggregateInputType | true
    }

  export interface BudgetDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Budget'], meta: { name: 'Budget' } }
    /**
     * Find zero or one Budget that matches the filter.
     * @param {BudgetFindUniqueArgs} args - Arguments to find a Budget
     * @example
     * // Get one Budget
     * const budget = await prisma.budget.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends BudgetFindUniqueArgs>(args: SelectSubset<T, BudgetFindUniqueArgs<ExtArgs>>): Prisma__BudgetClient<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Budget that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {BudgetFindUniqueOrThrowArgs} args - Arguments to find a Budget
     * @example
     * // Get one Budget
     * const budget = await prisma.budget.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends BudgetFindUniqueOrThrowArgs>(args: SelectSubset<T, BudgetFindUniqueOrThrowArgs<ExtArgs>>): Prisma__BudgetClient<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Budget that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BudgetFindFirstArgs} args - Arguments to find a Budget
     * @example
     * // Get one Budget
     * const budget = await prisma.budget.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends BudgetFindFirstArgs>(args?: SelectSubset<T, BudgetFindFirstArgs<ExtArgs>>): Prisma__BudgetClient<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Budget that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BudgetFindFirstOrThrowArgs} args - Arguments to find a Budget
     * @example
     * // Get one Budget
     * const budget = await prisma.budget.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends BudgetFindFirstOrThrowArgs>(args?: SelectSubset<T, BudgetFindFirstOrThrowArgs<ExtArgs>>): Prisma__BudgetClient<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Budgets that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BudgetFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Budgets
     * const budgets = await prisma.budget.findMany()
     * 
     * // Get first 10 Budgets
     * const budgets = await prisma.budget.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const budgetWithIdOnly = await prisma.budget.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends BudgetFindManyArgs>(args?: SelectSubset<T, BudgetFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Budget.
     * @param {BudgetCreateArgs} args - Arguments to create a Budget.
     * @example
     * // Create one Budget
     * const Budget = await prisma.budget.create({
     *   data: {
     *     // ... data to create a Budget
     *   }
     * })
     * 
     */
    create<T extends BudgetCreateArgs>(args: SelectSubset<T, BudgetCreateArgs<ExtArgs>>): Prisma__BudgetClient<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Budgets.
     * @param {BudgetCreateManyArgs} args - Arguments to create many Budgets.
     * @example
     * // Create many Budgets
     * const budget = await prisma.budget.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends BudgetCreateManyArgs>(args?: SelectSubset<T, BudgetCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Budgets and returns the data saved in the database.
     * @param {BudgetCreateManyAndReturnArgs} args - Arguments to create many Budgets.
     * @example
     * // Create many Budgets
     * const budget = await prisma.budget.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Budgets and only return the `id`
     * const budgetWithIdOnly = await prisma.budget.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends BudgetCreateManyAndReturnArgs>(args?: SelectSubset<T, BudgetCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Budget.
     * @param {BudgetDeleteArgs} args - Arguments to delete one Budget.
     * @example
     * // Delete one Budget
     * const Budget = await prisma.budget.delete({
     *   where: {
     *     // ... filter to delete one Budget
     *   }
     * })
     * 
     */
    delete<T extends BudgetDeleteArgs>(args: SelectSubset<T, BudgetDeleteArgs<ExtArgs>>): Prisma__BudgetClient<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Budget.
     * @param {BudgetUpdateArgs} args - Arguments to update one Budget.
     * @example
     * // Update one Budget
     * const budget = await prisma.budget.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends BudgetUpdateArgs>(args: SelectSubset<T, BudgetUpdateArgs<ExtArgs>>): Prisma__BudgetClient<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Budgets.
     * @param {BudgetDeleteManyArgs} args - Arguments to filter Budgets to delete.
     * @example
     * // Delete a few Budgets
     * const { count } = await prisma.budget.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends BudgetDeleteManyArgs>(args?: SelectSubset<T, BudgetDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Budgets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BudgetUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Budgets
     * const budget = await prisma.budget.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends BudgetUpdateManyArgs>(args: SelectSubset<T, BudgetUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Budgets and returns the data updated in the database.
     * @param {BudgetUpdateManyAndReturnArgs} args - Arguments to update many Budgets.
     * @example
     * // Update many Budgets
     * const budget = await prisma.budget.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Budgets and only return the `id`
     * const budgetWithIdOnly = await prisma.budget.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends BudgetUpdateManyAndReturnArgs>(args: SelectSubset<T, BudgetUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Budget.
     * @param {BudgetUpsertArgs} args - Arguments to update or create a Budget.
     * @example
     * // Update or create a Budget
     * const budget = await prisma.budget.upsert({
     *   create: {
     *     // ... data to create a Budget
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Budget we want to update
     *   }
     * })
     */
    upsert<T extends BudgetUpsertArgs>(args: SelectSubset<T, BudgetUpsertArgs<ExtArgs>>): Prisma__BudgetClient<$Result.GetResult<Prisma.$BudgetPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Budgets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BudgetCountArgs} args - Arguments to filter Budgets to count.
     * @example
     * // Count the number of Budgets
     * const count = await prisma.budget.count({
     *   where: {
     *     // ... the filter for the Budgets we want to count
     *   }
     * })
    **/
    count<T extends BudgetCountArgs>(
      args?: Subset<T, BudgetCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], BudgetCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Budget.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BudgetAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends BudgetAggregateArgs>(args: Subset<T, BudgetAggregateArgs>): Prisma.PrismaPromise<GetBudgetAggregateType<T>>

    /**
     * Group by Budget.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BudgetGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends BudgetGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: BudgetGroupByArgs['orderBy'] }
        : { orderBy?: BudgetGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, BudgetGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetBudgetGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Budget model
   */
  readonly fields: BudgetFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Budget.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__BudgetClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    category<T extends CategoryDefaultArgs<ExtArgs> = {}>(args?: Subset<T, CategoryDefaultArgs<ExtArgs>>): Prisma__CategoryClient<$Result.GetResult<Prisma.$CategoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Budget model
   */
  interface BudgetFieldRefs {
    readonly id: FieldRef<"Budget", 'Int'>
    readonly month: FieldRef<"Budget", 'String'>
    readonly categoryId: FieldRef<"Budget", 'Int'>
    readonly amount: FieldRef<"Budget", 'Float'>
    readonly createdAt: FieldRef<"Budget", 'DateTime'>
    readonly updatedAt: FieldRef<"Budget", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Budget findUnique
   */
  export type BudgetFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetInclude<ExtArgs> | null
    /**
     * Filter, which Budget to fetch.
     */
    where: BudgetWhereUniqueInput
  }

  /**
   * Budget findUniqueOrThrow
   */
  export type BudgetFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetInclude<ExtArgs> | null
    /**
     * Filter, which Budget to fetch.
     */
    where: BudgetWhereUniqueInput
  }

  /**
   * Budget findFirst
   */
  export type BudgetFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetInclude<ExtArgs> | null
    /**
     * Filter, which Budget to fetch.
     */
    where?: BudgetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Budgets to fetch.
     */
    orderBy?: BudgetOrderByWithRelationInput | BudgetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Budgets.
     */
    cursor?: BudgetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Budgets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Budgets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Budgets.
     */
    distinct?: BudgetScalarFieldEnum | BudgetScalarFieldEnum[]
  }

  /**
   * Budget findFirstOrThrow
   */
  export type BudgetFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetInclude<ExtArgs> | null
    /**
     * Filter, which Budget to fetch.
     */
    where?: BudgetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Budgets to fetch.
     */
    orderBy?: BudgetOrderByWithRelationInput | BudgetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Budgets.
     */
    cursor?: BudgetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Budgets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Budgets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Budgets.
     */
    distinct?: BudgetScalarFieldEnum | BudgetScalarFieldEnum[]
  }

  /**
   * Budget findMany
   */
  export type BudgetFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetInclude<ExtArgs> | null
    /**
     * Filter, which Budgets to fetch.
     */
    where?: BudgetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Budgets to fetch.
     */
    orderBy?: BudgetOrderByWithRelationInput | BudgetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Budgets.
     */
    cursor?: BudgetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Budgets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Budgets.
     */
    skip?: number
    distinct?: BudgetScalarFieldEnum | BudgetScalarFieldEnum[]
  }

  /**
   * Budget create
   */
  export type BudgetCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetInclude<ExtArgs> | null
    /**
     * The data needed to create a Budget.
     */
    data: XOR<BudgetCreateInput, BudgetUncheckedCreateInput>
  }

  /**
   * Budget createMany
   */
  export type BudgetCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Budgets.
     */
    data: BudgetCreateManyInput | BudgetCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Budget createManyAndReturn
   */
  export type BudgetCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * The data used to create many Budgets.
     */
    data: BudgetCreateManyInput | BudgetCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Budget update
   */
  export type BudgetUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetInclude<ExtArgs> | null
    /**
     * The data needed to update a Budget.
     */
    data: XOR<BudgetUpdateInput, BudgetUncheckedUpdateInput>
    /**
     * Choose, which Budget to update.
     */
    where: BudgetWhereUniqueInput
  }

  /**
   * Budget updateMany
   */
  export type BudgetUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Budgets.
     */
    data: XOR<BudgetUpdateManyMutationInput, BudgetUncheckedUpdateManyInput>
    /**
     * Filter which Budgets to update
     */
    where?: BudgetWhereInput
    /**
     * Limit how many Budgets to update.
     */
    limit?: number
  }

  /**
   * Budget updateManyAndReturn
   */
  export type BudgetUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * The data used to update Budgets.
     */
    data: XOR<BudgetUpdateManyMutationInput, BudgetUncheckedUpdateManyInput>
    /**
     * Filter which Budgets to update
     */
    where?: BudgetWhereInput
    /**
     * Limit how many Budgets to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Budget upsert
   */
  export type BudgetUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetInclude<ExtArgs> | null
    /**
     * The filter to search for the Budget to update in case it exists.
     */
    where: BudgetWhereUniqueInput
    /**
     * In case the Budget found by the `where` argument doesn't exist, create a new Budget with this data.
     */
    create: XOR<BudgetCreateInput, BudgetUncheckedCreateInput>
    /**
     * In case the Budget was found with the provided `where` argument, update it with this data.
     */
    update: XOR<BudgetUpdateInput, BudgetUncheckedUpdateInput>
  }

  /**
   * Budget delete
   */
  export type BudgetDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetInclude<ExtArgs> | null
    /**
     * Filter which Budget to delete.
     */
    where: BudgetWhereUniqueInput
  }

  /**
   * Budget deleteMany
   */
  export type BudgetDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Budgets to delete
     */
    where?: BudgetWhereInput
    /**
     * Limit how many Budgets to delete.
     */
    limit?: number
  }

  /**
   * Budget without action
   */
  export type BudgetDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Budget
     */
    select?: BudgetSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Budget
     */
    omit?: BudgetOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BudgetInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const TransactionScalarFieldEnum: {
    id: 'id',
    date: 'date',
    amount: 'amount',
    type: 'type',
    description: 'description',
    categoryId: 'categoryId',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type TransactionScalarFieldEnum = (typeof TransactionScalarFieldEnum)[keyof typeof TransactionScalarFieldEnum]


  export const CategoryScalarFieldEnum: {
    id: 'id',
    name: 'name',
    type: 'type',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type CategoryScalarFieldEnum = (typeof CategoryScalarFieldEnum)[keyof typeof CategoryScalarFieldEnum]


  export const BudgetScalarFieldEnum: {
    id: 'id',
    month: 'month',
    categoryId: 'categoryId',
    amount: 'amount',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type BudgetScalarFieldEnum = (typeof BudgetScalarFieldEnum)[keyof typeof BudgetScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    
  /**
   * Deep Input Types
   */


  export type TransactionWhereInput = {
    AND?: TransactionWhereInput | TransactionWhereInput[]
    OR?: TransactionWhereInput[]
    NOT?: TransactionWhereInput | TransactionWhereInput[]
    id?: IntFilter<"Transaction"> | number
    date?: DateTimeFilter<"Transaction"> | Date | string
    amount?: FloatFilter<"Transaction"> | number
    type?: StringFilter<"Transaction"> | string
    description?: StringNullableFilter<"Transaction"> | string | null
    categoryId?: IntFilter<"Transaction"> | number
    createdAt?: DateTimeFilter<"Transaction"> | Date | string
    updatedAt?: DateTimeFilter<"Transaction"> | Date | string
    category?: XOR<CategoryScalarRelationFilter, CategoryWhereInput>
  }

  export type TransactionOrderByWithRelationInput = {
    id?: SortOrder
    date?: SortOrder
    amount?: SortOrder
    type?: SortOrder
    description?: SortOrderInput | SortOrder
    categoryId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    category?: CategoryOrderByWithRelationInput
  }

  export type TransactionWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: TransactionWhereInput | TransactionWhereInput[]
    OR?: TransactionWhereInput[]
    NOT?: TransactionWhereInput | TransactionWhereInput[]
    date?: DateTimeFilter<"Transaction"> | Date | string
    amount?: FloatFilter<"Transaction"> | number
    type?: StringFilter<"Transaction"> | string
    description?: StringNullableFilter<"Transaction"> | string | null
    categoryId?: IntFilter<"Transaction"> | number
    createdAt?: DateTimeFilter<"Transaction"> | Date | string
    updatedAt?: DateTimeFilter<"Transaction"> | Date | string
    category?: XOR<CategoryScalarRelationFilter, CategoryWhereInput>
  }, "id">

  export type TransactionOrderByWithAggregationInput = {
    id?: SortOrder
    date?: SortOrder
    amount?: SortOrder
    type?: SortOrder
    description?: SortOrderInput | SortOrder
    categoryId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TransactionCountOrderByAggregateInput
    _avg?: TransactionAvgOrderByAggregateInput
    _max?: TransactionMaxOrderByAggregateInput
    _min?: TransactionMinOrderByAggregateInput
    _sum?: TransactionSumOrderByAggregateInput
  }

  export type TransactionScalarWhereWithAggregatesInput = {
    AND?: TransactionScalarWhereWithAggregatesInput | TransactionScalarWhereWithAggregatesInput[]
    OR?: TransactionScalarWhereWithAggregatesInput[]
    NOT?: TransactionScalarWhereWithAggregatesInput | TransactionScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Transaction"> | number
    date?: DateTimeWithAggregatesFilter<"Transaction"> | Date | string
    amount?: FloatWithAggregatesFilter<"Transaction"> | number
    type?: StringWithAggregatesFilter<"Transaction"> | string
    description?: StringNullableWithAggregatesFilter<"Transaction"> | string | null
    categoryId?: IntWithAggregatesFilter<"Transaction"> | number
    createdAt?: DateTimeWithAggregatesFilter<"Transaction"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Transaction"> | Date | string
  }

  export type CategoryWhereInput = {
    AND?: CategoryWhereInput | CategoryWhereInput[]
    OR?: CategoryWhereInput[]
    NOT?: CategoryWhereInput | CategoryWhereInput[]
    id?: IntFilter<"Category"> | number
    name?: StringFilter<"Category"> | string
    type?: StringFilter<"Category"> | string
    createdAt?: DateTimeFilter<"Category"> | Date | string
    updatedAt?: DateTimeFilter<"Category"> | Date | string
    budgets?: BudgetListRelationFilter
    transactions?: TransactionListRelationFilter
  }

  export type CategoryOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    budgets?: BudgetOrderByRelationAggregateInput
    transactions?: TransactionOrderByRelationAggregateInput
  }

  export type CategoryWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    AND?: CategoryWhereInput | CategoryWhereInput[]
    OR?: CategoryWhereInput[]
    NOT?: CategoryWhereInput | CategoryWhereInput[]
    name?: StringFilter<"Category"> | string
    type?: StringFilter<"Category"> | string
    createdAt?: DateTimeFilter<"Category"> | Date | string
    updatedAt?: DateTimeFilter<"Category"> | Date | string
    budgets?: BudgetListRelationFilter
    transactions?: TransactionListRelationFilter
  }, "id">

  export type CategoryOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: CategoryCountOrderByAggregateInput
    _avg?: CategoryAvgOrderByAggregateInput
    _max?: CategoryMaxOrderByAggregateInput
    _min?: CategoryMinOrderByAggregateInput
    _sum?: CategorySumOrderByAggregateInput
  }

  export type CategoryScalarWhereWithAggregatesInput = {
    AND?: CategoryScalarWhereWithAggregatesInput | CategoryScalarWhereWithAggregatesInput[]
    OR?: CategoryScalarWhereWithAggregatesInput[]
    NOT?: CategoryScalarWhereWithAggregatesInput | CategoryScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Category"> | number
    name?: StringWithAggregatesFilter<"Category"> | string
    type?: StringWithAggregatesFilter<"Category"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Category"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Category"> | Date | string
  }

  export type BudgetWhereInput = {
    AND?: BudgetWhereInput | BudgetWhereInput[]
    OR?: BudgetWhereInput[]
    NOT?: BudgetWhereInput | BudgetWhereInput[]
    id?: IntFilter<"Budget"> | number
    month?: StringFilter<"Budget"> | string
    categoryId?: IntFilter<"Budget"> | number
    amount?: FloatFilter<"Budget"> | number
    createdAt?: DateTimeFilter<"Budget"> | Date | string
    updatedAt?: DateTimeFilter<"Budget"> | Date | string
    category?: XOR<CategoryScalarRelationFilter, CategoryWhereInput>
  }

  export type BudgetOrderByWithRelationInput = {
    id?: SortOrder
    month?: SortOrder
    categoryId?: SortOrder
    amount?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    category?: CategoryOrderByWithRelationInput
  }

  export type BudgetWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    month_categoryId?: BudgetMonthCategoryIdCompoundUniqueInput
    AND?: BudgetWhereInput | BudgetWhereInput[]
    OR?: BudgetWhereInput[]
    NOT?: BudgetWhereInput | BudgetWhereInput[]
    month?: StringFilter<"Budget"> | string
    categoryId?: IntFilter<"Budget"> | number
    amount?: FloatFilter<"Budget"> | number
    createdAt?: DateTimeFilter<"Budget"> | Date | string
    updatedAt?: DateTimeFilter<"Budget"> | Date | string
    category?: XOR<CategoryScalarRelationFilter, CategoryWhereInput>
  }, "id" | "month_categoryId">

  export type BudgetOrderByWithAggregationInput = {
    id?: SortOrder
    month?: SortOrder
    categoryId?: SortOrder
    amount?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: BudgetCountOrderByAggregateInput
    _avg?: BudgetAvgOrderByAggregateInput
    _max?: BudgetMaxOrderByAggregateInput
    _min?: BudgetMinOrderByAggregateInput
    _sum?: BudgetSumOrderByAggregateInput
  }

  export type BudgetScalarWhereWithAggregatesInput = {
    AND?: BudgetScalarWhereWithAggregatesInput | BudgetScalarWhereWithAggregatesInput[]
    OR?: BudgetScalarWhereWithAggregatesInput[]
    NOT?: BudgetScalarWhereWithAggregatesInput | BudgetScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"Budget"> | number
    month?: StringWithAggregatesFilter<"Budget"> | string
    categoryId?: IntWithAggregatesFilter<"Budget"> | number
    amount?: FloatWithAggregatesFilter<"Budget"> | number
    createdAt?: DateTimeWithAggregatesFilter<"Budget"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Budget"> | Date | string
  }

  export type TransactionCreateInput = {
    date: Date | string
    amount: number
    type: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    category: CategoryCreateNestedOneWithoutTransactionsInput
  }

  export type TransactionUncheckedCreateInput = {
    id?: number
    date: Date | string
    amount: number
    type: string
    description?: string | null
    categoryId: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionUpdateInput = {
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: CategoryUpdateOneRequiredWithoutTransactionsNestedInput
  }

  export type TransactionUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    categoryId?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionCreateManyInput = {
    id?: number
    date: Date | string
    amount: number
    type: string
    description?: string | null
    categoryId: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionUpdateManyMutationInput = {
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    categoryId?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryCreateInput = {
    name: string
    type: string
    createdAt?: Date | string
    updatedAt?: Date | string
    budgets?: BudgetCreateNestedManyWithoutCategoryInput
    transactions?: TransactionCreateNestedManyWithoutCategoryInput
  }

  export type CategoryUncheckedCreateInput = {
    id?: number
    name: string
    type: string
    createdAt?: Date | string
    updatedAt?: Date | string
    budgets?: BudgetUncheckedCreateNestedManyWithoutCategoryInput
    transactions?: TransactionUncheckedCreateNestedManyWithoutCategoryInput
  }

  export type CategoryUpdateInput = {
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    budgets?: BudgetUpdateManyWithoutCategoryNestedInput
    transactions?: TransactionUpdateManyWithoutCategoryNestedInput
  }

  export type CategoryUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    budgets?: BudgetUncheckedUpdateManyWithoutCategoryNestedInput
    transactions?: TransactionUncheckedUpdateManyWithoutCategoryNestedInput
  }

  export type CategoryCreateManyInput = {
    id?: number
    name: string
    type: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type CategoryUpdateManyMutationInput = {
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type CategoryUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BudgetCreateInput = {
    month: string
    amount: number
    createdAt?: Date | string
    updatedAt?: Date | string
    category: CategoryCreateNestedOneWithoutBudgetsInput
  }

  export type BudgetUncheckedCreateInput = {
    id?: number
    month: string
    categoryId: number
    amount: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BudgetUpdateInput = {
    month?: StringFieldUpdateOperationsInput | string
    amount?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    category?: CategoryUpdateOneRequiredWithoutBudgetsNestedInput
  }

  export type BudgetUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    month?: StringFieldUpdateOperationsInput | string
    categoryId?: IntFieldUpdateOperationsInput | number
    amount?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BudgetCreateManyInput = {
    id?: number
    month: string
    categoryId: number
    amount: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BudgetUpdateManyMutationInput = {
    month?: StringFieldUpdateOperationsInput | string
    amount?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BudgetUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    month?: StringFieldUpdateOperationsInput | string
    categoryId?: IntFieldUpdateOperationsInput | number
    amount?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type CategoryScalarRelationFilter = {
    is?: CategoryWhereInput
    isNot?: CategoryWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type TransactionCountOrderByAggregateInput = {
    id?: SortOrder
    date?: SortOrder
    amount?: SortOrder
    type?: SortOrder
    description?: SortOrder
    categoryId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TransactionAvgOrderByAggregateInput = {
    id?: SortOrder
    amount?: SortOrder
    categoryId?: SortOrder
  }

  export type TransactionMaxOrderByAggregateInput = {
    id?: SortOrder
    date?: SortOrder
    amount?: SortOrder
    type?: SortOrder
    description?: SortOrder
    categoryId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TransactionMinOrderByAggregateInput = {
    id?: SortOrder
    date?: SortOrder
    amount?: SortOrder
    type?: SortOrder
    description?: SortOrder
    categoryId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TransactionSumOrderByAggregateInput = {
    id?: SortOrder
    amount?: SortOrder
    categoryId?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type BudgetListRelationFilter = {
    every?: BudgetWhereInput
    some?: BudgetWhereInput
    none?: BudgetWhereInput
  }

  export type TransactionListRelationFilter = {
    every?: TransactionWhereInput
    some?: TransactionWhereInput
    none?: TransactionWhereInput
  }

  export type BudgetOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type TransactionOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type CategoryCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CategoryAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type CategoryMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CategoryMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    type?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type CategorySumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type BudgetMonthCategoryIdCompoundUniqueInput = {
    month: string
    categoryId: number
  }

  export type BudgetCountOrderByAggregateInput = {
    id?: SortOrder
    month?: SortOrder
    categoryId?: SortOrder
    amount?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BudgetAvgOrderByAggregateInput = {
    id?: SortOrder
    categoryId?: SortOrder
    amount?: SortOrder
  }

  export type BudgetMaxOrderByAggregateInput = {
    id?: SortOrder
    month?: SortOrder
    categoryId?: SortOrder
    amount?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BudgetMinOrderByAggregateInput = {
    id?: SortOrder
    month?: SortOrder
    categoryId?: SortOrder
    amount?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type BudgetSumOrderByAggregateInput = {
    id?: SortOrder
    categoryId?: SortOrder
    amount?: SortOrder
  }

  export type CategoryCreateNestedOneWithoutTransactionsInput = {
    create?: XOR<CategoryCreateWithoutTransactionsInput, CategoryUncheckedCreateWithoutTransactionsInput>
    connectOrCreate?: CategoryCreateOrConnectWithoutTransactionsInput
    connect?: CategoryWhereUniqueInput
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type CategoryUpdateOneRequiredWithoutTransactionsNestedInput = {
    create?: XOR<CategoryCreateWithoutTransactionsInput, CategoryUncheckedCreateWithoutTransactionsInput>
    connectOrCreate?: CategoryCreateOrConnectWithoutTransactionsInput
    upsert?: CategoryUpsertWithoutTransactionsInput
    connect?: CategoryWhereUniqueInput
    update?: XOR<XOR<CategoryUpdateToOneWithWhereWithoutTransactionsInput, CategoryUpdateWithoutTransactionsInput>, CategoryUncheckedUpdateWithoutTransactionsInput>
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type BudgetCreateNestedManyWithoutCategoryInput = {
    create?: XOR<BudgetCreateWithoutCategoryInput, BudgetUncheckedCreateWithoutCategoryInput> | BudgetCreateWithoutCategoryInput[] | BudgetUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: BudgetCreateOrConnectWithoutCategoryInput | BudgetCreateOrConnectWithoutCategoryInput[]
    createMany?: BudgetCreateManyCategoryInputEnvelope
    connect?: BudgetWhereUniqueInput | BudgetWhereUniqueInput[]
  }

  export type TransactionCreateNestedManyWithoutCategoryInput = {
    create?: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput> | TransactionCreateWithoutCategoryInput[] | TransactionUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutCategoryInput | TransactionCreateOrConnectWithoutCategoryInput[]
    createMany?: TransactionCreateManyCategoryInputEnvelope
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
  }

  export type BudgetUncheckedCreateNestedManyWithoutCategoryInput = {
    create?: XOR<BudgetCreateWithoutCategoryInput, BudgetUncheckedCreateWithoutCategoryInput> | BudgetCreateWithoutCategoryInput[] | BudgetUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: BudgetCreateOrConnectWithoutCategoryInput | BudgetCreateOrConnectWithoutCategoryInput[]
    createMany?: BudgetCreateManyCategoryInputEnvelope
    connect?: BudgetWhereUniqueInput | BudgetWhereUniqueInput[]
  }

  export type TransactionUncheckedCreateNestedManyWithoutCategoryInput = {
    create?: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput> | TransactionCreateWithoutCategoryInput[] | TransactionUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutCategoryInput | TransactionCreateOrConnectWithoutCategoryInput[]
    createMany?: TransactionCreateManyCategoryInputEnvelope
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
  }

  export type BudgetUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<BudgetCreateWithoutCategoryInput, BudgetUncheckedCreateWithoutCategoryInput> | BudgetCreateWithoutCategoryInput[] | BudgetUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: BudgetCreateOrConnectWithoutCategoryInput | BudgetCreateOrConnectWithoutCategoryInput[]
    upsert?: BudgetUpsertWithWhereUniqueWithoutCategoryInput | BudgetUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: BudgetCreateManyCategoryInputEnvelope
    set?: BudgetWhereUniqueInput | BudgetWhereUniqueInput[]
    disconnect?: BudgetWhereUniqueInput | BudgetWhereUniqueInput[]
    delete?: BudgetWhereUniqueInput | BudgetWhereUniqueInput[]
    connect?: BudgetWhereUniqueInput | BudgetWhereUniqueInput[]
    update?: BudgetUpdateWithWhereUniqueWithoutCategoryInput | BudgetUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: BudgetUpdateManyWithWhereWithoutCategoryInput | BudgetUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: BudgetScalarWhereInput | BudgetScalarWhereInput[]
  }

  export type TransactionUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput> | TransactionCreateWithoutCategoryInput[] | TransactionUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutCategoryInput | TransactionCreateOrConnectWithoutCategoryInput[]
    upsert?: TransactionUpsertWithWhereUniqueWithoutCategoryInput | TransactionUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: TransactionCreateManyCategoryInputEnvelope
    set?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    disconnect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    delete?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    update?: TransactionUpdateWithWhereUniqueWithoutCategoryInput | TransactionUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: TransactionUpdateManyWithWhereWithoutCategoryInput | TransactionUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
  }

  export type BudgetUncheckedUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<BudgetCreateWithoutCategoryInput, BudgetUncheckedCreateWithoutCategoryInput> | BudgetCreateWithoutCategoryInput[] | BudgetUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: BudgetCreateOrConnectWithoutCategoryInput | BudgetCreateOrConnectWithoutCategoryInput[]
    upsert?: BudgetUpsertWithWhereUniqueWithoutCategoryInput | BudgetUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: BudgetCreateManyCategoryInputEnvelope
    set?: BudgetWhereUniqueInput | BudgetWhereUniqueInput[]
    disconnect?: BudgetWhereUniqueInput | BudgetWhereUniqueInput[]
    delete?: BudgetWhereUniqueInput | BudgetWhereUniqueInput[]
    connect?: BudgetWhereUniqueInput | BudgetWhereUniqueInput[]
    update?: BudgetUpdateWithWhereUniqueWithoutCategoryInput | BudgetUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: BudgetUpdateManyWithWhereWithoutCategoryInput | BudgetUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: BudgetScalarWhereInput | BudgetScalarWhereInput[]
  }

  export type TransactionUncheckedUpdateManyWithoutCategoryNestedInput = {
    create?: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput> | TransactionCreateWithoutCategoryInput[] | TransactionUncheckedCreateWithoutCategoryInput[]
    connectOrCreate?: TransactionCreateOrConnectWithoutCategoryInput | TransactionCreateOrConnectWithoutCategoryInput[]
    upsert?: TransactionUpsertWithWhereUniqueWithoutCategoryInput | TransactionUpsertWithWhereUniqueWithoutCategoryInput[]
    createMany?: TransactionCreateManyCategoryInputEnvelope
    set?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    disconnect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    delete?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    connect?: TransactionWhereUniqueInput | TransactionWhereUniqueInput[]
    update?: TransactionUpdateWithWhereUniqueWithoutCategoryInput | TransactionUpdateWithWhereUniqueWithoutCategoryInput[]
    updateMany?: TransactionUpdateManyWithWhereWithoutCategoryInput | TransactionUpdateManyWithWhereWithoutCategoryInput[]
    deleteMany?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
  }

  export type CategoryCreateNestedOneWithoutBudgetsInput = {
    create?: XOR<CategoryCreateWithoutBudgetsInput, CategoryUncheckedCreateWithoutBudgetsInput>
    connectOrCreate?: CategoryCreateOrConnectWithoutBudgetsInput
    connect?: CategoryWhereUniqueInput
  }

  export type CategoryUpdateOneRequiredWithoutBudgetsNestedInput = {
    create?: XOR<CategoryCreateWithoutBudgetsInput, CategoryUncheckedCreateWithoutBudgetsInput>
    connectOrCreate?: CategoryCreateOrConnectWithoutBudgetsInput
    upsert?: CategoryUpsertWithoutBudgetsInput
    connect?: CategoryWhereUniqueInput
    update?: XOR<XOR<CategoryUpdateToOneWithWhereWithoutBudgetsInput, CategoryUpdateWithoutBudgetsInput>, CategoryUncheckedUpdateWithoutBudgetsInput>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type CategoryCreateWithoutTransactionsInput = {
    name: string
    type: string
    createdAt?: Date | string
    updatedAt?: Date | string
    budgets?: BudgetCreateNestedManyWithoutCategoryInput
  }

  export type CategoryUncheckedCreateWithoutTransactionsInput = {
    id?: number
    name: string
    type: string
    createdAt?: Date | string
    updatedAt?: Date | string
    budgets?: BudgetUncheckedCreateNestedManyWithoutCategoryInput
  }

  export type CategoryCreateOrConnectWithoutTransactionsInput = {
    where: CategoryWhereUniqueInput
    create: XOR<CategoryCreateWithoutTransactionsInput, CategoryUncheckedCreateWithoutTransactionsInput>
  }

  export type CategoryUpsertWithoutTransactionsInput = {
    update: XOR<CategoryUpdateWithoutTransactionsInput, CategoryUncheckedUpdateWithoutTransactionsInput>
    create: XOR<CategoryCreateWithoutTransactionsInput, CategoryUncheckedCreateWithoutTransactionsInput>
    where?: CategoryWhereInput
  }

  export type CategoryUpdateToOneWithWhereWithoutTransactionsInput = {
    where?: CategoryWhereInput
    data: XOR<CategoryUpdateWithoutTransactionsInput, CategoryUncheckedUpdateWithoutTransactionsInput>
  }

  export type CategoryUpdateWithoutTransactionsInput = {
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    budgets?: BudgetUpdateManyWithoutCategoryNestedInput
  }

  export type CategoryUncheckedUpdateWithoutTransactionsInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    budgets?: BudgetUncheckedUpdateManyWithoutCategoryNestedInput
  }

  export type BudgetCreateWithoutCategoryInput = {
    month: string
    amount: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BudgetUncheckedCreateWithoutCategoryInput = {
    id?: number
    month: string
    amount: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BudgetCreateOrConnectWithoutCategoryInput = {
    where: BudgetWhereUniqueInput
    create: XOR<BudgetCreateWithoutCategoryInput, BudgetUncheckedCreateWithoutCategoryInput>
  }

  export type BudgetCreateManyCategoryInputEnvelope = {
    data: BudgetCreateManyCategoryInput | BudgetCreateManyCategoryInput[]
    skipDuplicates?: boolean
  }

  export type TransactionCreateWithoutCategoryInput = {
    date: Date | string
    amount: number
    type: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionUncheckedCreateWithoutCategoryInput = {
    id?: number
    date: Date | string
    amount: number
    type: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionCreateOrConnectWithoutCategoryInput = {
    where: TransactionWhereUniqueInput
    create: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput>
  }

  export type TransactionCreateManyCategoryInputEnvelope = {
    data: TransactionCreateManyCategoryInput | TransactionCreateManyCategoryInput[]
    skipDuplicates?: boolean
  }

  export type BudgetUpsertWithWhereUniqueWithoutCategoryInput = {
    where: BudgetWhereUniqueInput
    update: XOR<BudgetUpdateWithoutCategoryInput, BudgetUncheckedUpdateWithoutCategoryInput>
    create: XOR<BudgetCreateWithoutCategoryInput, BudgetUncheckedCreateWithoutCategoryInput>
  }

  export type BudgetUpdateWithWhereUniqueWithoutCategoryInput = {
    where: BudgetWhereUniqueInput
    data: XOR<BudgetUpdateWithoutCategoryInput, BudgetUncheckedUpdateWithoutCategoryInput>
  }

  export type BudgetUpdateManyWithWhereWithoutCategoryInput = {
    where: BudgetScalarWhereInput
    data: XOR<BudgetUpdateManyMutationInput, BudgetUncheckedUpdateManyWithoutCategoryInput>
  }

  export type BudgetScalarWhereInput = {
    AND?: BudgetScalarWhereInput | BudgetScalarWhereInput[]
    OR?: BudgetScalarWhereInput[]
    NOT?: BudgetScalarWhereInput | BudgetScalarWhereInput[]
    id?: IntFilter<"Budget"> | number
    month?: StringFilter<"Budget"> | string
    categoryId?: IntFilter<"Budget"> | number
    amount?: FloatFilter<"Budget"> | number
    createdAt?: DateTimeFilter<"Budget"> | Date | string
    updatedAt?: DateTimeFilter<"Budget"> | Date | string
  }

  export type TransactionUpsertWithWhereUniqueWithoutCategoryInput = {
    where: TransactionWhereUniqueInput
    update: XOR<TransactionUpdateWithoutCategoryInput, TransactionUncheckedUpdateWithoutCategoryInput>
    create: XOR<TransactionCreateWithoutCategoryInput, TransactionUncheckedCreateWithoutCategoryInput>
  }

  export type TransactionUpdateWithWhereUniqueWithoutCategoryInput = {
    where: TransactionWhereUniqueInput
    data: XOR<TransactionUpdateWithoutCategoryInput, TransactionUncheckedUpdateWithoutCategoryInput>
  }

  export type TransactionUpdateManyWithWhereWithoutCategoryInput = {
    where: TransactionScalarWhereInput
    data: XOR<TransactionUpdateManyMutationInput, TransactionUncheckedUpdateManyWithoutCategoryInput>
  }

  export type TransactionScalarWhereInput = {
    AND?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
    OR?: TransactionScalarWhereInput[]
    NOT?: TransactionScalarWhereInput | TransactionScalarWhereInput[]
    id?: IntFilter<"Transaction"> | number
    date?: DateTimeFilter<"Transaction"> | Date | string
    amount?: FloatFilter<"Transaction"> | number
    type?: StringFilter<"Transaction"> | string
    description?: StringNullableFilter<"Transaction"> | string | null
    categoryId?: IntFilter<"Transaction"> | number
    createdAt?: DateTimeFilter<"Transaction"> | Date | string
    updatedAt?: DateTimeFilter<"Transaction"> | Date | string
  }

  export type CategoryCreateWithoutBudgetsInput = {
    name: string
    type: string
    createdAt?: Date | string
    updatedAt?: Date | string
    transactions?: TransactionCreateNestedManyWithoutCategoryInput
  }

  export type CategoryUncheckedCreateWithoutBudgetsInput = {
    id?: number
    name: string
    type: string
    createdAt?: Date | string
    updatedAt?: Date | string
    transactions?: TransactionUncheckedCreateNestedManyWithoutCategoryInput
  }

  export type CategoryCreateOrConnectWithoutBudgetsInput = {
    where: CategoryWhereUniqueInput
    create: XOR<CategoryCreateWithoutBudgetsInput, CategoryUncheckedCreateWithoutBudgetsInput>
  }

  export type CategoryUpsertWithoutBudgetsInput = {
    update: XOR<CategoryUpdateWithoutBudgetsInput, CategoryUncheckedUpdateWithoutBudgetsInput>
    create: XOR<CategoryCreateWithoutBudgetsInput, CategoryUncheckedCreateWithoutBudgetsInput>
    where?: CategoryWhereInput
  }

  export type CategoryUpdateToOneWithWhereWithoutBudgetsInput = {
    where?: CategoryWhereInput
    data: XOR<CategoryUpdateWithoutBudgetsInput, CategoryUncheckedUpdateWithoutBudgetsInput>
  }

  export type CategoryUpdateWithoutBudgetsInput = {
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transactions?: TransactionUpdateManyWithoutCategoryNestedInput
  }

  export type CategoryUncheckedUpdateWithoutBudgetsInput = {
    id?: IntFieldUpdateOperationsInput | number
    name?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    transactions?: TransactionUncheckedUpdateManyWithoutCategoryNestedInput
  }

  export type BudgetCreateManyCategoryInput = {
    id?: number
    month: string
    amount: number
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TransactionCreateManyCategoryInput = {
    id?: number
    date: Date | string
    amount: number
    type: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type BudgetUpdateWithoutCategoryInput = {
    month?: StringFieldUpdateOperationsInput | string
    amount?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BudgetUncheckedUpdateWithoutCategoryInput = {
    id?: IntFieldUpdateOperationsInput | number
    month?: StringFieldUpdateOperationsInput | string
    amount?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BudgetUncheckedUpdateManyWithoutCategoryInput = {
    id?: IntFieldUpdateOperationsInput | number
    month?: StringFieldUpdateOperationsInput | string
    amount?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionUpdateWithoutCategoryInput = {
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionUncheckedUpdateWithoutCategoryInput = {
    id?: IntFieldUpdateOperationsInput | number
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TransactionUncheckedUpdateManyWithoutCategoryInput = {
    id?: IntFieldUpdateOperationsInput | number
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    amount?: FloatFieldUpdateOperationsInput | number
    type?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}```

```ts
/* ./prisma/node_modules/.prisma/client/runtime/index-browser.d.ts */
declare class AnyNull extends NullTypesEnumValue {
    #private;
}

declare type Args<T, F extends Operation> = T extends {
    [K: symbol]: {
        types: {
            operations: {
                [K in F]: {
                    args: any;
                };
            };
        };
    };
} ? T[symbol]['types']['operations'][F]['args'] : any;

declare class DbNull extends NullTypesEnumValue {
    #private;
}

export declare function Decimal(n: Decimal.Value): Decimal;

export declare namespace Decimal {
    export type Constructor = typeof Decimal;
    export type Instance = Decimal;
    export type Rounding = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    export type Modulo = Rounding | 9;
    export type Value = string | number | Decimal;

    // http://mikemcl.github.io/decimal.js/#constructor-properties
    export interface Config {
        precision?: number;
        rounding?: Rounding;
        toExpNeg?: number;
        toExpPos?: number;
        minE?: number;
        maxE?: number;
        crypto?: boolean;
        modulo?: Modulo;
        defaults?: boolean;
    }
}

export declare class Decimal {
    readonly d: number[];
    readonly e: number;
    readonly s: number;

    constructor(n: Decimal.Value);

    absoluteValue(): Decimal;
    abs(): Decimal;

    ceil(): Decimal;

    clampedTo(min: Decimal.Value, max: Decimal.Value): Decimal;
    clamp(min: Decimal.Value, max: Decimal.Value): Decimal;

    comparedTo(n: Decimal.Value): number;
    cmp(n: Decimal.Value): number;

    cosine(): Decimal;
    cos(): Decimal;

    cubeRoot(): Decimal;
    cbrt(): Decimal;

    decimalPlaces(): number;
    dp(): number;

    dividedBy(n: Decimal.Value): Decimal;
    div(n: Decimal.Value): Decimal;

    dividedToIntegerBy(n: Decimal.Value): Decimal;
    divToInt(n: Decimal.Value): Decimal;

    equals(n: Decimal.Value): boolean;
    eq(n: Decimal.Value): boolean;

    floor(): Decimal;

    greaterThan(n: Decimal.Value): boolean;
    gt(n: Decimal.Value): boolean;

    greaterThanOrEqualTo(n: Decimal.Value): boolean;
    gte(n: Decimal.Value): boolean;

    hyperbolicCosine(): Decimal;
    cosh(): Decimal;

    hyperbolicSine(): Decimal;
    sinh(): Decimal;

    hyperbolicTangent(): Decimal;
    tanh(): Decimal;

    inverseCosine(): Decimal;
    acos(): Decimal;

    inverseHyperbolicCosine(): Decimal;
    acosh(): Decimal;

    inverseHyperbolicSine(): Decimal;
    asinh(): Decimal;

    inverseHyperbolicTangent(): Decimal;
    atanh(): Decimal;

    inverseSine(): Decimal;
    asin(): Decimal;

    inverseTangent(): Decimal;
    atan(): Decimal;

    isFinite(): boolean;

    isInteger(): boolean;
    isInt(): boolean;

    isNaN(): boolean;

    isNegative(): boolean;
    isNeg(): boolean;

    isPositive(): boolean;
    isPos(): boolean;

    isZero(): boolean;

    lessThan(n: Decimal.Value): boolean;
    lt(n: Decimal.Value): boolean;

    lessThanOrEqualTo(n: Decimal.Value): boolean;
    lte(n: Decimal.Value): boolean;

    logarithm(n?: Decimal.Value): Decimal;
    log(n?: Decimal.Value): Decimal;

    minus(n: Decimal.Value): Decimal;
    sub(n: Decimal.Value): Decimal;

    modulo(n: Decimal.Value): Decimal;
    mod(n: Decimal.Value): Decimal;

    naturalExponential(): Decimal;
    exp(): Decimal;

    naturalLogarithm(): Decimal;
    ln(): Decimal;

    negated(): Decimal;
    neg(): Decimal;

    plus(n: Decimal.Value): Decimal;
    add(n: Decimal.Value): Decimal;

    precision(includeZeros?: boolean): number;
    sd(includeZeros?: boolean): number;

    round(): Decimal;

    sine() : Decimal;
    sin() : Decimal;

    squareRoot(): Decimal;
    sqrt(): Decimal;

    tangent() : Decimal;
    tan() : Decimal;

    times(n: Decimal.Value): Decimal;
    mul(n: Decimal.Value) : Decimal;

    toBinary(significantDigits?: number): string;
    toBinary(significantDigits: number, rounding: Decimal.Rounding): string;

    toDecimalPlaces(decimalPlaces?: number): Decimal;
    toDecimalPlaces(decimalPlaces: number, rounding: Decimal.Rounding): Decimal;
    toDP(decimalPlaces?: number): Decimal;
    toDP(decimalPlaces: number, rounding: Decimal.Rounding): Decimal;

    toExponential(decimalPlaces?: number): string;
    toExponential(decimalPlaces: number, rounding: Decimal.Rounding): string;

    toFixed(decimalPlaces?: number): string;
    toFixed(decimalPlaces: number, rounding: Decimal.Rounding): string;

    toFraction(max_denominator?: Decimal.Value): Decimal[];

    toHexadecimal(significantDigits?: number): string;
    toHexadecimal(significantDigits: number, rounding: Decimal.Rounding): string;
    toHex(significantDigits?: number): string;
    toHex(significantDigits: number, rounding?: Decimal.Rounding): string;

    toJSON(): string;

    toNearest(n: Decimal.Value, rounding?: Decimal.Rounding): Decimal;

    toNumber(): number;

    toOctal(significantDigits?: number): string;
    toOctal(significantDigits: number, rounding: Decimal.Rounding): string;

    toPower(n: Decimal.Value): Decimal;
    pow(n: Decimal.Value): Decimal;

    toPrecision(significantDigits?: number): string;
    toPrecision(significantDigits: number, rounding: Decimal.Rounding): string;

    toSignificantDigits(significantDigits?: number): Decimal;
    toSignificantDigits(significantDigits: number, rounding: Decimal.Rounding): Decimal;
    toSD(significantDigits?: number): Decimal;
    toSD(significantDigits: number, rounding: Decimal.Rounding): Decimal;

    toString(): string;

    truncated(): Decimal;
    trunc(): Decimal;

    valueOf(): string;

    static abs(n: Decimal.Value): Decimal;
    static acos(n: Decimal.Value): Decimal;
    static acosh(n: Decimal.Value): Decimal;
    static add(x: Decimal.Value, y: Decimal.Value): Decimal;
    static asin(n: Decimal.Value): Decimal;
    static asinh(n: Decimal.Value): Decimal;
    static atan(n: Decimal.Value): Decimal;
    static atanh(n: Decimal.Value): Decimal;
    static atan2(y: Decimal.Value, x: Decimal.Value): Decimal;
    static cbrt(n: Decimal.Value): Decimal;
    static ceil(n: Decimal.Value): Decimal;
    static clamp(n: Decimal.Value, min: Decimal.Value, max: Decimal.Value): Decimal;
    static clone(object?: Decimal.Config): Decimal.Constructor;
    static config(object: Decimal.Config): Decimal.Constructor;
    static cos(n: Decimal.Value): Decimal;
    static cosh(n: Decimal.Value): Decimal;
    static div(x: Decimal.Value, y: Decimal.Value): Decimal;
    static exp(n: Decimal.Value): Decimal;
    static floor(n: Decimal.Value): Decimal;
    static hypot(...n: Decimal.Value[]): Decimal;
    static isDecimal(object: any): object is Decimal;
    static ln(n: Decimal.Value): Decimal;
    static log(n: Decimal.Value, base?: Decimal.Value): Decimal;
    static log2(n: Decimal.Value): Decimal;
    static log10(n: Decimal.Value): Decimal;
    static max(...n: Decimal.Value[]): Decimal;
    static min(...n: Decimal.Value[]): Decimal;
    static mod(x: Decimal.Value, y: Decimal.Value): Decimal;
    static mul(x: Decimal.Value, y: Decimal.Value): Decimal;
    static noConflict(): Decimal.Constructor;   // Browser only
    static pow(base: Decimal.Value, exponent: Decimal.Value): Decimal;
    static random(significantDigits?: number): Decimal;
    static round(n: Decimal.Value): Decimal;
    static set(object: Decimal.Config): Decimal.Constructor;
    static sign(n: Decimal.Value): number;
    static sin(n: Decimal.Value): Decimal;
    static sinh(n: Decimal.Value): Decimal;
    static sqrt(n: Decimal.Value): Decimal;
    static sub(x: Decimal.Value, y: Decimal.Value): Decimal;
    static sum(...n: Decimal.Value[]): Decimal;
    static tan(n: Decimal.Value): Decimal;
    static tanh(n: Decimal.Value): Decimal;
    static trunc(n: Decimal.Value): Decimal;

    static readonly default?: Decimal.Constructor;
    static readonly Decimal?: Decimal.Constructor;

    static readonly precision: number;
    static readonly rounding: Decimal.Rounding;
    static readonly toExpNeg: number;
    static readonly toExpPos: number;
    static readonly minE: number;
    static readonly maxE: number;
    static readonly crypto: boolean;
    static readonly modulo: Decimal.Modulo;

    static readonly ROUND_UP: 0;
    static readonly ROUND_DOWN: 1;
    static readonly ROUND_CEIL: 2;
    static readonly ROUND_FLOOR: 3;
    static readonly ROUND_HALF_UP: 4;
    static readonly ROUND_HALF_DOWN: 5;
    static readonly ROUND_HALF_EVEN: 6;
    static readonly ROUND_HALF_CEIL: 7;
    static readonly ROUND_HALF_FLOOR: 8;
    static readonly EUCLID: 9;
}

declare type Exact<A, W> = (A extends unknown ? (W extends A ? {
    [K in keyof A]: Exact<A[K], W[K]>;
} : W) : never) | (A extends Narrowable ? A : never);

export declare function getRuntime(): GetRuntimeOutput;

declare type GetRuntimeOutput = {
    id: RuntimeName;
    prettyName: string;
    isEdge: boolean;
};

declare class JsonNull extends NullTypesEnumValue {
    #private;
}

/**
 * Generates more strict variant of an enum which, unlike regular enum,
 * throws on non-existing property access. This can be useful in following situations:
 * - we have an API, that accepts both `undefined` and `SomeEnumType` as an input
 * - enum values are generated dynamically from DMMF.
 *
 * In that case, if using normal enums and no compile-time typechecking, using non-existing property
 * will result in `undefined` value being used, which will be accepted. Using strict enum
 * in this case will help to have a runtime exception, telling you that you are probably doing something wrong.
 *
 * Note: if you need to check for existence of a value in the enum you can still use either
 * `in` operator or `hasOwnProperty` function.
 *
 * @param definition
 * @returns
 */
export declare function makeStrictEnum<T extends Record<PropertyKey, string | number>>(definition: T): T;

declare type Narrowable = string | number | bigint | boolean | [];

declare class NullTypesEnumValue extends ObjectEnumValue {
    _getNamespace(): string;
}

/**
 * Base class for unique values of object-valued enums.
 */
declare abstract class ObjectEnumValue {
    constructor(arg?: symbol);
    abstract _getNamespace(): string;
    _getName(): string;
    toString(): string;
}

export declare const objectEnumValues: {
    classes: {
        DbNull: typeof DbNull;
        JsonNull: typeof JsonNull;
        AnyNull: typeof AnyNull;
    };
    instances: {
        DbNull: DbNull;
        JsonNull: JsonNull;
        AnyNull: AnyNull;
    };
};

declare type Operation = 'findFirst' | 'findFirstOrThrow' | 'findUnique' | 'findUniqueOrThrow' | 'findMany' | 'create' | 'createMany' | 'createManyAndReturn' | 'update' | 'updateMany' | 'updateManyAndReturn' | 'upsert' | 'delete' | 'deleteMany' | 'aggregate' | 'count' | 'groupBy' | '$queryRaw' | '$executeRaw' | '$queryRawUnsafe' | '$executeRawUnsafe' | 'findRaw' | 'aggregateRaw' | '$runCommandRaw';

declare namespace Public {
    export {
        validator
    }
}
export { Public }

declare type RuntimeName = 'workerd' | 'deno' | 'netlify' | 'node' | 'bun' | 'edge-light' | '';

declare function validator<V>(): <S>(select: Exact<S, V>) => S;

declare function validator<C, M extends Exclude<keyof C, `$${string}`>, O extends keyof C[M] & Operation>(client: C, model: M, operation: O): <S>(select: Exact<S, Args<C[M], O>>) => S;

declare function validator<C, M extends Exclude<keyof C, `$${string}`>, O extends keyof C[M] & Operation, P extends keyof Args<C[M], O>>(client: C, model: M, operation: O, prop: P): <S>(select: Exact<S, Args<C[M], O>[P]>) => S;

export { }
```

```ts
/* ./prisma/node_modules/.prisma/client/runtime/library.d.ts */
/**
 * @param this
 */
declare function $extends(this: Client, extension: ExtensionArgs | ((client: Client) => Client)): Client;

declare type AccelerateEngineConfig = {
    inlineSchema: EngineConfig['inlineSchema'];
    inlineSchemaHash: EngineConfig['inlineSchemaHash'];
    env: EngineConfig['env'];
    generator?: {
        previewFeatures: string[];
    };
    inlineDatasources: EngineConfig['inlineDatasources'];
    overrideDatasources: EngineConfig['overrideDatasources'];
    clientVersion: EngineConfig['clientVersion'];
    engineVersion: EngineConfig['engineVersion'];
    logEmitter: EngineConfig['logEmitter'];
    logQueries?: EngineConfig['logQueries'];
    logLevel?: EngineConfig['logLevel'];
    tracingHelper: EngineConfig['tracingHelper'];
    accelerateUtils?: AccelerateUtils;
};

declare type AccelerateUtils = EngineConfig['accelerateUtils'];

export declare type Action = keyof typeof DMMF_2.ModelAction | 'executeRaw' | 'queryRaw' | 'runCommandRaw';

declare type ActiveConnectorType = Exclude<ConnectorType, 'postgres' | 'prisma+postgres'>;

/**
 * An interface that exposes some basic information about the
 * adapter like its name and provider type.
 */
declare interface AdapterInfo {
    readonly provider: Provider;
    readonly adapterName: (typeof officialPrismaAdapters)[number] | (string & {});
}

export declare type Aggregate = '_count' | '_max' | '_min' | '_avg' | '_sum';

export declare type AllModelsToStringIndex<TypeMap extends TypeMapDef, Args extends Record<string, any>, K extends PropertyKey> = Args extends {
    [P in K]: {
        $allModels: infer AllModels;
    };
} ? {
    [P in K]: Record<TypeMap['meta']['modelProps'], AllModels>;
} : {};

declare class AnyNull extends NullTypesEnumValue {
    #private;
}

export declare type ApplyOmit<T, OmitConfig> = Compute<{
    [K in keyof T as OmitValue<OmitConfig, K> extends true ? never : K]: T[K];
}>;

export declare type Args<T, F extends Operation> = T extends {
    [K: symbol]: {
        types: {
            operations: {
                [K in F]: {
                    args: any;
                };
            };
        };
    };
} ? T[symbol]['types']['operations'][F]['args'] : any;

export declare type Args_3<T, F extends Operation> = Args<T, F>;

/**
 * Original `quaint::ValueType` enum tag from Prisma's `quaint`.
 * Query arguments marked with this type are sanitized before being sent to the database.
 * Notice while a query argument may be `null`, `ArgType` is guaranteed to be defined.
 */
declare type ArgType = 'Int32' | 'Int64' | 'Float' | 'Double' | 'Text' | 'Enum' | 'EnumArray' | 'Bytes' | 'Boolean' | 'Char' | 'Array' | 'Numeric' | 'Json' | 'Xml' | 'Uuid' | 'DateTime' | 'Date' | 'Time';

/**
 * Attributes is a map from string to attribute values.
 *
 * Note: only the own enumerable keys are counted as valid attribute keys.
 */
declare interface Attributes {
    [attributeKey: string]: AttributeValue | undefined;
}

/**
 * Attribute values may be any non-nullish primitive value except an object.
 *
 * null or undefined attribute values are invalid and will result in undefined behavior.
 */
declare type AttributeValue = string | number | boolean | Array<null | undefined | string> | Array<null | undefined | number> | Array<null | undefined | boolean>;

export declare type BaseDMMF = {
    readonly datamodel: Omit<DMMF_2.Datamodel, 'indexes'>;
};

declare type BatchArgs = {
    queries: BatchQuery[];
    transaction?: {
        isolationLevel?: IsolationLevel;
    };
};

declare type BatchInternalParams = {
    requests: RequestParams[];
    customDataProxyFetch?: CustomDataProxyFetch;
};

declare type BatchQuery = {
    model: string | undefined;
    operation: string;
    args: JsArgs | RawQueryArgs;
};

declare type BatchQueryEngineResult<T> = QueryEngineResultData<T> | Error;

declare type BatchQueryOptionsCb = (args: BatchQueryOptionsCbArgs) => Promise<any>;

declare type BatchQueryOptionsCbArgs = {
    args: BatchArgs;
    query: (args: BatchArgs, __internalParams?: BatchInternalParams) => Promise<unknown[]>;
    __internalParams: BatchInternalParams;
};

declare type BatchResponse = MultiBatchResponse | CompactedBatchResponse;

declare type BatchTransactionOptions = {
    isolationLevel?: IsolationLevel;
};

declare interface BinaryTargetsEnvValue {
    fromEnvVar: string | null;
    value: string;
    native?: boolean;
}

export declare type Call<F extends Fn, P> = (F & {
    params: P;
})['returns'];

declare interface CallSite {
    getLocation(): LocationInFile | null;
}

export declare type Cast<A, W> = A extends W ? A : W;

declare type Client = ReturnType<typeof getPrismaClient> extends new () => infer T ? T : never;

export declare type ClientArg = {
    [MethodName in string]: unknown;
};

export declare type ClientArgs = {
    client: ClientArg;
};

export declare type ClientBuiltInProp = keyof DynamicClientExtensionThisBuiltin<never, never, never>;

export declare type ClientOptionDef = undefined | {
    [K in string]: any;
};

export declare type ClientOtherOps = {
    $queryRaw<T = unknown>(query: TemplateStringsArray | Sql, ...values: any[]): PrismaPromise<T>;
    $queryRawTyped<T>(query: TypedSql<unknown[], T>): PrismaPromise<T[]>;
    $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): PrismaPromise<T>;
    $executeRaw(query: TemplateStringsArray | Sql, ...values: any[]): PrismaPromise<number>;
    $executeRawUnsafe(query: string, ...values: any[]): PrismaPromise<number>;
    $runCommandRaw(command: InputJsonObject): PrismaPromise<JsonObject>;
};

declare type ColumnType = (typeof ColumnTypeEnum)[keyof typeof ColumnTypeEnum];

declare const ColumnTypeEnum: {
    readonly Int32: 0;
    readonly Int64: 1;
    readonly Float: 2;
    readonly Double: 3;
    readonly Numeric: 4;
    readonly Boolean: 5;
    readonly Character: 6;
    readonly Text: 7;
    readonly Date: 8;
    readonly Time: 9;
    readonly DateTime: 10;
    readonly Json: 11;
    readonly Enum: 12;
    readonly Bytes: 13;
    readonly Set: 14;
    readonly Uuid: 15;
    readonly Int32Array: 64;
    readonly Int64Array: 65;
    readonly FloatArray: 66;
    readonly DoubleArray: 67;
    readonly NumericArray: 68;
    readonly BooleanArray: 69;
    readonly CharacterArray: 70;
    readonly TextArray: 71;
    readonly DateArray: 72;
    readonly TimeArray: 73;
    readonly DateTimeArray: 74;
    readonly JsonArray: 75;
    readonly EnumArray: 76;
    readonly BytesArray: 77;
    readonly UuidArray: 78;
    readonly UnknownNumber: 128;
};

declare type CompactedBatchResponse = {
    type: 'compacted';
    plan: object;
    arguments: Record<string, {}>[];
    nestedSelection: string[];
    keys: string[];
    expectNonEmpty: boolean;
};

declare type CompilerWasmLoadingConfig = {
    /**
     * WASM-bindgen runtime for corresponding module
     */
    getRuntime: () => Promise<{
        __wbg_set_wasm(exports: unknown): void;
        QueryCompiler: QueryCompilerConstructor;
    }>;
    /**
     * Loads the raw wasm module for the wasm compiler engine. This configuration is
     * generated specifically for each type of client, eg. Node.js client and Edge
     * clients will have different implementations.
     * @remarks this is a callback on purpose, we only load the wasm if needed.
     * @remarks only used by ClientEngine
     */
    getQueryCompilerWasmModule: () => Promise<unknown>;
};

export declare type Compute<T> = T extends Function ? T : {
    [K in keyof T]: T[K];
} & unknown;

export declare type ComputeDeep<T> = T extends Function ? T : {
    [K in keyof T]: ComputeDeep<T[K]>;
} & unknown;

declare type ComputedField = {
    name: string;
    needs: string[];
    compute: ResultArgsFieldCompute;
};

declare type ComputedFieldsMap = {
    [fieldName: string]: ComputedField;
};

declare type ConnectionInfo = {
    schemaName?: string;
    maxBindValues?: number;
};

declare type ConnectorType = 'mysql' | 'mongodb' | 'sqlite' | 'postgresql' | 'postgres' | 'prisma+postgres' | 'sqlserver' | 'cockroachdb';

declare interface Context {
    /**
     * Get a value from the context.
     *
     * @param key key which identifies a context value
     */
    getValue(key: symbol): unknown;
    /**
     * Create a new context which inherits from this context and has
     * the given key set to the given value.
     *
     * @param key context key for which to set the value
     * @param value value to set for the given key
     */
    setValue(key: symbol, value: unknown): Context;
    /**
     * Return a new context which inherits from this context but does
     * not contain a value for the given key.
     *
     * @param key context key for which to clear a value
     */
    deleteValue(key: symbol): Context;
}

declare type Context_2<T> = T extends {
    [K: symbol]: {
        ctx: infer C;
    };
} ? C & T & {
    /**
     * @deprecated Use `$name` instead.
     */
    name?: string;
    $name?: string;
    $parent?: unknown;
} : T & {
    /**
     * @deprecated Use `$name` instead.
     */
    name?: string;
    $name?: string;
    $parent?: unknown;
};

export declare type Count<O> = {
    [K in keyof O]: Count<number>;
} & {};

export declare function createParam(name: string): Param<unknown, string>;

/**
 * Custom fetch function for `DataProxyEngine`.
 *
 * We can't use the actual type of `globalThis.fetch` because this will result
 * in API Extractor referencing Node.js type definitions in the `.d.ts` bundle
 * for the client runtime. We can only use such types in internal types that
 * don't end up exported anywhere.

 * It's also not possible to write a definition of `fetch` that would accept the
 * actual `fetch` function from different environments such as Node.js and
 * Cloudflare Workers (with their extensions to `RequestInit` and `Response`).
 * `fetch` is used in both covariant and contravariant positions in
 * `CustomDataProxyFetch`, making it invariant, so we need the exact same type.
 * Even if we removed the argument and left `fetch` in covariant position only,
 * then for an extension-supplied function to be assignable to `customDataProxyFetch`,
 * the platform-specific (or custom) `fetch` function needs to be assignable
 * to our `fetch` definition. This, in turn, requires the third-party `Response`
 * to be a subtype of our `Response` (which is not a problem, we could declare
 * a minimal `Response` type that only includes what we use) *and* requires the
 * third-party `RequestInit` to be a supertype of our `RequestInit` (i.e. we
 * have to declare all properties any `RequestInit` implementation in existence
 * could possibly have), which is not possible.
 *
 * Since `@prisma/extension-accelerate` redefines the type of
 * `__internalParams.customDataProxyFetch` to its own type anyway (probably for
 * exactly this reason), our definition is never actually used and is completely
 * ignored, so it doesn't matter, and we can just use `unknown` as the type of
 * `fetch` here.
 */
declare type CustomDataProxyFetch = (fetch: unknown) => unknown;

declare class DataLoader<T = unknown> {
    private options;
    batches: {
        [key: string]: Job[];
    };
    private tickActive;
    constructor(options: DataLoaderOptions<T>);
    request(request: T): Promise<any>;
    private dispatchBatches;
    get [Symbol.toStringTag](): string;
}

declare type DataLoaderOptions<T> = {
    singleLoader: (request: T) => Promise<any>;
    batchLoader: (request: T[]) => Promise<any[]>;
    batchBy: (request: T) => string | undefined;
    batchOrder: (requestA: T, requestB: T) => number;
};

declare type Datamodel = ReadonlyDeep_2<{
    models: Model[];
    enums: DatamodelEnum[];
    types: Model[];
    indexes: Index[];
}>;

declare type DatamodelEnum = ReadonlyDeep_2<{
    name: string;
    values: EnumValue[];
    dbName?: string | null;
    documentation?: string;
}>;

declare function datamodelEnumToSchemaEnum(datamodelEnum: DatamodelEnum): SchemaEnum;

declare type Datasource = {
    url?: string;
};

declare type Datasources = {
    [name in string]: Datasource;
};

declare class DbNull extends NullTypesEnumValue {
    #private;
}

export declare const Debug: typeof debugCreate & {
    enable(namespace: any): void;
    disable(): any;
    enabled(namespace: string): boolean;
    log: (...args: string[]) => void;
    formatters: {};
};

/**
 * Create a new debug instance with the given namespace.
 *
 * @example
 * ```ts
 * import Debug from '@prisma/debug'
 * const debug = Debug('prisma:client')
 * debug('Hello World')
 * ```
 */
declare function debugCreate(namespace: string): ((...args: any[]) => void) & {
    color: string;
    enabled: boolean;
    namespace: string;
    log: (...args: string[]) => void;
    extend: () => void;
};

export declare function Decimal(n: Decimal.Value): Decimal;

export declare namespace Decimal {
    export type Constructor = typeof Decimal;
    export type Instance = Decimal;
    export type Rounding = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    export type Modulo = Rounding | 9;
    export type Value = string | number | Decimal;

    // http://mikemcl.github.io/decimal.js/#constructor-properties
    export interface Config {
        precision?: number;
        rounding?: Rounding;
        toExpNeg?: number;
        toExpPos?: number;
        minE?: number;
        maxE?: number;
        crypto?: boolean;
        modulo?: Modulo;
        defaults?: boolean;
    }
}

export declare class Decimal {
    readonly d: number[];
    readonly e: number;
    readonly s: number;

    constructor(n: Decimal.Value);

    absoluteValue(): Decimal;
    abs(): Decimal;

    ceil(): Decimal;

    clampedTo(min: Decimal.Value, max: Decimal.Value): Decimal;
    clamp(min: Decimal.Value, max: Decimal.Value): Decimal;

    comparedTo(n: Decimal.Value): number;
    cmp(n: Decimal.Value): number;

    cosine(): Decimal;
    cos(): Decimal;

    cubeRoot(): Decimal;
    cbrt(): Decimal;

    decimalPlaces(): number;
    dp(): number;

    dividedBy(n: Decimal.Value): Decimal;
    div(n: Decimal.Value): Decimal;

    dividedToIntegerBy(n: Decimal.Value): Decimal;
    divToInt(n: Decimal.Value): Decimal;

    equals(n: Decimal.Value): boolean;
    eq(n: Decimal.Value): boolean;

    floor(): Decimal;

    greaterThan(n: Decimal.Value): boolean;
    gt(n: Decimal.Value): boolean;

    greaterThanOrEqualTo(n: Decimal.Value): boolean;
    gte(n: Decimal.Value): boolean;

    hyperbolicCosine(): Decimal;
    cosh(): Decimal;

    hyperbolicSine(): Decimal;
    sinh(): Decimal;

    hyperbolicTangent(): Decimal;
    tanh(): Decimal;

    inverseCosine(): Decimal;
    acos(): Decimal;

    inverseHyperbolicCosine(): Decimal;
    acosh(): Decimal;

    inverseHyperbolicSine(): Decimal;
    asinh(): Decimal;

    inverseHyperbolicTangent(): Decimal;
    atanh(): Decimal;

    inverseSine(): Decimal;
    asin(): Decimal;

    inverseTangent(): Decimal;
    atan(): Decimal;

    isFinite(): boolean;

    isInteger(): boolean;
    isInt(): boolean;

    isNaN(): boolean;

    isNegative(): boolean;
    isNeg(): boolean;

    isPositive(): boolean;
    isPos(): boolean;

    isZero(): boolean;

    lessThan(n: Decimal.Value): boolean;
    lt(n: Decimal.Value): boolean;

    lessThanOrEqualTo(n: Decimal.Value): boolean;
    lte(n: Decimal.Value): boolean;

    logarithm(n?: Decimal.Value): Decimal;
    log(n?: Decimal.Value): Decimal;

    minus(n: Decimal.Value): Decimal;
    sub(n: Decimal.Value): Decimal;

    modulo(n: Decimal.Value): Decimal;
    mod(n: Decimal.Value): Decimal;

    naturalExponential(): Decimal;
    exp(): Decimal;

    naturalLogarithm(): Decimal;
    ln(): Decimal;

    negated(): Decimal;
    neg(): Decimal;

    plus(n: Decimal.Value): Decimal;
    add(n: Decimal.Value): Decimal;

    precision(includeZeros?: boolean): number;
    sd(includeZeros?: boolean): number;

    round(): Decimal;

    sine() : Decimal;
    sin() : Decimal;

    squareRoot(): Decimal;
    sqrt(): Decimal;

    tangent() : Decimal;
    tan() : Decimal;

    times(n: Decimal.Value): Decimal;
    mul(n: Decimal.Value) : Decimal;

    toBinary(significantDigits?: number): string;
    toBinary(significantDigits: number, rounding: Decimal.Rounding): string;

    toDecimalPlaces(decimalPlaces?: number): Decimal;
    toDecimalPlaces(decimalPlaces: number, rounding: Decimal.Rounding): Decimal;
    toDP(decimalPlaces?: number): Decimal;
    toDP(decimalPlaces: number, rounding: Decimal.Rounding): Decimal;

    toExponential(decimalPlaces?: number): string;
    toExponential(decimalPlaces: number, rounding: Decimal.Rounding): string;

    toFixed(decimalPlaces?: number): string;
    toFixed(decimalPlaces: number, rounding: Decimal.Rounding): string;

    toFraction(max_denominator?: Decimal.Value): Decimal[];

    toHexadecimal(significantDigits?: number): string;
    toHexadecimal(significantDigits: number, rounding: Decimal.Rounding): string;
    toHex(significantDigits?: number): string;
    toHex(significantDigits: number, rounding?: Decimal.Rounding): string;

    toJSON(): string;

    toNearest(n: Decimal.Value, rounding?: Decimal.Rounding): Decimal;

    toNumber(): number;

    toOctal(significantDigits?: number): string;
    toOctal(significantDigits: number, rounding: Decimal.Rounding): string;

    toPower(n: Decimal.Value): Decimal;
    pow(n: Decimal.Value): Decimal;

    toPrecision(significantDigits?: number): string;
    toPrecision(significantDigits: number, rounding: Decimal.Rounding): string;

    toSignificantDigits(significantDigits?: number): Decimal;
    toSignificantDigits(significantDigits: number, rounding: Decimal.Rounding): Decimal;
    toSD(significantDigits?: number): Decimal;
    toSD(significantDigits: number, rounding: Decimal.Rounding): Decimal;

    toString(): string;

    truncated(): Decimal;
    trunc(): Decimal;

    valueOf(): string;

    static abs(n: Decimal.Value): Decimal;
    static acos(n: Decimal.Value): Decimal;
    static acosh(n: Decimal.Value): Decimal;
    static add(x: Decimal.Value, y: Decimal.Value): Decimal;
    static asin(n: Decimal.Value): Decimal;
    static asinh(n: Decimal.Value): Decimal;
    static atan(n: Decimal.Value): Decimal;
    static atanh(n: Decimal.Value): Decimal;
    static atan2(y: Decimal.Value, x: Decimal.Value): Decimal;
    static cbrt(n: Decimal.Value): Decimal;
    static ceil(n: Decimal.Value): Decimal;
    static clamp(n: Decimal.Value, min: Decimal.Value, max: Decimal.Value): Decimal;
    static clone(object?: Decimal.Config): Decimal.Constructor;
    static config(object: Decimal.Config): Decimal.Constructor;
    static cos(n: Decimal.Value): Decimal;
    static cosh(n: Decimal.Value): Decimal;
    static div(x: Decimal.Value, y: Decimal.Value): Decimal;
    static exp(n: Decimal.Value): Decimal;
    static floor(n: Decimal.Value): Decimal;
    static hypot(...n: Decimal.Value[]): Decimal;
    static isDecimal(object: any): object is Decimal;
    static ln(n: Decimal.Value): Decimal;
    static log(n: Decimal.Value, base?: Decimal.Value): Decimal;
    static log2(n: Decimal.Value): Decimal;
    static log10(n: Decimal.Value): Decimal;
    static max(...n: Decimal.Value[]): Decimal;
    static min(...n: Decimal.Value[]): Decimal;
    static mod(x: Decimal.Value, y: Decimal.Value): Decimal;
    static mul(x: Decimal.Value, y: Decimal.Value): Decimal;
    static noConflict(): Decimal.Constructor;   // Browser only
    static pow(base: Decimal.Value, exponent: Decimal.Value): Decimal;
    static random(significantDigits?: number): Decimal;
    static round(n: Decimal.Value): Decimal;
    static set(object: Decimal.Config): Decimal.Constructor;
    static sign(n: Decimal.Value): number;
    static sin(n: Decimal.Value): Decimal;
    static sinh(n: Decimal.Value): Decimal;
    static sqrt(n: Decimal.Value): Decimal;
    static sub(x: Decimal.Value, y: Decimal.Value): Decimal;
    static sum(...n: Decimal.Value[]): Decimal;
    static tan(n: Decimal.Value): Decimal;
    static tanh(n: Decimal.Value): Decimal;
    static trunc(n: Decimal.Value): Decimal;

    static readonly default?: Decimal.Constructor;
    static readonly Decimal?: Decimal.Constructor;

    static readonly precision: number;
    static readonly rounding: Decimal.Rounding;
    static readonly toExpNeg: number;
    static readonly toExpPos: number;
    static readonly minE: number;
    static readonly maxE: number;
    static readonly crypto: boolean;
    static readonly modulo: Decimal.Modulo;

    static readonly ROUND_UP: 0;
    static readonly ROUND_DOWN: 1;
    static readonly ROUND_CEIL: 2;
    static readonly ROUND_FLOOR: 3;
    static readonly ROUND_HALF_UP: 4;
    static readonly ROUND_HALF_DOWN: 5;
    static readonly ROUND_HALF_EVEN: 6;
    static readonly ROUND_HALF_CEIL: 7;
    static readonly ROUND_HALF_FLOOR: 8;
    static readonly EUCLID: 9;
}

/**
 * Interface for any Decimal.js-like library
 * Allows us to accept Decimal.js from different
 * versions and some compatible alternatives
 */
export declare interface DecimalJsLike {
    d: number[];
    e: number;
    s: number;
    toFixed(): string;
}

export declare type DefaultArgs = InternalArgs<{}, {}, {}, {}>;

export declare type DefaultSelection<Payload extends OperationPayload, Args = {}, GlobalOmitOptions = {}> = Args extends {
    omit: infer LocalOmit;
} ? ApplyOmit<UnwrapPayload<{
    default: Payload;
}>['default'], PatchFlat<LocalOmit, ExtractGlobalOmit<GlobalOmitOptions, Uncapitalize<Payload['name']>>>> : ApplyOmit<UnwrapPayload<{
    default: Payload;
}>['default'], ExtractGlobalOmit<GlobalOmitOptions, Uncapitalize<Payload['name']>>>;

export declare function defineDmmfProperty(target: object, runtimeDataModel: RuntimeDataModel): void;

declare function defineExtension(ext: ExtensionArgs | ((client: Client) => Client)): (client: Client) => Client;

declare const denylist: readonly ["$connect", "$disconnect", "$on", "$transaction", "$use", "$extends"];

declare type Deprecation = ReadonlyDeep_2<{
    sinceVersion: string;
    reason: string;
    plannedRemovalVersion?: string;
}>;

declare type DeserializedResponse = Array<Record<string, unknown>>;

export declare function deserializeJsonResponse(result: unknown): unknown;

export declare function deserializeRawResult(response: RawResponse): DeserializedResponse;

export declare type DevTypeMapDef = {
    meta: {
        modelProps: string;
    };
    model: {
        [Model in PropertyKey]: {
            [Operation in PropertyKey]: DevTypeMapFnDef;
        };
    };
    other: {
        [Operation in PropertyKey]: DevTypeMapFnDef;
    };
};

export declare type DevTypeMapFnDef = {
    args: any;
    result: any;
    payload: OperationPayload;
};

export declare namespace DMMF {
    export {
        datamodelEnumToSchemaEnum,
        Document_2 as Document,
        Mappings,
        OtherOperationMappings,
        DatamodelEnum,
        SchemaEnum,
        EnumValue,
        Datamodel,
        uniqueIndex,
        PrimaryKey,
        Model,
        FieldKind,
        FieldNamespace,
        FieldLocation,
        Field,
        FieldDefault,
        FieldDefaultScalar,
        Index,
        IndexType,
        IndexField,
        SortOrder,
        Schema,
        Query,
        QueryOutput,
        TypeRef,
        InputTypeRef,
        SchemaArg,
        OutputType,
        SchemaField,
        OutputTypeRef,
        Deprecation,
        InputType,
        FieldRefType,
        FieldRefAllowType,
        ModelMapping,
        ModelAction
    }
}

declare namespace DMMF_2 {
    export {
        datamodelEnumToSchemaEnum,
        Document_2 as Document,
        Mappings,
        OtherOperationMappings,
        DatamodelEnum,
        SchemaEnum,
        EnumValue,
        Datamodel,
        uniqueIndex,
        PrimaryKey,
        Model,
        FieldKind,
        FieldNamespace,
        FieldLocation,
        Field,
        FieldDefault,
        FieldDefaultScalar,
        Index,
        IndexType,
        IndexField,
        SortOrder,
        Schema,
        Query,
        QueryOutput,
        TypeRef,
        InputTypeRef,
        SchemaArg,
        OutputType,
        SchemaField,
        OutputTypeRef,
        Deprecation,
        InputType,
        FieldRefType,
        FieldRefAllowType,
        ModelMapping,
        ModelAction
    }
}

export declare function dmmfToRuntimeDataModel(dmmfDataModel: DMMF_2.Datamodel): RuntimeDataModel;

declare type Document_2 = ReadonlyDeep_2<{
    datamodel: Datamodel;
    schema: Schema;
    mappings: Mappings;
}>;

/**
 * A generic driver adapter factory that allows the user to instantiate a
 * driver adapter. The query and result types are specific to the adapter.
 */
declare interface DriverAdapterFactory<Query, Result> extends AdapterInfo {
    /**
     * Instantiate a driver adapter.
     */
    connect(): Promise<Queryable<Query, Result>>;
}

/** Client */
export declare type DynamicClientExtensionArgs<C_, TypeMap extends TypeMapDef, TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>> = {
    [P in keyof C_]: unknown;
} & {
    [K: symbol]: {
        ctx: Optional<DynamicClientExtensionThis<TypeMap, TypeMapCb, ExtArgs>, ITXClientDenyList> & {
            $parent: Optional<DynamicClientExtensionThis<TypeMap, TypeMapCb, ExtArgs>, ITXClientDenyList>;
        };
    };
};

export declare type DynamicClientExtensionThis<TypeMap extends TypeMapDef, TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>> = {
    [P in keyof ExtArgs['client']]: Return<ExtArgs['client'][P]>;
} & {
    [P in Exclude<TypeMap['meta']['modelProps'], keyof ExtArgs['client']>]: DynamicModelExtensionThis<TypeMap, ModelKey<TypeMap, P>, ExtArgs>;
} & {
    [P in Exclude<keyof TypeMap['other']['operations'], keyof ExtArgs['client']>]: P extends keyof ClientOtherOps ? ClientOtherOps[P] : never;
} & {
    [P in Exclude<ClientBuiltInProp, keyof ExtArgs['client']>]: DynamicClientExtensionThisBuiltin<TypeMap, TypeMapCb, ExtArgs>[P];
} & {
    [K: symbol]: {
        types: TypeMap['other'];
    };
};

export declare type DynamicClientExtensionThisBuiltin<TypeMap extends TypeMapDef, TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>> = {
    $extends: ExtendsHook<'extends', TypeMapCb, ExtArgs, Call<TypeMapCb, {
        extArgs: ExtArgs;
    }>>;
    $transaction<P extends PrismaPromise<any>[]>(arg: [...P], options?: {
        isolationLevel?: TypeMap['meta']['txIsolationLevel'];
    }): Promise<UnwrapTuple<P>>;
    $transaction<R>(fn: (client: Omit<DynamicClientExtensionThis<TypeMap, TypeMapCb, ExtArgs>, ITXClientDenyList>) => Promise<R>, options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: TypeMap['meta']['txIsolationLevel'];
    }): Promise<R>;
    $disconnect(): Promise<void>;
    $connect(): Promise<void>;
};

/** Model */
export declare type DynamicModelExtensionArgs<M_, TypeMap extends TypeMapDef, TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>> = {
    [K in keyof M_]: K extends '$allModels' ? {
        [P in keyof M_[K]]?: unknown;
    } & {
        [K: symbol]: {};
    } : K extends TypeMap['meta']['modelProps'] ? {
        [P in keyof M_[K]]?: unknown;
    } & {
        [K: symbol]: {
            ctx: DynamicModelExtensionThis<TypeMap, ModelKey<TypeMap, K>, ExtArgs> & {
                $parent: DynamicClientExtensionThis<TypeMap, TypeMapCb, ExtArgs>;
            } & {
                $name: ModelKey<TypeMap, K>;
            } & {
                /**
                 * @deprecated Use `$name` instead.
                 */
                name: ModelKey<TypeMap, K>;
            };
        };
    } : never;
};

export declare type DynamicModelExtensionFluentApi<TypeMap extends TypeMapDef, M extends PropertyKey, P extends PropertyKey, Null> = {
    [K in keyof TypeMap['model'][M]['payload']['objects']]: <A>(args?: Exact<A, Path<TypeMap['model'][M]['operations'][P]['args']['select'], [K]>>) => PrismaPromise<Path<DynamicModelExtensionFnResultBase<TypeMap, M, {
        select: {
            [P in K]: A;
        };
    }, P>, [K]> | Null> & DynamicModelExtensionFluentApi<TypeMap, (TypeMap['model'][M]['payload']['objects'][K] & {})['name'], P, Null | Select<TypeMap['model'][M]['payload']['objects'][K], null>>;
};

export declare type DynamicModelExtensionFnResult<TypeMap extends TypeMapDef, M extends PropertyKey, A, P extends PropertyKey, Null> = P extends FluentOperation ? DynamicModelExtensionFluentApi<TypeMap, M, P, Null> & PrismaPromise<DynamicModelExtensionFnResultBase<TypeMap, M, A, P> | Null> : PrismaPromise<DynamicModelExtensionFnResultBase<TypeMap, M, A, P>>;

export declare type DynamicModelExtensionFnResultBase<TypeMap extends TypeMapDef, M extends PropertyKey, A, P extends PropertyKey> = GetResult<TypeMap['model'][M]['payload'], A, P & Operation, TypeMap['globalOmitOptions']>;

export declare type DynamicModelExtensionFnResultNull<P extends PropertyKey> = P extends 'findUnique' | 'findFirst' ? null : never;

export declare type DynamicModelExtensionOperationFn<TypeMap extends TypeMapDef, M extends PropertyKey, P extends PropertyKey> = {} extends TypeMap['model'][M]['operations'][P]['args'] ? <A extends TypeMap['model'][M]['operations'][P]['args']>(args?: Exact<A, TypeMap['model'][M]['operations'][P]['args']>) => DynamicModelExtensionFnResult<TypeMap, M, A, P, DynamicModelExtensionFnResultNull<P>> : <A extends TypeMap['model'][M]['operations'][P]['args']>(args: Exact<A, TypeMap['model'][M]['operations'][P]['args']>) => DynamicModelExtensionFnResult<TypeMap, M, A, P, DynamicModelExtensionFnResultNull<P>>;

export declare type DynamicModelExtensionThis<TypeMap extends TypeMapDef, M extends PropertyKey, ExtArgs extends Record<string, any>> = {
    [P in keyof ExtArgs['model'][Uncapitalize<M & string>]]: Return<ExtArgs['model'][Uncapitalize<M & string>][P]>;
} & {
    [P in Exclude<keyof TypeMap['model'][M]['operations'], keyof ExtArgs['model'][Uncapitalize<M & string>]>]: DynamicModelExtensionOperationFn<TypeMap, M, P>;
} & {
    [P in Exclude<'fields', keyof ExtArgs['model'][Uncapitalize<M & string>]>]: TypeMap['model'][M]['fields'];
} & {
    [K: symbol]: {
        types: TypeMap['model'][M];
    };
};

/** Query */
export declare type DynamicQueryExtensionArgs<Q_, TypeMap extends TypeMapDef> = {
    [K in keyof Q_]: K extends '$allOperations' ? (args: {
        model?: string;
        operation: string;
        args: any;
        query: (args: any) => PrismaPromise<any>;
    }) => Promise<any> : K extends '$allModels' ? {
        [P in keyof Q_[K] | keyof TypeMap['model'][keyof TypeMap['model']]['operations'] | '$allOperations']?: P extends '$allOperations' ? DynamicQueryExtensionCb<TypeMap, 'model', keyof TypeMap['model'], keyof TypeMap['model'][keyof TypeMap['model']]['operations']> : P extends keyof TypeMap['model'][keyof TypeMap['model']]['operations'] ? DynamicQueryExtensionCb<TypeMap, 'model', keyof TypeMap['model'], P> : never;
    } : K extends TypeMap['meta']['modelProps'] ? {
        [P in keyof Q_[K] | keyof TypeMap['model'][ModelKey<TypeMap, K>]['operations'] | '$allOperations']?: P extends '$allOperations' ? DynamicQueryExtensionCb<TypeMap, 'model', ModelKey<TypeMap, K>, keyof TypeMap['model'][ModelKey<TypeMap, K>]['operations']> : P extends keyof TypeMap['model'][ModelKey<TypeMap, K>]['operations'] ? DynamicQueryExtensionCb<TypeMap, 'model', ModelKey<TypeMap, K>, P> : never;
    } : K extends keyof TypeMap['other']['operations'] ? DynamicQueryExtensionCb<[TypeMap], 0, 'other', K> : never;
};

export declare type DynamicQueryExtensionCb<TypeMap extends TypeMapDef, _0 extends PropertyKey, _1 extends PropertyKey, _2 extends PropertyKey> = <A extends DynamicQueryExtensionCbArgs<TypeMap, _0, _1, _2>>(args: A) => Promise<TypeMap[_0][_1][_2]['result']>;

export declare type DynamicQueryExtensionCbArgs<TypeMap extends TypeMapDef, _0 extends PropertyKey, _1 extends PropertyKey, _2 extends PropertyKey> = (_1 extends unknown ? _2 extends unknown ? {
    args: DynamicQueryExtensionCbArgsArgs<TypeMap, _0, _1, _2>;
    model: _0 extends 0 ? undefined : _1;
    operation: _2;
    query: <A extends DynamicQueryExtensionCbArgsArgs<TypeMap, _0, _1, _2>>(args: A) => PrismaPromise<TypeMap[_0][_1]['operations'][_2]['result']>;
} : never : never) & {
    query: (args: DynamicQueryExtensionCbArgsArgs<TypeMap, _0, _1, _2>) => PrismaPromise<TypeMap[_0][_1]['operations'][_2]['result']>;
};

export declare type DynamicQueryExtensionCbArgsArgs<TypeMap extends TypeMapDef, _0 extends PropertyKey, _1 extends PropertyKey, _2 extends PropertyKey> = _2 extends '$queryRaw' | '$executeRaw' ? Sql : TypeMap[_0][_1]['operations'][_2]['args'];

/** Result */
export declare type DynamicResultExtensionArgs<R_, TypeMap extends TypeMapDef> = {
    [K in keyof R_]: {
        [P in keyof R_[K]]?: {
            needs?: DynamicResultExtensionNeeds<TypeMap, ModelKey<TypeMap, K>, R_[K][P]>;
            compute(data: DynamicResultExtensionData<TypeMap, ModelKey<TypeMap, K>, R_[K][P]>): any;
        };
    };
};

export declare type DynamicResultExtensionData<TypeMap extends TypeMapDef, M extends PropertyKey, S> = GetFindResult<TypeMap['model'][M]['payload'], {
    select: S;
}, {}>;

export declare type DynamicResultExtensionNeeds<TypeMap extends TypeMapDef, M extends PropertyKey, S> = {
    [K in keyof S]: K extends keyof TypeMap['model'][M]['payload']['scalars'] ? S[K] : never;
} & {
    [N in keyof TypeMap['model'][M]['payload']['scalars']]?: boolean;
};

/**
 * Placeholder value for "no text".
 */
export declare const empty: Sql;

export declare type EmptyToUnknown<T> = T;

declare interface Engine<InteractiveTransactionPayload = unknown> {
    /** The name of the engine. This is meant to be consumed externally */
    readonly name: string;
    onBeforeExit(callback: () => Promise<void>): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    version(forceRun?: boolean): Promise<string> | string;
    request<T>(query: JsonQuery, options: RequestOptions<InteractiveTransactionPayload>): Promise<QueryEngineResultData<T>>;
    requestBatch<T>(queries: JsonQuery[], options: RequestBatchOptions<InteractiveTransactionPayload>): Promise<BatchQueryEngineResult<T>[]>;
    transaction(action: 'start', headers: Transaction_2.TransactionHeaders, options: Transaction_2.Options): Promise<Transaction_2.InteractiveTransactionInfo<unknown>>;
    transaction(action: 'commit', headers: Transaction_2.TransactionHeaders, info: Transaction_2.InteractiveTransactionInfo<unknown>): Promise<void>;
    transaction(action: 'rollback', headers: Transaction_2.TransactionHeaders, info: Transaction_2.InteractiveTransactionInfo<unknown>): Promise<void>;
    metrics(options: MetricsOptionsJson): Promise<Metrics>;
    metrics(options: MetricsOptionsPrometheus): Promise<string>;
    applyPendingMigrations(): Promise<void>;
}

declare interface EngineConfig {
    cwd: string;
    dirname: string;
    enableDebugLogs?: boolean;
    allowTriggerPanic?: boolean;
    prismaPath?: string;
    generator?: GeneratorConfig;
    /**
     * @remarks this field is used internally by Policy, do not rename or remove
     */
    overrideDatasources: Datasources;
    showColors?: boolean;
    logQueries?: boolean;
    logLevel?: 'info' | 'warn';
    env: Record<string, string>;
    flags?: string[];
    clientVersion: string;
    engineVersion: string;
    previewFeatures?: string[];
    engineEndpoint?: string;
    activeProvider?: string;
    logEmitter: LogEmitter;
    transactionOptions: Transaction_2.Options;
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`.
     * If set, this is only used in the library engine, and all queries would be performed through it,
     * rather than Prisma's Rust drivers.
     * @remarks only used by LibraryEngine.ts
     */
    adapter?: SqlDriverAdapterFactory;
    /**
     * The contents of the schema encoded into a string
     */
    inlineSchema: string;
    /**
     * The contents of the datasource url saved in a string
     * @remarks only used by DataProxyEngine.ts
     * @remarks this field is used internally by Policy, do not rename or remove
     */
    inlineDatasources: GetPrismaClientConfig['inlineDatasources'];
    /**
     * The string hash that was produced for a given schema
     * @remarks only used by DataProxyEngine.ts
     */
    inlineSchemaHash: string;
    /**
     * The helper for interaction with OTEL tracing
     * @remarks enabling is determined by the client and @prisma/instrumentation package
     */
    tracingHelper: TracingHelper;
    /**
     * Information about whether we have not found a schema.prisma file in the
     * default location, and that we fell back to finding the schema.prisma file
     * in the current working directory. This usually means it has been bundled.
     */
    isBundled?: boolean;
    /**
     * Web Assembly module loading configuration
     */
    engineWasm?: EngineWasmLoadingConfig;
    compilerWasm?: CompilerWasmLoadingConfig;
    /**
     * Allows Accelerate to use runtime utilities from the client. These are
     * necessary for the AccelerateEngine to function correctly.
     */
    accelerateUtils?: {
        resolveDatasourceUrl: typeof resolveDatasourceUrl;
        getBatchRequestPayload: typeof getBatchRequestPayload;
        prismaGraphQLToJSError: typeof prismaGraphQLToJSError;
        PrismaClientUnknownRequestError: typeof PrismaClientUnknownRequestError;
        PrismaClientInitializationError: typeof PrismaClientInitializationError;
        PrismaClientKnownRequestError: typeof PrismaClientKnownRequestError;
        debug: (...args: any[]) => void;
        engineVersion: string;
        clientVersion: string;
    };
}

declare type EngineEvent<E extends EngineEventType> = E extends QueryEventType ? QueryEvent : LogEvent;

declare type EngineEventType = QueryEventType | LogEventType;

declare type EngineSpan = {
    id: EngineSpanId;
    parentId: string | null;
    name: string;
    startTime: HrTime;
    endTime: HrTime;
    kind: EngineSpanKind;
    attributes?: Record<string, unknown>;
    links?: EngineSpanId[];
};

declare type EngineSpanId = string;

declare type EngineSpanKind = 'client' | 'internal';

declare type EngineWasmLoadingConfig = {
    /**
     * WASM-bindgen runtime for corresponding module
     */
    getRuntime: () => Promise<{
        __wbg_set_wasm(exports: unknown): void;
        QueryEngine: QueryEngineConstructor;
    }>;
    /**
     * Loads the raw wasm module for the wasm query engine. This configuration is
     * generated specifically for each type of client, eg. Node.js client and Edge
     * clients will have different implementations.
     * @remarks this is a callback on purpose, we only load the wasm if needed.
     * @remarks only used by LibraryEngine
     */
    getQueryEngineWasmModule: () => Promise<unknown>;
};

declare type EnumValue = ReadonlyDeep_2<{
    name: string;
    dbName: string | null;
}>;

declare type EnvPaths = {
    rootEnvPath: string | null;
    schemaEnvPath: string | undefined;
};

declare interface EnvValue {
    fromEnvVar: null | string;
    value: null | string;
}

export declare type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? 1 : 0;

declare type Error_2 = {
    kind: 'GenericJs';
    id: number;
} | {
    kind: 'UnsupportedNativeDataType';
    type: string;
} | {
    kind: 'InvalidIsolationLevel';
    level: string;
} | {
    kind: 'LengthMismatch';
    column?: string;
} | {
    kind: 'UniqueConstraintViolation';
    fields: string[];
} | {
    kind: 'NullConstraintViolation';
    fields: string[];
} | {
    kind: 'ForeignKeyConstraintViolation';
    constraint?: {
        fields: string[];
    } | {
        index: string;
    } | {
        foreignKey: {};
    };
} | {
    kind: 'DatabaseDoesNotExist';
    db?: string;
} | {
    kind: 'DatabaseAlreadyExists';
    db?: string;
} | {
    kind: 'DatabaseAccessDenied';
    db?: string;
} | {
    kind: 'AuthenticationFailed';
    user?: string;
} | {
    kind: 'TransactionWriteConflict';
} | {
    kind: 'TableDoesNotExist';
    table?: string;
} | {
    kind: 'ColumnNotFound';
    column?: string;
} | {
    kind: 'TooManyConnections';
    cause: string;
} | {
    kind: 'SocketTimeout';
} | {
    kind: 'postgres';
    code: string;
    severity: string;
    message: string;
    detail: string | undefined;
    column: string | undefined;
    hint: string | undefined;
} | {
    kind: 'mysql';
    code: number;
    message: string;
    state: string;
} | {
    kind: 'sqlite';
    /**
     * Sqlite extended error code: https://www.sqlite.org/rescode.html
     */
    extendedCode: number;
    message: string;
};

declare type ErrorCapturingFunction<T> = T extends (...args: infer A) => Promise<infer R> ? (...args: A) => Promise<Result_4<ErrorCapturingInterface<R>>> : T extends (...args: infer A) => infer R ? (...args: A) => Result_4<ErrorCapturingInterface<R>> : T;

declare type ErrorCapturingInterface<T> = {
    [K in keyof T]: ErrorCapturingFunction<T[K]>;
};

declare interface ErrorCapturingSqlDriverAdapter extends ErrorCapturingInterface<SqlDriverAdapter> {
    readonly errorRegistry: ErrorRegistry;
}

declare type ErrorFormat = 'pretty' | 'colorless' | 'minimal';

declare type ErrorRecord = {
    error: unknown;
};

declare interface ErrorRegistry {
    consumeError(id: number): ErrorRecord | undefined;
}

declare interface ErrorWithBatchIndex {
    batchRequestIdx?: number;
}

declare type EventCallback<E extends ExtendedEventType> = [E] extends ['beforeExit'] ? () => Promise<void> : [E] extends [LogLevel] ? (event: EngineEvent<E>) => void : never;

export declare type Exact<A, W> = (A extends unknown ? (W extends A ? {
    [K in keyof A]: Exact<A[K], W[K]>;
} : W) : never) | (A extends Narrowable ? A : never);

/**
 * Defines Exception.
 *
 * string or an object with one of (message or name or code) and optional stack
 */
declare type Exception = ExceptionWithCode | ExceptionWithMessage | ExceptionWithName | string;

declare interface ExceptionWithCode {
    code: string | number;
    name?: string;
    message?: string;
    stack?: string;
}

declare interface ExceptionWithMessage {
    code?: string | number;
    message: string;
    name?: string;
    stack?: string;
}

declare interface ExceptionWithName {
    code?: string | number;
    message?: string;
    name: string;
    stack?: string;
}

declare type ExtendedEventType = LogLevel | 'beforeExit';

declare type ExtendedSpanOptions = SpanOptions & {
    /** The name of the span */
    name: string;
    internal?: boolean;
    middleware?: boolean;
    /** Whether it propagates context (?=true) */
    active?: boolean;
    /** The context to append the span to */
    context?: Context;
};

/** $extends, defineExtension */
export declare interface ExtendsHook<Variant extends 'extends' | 'define', TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>, TypeMap extends TypeMapDef = Call<TypeMapCb, {
    extArgs: ExtArgs;
}>> {
    extArgs: ExtArgs;
    <R_ extends {
        [K in TypeMap['meta']['modelProps'] | '$allModels']?: unknown;
    }, R, M_ extends {
        [K in TypeMap['meta']['modelProps'] | '$allModels']?: unknown;
    }, M, Q_ extends {
        [K in TypeMap['meta']['modelProps'] | '$allModels' | keyof TypeMap['other']['operations'] | '$allOperations']?: unknown;
    }, C_ extends {
        [K in string]?: unknown;
    }, C, Args extends InternalArgs = InternalArgs<R, M, {}, C>, MergedArgs extends InternalArgs = MergeExtArgs<TypeMap, ExtArgs, Args>>(extension: ((client: DynamicClientExtensionThis<TypeMap, TypeMapCb, ExtArgs>) => {
        $extends: {
            extArgs: Args;
        };
    }) | {
        name?: string;
        query?: DynamicQueryExtensionArgs<Q_, TypeMap>;
        result?: DynamicResultExtensionArgs<R_, TypeMap> & R;
        model?: DynamicModelExtensionArgs<M_, TypeMap, TypeMapCb, ExtArgs> & M;
        client?: DynamicClientExtensionArgs<C_, TypeMap, TypeMapCb, ExtArgs> & C;
    }): {
        extends: DynamicClientExtensionThis<Call<TypeMapCb, {
            extArgs: MergedArgs;
        }>, TypeMapCb, MergedArgs>;
        define: (client: any) => {
            $extends: {
                extArgs: Args;
            };
        };
    }[Variant];
}

export declare type ExtensionArgs = Optional<RequiredExtensionArgs>;

declare namespace Extensions {
    export {
        defineExtension,
        getExtensionContext
    }
}
export { Extensions }

declare namespace Extensions_2 {
    export {
        InternalArgs,
        DefaultArgs,
        GetPayloadResultExtensionKeys,
        GetPayloadResultExtensionObject,
        GetPayloadResult,
        GetSelect,
        GetOmit,
        DynamicQueryExtensionArgs,
        DynamicQueryExtensionCb,
        DynamicQueryExtensionCbArgs,
        DynamicQueryExtensionCbArgsArgs,
        DynamicResultExtensionArgs,
        DynamicResultExtensionNeeds,
        DynamicResultExtensionData,
        DynamicModelExtensionArgs,
        DynamicModelExtensionThis,
        DynamicModelExtensionOperationFn,
        DynamicModelExtensionFnResult,
        DynamicModelExtensionFnResultBase,
        DynamicModelExtensionFluentApi,
        DynamicModelExtensionFnResultNull,
        DynamicClientExtensionArgs,
        DynamicClientExtensionThis,
        ClientBuiltInProp,
        DynamicClientExtensionThisBuiltin,
        ExtendsHook,
        MergeExtArgs,
        AllModelsToStringIndex,
        TypeMapDef,
        DevTypeMapDef,
        DevTypeMapFnDef,
        ClientOptionDef,
        ClientOtherOps,
        TypeMapCbDef,
        ModelKey,
        RequiredExtensionArgs as UserArgs
    }
}

export declare type ExtractGlobalOmit<Options, ModelName extends string> = Options extends {
    omit: {
        [K in ModelName]: infer GlobalOmit;
    };
} ? GlobalOmit : {};

declare type Field = ReadonlyDeep_2<{
    kind: FieldKind;
    name: string;
    isRequired: boolean;
    isList: boolean;
    isUnique: boolean;
    isId: boolean;
    isReadOnly: boolean;
    isGenerated?: boolean;
    isUpdatedAt?: boolean;
    /**
     * Describes the data type in the same the way it is defined in the Prisma schema:
     * BigInt, Boolean, Bytes, DateTime, Decimal, Float, Int, JSON, String, $ModelName
     */
    type: string;
    /**
     * Native database type, if specified.
     * For example, `@db.VarChar(191)` is encoded as `['VarChar', ['191']]`,
     * `@db.Text` is encoded as `['Text', []]`.
     */
    nativeType?: [string, string[]] | null;
    dbName?: string | null;
    hasDefaultValue: boolean;
    default?: FieldDefault | FieldDefaultScalar | FieldDefaultScalar[];
    relationFromFields?: string[];
    relationToFields?: string[];
    relationOnDelete?: string;
    relationOnUpdate?: string;
    relationName?: string;
    documentation?: string;
}>;

declare type FieldDefault = ReadonlyDeep_2<{
    name: string;
    args: Array<string | number>;
}>;

declare type FieldDefaultScalar = string | boolean | number;

declare type FieldKind = 'scalar' | 'object' | 'enum' | 'unsupported';

declare type FieldLocation = 'scalar' | 'inputObjectTypes' | 'outputObjectTypes' | 'enumTypes' | 'fieldRefTypes';

declare type FieldNamespace = 'model' | 'prisma';

/**
 * A reference to a specific field of a specific model
 */
export declare interface FieldRef<Model, FieldType> {
    readonly modelName: Model;
    readonly name: string;
    readonly typeName: FieldType;
    readonly isList: boolean;
}

declare type FieldRefAllowType = TypeRef<'scalar' | 'enumTypes'>;

declare type FieldRefType = ReadonlyDeep_2<{
    name: string;
    allowTypes: FieldRefAllowType[];
    fields: SchemaArg[];
}>;

declare type FluentOperation = 'findUnique' | 'findUniqueOrThrow' | 'findFirst' | 'findFirstOrThrow' | 'create' | 'update' | 'upsert' | 'delete';

export declare interface Fn<Params = unknown, Returns = unknown> {
    params: Params;
    returns: Returns;
}

declare interface GeneratorConfig {
    name: string;
    output: EnvValue | null;
    isCustomOutput?: boolean;
    provider: EnvValue;
    config: {
        /** `output` is a reserved name and will only be available directly at `generator.output` */
        output?: never;
        /** `provider` is a reserved name and will only be available directly at `generator.provider` */
        provider?: never;
        /** `binaryTargets` is a reserved name and will only be available directly at `generator.binaryTargets` */
        binaryTargets?: never;
        /** `previewFeatures` is a reserved name and will only be available directly at `generator.previewFeatures` */
        previewFeatures?: never;
    } & {
        [key: string]: string | string[] | undefined;
    };
    binaryTargets: BinaryTargetsEnvValue[];
    previewFeatures: string[];
    envPaths?: EnvPaths;
    sourceFilePath: string;
}

export declare type GetAggregateResult<P extends OperationPayload, A> = {
    [K in keyof A as K extends Aggregate ? K : never]: K extends '_count' ? A[K] extends true ? number : Count<A[K]> : {
        [J in keyof A[K] & string]: P['scalars'][J] | null;
    };
};

declare function getBatchRequestPayload(batch: JsonQuery[], transaction?: TransactionOptions_3<unknown>): QueryEngineBatchRequest;

export declare type GetBatchResult = {
    count: number;
};

export declare type GetCountResult<A> = A extends {
    select: infer S;
} ? (S extends true ? number : Count<S>) : number;

declare function getExtensionContext<T>(that: T): Context_2<T>;

export declare type GetFindResult<P extends OperationPayload, A, GlobalOmitOptions> = Equals<A, any> extends 1 ? DefaultSelection<P, A, GlobalOmitOptions> : A extends {
    select: infer S extends object;
} & Record<string, unknown> | {
    include: infer I extends object;
} & Record<string, unknown> ? {
    [K in keyof S | keyof I as (S & I)[K] extends false | undefined | Skip | null ? never : K]: (S & I)[K] extends object ? P extends SelectablePayloadFields<K, (infer O)[]> ? O extends OperationPayload ? GetFindResult<O, (S & I)[K], GlobalOmitOptions>[] : never : P extends SelectablePayloadFields<K, infer O | null> ? O extends OperationPayload ? GetFindResult<O, (S & I)[K], GlobalOmitOptions> | SelectField<P, K> & null : never : K extends '_count' ? Count<GetFindResult<P, (S & I)[K], GlobalOmitOptions>> : never : P extends SelectablePayloadFields<K, (infer O)[]> ? O extends OperationPayload ? DefaultSelection<O, {}, GlobalOmitOptions>[] : never : P extends SelectablePayloadFields<K, infer O | null> ? O extends OperationPayload ? DefaultSelection<O, {}, GlobalOmitOptions> | SelectField<P, K> & null : never : P extends {
        scalars: {
            [k in K]: infer O;
        };
    } ? O : K extends '_count' ? Count<P['objects']> : never;
} & (A extends {
    include: any;
} & Record<string, unknown> ? DefaultSelection<P, A & {
    omit: A['omit'];
}, GlobalOmitOptions> : unknown) : DefaultSelection<P, A, GlobalOmitOptions>;

export declare type GetGroupByResult<P extends OperationPayload, A> = A extends {
    by: string[];
} ? Array<GetAggregateResult<P, A> & {
    [K in A['by'][number]]: P['scalars'][K];
}> : A extends {
    by: string;
} ? Array<GetAggregateResult<P, A> & {
    [K in A['by']]: P['scalars'][K];
}> : {}[];

export declare type GetOmit<BaseKeys extends string, R extends InternalArgs['result'][string], ExtraType = never> = {
    [K in (string extends keyof R ? never : keyof R) | BaseKeys]?: boolean | ExtraType;
};

export declare type GetPayloadResult<Base extends Record<any, any>, R extends InternalArgs['result'][string]> = Omit<Base, GetPayloadResultExtensionKeys<R>> & GetPayloadResultExtensionObject<R>;

export declare type GetPayloadResultExtensionKeys<R extends InternalArgs['result'][string], KR extends keyof R = string extends keyof R ? never : keyof R> = KR;

export declare type GetPayloadResultExtensionObject<R extends InternalArgs['result'][string]> = {
    [K in GetPayloadResultExtensionKeys<R>]: R[K] extends () => {
        compute: (...args: any) => infer C;
    } ? C : never;
};

export declare function getPrismaClient(config: GetPrismaClientConfig): {
    new (optionsArg?: PrismaClientOptions): {
        _originalClient: any;
        _runtimeDataModel: RuntimeDataModel;
        _requestHandler: RequestHandler;
        _connectionPromise?: Promise<any> | undefined;
        _disconnectionPromise?: Promise<any> | undefined;
        _engineConfig: EngineConfig;
        _accelerateEngineConfig: AccelerateEngineConfig;
        _clientVersion: string;
        _errorFormat: ErrorFormat;
        _tracingHelper: TracingHelper;
        _middlewares: MiddlewareHandler<QueryMiddleware>;
        _previewFeatures: string[];
        _activeProvider: string;
        _globalOmit?: GlobalOmitOptions | undefined;
        _extensions: MergedExtensionsList;
        /**
         * @remarks This is used internally by Policy, do not rename or remove
         */
        _engine: Engine;
        /**
         * A fully constructed/applied Client that references the parent
         * PrismaClient. This is used for Client extensions only.
         */
        _appliedParent: any;
        _createPrismaPromise: PrismaPromiseFactory;
        /**
         * Hook a middleware into the client
         * @param middleware to hook
         */
        $use(middleware: QueryMiddleware): void;
        $on<E extends ExtendedEventType>(eventType: E, callback: EventCallback<E>): any;
        $connect(): Promise<void>;
        /**
         * Disconnect from the database
         */
        $disconnect(): Promise<void>;
        /**
         * Executes a raw query and always returns a number
         */
        $executeRawInternal(transaction: PrismaPromiseTransaction | undefined, clientMethod: string, args: RawQueryArgs, middlewareArgsMapper?: MiddlewareArgsMapper<unknown, unknown>): Promise<number>;
        /**
         * Executes a raw query provided through a safe tag function
         * @see https://github.com/prisma/prisma/issues/7142
         *
         * @param query
         * @param values
         * @returns
         */
        $executeRaw(query: TemplateStringsArray | Sql, ...values: any[]): PrismaPromise_2<unknown, any>;
        /**
         * Unsafe counterpart of `$executeRaw` that is susceptible to SQL injections
         * @see https://github.com/prisma/prisma/issues/7142
         *
         * @param query
         * @param values
         * @returns
         */
        $executeRawUnsafe(query: string, ...values: RawValue[]): PrismaPromise_2<unknown, any>;
        /**
         * Executes a raw command only for MongoDB
         *
         * @param command
         * @returns
         */
        $runCommandRaw(command: Record<string, JsInputValue>): PrismaPromise_2<unknown, any>;
        /**
         * Executes a raw query and returns selected data
         */
        $queryRawInternal(transaction: PrismaPromiseTransaction | undefined, clientMethod: string, args: RawQueryArgs, middlewareArgsMapper?: MiddlewareArgsMapper<unknown, unknown>): Promise<any>;
        /**
         * Executes a raw query provided through a safe tag function
         * @see https://github.com/prisma/prisma/issues/7142
         *
         * @param query
         * @param values
         * @returns
         */
        $queryRaw(query: TemplateStringsArray | Sql, ...values: any[]): PrismaPromise_2<unknown, any>;
        /**
         * Counterpart to $queryRaw, that returns strongly typed results
         * @param typedSql
         */
        $queryRawTyped(typedSql: UnknownTypedSql): PrismaPromise_2<unknown, any>;
        /**
         * Unsafe counterpart of `$queryRaw` that is susceptible to SQL injections
         * @see https://github.com/prisma/prisma/issues/7142
         *
         * @param query
         * @param values
         * @returns
         */
        $queryRawUnsafe(query: string, ...values: RawValue[]): PrismaPromise_2<unknown, any>;
        /**
         * Execute a batch of requests in a transaction
         * @param requests
         * @param options
         */
        _transactionWithArray({ promises, options, }: {
            promises: Array<PrismaPromise_2<any>>;
            options?: BatchTransactionOptions;
        }): Promise<any>;
        /**
         * Perform a long-running transaction
         * @param callback
         * @param options
         * @returns
         */
        _transactionWithCallback({ callback, options, }: {
            callback: (client: Client) => Promise<unknown>;
            options?: TransactionOptions_2;
        }): Promise<unknown>;
        _createItxClient(transaction: PrismaPromiseInteractiveTransaction): Client;
        /**
         * Execute queries within a transaction
         * @param input a callback or a query list
         * @param options to set timeouts (callback)
         * @returns
         */
        $transaction(input: any, options?: any): Promise<any>;
        /**
         * Runs the middlewares over params before executing a request
         * @param internalParams
         * @returns
         */
        _request(internalParams: InternalRequestParams): Promise<any>;
        _executeRequest({ args, clientMethod, dataPath, callsite, action, model, argsMapper, transaction, unpacker, otelParentCtx, customDataProxyFetch, }: InternalRequestParams): Promise<any>;
        $metrics: MetricsClient;
        /**
         * Shortcut for checking a preview flag
         * @param feature preview flag
         * @returns
         */
        _hasPreviewFlag(feature: string): boolean;
        $applyPendingMigrations(): Promise<void>;
        $extends: typeof $extends;
        readonly [Symbol.toStringTag]: string;
    };
};

/**
 * Config that is stored into the generated client. When the generated client is
 * loaded, this same config is passed to {@link getPrismaClient} which creates a
 * closure with that config around a non-instantiated [[PrismaClient]].
 */
export declare type GetPrismaClientConfig = {
    runtimeDataModel: RuntimeDataModel;
    generator?: GeneratorConfig;
    relativeEnvPaths?: {
        rootEnvPath?: string | null;
        schemaEnvPath?: string | null;
    };
    relativePath: string;
    dirname: string;
    clientVersion: string;
    engineVersion: string;
    datasourceNames: string[];
    activeProvider: ActiveConnectorType;
    /**
     * The contents of the schema encoded into a string
     * @remarks only used for the purpose of data proxy
     */
    inlineSchema: string;
    /**
     * A special env object just for the data proxy edge runtime.
     * Allows bundlers to inject their own env variables (Vercel).
     * Allows platforms to declare global variables as env (Workers).
     * @remarks only used for the purpose of data proxy
     */
    injectableEdgeEnv?: () => LoadedEnv;
    /**
     * The contents of the datasource url saved in a string.
     * This can either be an env var name or connection string.
     * It is needed by the client to connect to the Data Proxy.
     * @remarks only used for the purpose of data proxy
     */
    inlineDatasources: {
        [name in string]: {
            url: EnvValue;
        };
    };
    /**
     * The string hash that was produced for a given schema
     * @remarks only used for the purpose of data proxy
     */
    inlineSchemaHash: string;
    /**
     * A marker to indicate that the client was not generated via `prisma
     * generate` but was generated via `generate --postinstall` script instead.
     * @remarks used to error for Vercel/Netlify for schema caching issues
     */
    postinstall?: boolean;
    /**
     * Information about the CI where the Prisma Client has been generated. The
     * name of the CI environment is stored at generation time because CI
     * information is not always available at runtime. Moreover, the edge client
     * has no notion of environment variables, so this works around that.
     * @remarks used to error for Vercel/Netlify for schema caching issues
     */
    ciName?: string;
    /**
     * Information about whether we have not found a schema.prisma file in the
     * default location, and that we fell back to finding the schema.prisma file
     * in the current working directory. This usually means it has been bundled.
     */
    isBundled?: boolean;
    /**
     * A boolean that is `false` when the client was generated with --no-engine. At
     * runtime, this means the client will be bound to be using the Data Proxy.
     */
    copyEngine?: boolean;
    /**
     * Optional wasm loading configuration
     */
    engineWasm?: EngineWasmLoadingConfig;
    compilerWasm?: CompilerWasmLoadingConfig;
};

export declare type GetResult<Payload extends OperationPayload, Args, OperationName extends Operation = 'findUniqueOrThrow', GlobalOmitOptions = {}> = {
    findUnique: GetFindResult<Payload, Args, GlobalOmitOptions> | null;
    findUniqueOrThrow: GetFindResult<Payload, Args, GlobalOmitOptions>;
    findFirst: GetFindResult<Payload, Args, GlobalOmitOptions> | null;
    findFirstOrThrow: GetFindResult<Payload, Args, GlobalOmitOptions>;
    findMany: GetFindResult<Payload, Args, GlobalOmitOptions>[];
    create: GetFindResult<Payload, Args, GlobalOmitOptions>;
    createMany: GetBatchResult;
    createManyAndReturn: GetFindResult<Payload, Args, GlobalOmitOptions>[];
    update: GetFindResult<Payload, Args, GlobalOmitOptions>;
    updateMany: GetBatchResult;
    updateManyAndReturn: GetFindResult<Payload, Args, GlobalOmitOptions>[];
    upsert: GetFindResult<Payload, Args, GlobalOmitOptions>;
    delete: GetFindResult<Payload, Args, GlobalOmitOptions>;
    deleteMany: GetBatchResult;
    aggregate: GetAggregateResult<Payload, Args>;
    count: GetCountResult<Args>;
    groupBy: GetGroupByResult<Payload, Args>;
    $queryRaw: unknown;
    $queryRawTyped: unknown;
    $executeRaw: number;
    $queryRawUnsafe: unknown;
    $executeRawUnsafe: number;
    $runCommandRaw: JsonObject;
    findRaw: JsonObject;
    aggregateRaw: JsonObject;
}[OperationName];

export declare function getRuntime(): GetRuntimeOutput;

declare type GetRuntimeOutput = {
    id: RuntimeName;
    prettyName: string;
    isEdge: boolean;
};

export declare type GetSelect<Base extends Record<any, any>, R extends InternalArgs['result'][string], KR extends keyof R = string extends keyof R ? never : keyof R> = {
    [K in KR | keyof Base]?: K extends KR ? boolean : Base[K];
};

declare type GlobalOmitOptions = {
    [modelName: string]: {
        [fieldName: string]: boolean;
    };
};

declare type HandleErrorParams = {
    args: JsArgs;
    error: any;
    clientMethod: string;
    callsite?: CallSite;
    transaction?: PrismaPromiseTransaction;
    modelName?: string;
    globalOmit?: GlobalOmitOptions;
};

declare type HrTime = [number, number];

/**
 * Defines High-Resolution Time.
 *
 * The first number, HrTime[0], is UNIX Epoch time in seconds since 00:00:00 UTC on 1 January 1970.
 * The second number, HrTime[1], represents the partial second elapsed since Unix Epoch time represented by first number in nanoseconds.
 * For example, 2021-01-01T12:30:10.150Z in UNIX Epoch time in milliseconds is represented as 1609504210150.
 * The first number is calculated by converting and truncating the Epoch time in milliseconds to seconds:
 * HrTime[0] = Math.trunc(1609504210150 / 1000) = 1609504210.
 * The second number is calculated by converting the digits after the decimal point of the subtraction, (1609504210150 / 1000) - HrTime[0], to nanoseconds:
 * HrTime[1] = Number((1609504210.150 - HrTime[0]).toFixed(9)) * 1e9 = 150000000.
 * This is represented in HrTime format as [1609504210, 150000000].
 */
declare type HrTime_2 = [number, number];

declare type Index = ReadonlyDeep_2<{
    model: string;
    type: IndexType;
    isDefinedOnField: boolean;
    name?: string;
    dbName?: string;
    algorithm?: string;
    clustered?: boolean;
    fields: IndexField[];
}>;

declare type IndexField = ReadonlyDeep_2<{
    name: string;
    sortOrder?: SortOrder;
    length?: number;
    operatorClass?: string;
}>;

declare type IndexType = 'id' | 'normal' | 'unique' | 'fulltext';

/**
 * Matches a JSON array.
 * Unlike \`JsonArray\`, readonly arrays are assignable to this type.
 */
export declare interface InputJsonArray extends ReadonlyArray<InputJsonValue | null> {
}

/**
 * Matches a JSON object.
 * Unlike \`JsonObject\`, this type allows undefined and read-only properties.
 */
export declare type InputJsonObject = {
    readonly [Key in string]?: InputJsonValue | null;
};

/**
 * Matches any valid value that can be used as an input for operations like
 * create and update as the value of a JSON field. Unlike \`JsonValue\`, this
 * type allows read-only arrays and read-only object properties and disallows
 * \`null\` at the top level.
 *
 * \`null\` cannot be used as the value of a JSON field because its meaning
 * would be ambiguous. Use \`Prisma.JsonNull\` to store the JSON null value or
 * \`Prisma.DbNull\` to clear the JSON value and set the field to the database
 * NULL value instead.
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-by-null-values
 */
export declare type InputJsonValue = string | number | boolean | InputJsonObject | InputJsonArray | {
    toJSON(): unknown;
};

declare type InputType = ReadonlyDeep_2<{
    name: string;
    constraints: {
        maxNumFields: number | null;
        minNumFields: number | null;
        fields?: string[];
    };
    meta?: {
        source?: string;
        grouping?: string;
    };
    fields: SchemaArg[];
}>;

declare type InputTypeRef = TypeRef<'scalar' | 'inputObjectTypes' | 'enumTypes' | 'fieldRefTypes'>;

declare type InteractiveTransactionInfo<Payload = unknown> = {
    /**
     * Transaction ID returned by the query engine.
     */
    id: string;
    /**
     * Arbitrary payload the meaning of which depends on the `Engine` implementation.
     * For example, `DataProxyEngine` needs to associate different API endpoints with transactions.
     * In `LibraryEngine` and `BinaryEngine` it is currently not used.
     */
    payload: Payload;
};

declare type InteractiveTransactionOptions<Payload> = Transaction_2.InteractiveTransactionInfo<Payload>;

export declare type InternalArgs<R = {
    [K in string]: {
        [K in string]: unknown;
    };
}, M = {
    [K in string]: {
        [K in string]: unknown;
    };
}, Q = {
    [K in string]: {
        [K in string]: unknown;
    };
}, C = {
    [K in string]: unknown;
}> = {
    result: {
        [K in keyof R]: {
            [P in keyof R[K]]: () => R[K][P];
        };
    };
    model: {
        [K in keyof M]: {
            [P in keyof M[K]]: () => M[K][P];
        };
    };
    query: {
        [K in keyof Q]: {
            [P in keyof Q[K]]: () => Q[K][P];
        };
    };
    client: {
        [K in keyof C]: () => C[K];
    };
};

declare type InternalRequestParams = {
    /**
     * The original client method being called.
     * Even though the rootField / operation can be changed,
     * this method stays as it is, as it's what the user's
     * code looks like
     */
    clientMethod: string;
    /**
     * Name of js model that triggered the request. Might be used
     * for warnings or error messages
     */
    jsModelName?: string;
    callsite?: CallSite;
    transaction?: PrismaPromiseTransaction;
    unpacker?: Unpacker;
    otelParentCtx?: Context;
    /** Used to "desugar" a user input into an "expanded" one */
    argsMapper?: (args?: UserArgs_2) => UserArgs_2;
    /** Used to convert args for middleware and back */
    middlewareArgsMapper?: MiddlewareArgsMapper<unknown, unknown>;
    /** Used for Accelerate client extension via Data Proxy */
    customDataProxyFetch?: CustomDataProxyFetch;
} & Omit<QueryMiddlewareParams, 'runInTransaction'>;

declare type IsolationLevel = 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SNAPSHOT' | 'SERIALIZABLE';

declare function isSkip(value: unknown): value is Skip;

export declare function isTypedSql(value: unknown): value is UnknownTypedSql;

export declare type ITXClientDenyList = (typeof denylist)[number];

export declare const itxClientDenyList: readonly (string | symbol)[];

declare interface Job {
    resolve: (data: any) => void;
    reject: (data: any) => void;
    request: any;
}

/**
 * Create a SQL query for a list of values.
 */
export declare function join(values: readonly RawValue[], separator?: string, prefix?: string, suffix?: string): Sql;

export declare type JsArgs = {
    select?: Selection_2;
    include?: Selection_2;
    omit?: Omission;
    [argName: string]: JsInputValue;
};

export declare type JsInputValue = null | undefined | string | number | boolean | bigint | Uint8Array | Date | DecimalJsLike | ObjectEnumValue | RawParameters | JsonConvertible | FieldRef<string, unknown> | JsInputValue[] | Skip | {
    [key: string]: JsInputValue;
};

declare type JsonArgumentValue = number | string | boolean | null | RawTaggedValue | JsonArgumentValue[] | {
    [key: string]: JsonArgumentValue;
};

/**
 * From https://github.com/sindresorhus/type-fest/
 * Matches a JSON array.
 */
export declare interface JsonArray extends Array<JsonValue> {
}

export declare type JsonBatchQuery = {
    batch: JsonQuery[];
    transaction?: {
        isolationLevel?: IsolationLevel;
    };
};

export declare interface JsonConvertible {
    toJSON(): unknown;
}

declare type JsonFieldSelection = {
    arguments?: Record<string, JsonArgumentValue> | RawTaggedValue;
    selection: JsonSelectionSet;
};

declare class JsonNull extends NullTypesEnumValue {
    #private;
}

/**
 * From https://github.com/sindresorhus/type-fest/
 * Matches a JSON object.
 * This type can be useful to enforce some input to be JSON-compatible or as a super-type to be extended from.
 */
export declare type JsonObject = {
    [Key in string]?: JsonValue;
};

export declare type JsonQuery = {
    modelName?: string;
    action: JsonQueryAction;
    query: JsonFieldSelection;
};

declare type JsonQueryAction = 'findUnique' | 'findUniqueOrThrow' | 'findFirst' | 'findFirstOrThrow' | 'findMany' | 'createOne' | 'createMany' | 'createManyAndReturn' | 'updateOne' | 'updateMany' | 'updateManyAndReturn' | 'deleteOne' | 'deleteMany' | 'upsertOne' | 'aggregate' | 'groupBy' | 'executeRaw' | 'queryRaw' | 'runCommandRaw' | 'findRaw' | 'aggregateRaw';

declare type JsonSelectionSet = {
    $scalars?: boolean;
    $composites?: boolean;
} & {
    [fieldName: string]: boolean | JsonFieldSelection;
};

/**
 * From https://github.com/sindresorhus/type-fest/
 * Matches any valid JSON value.
 */
export declare type JsonValue = string | number | boolean | JsonObject | JsonArray | null;

export declare type JsOutputValue = null | string | number | boolean | bigint | Uint8Array | Date | Decimal | JsOutputValue[] | {
    [key: string]: JsOutputValue;
};

export declare type JsPromise<T> = Promise<T> & {};

declare type KnownErrorParams = {
    code: string;
    clientVersion: string;
    meta?: Record<string, unknown>;
    batchRequestIdx?: number;
};

/**
 * A pointer from the current {@link Span} to another span in the same trace or
 * in a different trace.
 * Few examples of Link usage.
 * 1. Batch Processing: A batch of elements may contain elements associated
 *    with one or more traces/spans. Since there can only be one parent
 *    SpanContext, Link is used to keep reference to SpanContext of all
 *    elements in the batch.
 * 2. Public Endpoint: A SpanContext in incoming client request on a public
 *    endpoint is untrusted from service provider perspective. In such case it
 *    is advisable to start a new trace with appropriate sampling decision.
 *    However, it is desirable to associate incoming SpanContext to new trace
 *    initiated on service provider side so two traces (from Client and from
 *    Service Provider) can be correlated.
 */
declare interface Link {
    /** The {@link SpanContext} of a linked span. */
    context: SpanContext;
    /** A set of {@link SpanAttributes} on the link. */
    attributes?: SpanAttributes;
    /** Count of attributes of the link that were dropped due to collection limits */
    droppedAttributesCount?: number;
}

declare type LoadedEnv = {
    message?: string;
    parsed: {
        [x: string]: string;
    };
} | undefined;

declare type LocationInFile = {
    fileName: string;
    lineNumber: number | null;
    columnNumber: number | null;
};

declare type LogDefinition = {
    level: LogLevel;
    emit: 'stdout' | 'event';
};

/**
 * Typings for the events we emit.
 *
 * @remarks
 * If this is updated, our edge runtime shim needs to be updated as well.
 */
declare type LogEmitter = {
    on<E extends EngineEventType>(event: E, listener: (event: EngineEvent<E>) => void): LogEmitter;
    emit(event: QueryEventType, payload: QueryEvent): boolean;
    emit(event: LogEventType, payload: LogEvent): boolean;
};

declare type LogEvent = {
    timestamp: Date;
    message: string;
    target: string;
};

declare type LogEventType = 'info' | 'warn' | 'error';

declare type LogLevel = 'info' | 'query' | 'warn' | 'error';

/**
 * Generates more strict variant of an enum which, unlike regular enum,
 * throws on non-existing property access. This can be useful in following situations:
 * - we have an API, that accepts both `undefined` and `SomeEnumType` as an input
 * - enum values are generated dynamically from DMMF.
 *
 * In that case, if using normal enums and no compile-time typechecking, using non-existing property
 * will result in `undefined` value being used, which will be accepted. Using strict enum
 * in this case will help to have a runtime exception, telling you that you are probably doing something wrong.
 *
 * Note: if you need to check for existence of a value in the enum you can still use either
 * `in` operator or `hasOwnProperty` function.
 *
 * @param definition
 * @returns
 */
export declare function makeStrictEnum<T extends Record<PropertyKey, string | number>>(definition: T): T;

export declare function makeTypedQueryFactory(sql: string): (...values: any[]) => TypedSql<any[], unknown>;

declare type Mappings = ReadonlyDeep_2<{
    modelOperations: ModelMapping[];
    otherOperations: {
        read: string[];
        write: string[];
    };
}>;

/**
 * Class that holds the list of all extensions, applied to particular instance,
 * as well as resolved versions of the components that need to apply on
 * different levels. Main idea of this class: avoid re-resolving as much of the
 * stuff as possible when new extensions are added while also delaying the
 * resolve until the point it is actually needed. For example, computed fields
 * of the model won't be resolved unless the model is actually queried. Neither
 * adding extensions with `client` component only cause other components to
 * recompute.
 */
declare class MergedExtensionsList {
    private head?;
    private constructor();
    static empty(): MergedExtensionsList;
    static single(extension: ExtensionArgs): MergedExtensionsList;
    isEmpty(): boolean;
    append(extension: ExtensionArgs): MergedExtensionsList;
    getAllComputedFields(dmmfModelName: string): ComputedFieldsMap | undefined;
    getAllClientExtensions(): ClientArg | undefined;
    getAllModelExtensions(dmmfModelName: string): ModelArg | undefined;
    getAllQueryCallbacks(jsModelName: string, operation: string): any;
    getAllBatchQueryCallbacks(): BatchQueryOptionsCb[];
}

export declare type MergeExtArgs<TypeMap extends TypeMapDef, ExtArgs extends Record<any, any>, Args extends Record<any, any>> = ComputeDeep<ExtArgs & Args & AllModelsToStringIndex<TypeMap, Args, 'result'> & AllModelsToStringIndex<TypeMap, Args, 'model'>>;

export declare type Metric<T> = {
    key: string;
    value: T;
    labels: Record<string, string>;
    description: string;
};

export declare type MetricHistogram = {
    buckets: MetricHistogramBucket[];
    sum: number;
    count: number;
};

export declare type MetricHistogramBucket = [maxValue: number, count: number];

export declare type Metrics = {
    counters: Metric<number>[];
    gauges: Metric<number>[];
    histograms: Metric<MetricHistogram>[];
};

export declare class MetricsClient {
    private _client;
    constructor(client: Client);
    /**
     * Returns all metrics gathered up to this point in prometheus format.
     * Result of this call can be exposed directly to prometheus scraping endpoint
     *
     * @param options
     * @returns
     */
    prometheus(options?: MetricsOptions): Promise<string>;
    /**
     * Returns all metrics gathered up to this point in prometheus format.
     *
     * @param options
     * @returns
     */
    json(options?: MetricsOptions): Promise<Metrics>;
}

declare type MetricsOptions = {
    /**
     * Labels to add to every metrics in key-value format
     */
    globalLabels?: Record<string, string>;
};

declare type MetricsOptionsCommon = {
    globalLabels?: Record<string, string>;
};

declare type MetricsOptionsJson = {
    format: 'json';
} & MetricsOptionsCommon;

declare type MetricsOptionsPrometheus = {
    format: 'prometheus';
} & MetricsOptionsCommon;

declare type MiddlewareArgsMapper<RequestArgs, MiddlewareArgs> = {
    requestArgsToMiddlewareArgs(requestArgs: RequestArgs): MiddlewareArgs;
    middlewareArgsToRequestArgs(middlewareArgs: MiddlewareArgs): RequestArgs;
};

declare class MiddlewareHandler<M extends Function> {
    private _middlewares;
    use(middleware: M): void;
    get(id: number): M | undefined;
    has(id: number): boolean;
    length(): number;
}

declare type Model = ReadonlyDeep_2<{
    name: string;
    dbName: string | null;
    schema: string | null;
    fields: Field[];
    uniqueFields: string[][];
    uniqueIndexes: uniqueIndex[];
    documentation?: string;
    primaryKey: PrimaryKey | null;
    isGenerated?: boolean;
}>;

declare enum ModelAction {
    findUnique = "findUnique",
    findUniqueOrThrow = "findUniqueOrThrow",
    findFirst = "findFirst",
    findFirstOrThrow = "findFirstOrThrow",
    findMany = "findMany",
    create = "create",
    createMany = "createMany",
    createManyAndReturn = "createManyAndReturn",
    update = "update",
    updateMany = "updateMany",
    updateManyAndReturn = "updateManyAndReturn",
    upsert = "upsert",
    delete = "delete",
    deleteMany = "deleteMany",
    groupBy = "groupBy",
    count = "count",// TODO: count does not actually exist in DMMF
    aggregate = "aggregate",
    findRaw = "findRaw",
    aggregateRaw = "aggregateRaw"
}

export declare type ModelArg = {
    [MethodName in string]: unknown;
};

export declare type ModelArgs = {
    model: {
        [ModelName in string]: ModelArg;
    };
};

export declare type ModelKey<TypeMap extends TypeMapDef, M extends PropertyKey> = M extends keyof TypeMap['model'] ? M : Capitalize<M & string>;

declare type ModelMapping = ReadonlyDeep_2<{
    model: string;
    plural: string;
    findUnique?: string | null;
    findUniqueOrThrow?: string | null;
    findFirst?: string | null;
    findFirstOrThrow?: string | null;
    findMany?: string | null;
    create?: string | null;
    createMany?: string | null;
    createManyAndReturn?: string | null;
    update?: string | null;
    updateMany?: string | null;
    updateManyAndReturn?: string | null;
    upsert?: string | null;
    delete?: string | null;
    deleteMany?: string | null;
    aggregate?: string | null;
    groupBy?: string | null;
    count?: string | null;
    findRaw?: string | null;
    aggregateRaw?: string | null;
}>;

export declare type ModelQueryOptionsCb = (args: ModelQueryOptionsCbArgs) => Promise<any>;

export declare type ModelQueryOptionsCbArgs = {
    model: string;
    operation: string;
    args: JsArgs;
    query: (args: JsArgs) => Promise<unknown>;
};

declare type MultiBatchResponse = {
    type: 'multi';
    plans: object[];
};

export declare type NameArgs = {
    name?: string;
};

export declare type Narrow<A> = {
    [K in keyof A]: A[K] extends Function ? A[K] : Narrow<A[K]>;
} | (A extends Narrowable ? A : never);

export declare type Narrowable = string | number | bigint | boolean | [];

export declare type NeverToUnknown<T> = [T] extends [never] ? unknown : T;

declare class NullTypesEnumValue extends ObjectEnumValue {
    _getNamespace(): string;
}

/**
 * Base class for unique values of object-valued enums.
 */
export declare abstract class ObjectEnumValue {
    constructor(arg?: symbol);
    abstract _getNamespace(): string;
    _getName(): string;
    toString(): string;
}

export declare const objectEnumValues: {
    classes: {
        DbNull: typeof DbNull;
        JsonNull: typeof JsonNull;
        AnyNull: typeof AnyNull;
    };
    instances: {
        DbNull: DbNull;
        JsonNull: JsonNull;
        AnyNull: AnyNull;
    };
};

declare const officialPrismaAdapters: readonly ["@prisma/adapter-planetscale", "@prisma/adapter-neon", "@prisma/adapter-libsql", "@prisma/adapter-d1", "@prisma/adapter-pg", "@prisma/adapter-pg-worker"];

export declare type Omission = Record<string, boolean | Skip>;

declare type Omit_2<T, K extends string | number | symbol> = {
    [P in keyof T as P extends K ? never : P]: T[P];
};
export { Omit_2 as Omit }

export declare type OmitValue<Omit, Key> = Key extends keyof Omit ? Omit[Key] : false;

export declare type Operation = 'findFirst' | 'findFirstOrThrow' | 'findUnique' | 'findUniqueOrThrow' | 'findMany' | 'create' | 'createMany' | 'createManyAndReturn' | 'update' | 'updateMany' | 'updateManyAndReturn' | 'upsert' | 'delete' | 'deleteMany' | 'aggregate' | 'count' | 'groupBy' | '$queryRaw' | '$executeRaw' | '$queryRawUnsafe' | '$executeRawUnsafe' | 'findRaw' | 'aggregateRaw' | '$runCommandRaw';

export declare type OperationPayload = {
    name: string;
    scalars: {
        [ScalarName in string]: unknown;
    };
    objects: {
        [ObjectName in string]: unknown;
    };
    composites: {
        [CompositeName in string]: unknown;
    };
};

export declare type Optional<O, K extends keyof any = keyof O> = {
    [P in K & keyof O]?: O[P];
} & {
    [P in Exclude<keyof O, K>]: O[P];
};

export declare type OptionalFlat<T> = {
    [K in keyof T]?: T[K];
};

export declare type OptionalKeys<O> = {
    [K in keyof O]-?: {} extends Pick_2<O, K> ? K : never;
}[keyof O];

declare type Options = {
    clientVersion: string;
};

export declare type Or<A extends 1 | 0, B extends 1 | 0> = {
    0: {
        0: 0;
        1: 1;
    };
    1: {
        0: 1;
        1: 1;
    };
}[A][B];

declare type OtherOperationMappings = ReadonlyDeep_2<{
    read: string[];
    write: string[];
}>;

declare type OutputType = ReadonlyDeep_2<{
    name: string;
    fields: SchemaField[];
}>;

declare type OutputTypeRef = TypeRef<'scalar' | 'outputObjectTypes' | 'enumTypes'>;

export declare function Param<$Type, $Value extends string>(name: $Value): Param<$Type, $Value>;

export declare type Param<out $Type, $Value extends string> = {
    readonly name: $Value;
};

export declare type PatchFlat<O1, O2> = O1 & Omit_2<O2, keyof O1>;

export declare type Path<O, P, Default = never> = O extends unknown ? P extends [infer K, ...infer R] ? K extends keyof O ? Path<O[K], R> : Default : O : never;

export declare type Payload<T, F extends Operation = never> = T extends {
    [K: symbol]: {
        types: {
            payload: any;
        };
    };
} ? T[symbol]['types']['payload'] : any;

export declare type PayloadToResult<P, O extends Record_2<any, any> = RenameAndNestPayloadKeys<P>> = {
    [K in keyof O]?: O[K][K] extends any[] ? PayloadToResult<O[K][K][number]>[] : O[K][K] extends object ? PayloadToResult<O[K][K]> : O[K][K];
};

declare type Pick_2<T, K extends string | number | symbol> = {
    [P in keyof T as P extends K ? P : never]: T[P];
};
export { Pick_2 as Pick }

declare type PrimaryKey = ReadonlyDeep_2<{
    name: string | null;
    fields: string[];
}>;

export declare class PrismaClientInitializationError extends Error {
    clientVersion: string;
    errorCode?: string;
    retryable?: boolean;
    constructor(message: string, clientVersion: string, errorCode?: string);
    get [Symbol.toStringTag](): string;
}

export declare class PrismaClientKnownRequestError extends Error implements ErrorWithBatchIndex {
    code: string;
    meta?: Record<string, unknown>;
    clientVersion: string;
    batchRequestIdx?: number;
    constructor(message: string, { code, clientVersion, meta, batchRequestIdx }: KnownErrorParams);
    get [Symbol.toStringTag](): string;
}

export declare type PrismaClientOptions = {
    /**
     * Overwrites the primary datasource url from your schema.prisma file
     */
    datasourceUrl?: string;
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale.
     */
    adapter?: SqlDriverAdapterFactory | null;
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources;
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat;
    /**
     * The default values for Transaction options
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: Transaction_2.Options;
    /**
     * @example
     * \`\`\`
     * // Defaults to stdout
     * log: ['query', 'info', 'warn']
     *
     * // Emit as events
     * log: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     * ]
     * \`\`\`
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: Array<LogLevel | LogDefinition>;
    omit?: GlobalOmitOptions;
    /**
     * @internal
     * You probably don't want to use this. \`__internal\` is used by internal tooling.
     */
    __internal?: {
        debug?: boolean;
        engine?: {
            cwd?: string;
            binaryPath?: string;
            endpoint?: string;
            allowTriggerPanic?: boolean;
        };
        /** This can be used for testing purposes */
        configOverride?: (config: GetPrismaClientConfig) => GetPrismaClientConfig;
    };
};

export declare class PrismaClientRustPanicError extends Error {
    clientVersion: string;
    constructor(message: string, clientVersion: string);
    get [Symbol.toStringTag](): string;
}

export declare class PrismaClientUnknownRequestError extends Error implements ErrorWithBatchIndex {
    clientVersion: string;
    batchRequestIdx?: number;
    constructor(message: string, { clientVersion, batchRequestIdx }: UnknownErrorParams);
    get [Symbol.toStringTag](): string;
}

export declare class PrismaClientValidationError extends Error {
    name: string;
    clientVersion: string;
    constructor(message: string, { clientVersion }: Options);
    get [Symbol.toStringTag](): string;
}

declare function prismaGraphQLToJSError({ error, user_facing_error }: RequestError, clientVersion: string, activeProvider: string): PrismaClientKnownRequestError | PrismaClientUnknownRequestError;

declare type PrismaOperationSpec<TArgs, TAction = string> = {
    args: TArgs;
    action: TAction;
    model: string;
};

export declare interface PrismaPromise<T> extends Promise<T> {
    [Symbol.toStringTag]: 'PrismaPromise';
}

/**
 * Prisma's `Promise` that is backwards-compatible. All additions on top of the
 * original `Promise` are optional so that it can be backwards-compatible.
 * @see [[createPrismaPromise]]
 */
declare interface PrismaPromise_2<TResult, TSpec extends PrismaOperationSpec<unknown> = any> extends Promise<TResult> {
    get spec(): TSpec;
    /**
     * Extension of the original `.then` function
     * @param onfulfilled same as regular promises
     * @param onrejected same as regular promises
     * @param transaction transaction options
     */
    then<R1 = TResult, R2 = never>(onfulfilled?: (value: TResult) => R1 | PromiseLike<R1>, onrejected?: (error: unknown) => R2 | PromiseLike<R2>, transaction?: PrismaPromiseTransaction): Promise<R1 | R2>;
    /**
     * Extension of the original `.catch` function
     * @param onrejected same as regular promises
     * @param transaction transaction options
     */
    catch<R = never>(onrejected?: ((reason: any) => R | PromiseLike<R>) | undefined | null, transaction?: PrismaPromiseTransaction): Promise<TResult | R>;
    /**
     * Extension of the original `.finally` function
     * @param onfinally same as regular promises
     * @param transaction transaction options
     */
    finally(onfinally?: (() => void) | undefined | null, transaction?: PrismaPromiseTransaction): Promise<TResult>;
    /**
     * Called when executing a batch of regular tx
     * @param transaction transaction options for batch tx
     */
    requestTransaction?(transaction: PrismaPromiseBatchTransaction): PromiseLike<unknown>;
}

declare type PrismaPromiseBatchTransaction = {
    kind: 'batch';
    id: number;
    isolationLevel?: IsolationLevel;
    index: number;
    lock: PromiseLike<void>;
};

declare type PrismaPromiseCallback = (transaction?: PrismaPromiseTransaction) => Promise<unknown>;

/**
 * Creates a [[PrismaPromise]]. It is Prisma's implementation of `Promise` which
 * is essentially a proxy for `Promise`. All the transaction-compatible client
 * methods return one, this allows for pre-preparing queries without executing
 * them until `.then` is called. It's the foundation of Prisma's query batching.
 * @param callback that will be wrapped within our promise implementation
 * @see [[PrismaPromise]]
 * @returns
 */
declare type PrismaPromiseFactory = <T extends PrismaOperationSpec<unknown>>(callback: PrismaPromiseCallback, op?: T) => PrismaPromise_2<unknown>;

declare type PrismaPromiseInteractiveTransaction<PayloadType = unknown> = {
    kind: 'itx';
    id: string;
    payload: PayloadType;
};

declare type PrismaPromiseTransaction<PayloadType = unknown> = PrismaPromiseBatchTransaction | PrismaPromiseInteractiveTransaction<PayloadType>;

export declare const PrivateResultType: unique symbol;

declare type Provider = 'mysql' | 'postgres' | 'sqlite';

declare namespace Public {
    export {
        validator
    }
}
export { Public }

declare namespace Public_2 {
    export {
        Args,
        Result,
        Payload,
        PrismaPromise,
        Operation,
        Exact
    }
}

declare type Query = ReadonlyDeep_2<{
    name: string;
    args: SchemaArg[];
    output: QueryOutput;
}>;

declare interface Queryable<Query, Result> extends AdapterInfo {
    /**
     * Execute a query and return its result.
     */
    queryRaw(params: Query): Promise<Result>;
    /**
     * Execute a query and return the number of affected rows.
     */
    executeRaw(params: Query): Promise<number>;
}

declare type QueryCompiler = {
    compile(request: string): string;
    compileBatch(batchRequest: string): BatchResponse;
};

declare interface QueryCompilerConstructor {
    new (options: QueryCompilerOptions): QueryCompiler;
}

declare type QueryCompilerOptions = {
    datamodel: string;
    provider: Provider;
    connectionInfo: ConnectionInfo;
};

declare type QueryEngineBatchGraphQLRequest = {
    batch: QueryEngineRequest[];
    transaction?: boolean;
    isolationLevel?: IsolationLevel;
};

declare type QueryEngineBatchRequest = QueryEngineBatchGraphQLRequest | JsonBatchQuery;

declare type QueryEngineConfig = {
    datamodel: string;
    configDir: string;
    logQueries: boolean;
    ignoreEnvVarErrors: boolean;
    datasourceOverrides: Record<string, string>;
    env: Record<string, string | undefined>;
    logLevel: QueryEngineLogLevel;
    engineProtocol: QueryEngineProtocol;
    enableTracing: boolean;
};

declare interface QueryEngineConstructor {
    new (config: QueryEngineConfig, logger: (log: string) => void, adapter?: ErrorCapturingSqlDriverAdapter): QueryEngineInstance;
}

declare type QueryEngineInstance = {
    connect(headers: string, requestId: string): Promise<void>;
    disconnect(headers: string, requestId: string): Promise<void>;
    /**
     * @param requestStr JSON.stringified `QueryEngineRequest | QueryEngineBatchRequest`
     * @param headersStr JSON.stringified `QueryEngineRequestHeaders`
     */
    query(requestStr: string, headersStr: string, transactionId: string | undefined, requestId: string): Promise<string>;
    sdlSchema?(): Promise<string>;
    startTransaction(options: string, traceHeaders: string, requestId: string): Promise<string>;
    commitTransaction(id: string, traceHeaders: string, requestId: string): Promise<string>;
    rollbackTransaction(id: string, traceHeaders: string, requestId: string): Promise<string>;
    metrics?(options: string): Promise<string>;
    applyPendingMigrations?(): Promise<void>;
    trace(requestId: string): Promise<string | null>;
};

declare type QueryEngineLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'off';

declare type QueryEngineProtocol = 'graphql' | 'json';

declare type QueryEngineRequest = {
    query: string;
    variables: Object;
};

declare type QueryEngineResultData<T> = {
    data: T;
};

declare type QueryEvent = {
    timestamp: Date;
    query: string;
    params: string;
    duration: number;
    target: string;
};

declare type QueryEventType = 'query';

declare type QueryIntrospectionBuiltinType = 'int' | 'bigint' | 'float' | 'double' | 'string' | 'enum' | 'bytes' | 'bool' | 'char' | 'decimal' | 'json' | 'xml' | 'uuid' | 'datetime' | 'date' | 'time' | 'int-array' | 'bigint-array' | 'float-array' | 'double-array' | 'string-array' | 'char-array' | 'bytes-array' | 'bool-array' | 'decimal-array' | 'json-array' | 'xml-array' | 'uuid-array' | 'datetime-array' | 'date-array' | 'time-array' | 'null' | 'unknown';

declare type QueryMiddleware = (params: QueryMiddlewareParams, next: (params: QueryMiddlewareParams) => Promise<unknown>) => Promise<unknown>;

declare type QueryMiddlewareParams = {
    /** The model this is executed on */
    model?: string;
    /** The action that is being handled */
    action: Action;
    /** TODO what is this */
    dataPath: string[];
    /** TODO what is this */
    runInTransaction: boolean;
    args?: UserArgs_2;
};

export declare type QueryOptions = {
    query: {
        [ModelName in string]: {
            [ModelAction in string]: ModelQueryOptionsCb;
        } | QueryOptionsCb;
    };
};

export declare type QueryOptionsCb = (args: QueryOptionsCbArgs) => Promise<any>;

export declare type QueryOptionsCbArgs = {
    model?: string;
    operation: string;
    args: JsArgs | RawQueryArgs;
    query: (args: JsArgs | RawQueryArgs) => Promise<unknown>;
};

declare type QueryOutput = ReadonlyDeep_2<{
    name: string;
    isRequired: boolean;
    isList: boolean;
}>;

/**
 * Create raw SQL statement.
 */
export declare function raw(value: string): Sql;

export declare type RawParameters = {
    __prismaRawParameters__: true;
    values: string;
};

export declare type RawQueryArgs = Sql | UnknownTypedSql | [query: string, ...values: RawValue[]];

declare type RawResponse = {
    columns: string[];
    types: QueryIntrospectionBuiltinType[];
    rows: unknown[][];
};

declare type RawTaggedValue = {
    $type: 'Raw';
    value: unknown;
};

/**
 * Supported value or SQL instance.
 */
export declare type RawValue = Value | Sql;

export declare type ReadonlyDeep<T> = {
    readonly [K in keyof T]: ReadonlyDeep<T[K]>;
};

declare type ReadonlyDeep_2<O> = {
    +readonly [K in keyof O]: ReadonlyDeep_2<O[K]>;
};

declare type Record_2<T extends string | number | symbol, U> = {
    [P in T]: U;
};
export { Record_2 as Record }

export declare type RenameAndNestPayloadKeys<P> = {
    [K in keyof P as K extends 'scalars' | 'objects' | 'composites' ? keyof P[K] : never]: P[K];
};

declare type RequestBatchOptions<InteractiveTransactionPayload> = {
    transaction?: TransactionOptions_3<InteractiveTransactionPayload>;
    traceparent?: string;
    numTry?: number;
    containsWrite: boolean;
    customDataProxyFetch?: CustomDataProxyFetch;
};

declare interface RequestError {
    error: string;
    user_facing_error: {
        is_panic: boolean;
        message: string;
        meta?: Record<string, unknown>;
        error_code?: string;
        batch_request_idx?: number;
    };
}

declare class RequestHandler {
    client: Client;
    dataloader: DataLoader<RequestParams>;
    private logEmitter?;
    constructor(client: Client, logEmitter?: LogEmitter);
    request(params: RequestParams): Promise<any>;
    mapQueryEngineResult({ dataPath, unpacker }: RequestParams, response: QueryEngineResultData<any>): any;
    /**
     * Handles the error and logs it, logging the error is done synchronously waiting for the event
     * handlers to finish.
     */
    handleAndLogRequestError(params: HandleErrorParams): never;
    handleRequestError({ error, clientMethod, callsite, transaction, args, modelName, globalOmit, }: HandleErrorParams): never;
    sanitizeMessage(message: any): any;
    unpack(data: unknown, dataPath: string[], unpacker?: Unpacker): any;
    get [Symbol.toStringTag](): string;
}

declare type RequestOptions<InteractiveTransactionPayload> = {
    traceparent?: string;
    numTry?: number;
    interactiveTransaction?: InteractiveTransactionOptions<InteractiveTransactionPayload>;
    isWrite: boolean;
    customDataProxyFetch?: CustomDataProxyFetch;
};

declare type RequestParams = {
    modelName?: string;
    action: Action;
    protocolQuery: JsonQuery;
    dataPath: string[];
    clientMethod: string;
    callsite?: CallSite;
    transaction?: PrismaPromiseTransaction;
    extensions: MergedExtensionsList;
    args?: any;
    headers?: Record<string, string>;
    unpacker?: Unpacker;
    otelParentCtx?: Context;
    otelChildCtx?: Context;
    globalOmit?: GlobalOmitOptions;
    customDataProxyFetch?: CustomDataProxyFetch;
};

declare type RequiredExtensionArgs = NameArgs & ResultArgs & ModelArgs & ClientArgs & QueryOptions;
export { RequiredExtensionArgs }
export { RequiredExtensionArgs as UserArgs }

export declare type RequiredKeys<O> = {
    [K in keyof O]-?: {} extends Pick_2<O, K> ? never : K;
}[keyof O];

declare function resolveDatasourceUrl({ inlineDatasources, overrideDatasources, env, clientVersion, }: {
    inlineDatasources: GetPrismaClientConfig['inlineDatasources'];
    overrideDatasources: Datasources;
    env: Record<string, string | undefined>;
    clientVersion: string;
}): string;

export declare type Result<T, A, F extends Operation> = T extends {
    [K: symbol]: {
        types: {
            payload: any;
        };
    };
} ? GetResult<T[symbol]['types']['payload'], A, F> : GetResult<{
    composites: {};
    objects: {};
    scalars: {};
    name: '';
}, {}, F>;

export declare type Result_2<T, A, F extends Operation> = Result<T, A, F>;

declare namespace Result_3 {
    export {
        Count,
        GetFindResult,
        SelectablePayloadFields,
        SelectField,
        DefaultSelection,
        UnwrapPayload,
        ApplyOmit,
        OmitValue,
        GetCountResult,
        Aggregate,
        GetAggregateResult,
        GetBatchResult,
        GetGroupByResult,
        GetResult,
        ExtractGlobalOmit
    }
}

declare type Result_4<T> = {
    map<U>(fn: (value: T) => U): Result_4<U>;
    flatMap<U>(fn: (value: T) => Result_4<U>): Result_4<U>;
} & ({
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: Error_2;
});

export declare type ResultArg = {
    [FieldName in string]: ResultFieldDefinition;
};

export declare type ResultArgs = {
    result: {
        [ModelName in string]: ResultArg;
    };
};

export declare type ResultArgsFieldCompute = (model: any) => unknown;

export declare type ResultFieldDefinition = {
    needs?: {
        [FieldName in string]: boolean;
    };
    compute: ResultArgsFieldCompute;
};

export declare type Return<T> = T extends (...args: any[]) => infer R ? R : T;

export declare type RuntimeDataModel = {
    readonly models: Record<string, RuntimeModel>;
    readonly enums: Record<string, RuntimeEnum>;
    readonly types: Record<string, RuntimeModel>;
};

declare type RuntimeEnum = Omit<DMMF_2.DatamodelEnum, 'name'>;

declare type RuntimeModel = Omit<DMMF_2.Model, 'name'>;

declare type RuntimeName = 'workerd' | 'deno' | 'netlify' | 'node' | 'bun' | 'edge-light' | '';

declare type Schema = ReadonlyDeep_2<{
    rootQueryType?: string;
    rootMutationType?: string;
    inputObjectTypes: {
        model?: InputType[];
        prisma: InputType[];
    };
    outputObjectTypes: {
        model: OutputType[];
        prisma: OutputType[];
    };
    enumTypes: {
        model?: SchemaEnum[];
        prisma: SchemaEnum[];
    };
    fieldRefTypes: {
        prisma?: FieldRefType[];
    };
}>;

declare type SchemaArg = ReadonlyDeep_2<{
    name: string;
    comment?: string;
    isNullable: boolean;
    isRequired: boolean;
    inputTypes: InputTypeRef[];
    deprecation?: Deprecation;
}>;

declare type SchemaEnum = ReadonlyDeep_2<{
    name: string;
    values: string[];
}>;

declare type SchemaField = ReadonlyDeep_2<{
    name: string;
    isNullable?: boolean;
    outputType: OutputTypeRef;
    args: SchemaArg[];
    deprecation?: Deprecation;
    documentation?: string;
}>;

export declare type Select<T, U> = T extends U ? T : never;

export declare type SelectablePayloadFields<K extends PropertyKey, O> = {
    objects: {
        [k in K]: O;
    };
} | {
    composites: {
        [k in K]: O;
    };
};

export declare type SelectField<P extends SelectablePayloadFields<any, any>, K extends PropertyKey> = P extends {
    objects: Record<K, any>;
} ? P['objects'][K] : P extends {
    composites: Record<K, any>;
} ? P['composites'][K] : never;

declare type Selection_2 = Record<string, boolean | Skip | JsArgs>;
export { Selection_2 as Selection }

export declare function serializeJsonQuery({ modelName, action, args, runtimeDataModel, extensions, callsite, clientMethod, errorFormat, clientVersion, previewFeatures, globalOmit, }: SerializeParams): JsonQuery;

declare type SerializeParams = {
    runtimeDataModel: RuntimeDataModel;
    modelName?: string;
    action: Action;
    args?: JsArgs;
    extensions?: MergedExtensionsList;
    callsite?: CallSite;
    clientMethod: string;
    clientVersion: string;
    errorFormat: ErrorFormat;
    previewFeatures: string[];
    globalOmit?: GlobalOmitOptions;
};

declare class Skip {
    constructor(param?: symbol);
    ifUndefined<T>(value: T | undefined): T | Skip;
}

export declare const skip: Skip;

declare type SortOrder = 'asc' | 'desc';

/**
 * An interface that represents a span. A span represents a single operation
 * within a trace. Examples of span might include remote procedure calls or a
 * in-process function calls to sub-components. A Trace has a single, top-level
 * "root" Span that in turn may have zero or more child Spans, which in turn
 * may have children.
 *
 * Spans are created by the {@link Tracer.startSpan} method.
 */
declare interface Span {
    /**
     * Returns the {@link SpanContext} object associated with this Span.
     *
     * Get an immutable, serializable identifier for this span that can be used
     * to create new child spans. Returned SpanContext is usable even after the
     * span ends.
     *
     * @returns the SpanContext object associated with this Span.
     */
    spanContext(): SpanContext;
    /**
     * Sets an attribute to the span.
     *
     * Sets a single Attribute with the key and value passed as arguments.
     *
     * @param key the key for this attribute.
     * @param value the value for this attribute. Setting a value null or
     *              undefined is invalid and will result in undefined behavior.
     */
    setAttribute(key: string, value: SpanAttributeValue): this;
    /**
     * Sets attributes to the span.
     *
     * @param attributes the attributes that will be added.
     *                   null or undefined attribute values
     *                   are invalid and will result in undefined behavior.
     */
    setAttributes(attributes: SpanAttributes): this;
    /**
     * Adds an event to the Span.
     *
     * @param name the name of the event.
     * @param [attributesOrStartTime] the attributes that will be added; these are
     *     associated with this event. Can be also a start time
     *     if type is {@type TimeInput} and 3rd param is undefined
     * @param [startTime] start time of the event.
     */
    addEvent(name: string, attributesOrStartTime?: SpanAttributes | TimeInput, startTime?: TimeInput): this;
    /**
     * Adds a single link to the span.
     *
     * Links added after the creation will not affect the sampling decision.
     * It is preferred span links be added at span creation.
     *
     * @param link the link to add.
     */
    addLink(link: Link): this;
    /**
     * Adds multiple links to the span.
     *
     * Links added after the creation will not affect the sampling decision.
     * It is preferred span links be added at span creation.
     *
     * @param links the links to add.
     */
    addLinks(links: Link[]): this;
    /**
     * Sets a status to the span. If used, this will override the default Span
     * status. Default is {@link SpanStatusCode.UNSET}. SetStatus overrides the value
     * of previous calls to SetStatus on the Span.
     *
     * @param status the SpanStatus to set.
     */
    setStatus(status: SpanStatus): this;
    /**
     * Updates the Span name.
     *
     * This will override the name provided via {@link Tracer.startSpan}.
     *
     * Upon this update, any sampling behavior based on Span name will depend on
     * the implementation.
     *
     * @param name the Span name.
     */
    updateName(name: string): this;
    /**
     * Marks the end of Span execution.
     *
     * Call to End of a Span MUST not have any effects on child spans. Those may
     * still be running and can be ended later.
     *
     * Do not return `this`. The Span generally should not be used after it
     * is ended so chaining is not desired in this context.
     *
     * @param [endTime] the time to set as Span's end time. If not provided,
     *     use the current time as the span's end time.
     */
    end(endTime?: TimeInput): void;
    /**
     * Returns the flag whether this span will be recorded.
     *
     * @returns true if this Span is active and recording information like events
     *     with the `AddEvent` operation and attributes using `setAttributes`.
     */
    isRecording(): boolean;
    /**
     * Sets exception as a span event
     * @param exception the exception the only accepted values are string or Error
     * @param [time] the time to set as Span's event time. If not provided,
     *     use the current time.
     */
    recordException(exception: Exception, time?: TimeInput): void;
}

/**
 * @deprecated please use {@link Attributes}
 */
declare type SpanAttributes = Attributes;

/**
 * @deprecated please use {@link AttributeValue}
 */
declare type SpanAttributeValue = AttributeValue;

declare type SpanCallback<R> = (span?: Span, context?: Context) => R;

/**
 * A SpanContext represents the portion of a {@link Span} which must be
 * serialized and propagated along side of a {@link Baggage}.
 */
declare interface SpanContext {
    /**
     * The ID of the trace that this span belongs to. It is worldwide unique
     * with practically sufficient probability by being made as 16 randomly
     * generated bytes, encoded as a 32 lowercase hex characters corresponding to
     * 128 bits.
     */
    traceId: string;
    /**
     * The ID of the Span. It is globally unique with practically sufficient
     * probability by being made as 8 randomly generated bytes, encoded as a 16
     * lowercase hex characters corresponding to 64 bits.
     */
    spanId: string;
    /**
     * Only true if the SpanContext was propagated from a remote parent.
     */
    isRemote?: boolean;
    /**
     * Trace flags to propagate.
     *
     * It is represented as 1 byte (bitmap). Bit to represent whether trace is
     * sampled or not. When set, the least significant bit documents that the
     * caller may have recorded trace data. A caller who does not record trace
     * data out-of-band leaves this flag unset.
     *
     * see {@link TraceFlags} for valid flag values.
     */
    traceFlags: number;
    /**
     * Tracing-system-specific info to propagate.
     *
     * The tracestate field value is a `list` as defined below. The `list` is a
     * series of `list-members` separated by commas `,`, and a list-member is a
     * key/value pair separated by an equals sign `=`. Spaces and horizontal tabs
     * surrounding `list-members` are ignored. There can be a maximum of 32
     * `list-members` in a `list`.
     * More Info: https://www.w3.org/TR/trace-context/#tracestate-field
     *
     * Examples:
     *     Single tracing system (generic format):
     *         tracestate: rojo=00f067aa0ba902b7
     *     Multiple tracing systems (with different formatting):
     *         tracestate: rojo=00f067aa0ba902b7,congo=t61rcWkgMzE
     */
    traceState?: TraceState;
}

declare enum SpanKind {
    /** Default value. Indicates that the span is used internally. */
    INTERNAL = 0,
    /**
     * Indicates that the span covers server-side handling of an RPC or other
     * remote request.
     */
    SERVER = 1,
    /**
     * Indicates that the span covers the client-side wrapper around an RPC or
     * other remote request.
     */
    CLIENT = 2,
    /**
     * Indicates that the span describes producer sending a message to a
     * broker. Unlike client and server, there is no direct critical path latency
     * relationship between producer and consumer spans.
     */
    PRODUCER = 3,
    /**
     * Indicates that the span describes consumer receiving a message from a
     * broker. Unlike client and server, there is no direct critical path latency
     * relationship between producer and consumer spans.
     */
    CONSUMER = 4
}

/**
 * Options needed for span creation
 */
declare interface SpanOptions {
    /**
     * The SpanKind of a span
     * @default {@link SpanKind.INTERNAL}
     */
    kind?: SpanKind;
    /** A span's attributes */
    attributes?: SpanAttributes;
    /** {@link Link}s span to other spans */
    links?: Link[];
    /** A manually specified start time for the created `Span` object. */
    startTime?: TimeInput;
    /** The new span should be a root span. (Ignore parent from context). */
    root?: boolean;
}

declare interface SpanStatus {
    /** The status code of this message. */
    code: SpanStatusCode;
    /** A developer-facing error message. */
    message?: string;
}

/**
 * An enumeration of status codes.
 */
declare enum SpanStatusCode {
    /**
     * The default status.
     */
    UNSET = 0,
    /**
     * The operation has been validated by an Application developer or
     * Operator to have completed successfully.
     */
    OK = 1,
    /**
     * The operation contains an error.
     */
    ERROR = 2
}

/**
 * A SQL instance can be nested within each other to build SQL strings.
 */
export declare class Sql {
    readonly values: Value[];
    readonly strings: string[];
    constructor(rawStrings: readonly string[], rawValues: readonly RawValue[]);
    get sql(): string;
    get statement(): string;
    get text(): string;
    inspect(): {
        sql: string;
        statement: string;
        text: string;
        values: unknown[];
    };
}

declare interface SqlDriverAdapter extends SqlQueryable {
    /**
     * Execute multiple SQL statements separated by semicolon.
     */
    executeScript(script: string): Promise<void>;
    /**
     * Start new transaction.
     */
    startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction>;
    /**
     * Optional method that returns extra connection info
     */
    getConnectionInfo?(): ConnectionInfo;
    /**
     * Dispose of the connection and release any resources.
     */
    dispose(): Promise<void>;
}

export declare interface SqlDriverAdapterFactory extends DriverAdapterFactory<SqlQuery, SqlResultSet> {
    connect(): Promise<SqlDriverAdapter>;
}

declare type SqlQuery = {
    sql: string;
    args: Array<unknown>;
    argTypes: Array<ArgType>;
};

declare interface SqlQueryable extends Queryable<SqlQuery, SqlResultSet> {
}

declare interface SqlResultSet {
    /**
     * List of column types appearing in a database query, in the same order as `columnNames`.
     * They are used within the Query Engine to convert values from JS to Quaint values.
     */
    columnTypes: Array<ColumnType>;
    /**
     * List of column names appearing in a database query, in the same order as `columnTypes`.
     */
    columnNames: Array<string>;
    /**
     * List of rows retrieved from a database query.
     * Each row is a list of values, whose length matches `columnNames` and `columnTypes`.
     */
    rows: Array<Array<unknown>>;
    /**
     * The last ID of an `INSERT` statement, if any.
     * This is required for `AUTO_INCREMENT` columns in databases based on MySQL and SQLite.
     */
    lastInsertId?: string;
}

/**
 * Create a SQL object from a template string.
 */
export declare function sqltag(strings: readonly string[], ...values: readonly RawValue[]): Sql;

/**
 * Defines TimeInput.
 *
 * hrtime, epoch milliseconds, performance.now() or Date
 */
declare type TimeInput = HrTime_2 | number | Date;

export declare type ToTuple<T> = T extends any[] ? T : [T];

declare interface TraceState {
    /**
     * Create a new TraceState which inherits from this TraceState and has the
     * given key set.
     * The new entry will always be added in the front of the list of states.
     *
     * @param key key of the TraceState entry.
     * @param value value of the TraceState entry.
     */
    set(key: string, value: string): TraceState;
    /**
     * Return a new TraceState which inherits from this TraceState but does not
     * contain the given key.
     *
     * @param key the key for the TraceState entry to be removed.
     */
    unset(key: string): TraceState;
    /**
     * Returns the value to which the specified key is mapped, or `undefined` if
     * this map contains no mapping for the key.
     *
     * @param key with which the specified value is to be associated.
     * @returns the value to which the specified key is mapped, or `undefined` if
     *     this map contains no mapping for the key.
     */
    get(key: string): string | undefined;
    /**
     * Serializes the TraceState to a `list` as defined below. The `list` is a
     * series of `list-members` separated by commas `,`, and a list-member is a
     * key/value pair separated by an equals sign `=`. Spaces and horizontal tabs
     * surrounding `list-members` are ignored. There can be a maximum of 32
     * `list-members` in a `list`.
     *
     * @returns the serialized string.
     */
    serialize(): string;
}

declare interface TracingHelper {
    isEnabled(): boolean;
    getTraceParent(context?: Context): string;
    dispatchEngineSpans(spans: EngineSpan[]): void;
    getActiveContext(): Context | undefined;
    runInChildSpan<R>(nameOrOptions: string | ExtendedSpanOptions, callback: SpanCallback<R>): R;
}

declare interface Transaction extends AdapterInfo, SqlQueryable {
    /**
     * Transaction options.
     */
    readonly options: TransactionOptions;
    /**
     * Commit the transaction.
     */
    commit(): Promise<void>;
    /**
     * Roll back the transaction.
     */
    rollback(): Promise<void>;
}

declare namespace Transaction_2 {
    export {
        TransactionOptions_2 as Options,
        InteractiveTransactionInfo,
        TransactionHeaders
    }
}

declare type TransactionHeaders = {
    traceparent?: string;
};

declare type TransactionOptions = {
    usePhantomQuery: boolean;
};

declare type TransactionOptions_2 = {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: IsolationLevel;
};

declare type TransactionOptions_3<InteractiveTransactionPayload> = {
    kind: 'itx';
    options: InteractiveTransactionOptions<InteractiveTransactionPayload>;
} | {
    kind: 'batch';
    options: BatchTransactionOptions;
};

export declare class TypedSql<Values extends readonly unknown[], Result> {
    [PrivateResultType]: Result;
    constructor(sql: string, values: Values);
    get sql(): string;
    get values(): Values;
}

export declare type TypeMapCbDef = Fn<{
    extArgs: InternalArgs;
}, TypeMapDef>;

/** Shared */
export declare type TypeMapDef = Record<any, any>;

declare type TypeRef<AllowedLocations extends FieldLocation> = {
    isList: boolean;
    type: string;
    location: AllowedLocations;
    namespace?: FieldNamespace;
};

declare namespace Types {
    export {
        Result_3 as Result,
        Extensions_2 as Extensions,
        Utils,
        Public_2 as Public,
        isSkip,
        Skip,
        skip,
        UnknownTypedSql,
        OperationPayload as Payload
    }
}
export { Types }

declare type uniqueIndex = ReadonlyDeep_2<{
    name: string;
    fields: string[];
}>;

declare type UnknownErrorParams = {
    clientVersion: string;
    batchRequestIdx?: number;
};

export declare type UnknownTypedSql = TypedSql<unknown[], unknown>;

declare type Unpacker = (data: any) => any;

export declare type UnwrapPayload<P> = {} extends P ? unknown : {
    [K in keyof P]: P[K] extends {
        scalars: infer S;
        composites: infer C;
    }[] ? Array<S & UnwrapPayload<C>> : P[K] extends {
        scalars: infer S;
        composites: infer C;
    } | null ? S & UnwrapPayload<C> | Select<P[K], null> : never;
};

export declare type UnwrapPromise<P> = P extends Promise<infer R> ? R : P;

export declare type UnwrapTuple<Tuple extends readonly unknown[]> = {
    [K in keyof Tuple]: K extends `${number}` ? Tuple[K] extends PrismaPromise<infer X> ? X : UnwrapPromise<Tuple[K]> : UnwrapPromise<Tuple[K]>;
};

/**
 * Input that flows from the user into the Client.
 */
declare type UserArgs_2 = any;

declare namespace Utils {
    export {
        EmptyToUnknown,
        NeverToUnknown,
        PatchFlat,
        Omit_2 as Omit,
        Pick_2 as Pick,
        ComputeDeep,
        Compute,
        OptionalFlat,
        ReadonlyDeep,
        Narrowable,
        Narrow,
        Exact,
        Cast,
        Record_2 as Record,
        UnwrapPromise,
        UnwrapTuple,
        Path,
        Fn,
        Call,
        RequiredKeys,
        OptionalKeys,
        Optional,
        Return,
        ToTuple,
        RenameAndNestPayloadKeys,
        PayloadToResult,
        Select,
        Equals,
        Or,
        JsPromise
    }
}

declare function validator<V>(): <S>(select: Exact<S, V>) => S;

declare function validator<C, M extends Exclude<keyof C, `$${string}`>, O extends keyof C[M] & Operation>(client: C, model: M, operation: O): <S>(select: Exact<S, Args<C[M], O>>) => S;

declare function validator<C, M extends Exclude<keyof C, `$${string}`>, O extends keyof C[M] & Operation, P extends keyof Args<C[M], O>>(client: C, model: M, operation: O, prop: P): <S>(select: Exact<S, Args<C[M], O>[P]>) => S;

/**
 * Values supported by SQL engine.
 */
export declare type Value = unknown;

export declare function warnEnvConflicts(envPaths: any): void;

export declare const warnOnce: (key: string, message: string, ...args: unknown[]) => void;

export { }
```

```ts
/* ./prisma/node_modules/.prisma/client/wasm.d.ts */
export * from "./index"```

```ts
/* ./prisma/reset.ts */
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

const prisma = new PrismaClient().$extends(withAccelerate());

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
/* ./prisma/node_modules/.prisma */
```

```ts
/* ./prisma/node_modules/.prisma/client/schema.prisma */
generator client {
  provider = "prisma-client-js"
  output   = "./node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_DATABASE_URL")
}

model Transaction {
  id          Int      @id @default(autoincrement())
  date        DateTime
  amount      Float
  type        String
  description String?
  categoryId  Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  category    Category @relation(fields: [categoryId], references: [id])
}

model Category {
  id           Int           @id @default(autoincrement())
  name         String
  type         String
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  budgets      Budget[]
  transactions Transaction[]
}

model Budget {
  id         Int      @id @default(autoincrement())
  month      String
  categoryId Int
  amount     Float
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  category   Category @relation(fields: [categoryId], references: [id])

  @@unique([month, categoryId])
}
```

```ts
/* ./prisma/schema.prisma */
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // 재호님의 환경에 맞게 (예: sqlite, mysql)
  url      = env("DATABASE_URL")
}

// --- 인증 관련 모델 ---
model Account {
  id                String  @id @default(cuid()) // ID 타입을 문자열로 변경 (cuid 또는 uuid 권장)
  userId            String  // User 모델의 ID 타입과 일치
  type              String
  provider          String  // 예: "google"
  providerAccountId String  // Google에서 제공하는 사용자 ID
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
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

