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
