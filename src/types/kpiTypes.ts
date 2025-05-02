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
