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
