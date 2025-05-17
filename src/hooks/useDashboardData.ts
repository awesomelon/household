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
