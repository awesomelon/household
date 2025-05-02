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
