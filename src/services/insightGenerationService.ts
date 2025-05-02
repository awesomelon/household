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
import type { GetTransactionsQuery } from "@/lib/schemas/transactionsApiSchemas"; // 추가

// Define the response type for getTransactions based on provided structure
interface TransactionResponse {
  currentPage: number;
  totalCount: number;
  totalPages: number;
  transactions: TransactionData[];
}

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
    const MAX_PAGE_SIZE = 10000; // 충분히 큰 페이지 크기로 모든 관련 데이터를 가져오도록 설정

    const membership = await prisma.workspaceUser.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) {
      throw new ForbiddenError(
        "이 워크스페이스의 인사이트를 생성할 권한이 없습니다."
      );
    }

    try {
      // 1. 필요한 데이터 페칭 (Promise.all로 병렬 처리)
      const monthlyStatsPromise = getMonthlyStatsService(
        userId,
        workspaceId,
        month,
        true
      );
      const budgetVsActualDataPromise = getBudgetVsActualStatsService(
        userId,
        workspaceId,
        month
      );

      const recentTransactionsQuery = {
        startDate: format(
          subDays(today, HIGH_SPENDING_CHECK_DAYS - 1),
          "yyyy-MM-dd"
        ),
        endDate: format(today, "yyyy-MM-dd"),
        type: "expense" as const, // "expense"로 타입 명시
        sortBy: "date" as const,
        sortOrder: "desc" as const,
        page: 1,
        pageSize: MAX_PAGE_SIZE,
      };
      const recentTransactionsPromise: Promise<TransactionResponse> =
        getTransactions(
          userId,
          workspaceId,
          recentTransactionsQuery as GetTransactionsQuery & {
            page: number;
            pageSize: number;
          }
        );

      const currentMonthTransactionsQuery = {
        startDate: format(startOfMonth(currentMonthDate), "yyyy-MM-dd"),
        endDate: format(endOfMonth(currentMonthDate), "yyyy-MM-dd"),
        type: "expense" as const,
        page: 1,
        pageSize: MAX_PAGE_SIZE,
      };
      const currentMonthTransactionsPromise: Promise<TransactionResponse> =
        getTransactions(
          userId,
          workspaceId,
          currentMonthTransactionsQuery as GetTransactionsQuery & {
            page: number;
            pageSize: number;
          }
        );

      const previousMonthStartDate = startOfMonth(
        subDays(startOfMonth(currentMonthDate), 1)
      );
      const previousMonthEndDate = endOfMonth(previousMonthStartDate);
      const previousMonthTransactionsQuery = {
        startDate: format(previousMonthStartDate, "yyyy-MM-dd"),
        endDate: format(previousMonthEndDate, "yyyy-MM-dd"),
        type: "expense" as const,
        page: 1,
        pageSize: MAX_PAGE_SIZE,
      };
      const previousMonthTransactionsPromise: Promise<TransactionResponse> =
        getTransactions(
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
          recentTransactionsResult.transactions,
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
          currentMonthTransactionsResult.transactions,
          previousMonthTransactionsResult.transactions,
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

    const currentMonthTxMapByDescAmount = new Map<
      string,
      Map<number, TransactionData>
    >();
    currentMonthTransactions.forEach((tx) => {
      if (tx.description) {
        if (!currentMonthTxMapByDescAmount.has(tx.description)) {
          currentMonthTxMapByDescAmount.set(
            tx.description,
            new Map<number, TransactionData>()
          );
        }
        currentMonthTxMapByDescAmount.get(tx.description)!.set(tx.amount, tx);
      }
    });

    const alertedPrevTxDescriptions: Set<string> = new Set();

    for (const prevTx of previousMonthTransactions) {
      if (
        prevTx.type === "expense" &&
        prevTx.description &&
        !(!prevTx.isInstallment || prevTx.originalTransactionId) &&
        !alertedPrevTxDescriptions.has(prevTx.description)
      ) {
        const prevTxDayOfMonth = getDate(parseISO(prevTx.date));
        const expectedPaymentDateThisMonth = parseISO(
          `${currentReportMonth}-${String(prevTxDayOfMonth).padStart(2, "0")}`
        );

        if (
          differenceInDays(expectedPaymentDateThisMonth, reminderStartDate) >=
            0 &&
          differenceInDays(expectedPaymentDateThisMonth, reminderEndDate) <= 0
        ) {
          let alreadyPaidThisMonthSimilarAmount = false;
          const similarTxsMap = currentMonthTxMapByDescAmount.get(
            prevTx.description
          );
          if (similarTxsMap) {
            for (const currentTxAmount of similarTxsMap.keys()) {
              if (
                prevTx.amount > 0 &&
                (Math.abs(currentTxAmount - prevTx.amount) / prevTx.amount) *
                  100 <=
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
              severity: "info",
              title: "🔔 정기 결제 예정 알림 (추정)",
              message: `[${prevTx.description}] 항목이 ${format(
                expectedPaymentDateThisMonth,
                "M월 d일"
              )}경 결제될 것으로 예상됩니다. (지난 달 ${prevTx.amount.toLocaleString()}원 기준)`,
              detailsLink: `/dashboard/transactions?keyword=${encodeURIComponent(
                prevTx.description
              )}`,
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
