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
